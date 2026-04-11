const { players } = require('../lib/cosmos');
const { requireAuth } = require('../lib/auth');

module.exports = async function(context, req) {
  try {
    requireAuth(req);
    const { resources } = await players().items
      .query('SELECT * FROM c')
      .fetchAll();
    context.res = { status: 200, body: { players: resources } };
  } catch(e) {
    context.res = { status: e.status || 500, body: { error: e.message } };
  }
};
