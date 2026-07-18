# Copilot Instructions For This Repository

This project is a Loveable-generated TanStack Start SSR app deployed to Azure App Service with Supabase as the backend.

## Always preserve

- `.lovable/` files and project metadata
- `vite.config.ts` based on `@lovable.dev/vite-tanstack-config`
- TanStack Start file-based routing in `src/routes/`
- `src/start.ts` and `src/server.ts`
- Nitro `preset: "node-server"`
- Generated file `src/routeTree.gen.ts`
- Supabase migration flow under `supabase/migrations/`

## Do not introduce

- Next.js, Remix, or `src/pages/` conventions
- Manual edits to `src/routeTree.gen.ts`
- Duplicate Vite plugins already included by Loveable
- Azure-specific application code when the change belongs in `infra/` or `.github/workflows/`
- Hardcoded secrets, internal database hosts, or service-role keys

## Preferred patterns

- Put frontend routes in `src/routes/`
- Put backend and hosting concerns in `infra/` and GitHub Actions
- Implement database changes as versioned Supabase migrations
- Use environment variables for runtime configuration
- Keep framework and deployment changes small and compatible with the current stack

## Before major changes

Check these files first:

- `.lovable/project.json`
- `vite.config.ts`
- `src/routes/README.md`
- `package.json`
- `infra/main.bicep`
- `supabase/config.toml`
