# Tasks: Integrity Audit Fixes

## Overview

Fix 6 critical/high-priority findings from the integrity audit: broken /api/gemma endpoint, RLS without policies, default secrets in env schema, web-vite API routing, WASM build linkage, and CI test wiring.

## Task Dependency Graph

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6
```

## Tasks

- [ ] **Task 1: Create /api/gemma endpoint**
  - **What:** Create Next.js API route at `apps/web/src/app/api/gemma/route.ts` that proxies transcript editing requests to local Gemma model via Transformers.js
  - **Files:** `apps/web/src/app/api/gemma/route.ts` (new)
  - **Done when:** POST to /api/gemma returns a response (not 404), validates input, handles model loading errors gracefully
  - **Depends on:** none

- [ ] **Task 2: Create RLS policies migration**
  - **What:** Create SQL migration that adds RLS policies for all tables: feedback (anyone can insert), users/sessions/accounts/verifications (authenticated users manage own data)
  - **Files:** `apps/web/migrations/0002_add_rls_policies.sql` (new)
  - **Done when:** Migration applies without errors, database queries succeed with RLS enabled
  - **Depends on:** Task 1

- [ ] **Task 3: Remove default secrets from env schema**
  - **What:** Remove `.default()` calls for BETTER_AUTH_SECRET, DATABASE_URL, UPSTASH_REDIS_REST_TOKEN in `apps/web/src/env/web.ts`. Add clear error messages
  - **Files:** `apps/web/src/env/web.ts`
  - **Done when:** Zod schema fails with clear error when secrets are missing, no default values for secrets
  - **Depends on:** Task 2

- [ ] **Task 4: Add Vite API proxy configuration**
  - **What:** Add server.proxy config to `apps/web-vite/vite.config.ts` to route `/api/*` requests to the Next.js dev server or Cloudflare Workers
  - **Files:** `apps/web-vite/vite.config.ts`
  - **Done when:** web-vite dev server successfully proxies /api/sounds/search and /api/feedback requests
  - **Depends on:** Task 3

- [ ] **Task 5: Fix WASM build linkage**
  - **What:** Update package.json to use workspace/file reference for opencut-wasm instead of npm version. Ensure `rust/wasm/pkg/` is gitignored
  - **Files:** `apps/web/package.json`, `apps/web-vite/package.json`, `.gitignore`
  - **Done when:** `bun run build:wasm` produces output that apps use directly, no npm dependency for local development
  - **Depends on:** Task 4

- [ ] **Task 6: Wire tests into CI**
  - **What:** Replace `echo "No tests implemented yet"` with `bun test` in `.github/workflows/bun-ci.yml`
  - **Files:** `.github/workflows/bun-ci.yml`
  - **Done when:** CI runs `bun test` and fails if tests fail
  - **Depends on:** Task 5
