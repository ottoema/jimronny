const { games } = require('../lib/cosmos');
const { requireAuth } = require('../lib/auth');

module.exports = async function(context, req) {
  try {
    requireAuth(req);
    const { resources } = await games().items
      .query('SELECT * FROM c ORDER BY c.date ASC')
      .fetchAll();
    context.res = { status: 200, body: { games: resources } };
  } catch(e) {
    context.res = { status: e.status || 500, body: { error: e.message } };
  }
};
