// Handles the Google OAuth authorization code callback.
// Exchanges the code for tokens server-side (client_secret never touches the browser),
// verifies the user's email against ALLOWED_EMAILS, then issues a signed JWT cookie.
const { sessionCookieHeader, signJwt } = require('../lib/auth');

module.exports = async function(context, req) {
  const code  = req.query.code;
  const error = req.query.error;

  if (error || !code) {
    context.res = { status: 302, headers: { Location: `${process.env.SPA_URL}/?auth_error=cancelled` } };
    return;
  }

  // Reconstruct the redirect_uri from the incoming request so it exactly matches
  // what the frontend sent to Google when initiating the flow.
  const host  = req.headers['x-forwarded-host'] || req.headers['host'];
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const redirectUri = `${proto}://${host}/api/authCallback`;

  try {
    // Exchange authorization code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      context.log.error('Token exchange failed:', await tokenRes.text());
      context.res = { status: 302, headers: { Location: `${process.env.SPA_URL}/?auth_error=token` } };
      return;
    }
    const { access_token } = await tokenRes.json();

    // Fetch user email from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { email } = await userRes.json();

    // Enforce allowlist
    const allowed = (process.env.ALLOWED_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase());
    if (!allowed.includes(email.toLowerCase())) {
      context.res = { status: 302, headers: { Location: `${process.env.SPA_URL}/?auth_error=forbidden` } };
      return;
    }

    // Issue a signed JWT (7 days)
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(
      { sub: email, email, iat: now, exp: now + 7 * 24 * 3600 },
      process.env.SESSION_SECRET
    );

    context.res = {
      status: 302,
      headers: {
        Location: `${process.env.SPA_URL}/`,
        'Set-Cookie': sessionCookieHeader(token),
      },
    };
  } catch(e) {
    context.log.error('Auth callback error:', e);
    context.res = { status: 302, headers: { Location: `${process.env.SPA_URL}/?auth_error=server` } };
  }
};
