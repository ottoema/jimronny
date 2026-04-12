// ─── JWT-based session auth ───────────────────────────────────────────────────
// Sessions are stateless signed JWTs stored in an HttpOnly cookie.
// No database lookup needed on every request — the signature proves authenticity.
const crypto = require('crypto');

const SESSION_COOKIE = 'jimronny_session';

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(pair => {
    const [k, ...v] = pair.trim().split('=');
    if (k) cookies[k.trim()] = v.join('=');
  });
  return cookies;
}

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function signJwt(payload, secret) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = base64url(JSON.stringify(payload));
  const sig    = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (sig !== expected) throw new Error('Invalid signature');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

function sessionCookieHeader(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=604800`;
}

function clearCookieHeader() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
}

// Throws { status, message } if not authenticated — use in every protected function.
// Accepts auth via cookie (desktop) or Authorization: Bearer header (iOS/WebKit where
// cross-site cookies are blocked by ITP).
function requireAuth(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      return verifyJwt(token, process.env.SESSION_SECRET);
    } catch(e) {
      throw { status: 401, message: e.message };
    }
  }
  const cookies = parseCookies(req.headers['cookie']);
  const token = cookies[SESSION_COOKIE];
  if (!token) throw { status: 401, message: 'No session' };
  try {
    return verifyJwt(token, process.env.SESSION_SECRET);
  } catch(e) {
    throw { status: 401, message: e.message };
  }
}

module.exports = { requireAuth, sessionCookieHeader, clearCookieHeader, parseCookies, signJwt, SESSION_COOKIE };
