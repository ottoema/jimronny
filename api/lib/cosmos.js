const { CosmosClient } = require('@azure/cosmos');

let client;
function getClient() {
  if (!client) client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
  return client;
}

const DB = 'jimronny';
const players  = () => getClient().database(DB).container('players');
const games    = () => getClient().database(DB).container('games');
const sessions = () => getClient().database(DB).container('sessions');

module.exports = { players, games, sessions };
