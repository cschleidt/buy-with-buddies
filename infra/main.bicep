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

      // Built with NITRO_PRESET=node-server so Azure's reverse proxy can handle the
      // HTTP response without closing the stream mid-render (Cloudflare Web Streams
      // format causes AbortErrors through Azure's Kudu proxy).
      // Bun runs both node-server and cloudflare preset outputs — it supports Node.js
      // http APIs natively. Oryx moves our node_modules to _del_node_modules and
      // replaces it with a symlink; we restore it before starting so all deps are found.
      appCommandLine: '/bin/bash -c "cd /home/site/wwwroot && if [ -L node_modules ] && [ -d _del_node_modules ]; then rm -f node_modules && mv _del_node_modules node_modules && echo Restored node_modules; fi && rm -f oryx-manifest.toml node_modules.tar.gz && if [ ! -f /home/.bun/bin/bun ]; then curl -fsSL https://bun.sh/install | BUN_INSTALL=/home/.bun bash; fi && /home/.bun/bin/bun server/server.js"'

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
        {
          // Tell the Node.js process which port to bind to.
          // Azure sets PORT=8080 by default; override so Vinxi binds to 3000.
          name: 'PORT'
          value: '3000'
        }
        {
          // Tell Azure's reverse proxy to forward traffic to port 3000
          // (must match PORT above).
          name: 'WEBSITES_PORT'
          value: '3000'
        }
        {
          // Prevent Oryx from detecting bun/node and replacing our deployed
          // node_modules with a stale tar.gz from persisted /home/ storage.
          // We ship a pre-built node_modules in the zip — no overlay needed.
          name: 'WEBSITE_DISABLE_PERSISTENT_ORYX_OVERLAY'
          value: '1'
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
