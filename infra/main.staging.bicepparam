// ============================================================
// Staging environment parameters
// Resource group: rg-shoppingapp
// App Service:    buy-with-buddies-staging.azurewebsites.net
// App Plan:       plan-buy-with-buddies-staging
// ============================================================

using './main.bicep'

param appName = 'buy-with-buddies-staging'

param location = 'westeurope'

param planSku = 'B1'

param nodeVersion = 'NODE|20-lts'
