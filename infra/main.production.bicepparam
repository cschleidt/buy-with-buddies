// ============================================================
// Production environment parameters
// Resource group: rg-shoppingapp
// App Service:    buy-with-buddies.azurewebsites.net
// ============================================================

using './main.bicep'

param appName = 'buy-with-buddies'

param location = 'westeurope'

// B1 minimum for production (always-on, custom domains).
// Upgrade to P1v3 when you need auto-scaling or more CPU/RAM.
param planSku = 'B1'

param nodeVersion = 'NODE|20-lts'
