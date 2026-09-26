import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { ProfileEngine, LIMITS, GITHUB_USERNAME_RE } from "./generator/lib.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try { loadEnvFile(path.join(__dirname, ".env")); } catch (err) { if (err.code !== "ENOENT") throw err; }
const DIST = path.join(__dirname, "site", "dist");
if (!fs.existsSync(path.join(DIST, "index.html"))) {
  throw new Error("Build the site first: cd site && npm run build");
}
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1"; // bind to loopback; Cloudflare Tunnel exposes it

// ---- Security headers (audit: CSP/HSTS/XCTO, section 6/13/15) ----
const BASE_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// ---- Per-IP token bucket: only *fresh* (cache-missing) lookups cost budget ----
const RATE_FRESH_PER_HOUR = Number(process.env.RATE_FRESH_PER_HOUR || 20);
const WINDOW_MS = 3600_000;
const rateBuckets = new Map(); // ip -> {hits: number[]}
function allowRate(ip, cost) {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket) { bucket = { hits: [] }; rateBuckets.set(ip, bucket); }
  bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS);
  if (bucket.hits.length + cost > RATE_FRESH_PER_HOUR) return false;
  if (cost > 0) bucket.hits.push(now);
  if (rateBuckets.size > 5000) rateBuckets.clear(); // bound memory
  return true;
}

function clientIp(req) {
  // Behind cloudflared the trusted proxy injects CF-Connecting-IP; on loopback/no-tunnel use remote addr
  const cf = req.headers["cf-connecting-ip"];
  if (cf && typeof cf === "string" && cf.length < 50) return cf;
  return req.socket.remoteAddress || "unknown";
}

// Sanitize for logging (strip control chars/newlines - audit: log injection)
function safeLog(s) {
  return String(s).replace(/[\r\n\x00-\x1f]/g, "").slice(0, 100);
}

const engine = new ProfileEngine({ token: process.env.GITHUB_TOKEN || "" });

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    ...BASE_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function handleApi(req, res, url) {
  if (req.method !== "GET") {       // audit: GET never mutates
    return sendJson(res, 405, { error: "not allowed" });
  }
  const username = url.searchParams.get("user") || "";
  const rawOffset = url.searchParams.get("offset") ?? "0";
  const offset = /^\d+$/.test(rawOffset) ? Number(rawOffset) : NaN;

  // Allow-list validation - reject outright, never silently clean (audit section 4)
  if (!GITHUB_USERNAME_RE.test(username)) {
    return sendJson(res, 400, { error: "invalid username" });
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > 400 || offset % LIMITS.MAX_REPOS_PER_PAGE !== 0) {
    return sendJson(res, 400, { error: "invalid offset" });
  }

  const ip = clientIp(req);
  const isCachedHit = (() => {
    const key = `${username.toLowerCase()}|${offset}|${LIMITS.MAX_REPOS_PER_PAGE}||`;
    const c = engine.profileCache.get(key);
    return !!(c && Date.now() - c.at < engine.cacheTtlMs);
  })();
  if (!allowRate(ip, isCachedHit ? 0 : 1)) {
    return sendJson(res, 429, { error: "too many requests - try again later" });
  }

  try {
    const profile = await engine.generateProfile({ username, offset });
    // Field allow-list path: profile objects are built server-side from fixed fields only
    return sendJson(res, 200, profile);
  } catch (err) {
    if (err && (err.status === 404 || err.status === 403 && /not found/i.test(err.message || ""))) {
      return sendJson(res, 404, { error: "no such user" });
    }
    // Generic error to client; details only in server logs (audit section 12)
    console.error(`[api] ${safeLog(username)} status=${err?.status || "?"} msg=${safeLog(err?.message || err)}`);
    return sendJson(res, 502, { error: "upstream unavailable - try again later" });
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function sendFile(res, filePath, status = 200) {
  const ext = path.extname(filePath);
  const body = fs.readFileSync(filePath);
  res.writeHead(status, {
    ...BASE_HEADERS,
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Content-Length": body.length,
    "Cache-Control": "public, max-age=3600",
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    return sendJson(res, 400, { error: "bad request" });
  }

  if (url.pathname === "/api/profile") {
    try {
      await handleApi(req, res, url);
    } catch (err) {
      console.error(`[api] unexpected: ${safeLog(err?.message || err)}`);
      if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
    }
    return;
  }

  // ---- Static files from the Astro build with traversal protection ----
  let decodedPath;
  try { decodedPath = decodeURIComponent(url.pathname); }
  catch { return sendJson(res, 400, { error: "bad path" }); }
  if (decodedPath.includes("\\") || decodedPath.includes("\0")) return sendJson(res, 400, { error: "bad path" });
  const safePath = path.posix.normalize(decodedPath);
  const candidates = [];
  if (safePath.startsWith("/profile/")) {
    candidates.push(path.join(DIST, "profile", "index.html")); // dynamic-profile shell
  } else if (safePath === "/api" || safePath === "/") {
    candidates.push(path.join(DIST, "index.html"));
  } else {
    const p = path.join(DIST, safePath);
    candidates.push(p, p + ".html", path.join(p, "index.html"));
  }
  for (const c of candidates) {
    if (!c.startsWith(DIST + path.sep)) continue; // traversal guard
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return sendFile(res, c);
  }
  return sendFile(res, path.join(DIST, "index.html"), 404);
});

server.listen(PORT, HOST, () => {
  console.log(`Portfolio Profile server on http://${HOST}:${PORT}`);
  console.log(`GitHub token: ${process.env.GITHUB_TOKEN ? "present" : "ABSENT - unauthenticated (60 req/hr shared)"}`);
});
