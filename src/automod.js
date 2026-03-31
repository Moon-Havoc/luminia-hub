const { statements, logAction } = require("./db");

const AUTOMOD_SETTING_KEY = "automod_config";
const AUTOMOD_RULE_LABELS = {
  invites: "Invite Filter",
  links: "External Links",
  blockedWords: "Blocked Words",
  massMentions: "Mass Mentions",
  repeatMessages: "Repeat Messages",
  burstSpam: "Burst Spam",
  caps: "Caps Spam",
  repeatedChars: "Repeated Characters",
  emojiSpam: "Emoji Spam",
  lineSpam: "Line Spam",
  attachments: "Blocked Attachments",
};
const DEFAULT_AUTOMOD_CONFIG = {
  enabled: true,
  exemptRoleIds: [],
  exemptChannelIds: [],
  exemptUserIds: [],
  allowedInviteCodes: ["vFdWTQ3uKC"],
  allowedDomains: [
    "luminia-hub-production.up.railway.app",
    "luminia-hub.is-a.dev",
    "amethyst-hub.is-a.dev",
  ],
  blockedWords: [],
  blockedExtensions: ["exe", "bat", "cmd", "scr", "vbs", "jar", "msi"],
  actions: {
    deleteMessage: true,
    timeoutEnabled: true,
    timeoutMinutes: 10,
    sendPublicNotice: true,
    noticeSeconds: 15,
    logChannelId: "",
  },
  rules: {
    invites: { enabled: true },
    links: { enabled: false },
    blockedWords: { enabled: false },
    massMentions: { enabled: true, limit: 5 },
    repeatMessages: { enabled: true, limit: 3, windowSeconds: 12 },
    burstSpam: { enabled: true, limit: 6, windowSeconds: 8 },
    caps: { enabled: true, minLength: 12, ratio: 0.75 },
    repeatedChars: { enabled: true, limit: 12 },
    emojiSpam: { enabled: true, limit: 10 },
    lineSpam: { enabled: true, limit: 8 },
    attachments: { enabled: false },
  },
};

const recentMessages = new Map();
const INVITE_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([a-z0-9-]+)/gi;
const DOMAIN_PATTERN = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})(?:\/[^\s]*)?/gi;
const CUSTOM_EMOJI_PATTERN = /<a?:\w+:\d+>/g;
const UNICODE_EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;

function cloneDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_AUTOMOD_CONFIG));
}

function deepMerge(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override.slice() : base.slice();
  }

  if (base && typeof base === "object") {
    const output = { ...base };
    const source = override && typeof override === "object" ? override : {};
    Object.keys(source).forEach((key) => {
      output[key] = key in base ? deepMerge(base[key], source[key]) : source[key];
    });
    return output;
  }

  return override === undefined ? base : override;
}

function parseBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "enabled"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off", "disabled"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function parseInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, parsed));
}

