// Returns public configuration for the frontend.
// GOOGLE_CLIENT_ID is not a secret but is kept in env vars for maintainability.
module.exports = async function(context) {
  context.res = {
    headers: { 'Content-Type': 'application/json' },
    body: { googleClientId: process.env.GOOGLE_CLIENT_ID },
  };
};
