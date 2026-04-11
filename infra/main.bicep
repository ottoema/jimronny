param location string = 'westeurope'

// ─── COSMOS DB ────────────────────────────────────────────────────────────────
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: 'jimronny-db'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [{ name: 'EnableServerless' }]
    locations: [{ locationName: location, failoverPriority: 0 }]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosAccount
  name: 'jimronny'
  properties: { resource: { id: 'jimronny' } }
}

// Players — one doc per player { id, name, wins, gamesPlayed }
resource playersContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'players'
  properties: {
    resource: {
      id: 'players'
      partitionKey: { paths: ['/id'], kind: 'Hash' }
    }
  }
}

// Games — one doc per finished game (full game object with players/scores/buys)
resource gamesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'games'
  properties: {
    resource: {
      id: 'games'
      partitionKey: { paths: ['/id'], kind: 'Hash' }
    }
  }
}

// Sessions — one doc per user, stores ongoing game state
// { id: 'state', userId: email, ongoingGames: [...], activeGameId: '...' }
resource sessionsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'sessions'
  properties: {
    resource: {
      id: 'sessions'
      partitionKey: { paths: ['/userId'], kind: 'Hash' }
    }
  }
}

// ─── STATIC WEB APPS ─────────────────────────────────────────────────────────
// Provisioned without a GitHub link — the deployment token is extracted as an
// output and written to GitHub secrets by the infra workflow, then used in app.yml.
resource swa 'Microsoft.Web/staticSites@2023-01-01' = {
  name: 'jimronny'
  location: location
  sku: { name: 'Free', tier: 'Free' }
  properties: {}
}

// ─── OUTPUTS ─────────────────────────────────────────────────────────────────
#disable-next-line outputs-should-not-contain-secrets
output swaDeploymentToken string = swa.listSecrets().properties.apiKey
#disable-next-line outputs-should-not-contain-secrets
output cosmosConnectionString string = cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
output swaHostname string = swa.properties.defaultHostname
