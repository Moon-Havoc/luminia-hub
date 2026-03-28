const { PermissionFlagsBits } = require("discord.js");
const config = require("./config");

function hasAdminRole(member) {
  if (!member || !config.adminRoleIds.length) {
    return false;
  }
  return member.roles.cache.some((role) => config.adminRoleIds.includes(role.id));
}

function isBotAdmin(member) {
  if (!member) {
    return false;
  }
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }
  return hasAdminRole(member);
}

module.exports = {
  isBotAdmin,
};

