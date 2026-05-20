# Design: Integrity Audit Fixes

## Overview

Fix 6 critical/high-priority findings from the integrity audit: create /api/gemma endpoint, fix RLS policies, remove default secrets, fix web-vite API routing, add WASM build linkage, and wire tests into CI.

## Architecture

```
apps/web/src/
├── app/api/
│   ├── gemma/
│   │   └── route.ts                    # New: Gemma LLM API endpoint
├── env/
│   └── web.ts                          # Remove default secrets
├── db/
│   └── schema.ts                       # Keep RLS, add migration for policies
apps/web-vite/
├── vite.config.ts                      # Add API proxy configuration
rust/wasm/
└── pkg/                                # Built output (gitignored)
.github/workflows/
└── bun-ci.yml                          # Wire bun test into CI
```

## Components

### Component 1: /api/gemma Endpoint
- **Responsibility:** Proxy transcript editing requests to local Gemma model via Transformers.js
- **Approach:** Create Next.js API route that loads Gemma model on-demand (like transcription service), processes chat messages, returns structured responses
- **Interface:** POST `/api/gemma` with `{ messages: [{ role, content }], transcript: string }`
- **Dependencies:** `@huggingface/transformers` (already installed)

### Component 2: RLS Policies Migration
- **Responsibility:** Define PostgreSQL RLS policies so database operations succeed
- **Approach:** Create migration that adds permissive policies for auth tables (users can manage their own data) and public policies for feedback table
- **Interface:** SQL migration file
- **Dependencies:** Existing Drizzle schema

### Component 3: Env Schema Cleanup
- **Responsibility:** Remove default values for secrets
- **Approach:** Remove `.default()` calls for BETTER_AUTH_SECRET, DATABASE_URL, UPSTASH_REDIS_REST_TOKEN. Add clear error messages
- **Interface:** Updated Zod schema in `apps/web/src/env/web.ts`
- **Dependencies:** None

### Component 4: Web-Vite API Proxy
- **Responsibility:** Route API calls from Vite dev server to appropriate backend
- **Approach:** Add Vite server proxy config for `/api/*` routes. For production, use existing Cloudflare Worker (`workers/sounds-search/`) and create a feedback worker
- **Interface:** `vite.config.ts` server.proxy configuration
- **Dependencies:** Existing API routes in web app

### Component 5: WASM Build Linkage
- **Responsibility:** Ensure local WASM build is used by apps
- **Approach:** Update package.json to use workspace link or file reference for `opencut-wasm` instead of npm version. Add `rust/wasm/pkg/` to .gitignore
- **Interface:** Updated dependency resolution
- **Dependencies:** wasm-pack build step

### Component 6: CI Test Wiring
- **Responsibility:** Run `bun test` in CI instead of echo placeholder
- **Approach:** Replace `echo "No tests implemented yet"` with `bun test` in bun-ci.yml
- **Interface:** Updated CI workflow
- **Dependencies:** Existing test files

## Data Models

No new data models.

## Data Flow

### Gemma API Flow
```
GemmaChatPanel → POST /api/gemma → Load Gemma model → Process messages → Return response
                                      ↓ (on-demand, cached)
                              Transformers.js pipeline
```

### RLS Policy Flow
```
App query → PostgreSQL → RLS policy check → Allow/Deny
                         ↓
                  Policy: authenticated users can access own data
                  Policy: anyone can insert feedback
```

## Key Algorithms

### RLS Policies
```sql
-- Feedback: anyone can insert (no auth required)
CREATE POLICY "anyone can insert feedback" ON feedback
  FOR INSERT WITH CHECK (true);

-- Users: users can read/update their own data
CREATE POLICY "users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Sessions: users can manage their own sessions
CREATE POLICY "users can manage own sessions" ON sessions
  USING (user_id = auth.uid());
```

## Error Handling

- **Gemma endpoint:** If model fails to load, return 503 with retry-after header
- **RLS policies:** If policies block intended operations, log specific policy name that blocked
- **Env schema:** Clear error messages listing which secrets are missing

## Requirements Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| Req 1: Fix /api/gemma | Component 1 — New API route |
| Req 2: Fix RLS | Component 2 — Migration with policies |
| Req 3: Remove default secrets | Component 3 — Updated env schema |
| Req 4: Fix web-vite API routing | Component 4 — Vite proxy config |
| Req 5: Add WASM build linkage | Component 5 — Workspace dependency |
| Req 6: Wire tests into CI | Component 6 — Updated CI workflow |

## Testing Strategy

- Verify /api/gemma endpoint exists and responds (not 404)
- Verify RLS migration applies without errors
- Verify env schema fails when secrets are missing
- Verify web-vite dev server proxies /api/* correctly
- Verify `bun run build:wasm` produces usable output
- Verify CI runs `bun test` instead of echo
