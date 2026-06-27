# Buy with Buddies — Azure Deployment Guide

This document explains how to set up a brand-new Azure environment for this app from scratch. Follow every step in order.

---

## Architecture overview

```
GitHub (staging branch)  →  GitHub Actions  →  Azure App Service (staging)
GitHub (main branch)     →  GitHub Actions  →  Azure App Service (production)
```

Each pipeline has three jobs:

1. **Infra** — deploys `infra/main.bicep` via Azure CLI (idempotent; creates App Service Plan + App Service if missing)
2. **Build** — runs `bun run build`, uploads `.output/` as a GitHub Actions artifact
3. **Deploy** — downloads the artifact and deploys to the App Service via publish profile
4. **Smoke test** — polls the app URL for HTTP 200 for up to 3 minutes

Authentication to Azure uses **OIDC federated credentials** (no stored passwords).

---

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and logged in (`az login`)
- Access to the GitHub repository settings (to manage environments and secrets)
- Contributor access on the Azure subscription or resource groups

---

## Step 1 — Create resource groups

Resource groups must exist before the pipeline runs. The service principal only has resource-group-level Contributor access, so it cannot create them itself.

```powershell
az group create --name rg-buy-with-buddies-staging    --location westeurope
az group create --name rg-buy-with-buddies-production --location westeurope
```

---

## Step 2 — Grant the service principal access

The GitHub Actions service principal is `sp-buy-with-buddies-github`. Grant it Contributor on each resource group.

```powershell
$SP  = "0aee2dd8-7a93-4392-827f-41f90f7afc01"   # object ID of sp-buy-with-buddies-github
$SUB = "5707e73b-2322-41e0-9c40-f7fce2776462"   # subscription ID

# Staging
az role assignment create `
  --assignee-object-id $SP `
  --assignee-principal-type ServicePrincipal `
  --role "Contributor" `
  --scope "/subscriptions/$SUB/resourceGroups/rg-buy-with-buddies-staging"

# Production
az role assignment create `
  --assignee-object-id $SP `
  --assignee-principal-type ServicePrincipal `
  --role "Contributor" `
  --scope "/subscriptions/$SUB/resourceGroups/rg-buy-with-buddies-production"
```

> **Note:** If you delete and recreate a resource group, all role assignments on it are also deleted. Repeat this step after any teardown.

---

## Step 3 — Configure GitHub secrets

Go to the repository on GitHub → **Settings → Environments**.

### `staging` environment secrets

| Secret | Value |
|---|---|
| `AZURE_RESOURCE_GROUP` | `rg-buy-with-buddies-staging` |
| `AZURE_WEBAPP_NAME` | `buy-with-buddies-staging` |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | *(set in step 5 — leave empty for now)* |

### `production` environment secrets

| Secret | Value |
|---|---|
| `AZURE_RESOURCE_GROUP` | `rg-buy-with-buddies-production` |
| `AZURE_WEBAPP_NAME` | `buy-with-buddies-production` |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | *(set in step 5 — leave empty for now)* |

### Repository-level secrets (Settings → Secrets and variables → Actions)

| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | App registration client ID for `sp-buy-with-buddies-github` (`85cd44f8-0cf8-421f-bb1d-47a620011a3f`) |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | `5707e73b-2322-41e0-9c40-f7fce2776462` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

---

## Step 4 — Trigger the first deployment

Push to the relevant branch to start the pipeline:

```bash
# Deploy to staging
git push origin <your-branch>:staging

# Deploy to production
git push origin <your-branch>:main
```

What happens on the first run:
- The **Infra** job runs Bicep and creates the App Service Plan and App Service.
- The **Deploy** job **will fail** with an authentication error — this is expected because `AZURE_WEBAPP_PUBLISH_PROFILE` is not set yet.

Wait for the Infra job to complete successfully before moving to step 5.

---

## Step 5 — Fetch publish profiles and update secrets

Once the App Services exist, fetch their publish profiles:

```powershell
# Staging
az webapp deployment list-publishing-profiles `
  --resource-group rg-buy-with-buddies-staging `
  --name buy-with-buddies-staging `
  --xml | Out-File -FilePath staging-publish-profile.xml -Encoding utf8

# Production
az webapp deployment list-publishing-profiles `
  --resource-group rg-buy-with-buddies-production `
  --name buy-with-buddies-production `
  --xml | Out-File -FilePath production-publish-profile.xml -Encoding utf8
```

Open each file and copy its full XML content into the corresponding `AZURE_WEBAPP_PUBLISH_PROFILE` secret in GitHub (**Settings → Environments → [staging|production]**).

> **Important:** The publish profile changes every time the App Service is recreated (e.g. after a teardown). Always re-fetch and update the secret after any teardown.

---

## Step 6 — Re-run the failed deploy job

In GitHub → **Actions**, open the failed workflow run and click **Re-run failed jobs**. The deploy and smoke test steps should now complete successfully.

---

## Ongoing deployments

After the initial setup, deployments are fully automatic:

- Push to `staging` branch → deploys to `buy-with-buddies-staging.azurewebsites.net`
- Push to `main` branch → deploys to `buy-with-buddies-production.azurewebsites.net`

---

## Teardown

To wipe an environment completely:

```powershell
az group delete --name rg-buy-with-buddies-staging    --yes
az group delete --name rg-buy-with-buddies-production --yes
```

After deletion, repeat **steps 1–6** in full. The publish profile and role assignments are both lost when the resource group is deleted.

---

## Troubleshooting

### Deploy step fails with 401 Unauthorized
The publish profile is stale. Fetch a fresh one (step 5) and update the GitHub secret, then re-run the failed job.

### App starts but exits immediately (container exit code 0)
The build produced a Cloudflare-format handler instead of a Node.js server. This can happen if the `NITRO_PRESET` environment variable is not set during the build. Check that the workflow's build step includes `NITRO_PRESET: node-server`.

### App returns 503 after several failed start attempts
Azure blocks the site temporarily after repeated startup failures. Wait a minute, then run:
```powershell
az webapp restart --resource-group rg-buy-with-buddies-staging --name buy-with-buddies-staging
```

### AuthorizationFailed on Bicep deploy
The service principal is missing its Contributor role assignment on the resource group. Repeat step 2.

### No subscriptions found during Azure login
The service principal has no role assignments at all (can happen after a resource group delete). Repeat step 2.
