// Admin deletion endpoint. Requires authentication.
// Body: { type: "game"|"player"|"round", id?, gameId?, roundIndex? }
//
// - type "game":   deletes a finished game and rolls back player win/gamesPlayed stats.
// - type "player": deletes the player document.
// - type "round":  removes the LAST round from an ongoing game (finished games may not
//                  have individual rounds deleted — delete the whole game instead).
const { games, players } = require('../lib/cosmos');
const { requireAuth } = require('../lib/auth');

module.exports = async function(context, req) {
  try {
    requireAuth(req);
    const { type, id, gameId, roundIndex } = req.body || {};

    if (type === 'game') {
      if (!id) { context.res = { status: 400, body: { error: 'id required' } }; return; }
      await deleteGame(id);

    } else if (type === 'player') {
      if (!id) { context.res = { status: 400, body: { error: 'id required' } }; return; }
      await players().item(id, id).delete();

    } else if (type === 'round') {
      if (!gameId || roundIndex == null) {
        context.res = { status: 400, body: { error: 'gameId and roundIndex required' } }; return;
      }
      await deleteRound(gameId, Number(roundIndex));

    } else {
      context.res = { status: 400, body: { error: 'type must be game, player, or round' } }; return;
    }

    context.res = { status: 200, body: { ok: true } };
  } catch(e) {
    context.log.error('adminDelete error:', e);
    // Cosmos SDK uses e.statusCode; our own thrown objects use e.status.
    const status = e.status || e.statusCode || 500;
    // e.message may be undefined for non-Error throws; fall back to a string representation.
    const message = e.message || (typeof e === 'string' ? e : JSON.stringify(e)) || 'Internal error';
    context.res = { status, body: { error: message } };
  }
};

async function deleteGame(gameId) {
  const { resource: game } = await games().item(gameId, gameId).read();
  if (!game) return; // already gone

  if (game.finished) {
    // Roll back wins and gamesPlayed for everyone who played in this game.
    // Player documents use a numeric id, not the name — query by name instead
    // of doing a point-read with the wrong key.
    const winner = [...game.players].sort((a, b) =>
      a.scores.reduce((s, x) => s + x, 0) - b.scores.reduce((s, x) => s + x, 0)
    )[0];

    await Promise.all(game.players.map(async gp => {
      try {
        const { resources } = await players().items
          .query({ query: 'SELECT * FROM c WHERE c.name = @name', parameters: [{ name: '@name', value: gp.name }] })
          .fetchAll();
        const player = resources[0];
        if (!player) return;
        player.gamesPlayed = Math.max(0, (player.gamesPlayed || 0) - 1);
        if (winner && gp.name === winner.name) {
          player.wins = Math.max(0, (player.wins || 0) - 1);
        }
        await players().item(player.id, player.id).replace(player);
      } catch(e) {
        if (e.code !== 404) throw e;
      }
    }));
  }

  await games().item(gameId, gameId).delete();
}

async function deleteRound(gameId, roundIndex) {
  const { resource: game } = await games().item(gameId, gameId).read();
  if (!game) return;

  if (game.finished) {
    throw { status: 400, message: 'Cannot delete a round from a finished game — delete the whole game instead.' };
  }

  const numRounds = game.players[0]?.scores?.length ?? 0;
  if (numRounds === 0) {
    throw { status: 400, message: 'No rounds to delete.' };
  }
  if (roundIndex !== numRounds - 1) {
    throw { status: 400, message: `Only the last round (index ${numRounds - 1}) may be deleted.` };
  }

  // Remove the last round from every player's scores and buys.
  game.players = game.players.map(p => ({
    ...p,
    scores: p.scores.slice(0, -1),
    buys:   (p.buys || []).slice(0, -1),
  }));
  if (Array.isArray(game.roundWinners)) {
    game.roundWinners = game.roundWinners.slice(0, -1);
  }
  game.currentRound = game.players[0].scores.length + 1;

  await games().item(gameId, gameId).replace(game);
}
