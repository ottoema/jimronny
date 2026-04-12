// Admin deletion endpoint. Requires authentication.
// Body: { type: "game"|"player"|"round", id?, gameId?, roundIndex? }
//
// - type "game":   deletes the game document and rolls back affected player win/gamesPlayed stats.
// - type "player": deletes the player document.
// - type "round":  removes one round (by index) from a game's embedded player scores/buys.
//                  If the game was finished it becomes unfinished and player stats are rolled back.
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
    context.res = { status: e.status || 500, body: { error: e.message } };
  }
};

async function deleteGame(gameId) {
  const { resource: game } = await games().item(gameId, gameId).read();
  if (!game) return; // already gone

  if (game.finished) {
    // Roll back wins and gamesPlayed for everyone who played in this game.
    const winner = [...game.players].sort((a, b) =>
      a.scores.reduce((s, x) => s + x, 0) - b.scores.reduce((s, x) => s + x, 0)
    )[0];

    await Promise.all(game.players.map(async gp => {
      try {
        const { resource: player } = await players().item(gp.name, gp.name).read();
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

  const numRounds = game.players[0]?.scores?.length ?? 0;
  if (roundIndex < 0 || roundIndex >= numRounds) {
    throw { status: 400, message: `roundIndex ${roundIndex} out of range (0–${numRounds - 1})` };
  }

  // If the game was finished, roll back affected player stats before modifying it.
  if (game.finished) {
    const winner = [...game.players].sort((a, b) =>
      a.scores.reduce((s, x) => s + x, 0) - b.scores.reduce((s, x) => s + x, 0)
    )[0];

    await Promise.all(game.players.map(async gp => {
      try {
        const { resource: player } = await players().item(gp.name, gp.name).read();
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

  // Splice out the round from every player's scores and buys.
  game.players = game.players.map(p => ({
    ...p,
    scores: p.scores.filter((_, i) => i !== roundIndex),
    buys:   (p.buys || []).filter((_, i) => i !== roundIndex),
  }));
  if (Array.isArray(game.roundWinners)) {
    game.roundWinners = game.roundWinners.filter((_, i) => i !== roundIndex);
  }

  // The game is now incomplete regardless of whether it was finished before.
  game.finished = false;
  delete game.finishedDate;
  game.currentRound = game.players[0].scores.length + 1;

  await games().item(gameId, gameId).replace(game);
}
