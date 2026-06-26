// ============================================================
// Production environment parameters
// Resource group: rg-shoppingapp
// App Service:    buy-with-buddies-production.azurewebsites.net
// App Plan:       plan-buy-with-buddies-production
// ============================================================

using './main.bicep'

param appName = 'buy-with-buddies-production'

param location = 'westeurope'

param planSku = 'B1'

param nodeVersion = 'NODE|20-lts'
