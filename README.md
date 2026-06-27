# Buy with Buddies

## Deploying from Scratch

Follow these steps in order when setting up a new environment or after a full teardown.

---

### 1. Azure — Create resource groups

Resource groups must exist before the deployment pipeline runs (the service principal only has resource-group-level Contributor, not subscription-level).

```powershell
# Staging
az group create --name rg-buy-with-buddies-staging --location westeurope

# Production
az group create --name rg-buy-with-buddies-production --location westeurope
```

---

### 2. Azure — Grant the service principal Contributor access

The service principal used by GitHub Actions is `sp-buy-with-buddies-github`.

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

---

### 3. GitHub — Verify environment secrets

Go to **Settings → Environments** and confirm the following secrets are set.

**`staging` environment:**

| Secret | Value |
|---|---|
| `AZURE_RESOURCE_GROUP` | `rg-buy-with-buddies-staging` |
| `AZURE_WEBAPP_NAME` | `buy-with-buddies-staging` |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | *(set in step 5)* |

**`production` environment:**

| Secret | Value |
|---|---|
| `AZURE_RESOURCE_GROUP` | `rg-buy-with-buddies-production` |
| `AZURE_WEBAPP_NAME` | `buy-with-buddies-production` |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | *(set in step 5)* |

**Repository-level secrets** (shared by both environments):

| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | App registration client ID for `sp-buy-with-buddies-github` |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | `5707e73b-2322-41e0-9c40-f7fce2776462` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

---

### 4. GitHub — Trigger the first deployment

Push to the relevant branch to start the pipeline:

- `staging` branch → deploys to `rg-buy-with-buddies-staging`
- `main` branch → deploys to `rg-buy-with-buddies-production`

The **Infra** job runs Bicep and creates the App Service. The **Deploy** job will fail at this point because the publish profile secret is not yet set — this is expected.

---

### 5. Azure — Fetch publish profiles and update GitHub secrets

After Bicep has created the App Services, fetch the publish profiles and update the secrets.

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

Copy the contents of each file into the corresponding `AZURE_WEBAPP_PUBLISH_PROFILE` secret in GitHub (**Settings → Environments → [staging|production]**).

---

### 6. Re-run the failed deploy job

In the GitHub Actions tab, open the failed run and click **Re-run failed jobs**. The deploy and smoke test steps should now complete successfully.

---

## Pipeline overview

```
staging branch push  →  Deploy → Staging   (buy-with-buddies-staging.azurewebsites.net)
main branch push     →  Deploy → Production (buy-with-buddies-production.azurewebsites.net)
```

Each pipeline runs three jobs in sequence:

1. **Infra** — deploys `infra/main.bicep` idempotently (creates App Service Plan + App Service if they don't exist)
2. **Build** — runs `bun run build`, uploads `.output/` as a GitHub Actions artifact
3. **Deploy** — downloads the artifact and deploys to the App Service via publish profile
4. **Smoke test** — polls the app URL for HTTP 200, retrying for up to 3 minutes

## Teardown

To wipe an environment and start clean:

```powershell
# Staging
az group delete --name rg-buy-with-buddies-staging --yes

# Production
az group delete --name rg-buy-with-buddies-production --yes
```

After deletion, repeat steps 1–6 above. Note that the publish profile changes every time the App Service is recreated, so step 5 is always required after a teardown.