function parseRatio(value, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (parsed > 1) {
    return Math.min(1, Math.max(0, parsed / 100));
  }

  return Math.min(1, Math.max(0, parsed));
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(/[\n,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeUniqueLowerList(value) {
  return [...new Set(normalizeList(value).map((entry) => entry.toLowerCase()))];
}

function normalizeAutoModConfig(input = {}) {
  const merged = deepMerge(cloneDefaultConfig(), input);

  return {
    enabled: parseBoolean(merged.enabled, DEFAULT_AUTOMOD_CONFIG.enabled),
    exemptRoleIds: [...new Set(normalizeList(merged.exemptRoleIds))],
    exemptChannelIds: [...new Set(normalizeList(merged.exemptChannelIds))],
    exemptUserIds: [...new Set(normalizeList(merged.exemptUserIds))],
    allowedInviteCodes: normalizeUniqueLowerList(merged.allowedInviteCodes),
    allowedDomains: normalizeUniqueLowerList(merged.allowedDomains),
    blockedWords: normalizeUniqueLowerList(merged.blockedWords),
    blockedExtensions: normalizeUniqueLowerList(merged.blockedExtensions),
    actions: {
      deleteMessage: parseBoolean(merged.actions?.deleteMessage, DEFAULT_AUTOMOD_CONFIG.actions.deleteMessage),
      timeoutEnabled: parseBoolean(merged.actions?.timeoutEnabled, DEFAULT_AUTOMOD_CONFIG.actions.timeoutEnabled),
      timeoutMinutes: parseInteger(
        merged.actions?.timeoutMinutes,
        DEFAULT_AUTOMOD_CONFIG.actions.timeoutMinutes,
        0,
        10_080,
      ),
      sendPublicNotice: parseBoolean(
        merged.actions?.sendPublicNotice,
        DEFAULT_AUTOMOD_CONFIG.actions.sendPublicNotice,
      ),
      noticeSeconds: parseInteger(
        merged.actions?.noticeSeconds,
        DEFAULT_AUTOMOD_CONFIG.actions.noticeSeconds,
        3,
        120,
      ),
      logChannelId: String(merged.actions?.logChannelId || "").trim(),
    },
    rules: {
      invites: {
        enabled: parseBoolean(merged.rules?.invites?.enabled, DEFAULT_AUTOMOD_CONFIG.rules.invites.enabled),
      },
      links: {
        enabled: parseBoolean(merged.rules?.links?.enabled, DEFAULT_AUTOMOD_CONFIG.rules.links.enabled),
      },
      blockedWords: {
        enabled: parseBoolean(
          merged.rules?.blockedWords?.enabled,
          DEFAULT_AUTOMOD_CONFIG.rules.blockedWords.enabled,
        ),
      },
      massMentions: {
        enabled: parseBoolean(
          merged.rules?.massMentions?.enabled,
          DEFAULT_AUTOMOD_CONFIG.rules.massMentions.enabled,
        ),
        limit: parseInteger(
          merged.rules?.massMentions?.limit,
          DEFAULT_AUTOMOD_CONFIG.rules.massMentions.limit,
          2,
          50,
        ),
      },
      repeatMessages: {
        enabled: parseBoolean(
          merged.rules?.repeatMessages?.enabled,
          DEFAULT_AUTOMOD_CONFIG.rules.repeatMessages.enabled,
        ),
        limit: parseInteger(
          merged.rules?.repeatMessages?.limit,
          DEFAULT_AUTOMOD_CONFIG.rules.repeatMessages.limit,
          2,
          10,
        ),
        windowSeconds: parseInteger(
          merged.rules?.repeatMessages?.windowSeconds,
          DEFAULT_AUTOMOD_CONFIG.rules.repeatMessages.windowSeconds,
          3,
          120,
        ),
      },
      burstSpam: {
        enabled: parseBoolean(
          merged.rules?.burstSpam?.enabled,
          DEFAULT_AUTOMOD_CONFIG.rules.burstSpam.enabled,
        ),
        limit: parseInteger(
          merged.rules?.burstSpam?.limit,
          DEFAULT_AUTOMOD_CONFIG.rules.burstSpam.limit,
          3,
          20,
        ),
        windowSeconds: parseInteger(
          merged.rules?.burstSpam?.windowSeconds,
          DEFAULT_AUTOMOD_CONFIG.rules.burstSpam.windowSeconds,
          3,
          120,
        ),
      },
      caps: {
        enabled: parseBoolean(merged.rules?.caps?.enabled, DEFAULT_AUTOMOD_CONFIG.rules.caps.enabled),
        minLength: parseInteger(
          merged.rules?.caps?.minLength,
          DEFAULT_AUTOMOD_CONFIG.rules.caps.minLength,
          4,
          200,
        ),
        ratio: parseRatio(merged.rules?.caps?.ratio, DEFAULT_AUTOMOD_CONFIG.rules.caps.ratio),
      },
      repeatedChars: {
        enabled: parseBoolean(
          merged.rules?.repeatedChars?.enabled,
          DEFAULT_AUTOMOD_CONFIG.rules.repeatedChars.enabled,
        ),
        limit: parseInteger(
          merged.rules?.repeatedChars?.limit,
          DEFAULT_AUTOMOD_CONFIG.rules.repeatedChars.limit,
          4,
          40,
        ),
      },
      emojiSpam: {
        enabled: parseBoolean(
          merged.rules?.emojiSpam?.enabled,
          DEFAULT_AUTOMOD_CONFIG.rules.emojiSpam.enabled,
        ),
        limit: parseInteger(
          merged.rules?.emojiSpam?.limit,
          DEFAULT_AUTOMOD_CONFIG.rules.emojiSpam.limit,
          3,
          100,
        ),
      },
      lineSpam: {
        enabled: parseBoolean(
          merged.rules?.lineSpam?.enabled,
          DEFAULT_AUTOMOD_CONFIG.rules.lineSpam.enabled,
        ),
        limit: parseInteger(
          merged.rules?.lineSpam?.limit,
          DEFAULT_AUTOMOD_CONFIG.rules.lineSpam.limit,
          3,
          50,
        ),
      },
      attachments: {
        enabled: parseBoolean(
          merged.rules?.attachments?.enabled,
          DEFAULT_AUTOMOD_CONFIG.rules.attachments.enabled,
        ),
      },
    },
  };
}

function autoModRuleLabel(ruleKey) {
  return AUTOMOD_RULE_LABELS[ruleKey] || ruleKey;
}

function getAutoModConfig() {
  const record = statements.getSystemSetting.get(AUTOMOD_SETTING_KEY);
  if (!record) {
    return normalizeAutoModConfig(cloneDefaultConfig());
  }

  try {
    return normalizeAutoModConfig(JSON.parse(record.value));
  } catch (error) {
    return normalizeAutoModConfig(cloneDefaultConfig());
  }
}

function saveAutoModConfig(updates, actor = {}) {
  const current = getAutoModConfig();
  const next = normalizeAutoModConfig(deepMerge(current, updates || {}));
  statements.upsertSystemSetting.run(AUTOMOD_SETTING_KEY, JSON.stringify(next));
  logAction({
    actorId: actor.actorId,
    actorTag: actor.actorTag,
    action: "update_automod_config",
    target: "automod",
    details: JSON.stringify({
      enabled: next.enabled,
      rules: Object.fromEntries(
        Object.entries(next.rules).map(([key, value]) => [key, value.enabled]),
      ),
    }),
  });
  return next;
}

function setValueAtPath(object, path, value) {
  const segments = path.split(".");
  let target = object;
  while (segments.length > 1) {
    const segment = segments.shift();
    if (!target[segment] || typeof target[segment] !== "object") {
      target[segment] = {};
    }
    target = target[segment];
  }
  target[segments[0]] = value;
  return object;
}

function updateAutoModValue(path, value, actor = {}) {
  const updates = setValueAtPath({}, path, value);
  return saveAutoModConfig(updates, actor);
}

function updateAutoModList(path, operation, item, actor = {}) {
  const config = getAutoModConfig();
  const segments = path.split(".");
  let source = config;
  for (const segment of segments) {
    source = source?.[segment];
  }

  const normalizedItem = String(item || "").trim();
  const normalizedValue = path.includes("allowed") || path.includes("blocked")
    ? normalizedItem.toLowerCase()
    : normalizedItem;

  const current = Array.isArray(source) ? source.slice() : [];
  let next;
  if (operation === "remove") {
    next = current.filter((entry) => String(entry) !== normalizedValue);
  } else {
    next = [...new Set([...current, normalizedValue])];
  }

  return updateAutoModValue(path, next, actor);
}

function buildAutoModPreset(name, current = getAutoModConfig()) {
  const preset = String(name || "").trim().toLowerCase();
  const base = normalizeAutoModConfig(current);

  const sharedLists = {
    exemptRoleIds: base.exemptRoleIds,
    exemptChannelIds: base.exemptChannelIds,
    exemptUserIds: base.exemptUserIds,
    allowedInviteCodes: base.allowedInviteCodes,
    allowedDomains: base.allowedDomains,
    blockedWords: base.blockedWords,
    blockedExtensions: base.blockedExtensions,
    actions: {
      logChannelId: base.actions.logChannelId,
    },
  };

  switch (preset) {
    case "strict":
      return normalizeAutoModConfig({
        ...sharedLists,
        enabled: true,
        actions: {
          ...sharedLists.actions,
          deleteMessage: true,
          timeoutEnabled: true,
          timeoutMinutes: 20,
          sendPublicNotice: true,
          noticeSeconds: 20,
        },
        rules: {
          invites: { enabled: true },
          links: { enabled: true },
          blockedWords: { enabled: true },
          massMentions: { enabled: true, limit: 4 },
          repeatMessages: { enabled: true, limit: 2, windowSeconds: 15 },
          burstSpam: { enabled: true, limit: 5, windowSeconds: 8 },
          caps: { enabled: true, minLength: 10, ratio: 0.7 },
          repeatedChars: { enabled: true, limit: 10 },
          emojiSpam: { enabled: true, limit: 8 },
          lineSpam: { enabled: true, limit: 6 },
          attachments: { enabled: true },
        },
      });
    case "relaxed":
      return normalizeAutoModConfig({
        ...sharedLists,
        enabled: true,
        actions: {
          ...sharedLists.actions,
          deleteMessage: true,
          timeoutEnabled: true,
          timeoutMinutes: 5,
          sendPublicNotice: false,
          noticeSeconds: 10,
        },
        rules: {
          invites: { enabled: true },
          links: { enabled: false },
          blockedWords: { enabled: true },
          massMentions: { enabled: true, limit: 8 },
          repeatMessages: { enabled: true, limit: 4, windowSeconds: 15 },
          burstSpam: { enabled: true, limit: 8, windowSeconds: 10 },
          caps: { enabled: false, minLength: 14, ratio: 0.82 },
          repeatedChars: { enabled: true, limit: 16 },
          emojiSpam: { enabled: true, limit: 16 },
          lineSpam: { enabled: true, limit: 12 },
          attachments: { enabled: false },
        },
      });
    case "off":
    case "disabled":
      return normalizeAutoModConfig({
        ...base,
        enabled: false,
      });
    case "balanced":
    case "default":
    default:
      return normalizeAutoModConfig({
        ...sharedLists,
        enabled: true,
        actions: {
          ...sharedLists.actions,
          deleteMessage: DEFAULT_AUTOMOD_CONFIG.actions.deleteMessage,
          timeoutEnabled: DEFAULT_AUTOMOD_CONFIG.actions.timeoutEnabled,
          timeoutMinutes: DEFAULT_AUTOMOD_CONFIG.actions.timeoutMinutes,
          sendPublicNotice: DEFAULT_AUTOMOD_CONFIG.actions.sendPublicNotice,
          noticeSeconds: DEFAULT_AUTOMOD_CONFIG.actions.noticeSeconds,
        },
        rules: cloneDefaultConfig().rules,
      });
  }
}

function applyAutoModPreset(name, actor = {}) {
  const next = buildAutoModPreset(name, getAutoModConfig());
  statements.upsertSystemSetting.run(AUTOMOD_SETTING_KEY, JSON.stringify(next));
  logAction({
    actorId: actor.actorId,
    actorTag: actor.actorTag,
    action: "apply_automod_preset",
    target: "automod",
    details: JSON.stringify({
      preset: String(name || "").trim().toLowerCase() || "balanced",
      enabled: next.enabled,
      enabledRules: listEnabledRules(next),
    }),
  });
  return next;
}

function normalizeMessageContent(content) {
  return String(content || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isExempt(message, config) {
  if (!message.member) {
    return true;
  }

  if (config.exemptUserIds.includes(message.author.id)) {
    return true;
  }

  if (config.exemptChannelIds.includes(message.channel.id)) {
    return true;
  }

  return message.member.roles.cache.some((role) => config.exemptRoleIds.includes(role.id));
}

function recordMessageHistory(userId, content, maxWindowSeconds) {
  const now = Date.now();
  const maxWindowMs = maxWindowSeconds * 1000;
  const history = (recentMessages.get(userId) || []).filter((entry) => now - entry.timestamp <= maxWindowMs);
  history.push({
    timestamp: now,
    content,
  });
  recentMessages.set(userId, history);
  return history;
}

function extractInviteCodes(content) {
  const codes = [];
  const text = String(content || "");
  for (const match of text.matchAll(INVITE_PATTERN)) {
    codes.push(String(match[1] || "").toLowerCase());
  }
  return [...new Set(codes.filter(Boolean))];
}

function extractDomains(content) {
  const domains = [];
  const text = String(content || "");
  for (const match of text.matchAll(DOMAIN_PATTERN)) {
    const domain = String(match[1] || "")
      .toLowerCase()
      .replace(/^www\./, "");
    if (domain) {
      domains.push(domain);
    }
  }
  return [...new Set(domains)];
}

function countEmoji(content) {
  const text = String(content || "");
  const customCount = (text.match(CUSTOM_EMOJI_PATTERN) || []).length;
  const unicodeCount = (text.match(UNICODE_EMOJI_PATTERN) || []).length;
  return customCount + unicodeCount;
}

function uppercaseRatio(content) {
  const letters = String(content || "").match(/[a-z]/gi) || [];
  if (!letters.length) {
    return { ratio: 0, count: 0 };
  }

  const uppercase = letters.filter((letter) => letter === letter.toUpperCase()).length;
  return {
    ratio: uppercase / letters.length,
    count: letters.length,
  };
}

function hasRepeatedChars(content, limit) {
  return new RegExp(`(.)\\1{${Math.max(1, limit - 1)},}`, "i").test(String(content || ""));
}

function evaluateAutoModMessage(message) {
  const config = getAutoModConfig();
  if (!config.enabled || isExempt(message, config)) {
    return null;
  }

  const content = String(message.content || "");
  const normalized = normalizeMessageContent(content);
  const maxWindowSeconds = Math.max(
    config.rules.repeatMessages.windowSeconds,
    config.rules.burstSpam.windowSeconds,
    1,
  );
  const history = normalized
    ? recordMessageHistory(message.author.id, normalized, maxWindowSeconds)
    : [];

  if (config.rules.invites.enabled) {
    const inviteCodes = extractInviteCodes(content);
    const blockedInvite = inviteCodes.find((code) => !config.allowedInviteCodes.includes(code));
    if (blockedInvite) {
      return {
        code: "invite_link",
        ruleLabel: "Invite Filter",
        description: "External Discord invite links are blocked.",
        evidence: blockedInvite,
        config,
      };
    }
  }

  if (config.rules.links.enabled) {
    const inviteCodes = new Set(extractInviteCodes(content));
    const domains = extractDomains(content).filter((domain) => {
      if (domain === "discord.gg" || domain.endsWith("discord.com")) {
        return inviteCodes.size === 0;
      }

      return !config.allowedDomains.some(
        (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
      );
    });

    if (domains.length) {
      return {
        code: "external_link",
        ruleLabel: "External Link Filter",
        description: "External links are blocked in this server.",
        evidence: domains[0],
        config,
      };
    }
  }

  if (config.rules.blockedWords.enabled && config.blockedWords.length) {
    const matchedWord = config.blockedWords.find((word) => normalized.includes(word));
    if (matchedWord) {
      return {
        code: "blocked_word",
        ruleLabel: "Blocked Words",
        description: "That message contains a blocked phrase.",
        evidence: matchedWord,
        config,
      };
    }
  }

  if (config.rules.massMentions.enabled) {
    const mentionCount =
      message.mentions.users.size +
      message.mentions.roles.size +
      (message.mentions.everyone ? config.rules.massMentions.limit : 0);

    if (mentionCount >= config.rules.massMentions.limit) {
      return {
        code: "mass_mentions",
        ruleLabel: "Mass Mention Filter",
        description: "Too many mentions were included in one message.",
        evidence: `${mentionCount} mentions`,
        config,
      };
    }
  }

  if (config.rules.repeatMessages.enabled && normalized) {
    const repeats = history.filter((entry) => entry.content === normalized).length;
    if (repeats >= config.rules.repeatMessages.limit) {
      return {
        code: "repeat_spam",
        ruleLabel: "Repeat Spam Filter",
        description: "Repeated duplicate messages were detected.",
        evidence: `${repeats} repeats in ${config.rules.repeatMessages.windowSeconds}s`,
        config,
      };
    }
  }

  if (config.rules.burstSpam.enabled && history.length >= config.rules.burstSpam.limit) {
    return {
      code: "burst_spam",
      ruleLabel: "Burst Spam Filter",
      description: "Too many messages were sent in a short period.",
      evidence: `${history.length} messages in ${config.rules.burstSpam.windowSeconds}s`,
      config,
    };
  }

  if (config.rules.caps.enabled) {
    const caps = uppercaseRatio(content);
    if (caps.count >= config.rules.caps.minLength && caps.ratio >= config.rules.caps.ratio) {
      return {
        code: "caps_spam",
        ruleLabel: "Caps Filter",
        description: "Too much uppercase text was detected.",
        evidence: `${Math.round(caps.ratio * 100)}% uppercase`,
        config,
      };
    }
  }

  if (config.rules.repeatedChars.enabled && hasRepeatedChars(content, config.rules.repeatedChars.limit)) {
    return {
      code: "repeated_chars",
      ruleLabel: "Repeated Character Filter",
      description: "Long repeated character spam was detected.",
      evidence: `${config.rules.repeatedChars.limit}+ repeated characters`,
      config,
    };
  }

  if (config.rules.emojiSpam.enabled) {
    const emojiCount = countEmoji(content);
    if (emojiCount >= config.rules.emojiSpam.limit) {
      return {
        code: "emoji_spam",
        ruleLabel: "Emoji Spam Filter",
        description: "Too many emojis were detected in one message.",
        evidence: `${emojiCount} emojis`,
        config,
      };
    }
  }

  if (config.rules.lineSpam.enabled) {
    const lineCount = content
      .split(/\n+/g)
      .map((line) => line.trim())
      .filter(Boolean).length;
    if (lineCount >= config.rules.lineSpam.limit) {
      return {
        code: "line_spam",
        ruleLabel: "Line Spam Filter",
        description: "Too many stacked lines were detected.",
        evidence: `${lineCount} lines`,
        config,
      };
    }
  }

  if (config.rules.attachments.enabled && message.attachments.size) {
    const blockedAttachment = [...message.attachments.values()].find((attachment) => {
      const extension = String(attachment.name || "")
        .split(".")
        .pop()
        .toLowerCase();
      return extension && config.blockedExtensions.includes(extension);
    });

    if (blockedAttachment) {
      return {
        code: "blocked_attachment",
        ruleLabel: "Attachment Filter",
        description: "That attachment type is blocked by automod.",
        evidence: blockedAttachment.name || "Unknown file",
        config,
      };
    }
  }

  return null;
}

function listEnabledRules(config) {
  return Object.entries(config.rules)
    .filter(([, rule]) => rule.enabled)
    .map(([key]) => key);
}

module.exports = {
  AUTOMOD_RULE_LABELS,
  DEFAULT_AUTOMOD_CONFIG,
  applyAutoModPreset,
  autoModRuleLabel,
  buildAutoModPreset,
  evaluateAutoModMessage,
  getAutoModConfig,
  listEnabledRules,
  normalizeAutoModConfig,
  saveAutoModConfig,
  updateAutoModList,
  updateAutoModValue,
};
