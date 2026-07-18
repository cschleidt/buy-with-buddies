## Loveable App Guardrails

This folder contains a Loveable-generated TanStack Start SSR app deployed to Azure App Service with Supabase as the backend.

Use these rules whenever editing code here from Codex, Claude, Copilot, Cursor, or VS Code agents.

### Preserve Loveable Compatibility

- Keep `.lovable/` in the repo and do not rename or delete its files.
- Keep `vite.config.ts` based on `@lovable.dev/vite-tanstack-config`.
- Do not manually add duplicate Vite plugins already provided by Loveable.
- Keep the TanStack Start SSR shape intact: `src/start.ts`, `src/server.ts`, and Nitro `preset: "node-server"`.
- Do not replace TanStack Start file-based routing with Next.js, Remix, or custom router conventions.
- Do not manually edit `src/routeTree.gen.ts`; treat it as generated output.

### Routing And App Structure

- Put route files under `src/routes/`.
- Preserve `src/routes/__root.tsx` as the application shell unless a task explicitly requires changing it.
- Follow the route conventions documented in `src/routes/README.md`.
- Prefer focused changes inside existing route, lib, component, and integration folders rather than moving the app to a new structure.

### Dependency And Build Safety

- Treat these packages as framework-critical unless explicitly asked to migrate them:
  `@lovable.dev/vite-tanstack-config`, `@tanstack/react-start`, `vite`, `nitro`, `react`, `@supabase/supabase-js`.
- Do not swap package managers or lockfile strategy without an explicit request.
- Before changing build output assumptions, check both `vite.config.ts` and Azure deployment files under `infra/` and `.github/workflows/`.

### Supabase Rules

- Make schema changes through `supabase/migrations/`, not ad hoc SQL outside the migration flow.
- Keep `supabase/config.toml` and migration history aligned with the real backend.
- Do not hardcode database credentials, service-role keys, or internal hostnames in source files.
- Treat auth, RLS, and storage policies as backend concerns that must stay reproducible from versioned files.

### Azure Rules

- Keep Azure infrastructure concerns in `infra/` and GitHub Actions workflows.
- Prefer environment variables and App Service settings over platform-specific code branches.
- Do not add `web.config`, IIS assumptions, or Windows-only hosting changes to the app unless explicitly required.
- If runtime behavior depends on Azure, document it in `AZURE-DEPLOYMENT.md` or the relevant workflow comments.

### Change Workflow

1. Inspect the relevant Loveable, routing, deployment, and Supabase files before major edits.
2. Make the smallest compatible change.
3. Validate that the change does not break Loveable conventions, SSR startup, migration flow, or Azure deployment assumptions.

### High-Risk Changes That Require Explicit Approval

- Replacing TanStack Start, Vite, Nitro, or the Loveable Vite wrapper.
- Reorganizing `src/routes/` into another framework layout.
- Changing the deployment model away from Azure App Service.
- Replacing Supabase auth or schema workflow.
