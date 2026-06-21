// ============================================================
// Parameters for buy-with-buddies Azure infrastructure.
// Edit these values — do NOT edit main.bicep for env-specific config.
// ============================================================

using './main.bicep'

// Must match your Azure App Service name exactly.
// This becomes the hostname: buy-with-buddies.azurewebsites.net
param appName = 'buy-with-buddies'

// Azure region. westeurope is a sensible default for EU-based startups.
param location = 'westeurope'

// B1 supports deployment slots and is the minimum for production.
// Upgrade to P1v3 when you need more CPU/memory or auto-scaling.
param planSku = 'B1'

param nodeVersion = 'NODE|20-lts'
