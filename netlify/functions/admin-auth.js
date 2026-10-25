/**
 * admin-auth.js — Netlify Function
 *
 * POST /.netlify/functions/admin-auth
 * Body: { "password": "..." }
 *
 * Verifies ADMIN_PASSWORD (Netlify env var).
 * On success: issues a signed HttpOnly session cookie containing an HMAC
 * of the session ID — SERVER_TOKEN is NEVER involved here or sent to the browser.
 *
 * Environment variables required (set in Netlify dashboard, never in code):
 *   ADMIN_PASSWORD  — the password administrators use to log in
 *   ADMIN_SESSION_SECRET — random 32+ char secret used to sign session tokens
 *
 * The browser never sees SERVER_TOKEN at any point.
 */

const crypto = require('crypto');

// ── Constants ────────────────────────────────────────────────────────────────
const COOKIE_NAME    = 'rdr_admin_session';
const SESSION_TTL_S  = 8 * 60 * 60; // 8 hours
const SESSION_TTL_MS = SESSION_TTL_S * 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Produce a signed session token: "<sessionId>.<expiry>.<hmac>"
 * The HMAC covers sessionId + expiry so neither can be tampered with.
 */
function createSessionToken(secret) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiry    = Date.now() + SESSION_TTL_MS;
  const payload   = `${sessionId}.${expiry}`;
  const hmac      = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `${payload}.${hmac}`;
}

function buildSetCookieHeader(token, isLogout) {
  const parts = [
    `${COOKIE_NAME}=${isLogout ? '' : encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Strict`,
    `Max-Age=${isLogout ? 0 : SESSION_TTL_S}`,
  ];
  // Netlify always serves over HTTPS in production
  if (process.env.NODE_ENV !== 'development') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // Only POST allowed
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  // Guard: env vars must be configured
  if (!adminPassword || !sessionSecret) {
    console.error('admin-auth: ADMIN_PASSWORD or ADMIN_SESSION_SECRET not set');
    return json(500, { error: 'Server configuration error. Contact the site administrator.' });
  }

  // ── Logout ──────────────────────────────────────────────────────────────────
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore */ }

  if (body.action === 'logout') {
    return json(200, { ok: true }, {
      'Set-Cookie': buildSetCookieHeader('', true),
    });
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  const { password } = body;

  if (typeof password !== 'string' || password.length === 0) {
    return json(400, { error: 'Password is required.' });
  }

  // Constant-time comparison to prevent timing attacks
  const supplied = Buffer.from(password);
  const expected = Buffer.from(adminPassword);
  const match    = supplied.length === expected.length &&
                   crypto.timingSafeEqual(supplied, expected);

  if (!match) {
    // Small fixed delay to blunt brute-force attempts
    await new Promise(r => setTimeout(r, 400));
    return json(401, { error: 'Incorrect password.' });
  }

  // Issue signed session cookie
  const token = createSessionToken(sessionSecret);
  return json(200, { ok: true }, {
    'Set-Cookie': buildSetCookieHeader(token, false),
  });
};
