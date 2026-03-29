const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const rootDir = path.resolve(__dirname, "..");

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function splitCsv(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAdminUsers(value) {
  return splitCsv(value)
    .map((entry) => {
      const divider = entry.indexOf(":");
      if (divider === -1) {
        return null;
      }

      const username = entry.slice(0, divider).trim().toLowerCase();
      const password = entry.slice(divider + 1).trim();
      if (!username || !password) {
        return null;
      }

      return { username, password };
    })
    .filter(Boolean);
}

const config = {
  rootDir,
  port: Number(process.env.PORT || 3000),
  databasePath: path.resolve(
    rootDir,
    process.env.DATABASE_PATH || "./data/luminia.sqlite",
  ),
  commandPrefix: process.env.COMMAND_PREFIX || "!",
  discordToken: process.env.DISCORD_TOKEN || "",
  discordClientId: process.env.DISCORD_CLIENT_ID || "",
  discordGuildId: process.env.DISCORD_GUILD_ID || "",
  adminRoleIds: splitCsv(process.env.ADMIN_ROLE_IDS),
  adminUsers: parseAdminUsers(process.env.ADMIN_USERS),
  adminSessionSecret:
    process.env.ADMIN_SESSION_SECRET || process.env.DISCORD_TOKEN || "luminia-local-admin-secret",
  siteUrl: process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`,
  required,
};

module.exports = config;
