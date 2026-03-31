const ACCESS_SCOPES = {
  normal: {
    scope: "normal",
    label: "Normal Access",
    keyType: "normal",
    publicPortal: true,
  },
  premium: {
    scope: "premium",
    label: "Premium Access",
    keyType: "premium",
    publicPortal: false,
    requiresDuration: true,
  },
  bb: {
    scope: "bb",
    label: "Blade Ball",
    keyType: "premium",
    publicPortal: false,
    scriptLocked: true,
  },
  sab: {
    scope: "sab",
    label: "Steal A Brainrot",
    keyType: "premium",
    publicPortal: false,
    scriptLocked: true,
  },
  arsenal: {
    scope: "arsenal",
    label: "Arsenal",
    keyType: "premium",
    publicPortal: false,
    scriptLocked: true,
  },
};

const ACCESS_SCOPE_ALIASES = {
  bladeball: "bb",
  blade_ball: "bb",
  "blade-ball": "bb",
  "blade ball": "bb",
  stealabrainrot: "sab",
  steal_a_brainrot: "sab",
  "steal a brainrot": "sab",
};

function normalizeAccessScope(value, fallback = "normal") {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (!raw) {
    return fallback;
  }

  const normalized = ACCESS_SCOPE_ALIASES[raw] || raw;
  return ACCESS_SCOPES[normalized] ? normalized : fallback;
}

function getScopeConfig(value) {
  return ACCESS_SCOPES[normalizeAccessScope(value)];
}

function isScriptScope(value) {
  return Boolean(getScopeConfig(value).scriptLocked);
}

function scopeLabel(value) {
  return getScopeConfig(value).label;
}

function keyTypeForScope(value) {
  return getScopeConfig(value).keyType;
}

function allScopeConfigs() {
  return Object.values(ACCESS_SCOPES);
}

module.exports = {
  ACCESS_SCOPES,
  allScopeConfigs,
  getScopeConfig,
  isScriptScope,
  keyTypeForScope,
  normalizeAccessScope,
  scopeLabel,
};
