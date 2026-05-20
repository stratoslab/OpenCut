# Requirements: Integrity Audit Fixes

## Introduction

Fix critical and high-priority findings from the full-system operational integrity audit. The audit identified 3 critical issues (missing auth UI, broken /api/gemma endpoint, RLS without policies) and 4 high-priority issues (dual app divergence, WASM drift, no tests, default secrets).

## Glossary

| Term | Definition |
|------|-----------|
| **RLS** | Row Level Security — PostgreSQL feature that restricts row access per user |
| **WASM drift** | Local Rust source diverging from the npm-published WASM package |
| **Dual app divergence** | `apps/web` (Next.js) and `apps/web-vite` (Vite) have different implementations |
| **GemmaChatPanel** | UI component for AI-powered transcript editing using Gemma LLM |

## Requirements

### Requirement 1: Fix /api/gemma endpoint

**User Story:** As a user editing transcripts, I want AI-powered transcript editing to work so that I can use LLM assistance for transcript changes.

#### Acceptance Criteria

1. WHEN the GemmaChatPanel sends a POST to `/api/gemma` THEN the endpoint SHALL exist and respond
2. IF the Gemma model is not available THEN the endpoint SHALL return a clear error message
3. WHEN the endpoint processes a request THEN it SHALL validate input and return structured responses

#### Correctness Properties

- **Property 1:** The endpoint SHALL NOT return 404 for valid requests
- **Property 2:** The endpoint SHALL validate input shape before processing

### Requirement 2: Define RLS policies or disable RLS

**User Story:** As a system, I need database queries to succeed so that auth, feedback, and sessions work correctly.

#### Acceptance Criteria

1. WHEN a database query is executed THEN it SHALL NOT be blocked by missing RLS policies
2. IF RLS is enabled THEN policies SHALL be defined for each table
3. WHEN RLS policies are applied THEN they SHALL allow the intended operations

#### Correctness Properties

- **Property 1:** Feedback insert SHALL succeed with current RLS configuration
- **Property 2:** Auth session creation SHALL succeed with current RLS configuration

### Requirement 3: Remove default secrets from env schema

**User Story:** As a deployer, I want the app to fail fast if secrets are not set so that I don't accidentally run with known-default credentials.

#### Acceptance Criteria

1. WHEN BETTER_AUTH_SECRET is not set in production THEN the app SHALL fail to start
2. WHEN DATABASE_URL is not set in production THEN the app SHALL fail to start
3. IF a secret has a default value THEN it SHALL be removed from the schema

#### Correctness Properties

- **Property 1:** No secret field SHALL have a `.default()` value
- **Property 2:** Missing secrets SHALL produce clear error messages

### Requirement 4: Fix dual app API routing for web-vite

**User Story:** As a developer deploying the web-vite app, I want API routes to resolve correctly so that sounds search and feedback work.

#### Acceptance Criteria

1. WHEN web-vite calls `/api/sounds/search` THEN the request SHALL reach the Freesound API
2. WHEN web-vite calls `/api/feedback` THEN the request SHALL persist to the database
3. IF API routes are not available in Vite THEN they SHALL be proxied to the Next.js app or implemented as Cloudflare Workers

#### Correctness Properties

- **Property 1:** API calls from web-vite SHALL NOT return 404
- **Property 2:** The same API contract SHALL be honored by both apps

### Requirement 5: Add WASM build linkage

**User Story:** As a developer modifying Rust code, I want my changes to be reflected in the running app so that I can iterate quickly.

#### Acceptance Criteria

1. WHEN `bun run build:wasm` is run THEN the output SHALL be placed where the apps can import it
2. IF the local WASM build exists THEN it SHALL be preferred over the npm package
3. WHEN the app starts THEN it SHALL use the locally built WASM if available

#### Correctness Properties

- **Property 1:** Local Rust changes SHALL be reflected after running `bun run build:wasm`
- **Property 2:** The build step SHALL NOT require publishing to npm

### Requirement 6: Wire tests into CI

**User Story:** As a maintainer, I want CI to run tests so that regressions are caught before merging.

#### Acceptance Criteria

1. WHEN a PR is opened THEN CI SHALL run `bun test`
2. IF tests fail THEN the CI check SHALL fail
3. WHEN new tests are added THEN they SHALL run automatically

#### Correctness Properties

- **Property 1:** The CI test step SHALL NOT be `echo "No tests implemented yet"`
- **Property 2:** Test failures SHALL block merges
