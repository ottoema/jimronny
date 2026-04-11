const { clearCookieHeader } = require('../lib/auth');

module.exports = async function(context, req) {
  context.res = {
    status: 200,
    headers: { 'Set-Cookie': clearCookieHeader() },
    body: { ok: true },
  };
};
