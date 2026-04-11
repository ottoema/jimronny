const { sessions } = require('../lib/cosmos');
const { requireAuth } = require('../lib/auth');

module.exports = async function(context, req) {
  try {
    const user = requireAuth(req);
    const { ongoingGames, activeGameId } = req.body || {};
    await sessions().items.upsert({
      id: 'state',
      userId: user.email,
      ongoingGames: ongoingGames || [],
      activeGameId: activeGameId || null,
    });
    context.res = { status: 200, body: { ok: true } };
  } catch(e) {
    context.res = { status: e.status || 500, body: { error: e.message } };
  }
};
