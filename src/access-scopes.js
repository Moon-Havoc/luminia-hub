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
  bloxfruits: {
    scope: "bloxfruits",
    label: "Blox Fruits",
    keyType: "premium",
    publicPortal: false,
    scriptLocked: true,
  },
};

const ACCESS_SCOPE_ALIASES = {
  bloxfruit: "bloxfruits",
  "blox fruit": "bloxfruits",
  "blox-fruit": "bloxfruits",
  blox_fruit: "bloxfruits",
  "blox fruits": "bloxfruits",
  "blox-fruits": "bloxfruits",
  blox_fruits: "bloxfruits",
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

function isRecognizedScope(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (!raw) {
    return false;
  }

  return Boolean(ACCESS_SCOPES[ACCESS_SCOPE_ALIASES[raw] || raw]);
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
  isRecognizedScope,
  keyTypeForScope,
  normalizeAccessScope,
  scopeLabel,
};
