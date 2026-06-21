// ============================================================
// Staging environment parameters
// Resource group: rg-buy-with-buddies-staging
// App Service:    buy-with-buddies-staging.azurewebsites.net
// ============================================================

using './main.bicep'

param appName = 'buy-with-buddies-staging'

param location = 'westeurope'

// F1 (free) is fine for staging — upgrade to B1 if you need
// custom domains or always-on. B1 is required for production.
param planSku = 'F1'

param nodeVersion = 'NODE|20-lts'
