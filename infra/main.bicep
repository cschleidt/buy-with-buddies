// ============================================================
// buy-with-buddies — Azure Infrastructure
// ============================================================
// Deploys:
//   - App Service Plan (Linux)
//   - App Service (Node 20 LTS, SSR via Nitro)
//
// This template is environment-agnostic. The param files drive
// the difference between staging and production:
//   infra/main.staging.bicepparam    → rg-buy-with-buddies-staging
//   infra/main.production.bicepparam → rg-buy-with-buddies-prod
//
// Run once per environment to create, re-run any time to update (idempotent).
// The CI pipeline runs this automatically on every push to the relevant branch.
//
// Manual bootstrap (first time only, per environment):
//   az group create --name <resourceGroup> --location <location>
//   az deployment group create \
//     --resource-group <resourceGroup> \
//     --template-file infra/main.bicep \
//     --parameters infra/main.<env>.bicepparam
// ============================================================

@description('Base name for all resources. Used as the App Service hostname: <appName>.azurewebsites.net')
param appName string

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('App Service Plan SKU.')
@allowed(['F1', 'B1', 'B2', 'B3', 'P1v3', 'P2v3', 'P3v3'])
param planSku string = 'B1'

@description('Node.js runtime version.')
param nodeVersion string = 'NODE|20-lts'

// ── App Service Plan ──────────────────────────────────────────
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: 'plan-${appName}'
  location: location
  sku: {
    name: planSku
  }
  kind: 'linux'
  properties: {
    reserved: true  // Required for Linux runtime
  }
}

// ── App Service ───────────────────────────────────────────────
// Single slot per environment — staging and production are now
// separate App Services in separate resource groups.
resource appService 'Microsoft.Web/sites@2022-09-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'  // Enables Managed Identity for Key Vault etc. later
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: nodeVersion

      // Nitro node-server entry point.
      // CI deploys .output/ as the app root, so server/index.mjs is at root level.
      appCommandLine: 'node server/server.js'

      // Disable Azure's own npm install/build — CI already built the app.
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
      ]

      // Force HTTPS at the platform level
      http20Enabled: true
      minTlsVersion: '1.2'
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────
@description('App Service URL')
output appUrl string = 'https://${appService.properties.defaultHostName}'

@description('App Service name')
output appServiceName string = appService.name

@description('System-assigned Managed Identity principal ID')
output appIdentityPrincipalId string = appService.identity.principalId
