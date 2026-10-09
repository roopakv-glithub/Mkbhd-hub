"use strict";

const crypto = require("node:crypto");

class BackendError extends Error {
  constructor(message, statusCode, headers) {
    super(message);
    this.statusCode = statusCode;
    this.headers = headers;
  }
}

function sendJson(res, statusCode, body, headers) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  Object.entries(headers || {}).forEach(([key, value]) => res.setHeader(key, value));
  res.status(statusCode).json(body);
}

function readJsonBody(req) {
  const contentType = (req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new BackendError("Send a JSON request body.", 415);
  }
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BackendError("Invalid JSON request body.", 400);
  }
  return body;
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const requestHost = req.headers["x-forwarded-host"] || req.headers.host;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new BackendError("Invalid request origin.", 403);
  }
  if (!requestHost || originHost !== requestHost) {
    throw new BackendError("Cross-origin requests are not allowed.", 403);
  }
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new BackendError("Server storage is not configured.", 503);
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new BackendError("Server storage configuration is invalid.", 503);
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.pathname !== "/") {
    throw new BackendError("Server storage configuration is invalid.", 503);
  }
  return { url: parsedUrl.origin, key };
}

async function supabaseRequest(path, options) {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(url + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      ...(options && options.headers),
    },
  });
  if (!response.ok) {
    console.error("Supabase request failed with status", response.status);
    throw new BackendError("Server storage request failed.", 502);
  }
  const responseBody = await response.text();
  return responseBody ? JSON.parse(responseBody) : null;
}

function getCookie(req, name) {
  const cookies = (req.headers.cookie || "").split(";");
  const prefix = name + "=";
  const entry = cookies.map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : "";
}

function makeVoterCookie(req) {
  const voterToken = crypto.randomBytes(32).toString("hex");
  const secure = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
  const attributes = [
    "mkbhd_voter=" + voterToken,
    "Path=/api",
    "Max-Age=31536000",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) attributes.push("Secure");
  return { voterToken, cookie: attributes.join("; ") };
}

function expireVoterCookie(req) {
  const secure = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
  const attributes = ["mkbhd_voter=", "Path=/api", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getVoterHash(req) {
  const token = getCookie(req, "mkbhd_voter");
  if (!/^[a-f0-9]{64}$/.test(token)) return "";
  return hashToken(token);
}

function handleError(res, error) {
  if (error instanceof BackendError) {
    return sendJson(res, error.statusCode, { error: error.message }, error.headers);
  }
  console.error("API request failed:", error && error.message ? error.message : "Unknown error");
  return sendJson(res, 500, { error: "The request could not be completed." });
}

module.exports = {
  BackendError,
  assertSameOrigin,
  expireVoterCookie,
  getVoterHash,
  handleError,
  hashToken,
  makeVoterCookie,
  readJsonBody,
  sendJson,
  supabaseRequest,
};
