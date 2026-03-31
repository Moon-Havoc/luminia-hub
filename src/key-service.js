const crypto = require("crypto");
const { statements, logAction, runMaintenance } = require("./db");
const { isScriptScope, keyTypeForScope, normalizeAccessScope, scopeLabel } = require("./access-scopes");

const LIFETIME_EXPIRY = "never";

function nowIso() {
  return new Date().toISOString();
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function generateKeyValue() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  while (suffix.length < 15) {
    const byte = crypto.randomBytes(1)[0];
    suffix += alphabet[byte % alphabet.length];
  }
  return `AME_${suffix}`;
}

function normalizeName(value) {
  return String(value || "").trim();
}

function expiryFromDuration(durationMs) {
  return new Date(Date.now() + durationMs).toISOString();
}

function isExpired(record) {
  if (!record || record.expires_at === LIFETIME_EXPIRY) {
    return false;
  }

  const expiresAt = Date.parse(record.expires_at);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

function resolveExpiry({ type, scope, durationMs }) {
  if (Number.isFinite(durationMs) && durationMs > 0) {
    return expiryFromDuration(durationMs);
  }

  if (type === "normal") {
    return hoursFromNow(24);
  }

  if (isScriptScope(scope)) {
    return LIFETIME_EXPIRY;
  }

  return LIFETIME_EXPIRY;
}

function invalid(reason, reasonCode, extras = {}) {
  return {
    valid: false,
    reason,
    reasonCode,
    ...extras,
  };
}

function ensureUserRecord({ discordUserId, discordTag, robloxUser }) {
  statements.upsertUser.run({
    discord_user_id: discordUserId || null,
    discord_tag: discordTag || null,
    roblox_user: robloxUser || null,
    blacklisted: null,
    blacklist_reason: null,
  });

  if (discordUserId) {
    return statements.findUserByDiscordId.get(discordUserId);
  }
  return statements.findUserByRoblox.get(robloxUser);
}

function createOrReuseKey({
  discordUserId,
  discordTag,
  robloxUser,
  type = "normal",
  scope = "normal",
  durationMs = null,
  force = false,
  actorId,
  actorTag,
}) {
  runMaintenance();

  const cleanRobloxUser = normalizeName(robloxUser);
  const cleanScope = normalizeAccessScope(scope, type === "premium" ? "premium" : "normal");
  const resolvedType = keyTypeForScope(cleanScope) || type;

  if (!cleanRobloxUser) {
    throw new Error("Roblox username is required.");
  }

  if (discordUserId) {
    const user = ensureUserRecord({ discordUserId, discordTag, robloxUser: cleanRobloxUser });
    if (user && user.blacklisted) {
      throw new Error("This user is blacklisted and cannot receive keys.");
    }
  }

  if (!force && discordUserId) {
    const existing = statements.findActiveKey.get(discordUserId, cleanRobloxUser, resolvedType, cleanScope);
    if (existing) {
      return { record: existing, created: false };
    }
  }

  const record = {
    key: generateKeyValue(),
    discord_user_id: discordUserId || null,
    discord_tag: discordTag || null,
    roblox_user: cleanRobloxUser,
    type: resolvedType,
    scope: cleanScope,
    status: "active",
    created_at: nowIso(),
    expires_at: resolveExpiry({ type: resolvedType, scope: cleanScope, durationMs }),
  };

  statements.insertKey.run(record);
  logAction({
    actorId,
    actorTag,
    action:
      resolvedType === "premium"
        ? isScriptScope(cleanScope)
          ? "create_script_key"
          : "create_premium_key"
        : "create_normal_key",
    target: discordUserId || cleanRobloxUser,
    details: `${record.key} (${scopeLabel(cleanScope)})`,
  });

  return { record, created: true };
}

function revokeKey({ key, reason, actorId, actorTag }) {
  runMaintenance();
  const existing = statements.findKeyByValue.get(key);
  if (!existing) {
    throw new Error("Key not found.");
  }
  statements.revokeKey.run(reason || "Revoked by administrator", key);
  logAction({
    actorId,
    actorTag,
    action: "revoke_key",
    target: existing.discord_user_id || existing.roblox_user,
    details: key,
  });
  return statements.findKeyByValue.get(key);
}

function validateKey({ key, robloxUser, scope }) {
  runMaintenance();

  const cleanKey = normalizeName(key);
  const cleanRobloxUser = normalizeName(robloxUser);
  const requestedScope = normalizeName(scope)
    ? normalizeAccessScope(scope, "normal")
    : null;

  if (!cleanKey || !cleanRobloxUser) {
    throw new Error("key and robloxUser are required.");
  }

  const record = statements.findKeyByValue.get(cleanKey);
  if (!record) {
    return invalid("That key does not exist.", "key_not_found");
  }

  if (record.status === "revoked") {
    return invalid("That key has been revoked.", "key_revoked", {
      record,
    });
  }

  if (record.status === "expired" || isExpired(record)) {
    return invalid("That key has expired.", "key_expired", {
      record,
    });
  }

  if (cleanRobloxUser.toLowerCase() !== String(record.roblox_user || "").trim().toLowerCase()) {
    return invalid("That key belongs to a different Roblox username.", "roblox_mismatch", {
      record,
    });
  }

  const recordScope = normalizeAccessScope(record.scope, record.type === "premium" ? "premium" : "normal");
  if (requestedScope && recordScope !== requestedScope) {
    return invalid(
      `That key is for ${scopeLabel(recordScope)}, not ${scopeLabel(requestedScope)}.`,
      "scope_mismatch",
      {
        record,
        requiredScope: recordScope,
        requestedScope,
      },
    );
  }

  return {
    valid: true,
    record: {
      ...record,
      scope: recordScope,
    },
  };
}

function resetHwid({ discordUserId, actorId, actorTag }) {
  statements.resetHwid.run(discordUserId);
  logAction({
    actorId,
    actorTag,
    action: "reset_hwid",
    target: discordUserId,
    details: "HWID cleared",
  });
}

function setBlacklist({ discordUserId, discordTag, robloxUser, blacklisted, reason, actorId, actorTag }) {
  ensureUserRecord({ discordUserId, discordTag, robloxUser });
  statements.setBlacklist.run(blacklisted ? 1 : 0, reason || null, discordUserId);
  logAction({
    actorId,
    actorTag,
    action: blacklisted ? "blacklist_user" : "unblacklist_user",
    target: discordUserId,
    details: reason || "",
  });
  return statements.findUserByDiscordId.get(discordUserId);
}

module.exports = {
  createOrReuseKey,
  revokeKey,
  resetHwid,
  setBlacklist,
  validateKey,
};
