// Saves a finished game. If noteOnly=true, only updates the note field on an
// existing game document (used by the in-game note editor).
const { games, players } = require('../lib/cosmos');
const { requireAuth } = require('../lib/auth');

module.exports = async function(context, req) {
  try {
    requireAuth(req);
    const { game, updatedPlayers, noteOnly } = req.body || {};
    if (!game?.id) {
      context.res = { status: 400, body: { error: 'game.id required' } };
      return;
    }

    if (noteOnly) {
      // Patch note on existing document without overwriting the full game
      const { resource } = await games().item(game.id, game.id).read();
      resource.note = game.note ?? '';
      await games().item(game.id, game.id).replace(resource);
    } else {
      await games().items.upsert({ ...game, id: game.id });
      if (Array.isArray(updatedPlayers)) {
        await Promise.all(updatedPlayers.map(p => players().items.upsert(p)));
      }
    }

    context.res = { status: 200, body: { ok: true } };
  } catch(e) {
    context.res = { status: e.status || 500, body: { error: e.message } };
  }
};
