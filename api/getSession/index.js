// Returns the authenticated user's ongoing game state.
// Also used by the frontend as an auth check — returns 401 if not logged in.
const { sessions } = require('../lib/cosmos');
const { requireAuth } = require('../lib/auth');

module.exports = async function(context, req) {
  try {
    const user = requireAuth(req);
    let ongoingGames = [], activeGameId = null;
    try {
      const { resource } = await sessions().item('state', user.email).read();
      if (resource) { ongoingGames = resource.ongoingGames || []; activeGameId = resource.activeGameId || null; }
    } catch(e) {
      // 404 = no game state yet, that's fine
      if (e.code !== 404) throw e;
    }
    context.res = {
      status: 200,
      body: { authenticated: true, email: user.email, ongoingGames, activeGameId },
    };
  } catch(e) {
    context.res = { status: e.status || 500, body: { error: e.message } };
  }
};
