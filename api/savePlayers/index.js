const { players } = require('../lib/cosmos');
const { requireAuth } = require('../lib/auth');

module.exports = async function(context, req) {
  try {
    requireAuth(req);
    const playersList = req.body?.players;
    if (!Array.isArray(playersList)) {
      context.res = { status: 400, body: { error: 'players array required' } };
      return;
    }
    await Promise.all(playersList.map(p => players().items.upsert(p)));
    context.res = { status: 200, body: { ok: true } };
  } catch(e) {
    context.res = { status: e.status || 500, body: { error: e.message } };
  }
};
