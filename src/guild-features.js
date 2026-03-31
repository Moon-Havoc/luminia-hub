const { statements, logAction } = require("./db");

const DEFAULT_GUILD_FEATURES = {
  verifyRoleId: "",
  unverifiedRoleId: "",
  autoRoleId: "",
  welcomeChannelId: "",
  welcomeMessage: "Welcome to {server}, {user}! You are member #{membercount}.",
};

function settingKey(guildId) {
  return `guild_features:${guildId}`;
}

function normalizeFeatures(value) {
  const clean = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    ...DEFAULT_GUILD_FEATURES,
    ...clean,
  };
}

function getGuildFeatures(guildId) {
  const row = statements.getSystemSetting.get(settingKey(guildId));
  if (!row?.value) {
    return { ...DEFAULT_GUILD_FEATURES };
  }

  try {
    return normalizeFeatures(JSON.parse(row.value));
  } catch (error) {
    return { ...DEFAULT_GUILD_FEATURES };
  }
}

function saveGuildFeatures(guildId, updates, actor = {}) {
  const current = getGuildFeatures(guildId);
  const next = normalizeFeatures({
    ...current,
    ...updates,
  });

  statements.upsertSystemSetting.run(settingKey(guildId), JSON.stringify(next));
  logAction({
    actorId: actor.actorId,
    actorTag: actor.actorTag,
    action: "guild_features_update",
    target: guildId,
    details: JSON.stringify(updates),
  });

  return next;
}

function renderWelcomeMessage(template, member) {
  const source = String(template || DEFAULT_GUILD_FEATURES.welcomeMessage);
  return source
    .replace(/\{user\}/gi, `<@${member.id}>`)
    .replace(/\{username\}/gi, member.user.username)
    .replace(/\{tag\}/gi, member.user.tag)
    .replace(/\{server\}/gi, member.guild.name)
    .replace(/\{membercount\}/gi, String(member.guild.memberCount || member.guild.members.cache.size || 0));
}

module.exports = {
  DEFAULT_GUILD_FEATURES,
  getGuildFeatures,
  renderWelcomeMessage,
  saveGuildFeatures,
};
