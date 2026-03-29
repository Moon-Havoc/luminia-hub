const crypto = require("crypto");
const config = require("./config");

const ADMIN_COOKIE_NAME = "luminia_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const divider = part.indexOf("=");
      if (divider === -1) {
        return cookies;
      }

      const key = part.slice(0, divider).trim();
      const value = part.slice(divider + 1).trim();
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function sign(value) {
  return crypto.createHmac("sha256", config.adminSessionSecret).update(value).digest("base64url");
}

function createSession(username) {
  const payload = {
    u: username,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function decodeSession(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encoded, signature] = token.split(".", 2);
  const expected = sign(encoded);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.u || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

function getAdminUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const session = decodeSession(cookies[ADMIN_COOKIE_NAME]);
  return session ? session.u : null;
}

function cookieOptions(req, clear = false) {
  const parts = [
    `${ADMIN_COOKIE_NAME}=${clear ? "" : ""}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (clear) {
    parts.push("Max-Age=0");
  } else {
    parts.push(`Max-Age=${SESSION_TTL_SECONDS}`);
  }

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "");
  if (forwardedProto.includes("https")) {
    parts.push("Secure");
  }

  return parts;
}

function setAdminCookie(res, req, sessionValue) {
  const parts = cookieOptions(req, false);
  parts[0] = `${ADMIN_COOKIE_NAME}=${encodeURIComponent(sessionValue)}`;
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearAdminCookie(res, req) {
  res.setHeader("Set-Cookie", cookieOptions(req, true).join("; "));
}

function authenticateAdmin(username, password) {
  const cleanUsername = String(username || "").trim().toLowerCase();
  const cleanPassword = String(password || "");

  return config.adminUsers.find(
    (entry) => entry.username === cleanUsername && entry.password === cleanPassword,
  );
}

function requireAdminApi(req, res, next) {
  const adminUser = getAdminUser(req);
  if (!adminUser) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
    });
  }

  req.adminUser = adminUser;
  return next();
}

module.exports = {
  authenticateAdmin,
  clearAdminCookie,
  createSession,
  getAdminUser,
  requireAdminApi,
  setAdminCookie,
};
