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

// ─── FUNCTION APP ─────────────────────────────────────────────────────────────
// Standalone Consumption-plan Function App — avoids SWA Free tier managed
// functions which have unreliable "content distribution" during deployment.
resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'jimronnyfnstore'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: { minimumTlsVersion: 'TLS1_2', allowBlobPublicAccess: false }
}

resource funcPlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: 'jimronny-fn-plan'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  kind: 'functionapp'
}

resource funcApp 'Microsoft.Web/sites@2023-01-01' = {
  name: 'jimronny-api'
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: funcPlan.id
    siteConfig: {
      appSettings: [
        { name: 'AzureWebJobsStorage',                      value: 'DefaultEndpointsProtocol=https;AccountName=${funcStorage.name};AccountKey=${funcStorage.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING', value: 'DefaultEndpointsProtocol=https;AccountName=${funcStorage.name};AccountKey=${funcStorage.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'WEBSITE_CONTENTSHARE',                    value: 'jimronny-api' }
        { name: 'FUNCTIONS_EXTENSION_VERSION',             value: '~4' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION',            value: '~20' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE',                value: '1' }
        { name: 'COSMOS_CONNECTION_STRING',                value: cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString }
        // Secrets injected by infra.yml after provisioning
        { name: 'GOOGLE_CLIENT_ID',     value: '' }
        { name: 'GOOGLE_CLIENT_SECRET', value: '' }
        { name: 'SESSION_SECRET',       value: '' }
        { name: 'ALLOWED_EMAILS',       value: '' }
      ]
      cors: {
        allowedOrigins: [ 'https://${swa.properties.defaultHostname}' ]
        supportCredentials: true  // required for SameSite=None cross-origin cookies
      }
    }
    httpsOnly: true
  }
}

// ─── STATIC WEB APPS ─────────────────────────────────────────────────────────
// Static SPA only — API is deployed separately to the Function App above.
resource swa 'Microsoft.Web/staticSites@2023-01-01' = {
  name: 'jimronny'
  location: location
  sku: { name: 'Free', tier: 'Free' }
  properties: {}
}

// ─── OUTPUTS ─────────────────────────────────────────────────────────────────
#disable-next-line outputs-should-not-contain-secrets
output swaDeploymentToken string = swa.listSecrets().properties.apiKey
output swaHostname string = swa.properties.defaultHostName
output funcAppHostname string = funcApp.properties.defaultHostName
