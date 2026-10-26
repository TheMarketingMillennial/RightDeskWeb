/**
 * admin-proxy.js — Netlify Function
 *
 * Secure server-side proxy for all Railway /admin/* endpoints.
 * ADMIN_TOKEN is injected here and NEVER sent to the browser.
 *
 * Routes (all require a valid signed session cookie):
 *   GET  /.netlify/functions/admin-proxy?path=/admin/firm-codes
 *   POST /.netlify/functions/admin-proxy?path=/admin/create-firm-code
 *   PATCH /.netlify/functions/admin-proxy?path=/admin/deactivate-firm-code/CODE
 *
 * Environment variables required (set in Netlify dashboard, never in code):
 *   ADMIN_TOKEN          — Bearer token for Railway /admin/* endpoints (NEVER sent to browser)
 *   ADMIN_SESSION_SECRET — same secret used in admin-auth.js to verify session cookies
 *   RAILWAY_API_BASE     — optional override, defaults to production Railway URL
 *
 * Security guarantees:
 *   1. Every request validates the signed session cookie before touching Railway
 *   2. ADMIN_TOKEN only exists in this function's process memory
 *   3. Allowed paths are whitelisted — arbitrary Railway calls are blocked
 *   4. Only GET / POST / PATCH are forwarded; all others are rejected
 *
 * SECURITY NOTE: ADMIN_TOKEN is separate from (and replaces) the old SERVER_TOKEN.
 * ADMIN_TOKEN protects only /admin/* endpoints and is never shipped in client apps.
 */

const crypto = require('crypto');
const https  = require('https');
const http   = require('http');

// ── Constants ────────────────────────────────────────────────────────────────
const COOKIE_NAME   = 'rdr_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const RAILWAY_BASE  = process.env.RAILWAY_API_BASE ||
  'https://right-desk-reports-backend-production.up.railway.app';

// Strict whitelist of paths this proxy will forward.
// Patterns use ^ anchors; CODE segment is validated separately.
const ALLOWED_PATH_PATTERNS = [
  /^\/admin\/firm-codes$/,
  /^\/admin\/create-firm-code$/,
  /^\/admin\/deactivate-firm-code\/[A-Z0-9]{1,30}$/,
];

// Allowed upstream HTTP methods
const ALLOWED_METHODS = ['GET', 'POST', 'PATCH'];

// ── Cookie parser ─────────────────────────────────────────────────────────────
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  });
  return cookies;
}

// ── Session verification ──────────────────────────────────────────────────────
/**
 * Returns true if token is a valid, unexpired, untampered session token.
 * Token format: "<sessionId>.<expiry>.<hmac>"
 */
function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string') return false;

  const lastDot = token.lastIndexOf('.');
  if (lastDot < 0) return false;

  const payload      = token.slice(0, lastDot);
  const suppliedHmac = token.slice(lastDot + 1);

  // Recompute expected HMAC
  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison
  if (suppliedHmac.length !== expectedHmac.length) return false;
  const match = crypto.timingSafeEqual(
    Buffer.from(suppliedHmac),
    Buffer.from(expectedHmac)
  );
  if (!match) return false;

  // Check expiry (second segment of payload)
  const parts  = payload.split('.');
  if (parts.length < 2) return false;
  const expiry = parseInt(parts[1], 10);
  if (isNaN(expiry) || Date.now() > expiry) return false;

  return true;
}

// ── Path validation ───────────────────────────────────────────────────────────
function isAllowedPath(path) {
  if (!path || typeof path !== 'string') return false;
  return ALLOWED_PATH_PATTERNS.some(re => re.test(path));
}

// ── Upstream HTTP request ─────────────────────────────────────────────────────
function upstreamRequest(method, url, adminToken, bodyStr) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib     = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = lib.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Upstream timeout')); });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Response helpers ──────────────────────────────────────────────────────────
function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type':  'application/json',
      'Cache-Control': 'no-store',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {

  // ── 0. Validate env vars ──────────────────────────────────────────────────
  const adminToken    = process.env.ADMIN_TOKEN;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!adminToken || !sessionSecret) {
    console.error('admin-proxy: ADMIN_TOKEN or ADMIN_SESSION_SECRET not configured');
    return json(500, { error: 'Server configuration error.' });
  }

  // ── 1. Verify session cookie ──────────────────────────────────────────────
  const cookies      = parseCookies(event.headers && event.headers.cookie);
  const sessionToken = cookies[COOKIE_NAME];

  if (!verifySessionToken(sessionToken, sessionSecret)) {
    return json(401, { error: 'Not authenticated. Please sign in.' });
  }

  // ── 2. Validate HTTP method ───────────────────────────────────────────────
  const method = (event.httpMethod || '').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return json(405, { error: `Method ${method} not allowed.` });
  }

  // ── 3. Validate and extract target path ──────────────────────────────────
  const targetPath = event.queryStringParameters && event.queryStringParameters.path;
  if (!isAllowedPath(targetPath)) {
    console.warn('admin-proxy: blocked request to path:', targetPath);
    return json(403, { error: 'Path not permitted.' });
  }

  // ── 4. Forward to Railway ────────────────────────────────────────────────
  const upstreamUrl = `${RAILWAY_BASE}${targetPath}`;
  const bodyStr     = (method === 'POST' && event.body) ? event.body : null;

  try {
    const upstream = await upstreamRequest(method, upstreamUrl, adminToken, bodyStr);

    // Pass Railway's status and body through unchanged so the browser gets
    // the same structured errors (409 conflict, 404 not found, etc.)
    return {
      statusCode: upstream.status,
      headers: {
        'Content-Type':  'application/json',
        'Cache-Control': 'no-store',
      },
      body: upstream.body,
    };

  } catch (err) {
    console.error('admin-proxy: upstream error:', err.message);
    return json(502, { error: 'Could not reach the backend. Please try again.' });
  }
};
