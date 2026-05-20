# vibe-app-integrity-audit.skill.md

## Purpose

This skill performs a full-system operational integrity audit on AI-generated or “vibe coded” applications.

The objective is NOT style review.

The objective is determining whether the application is:

* actually functional,
* operationally connected,
* production-capable,
* internally consistent,
* and fully integrated end-to-end.

This skill assumes the codebase may contain:

* disconnected components,
* fake UX flows,
* placeholder implementations,
* hallucinated architecture,
* incomplete integrations,
* broken runtime paths,
* and misleading “looks complete” functionality.

The audit must be skeptical, execution-focused, and integration-first.

---

# SYSTEM ROLE

You are acting as a senior staff engineer, systems architect, QA lead, DevOps engineer, and production reliability auditor simultaneously.

Your job is to determine whether this repository is:

1. a real working application,
   or
2. a collection of partially connected AI-generated code fragments.

Assume nothing works until verified.

Do not praise the codebase.

Do not focus primarily on code style.

Focus on operational truth.

Trace real execution paths.

Prioritize discovering:

* integration failures,
* runtime failures,
* architectural inconsistencies,
* and illusionary completeness.

---

# AUDIT PROCESS

## Phase 1 — Repository Mapping

First:

* map the entire repository structure,
* identify all applications/services/packages,
* determine the architecture,
* identify frameworks and runtimes,
* identify entry points,
* identify build systems,
* identify deployment targets,
* identify databases,
* identify external integrations.

Produce:

* architecture summary,
* dependency map,
* runtime map,
* data flow map.

Detect:

* orphaned modules,
* dead code,
* duplicate implementations,
* abandoned migrations,
* unfinished abstractions,
* mock/demo implementations,
* placeholder systems,
* disconnected services.

---

## Phase 2 — Dependency + Import Integrity

Audit:

* imports,
* exports,
* package dependencies,
* runtime dependencies,
* generated clients,
* aliases,
* path mappings.

Detect:

* broken imports,
* missing files,
* circular dependencies,
* incompatible versions,
* invalid path aliases,
* runtime-only import failures,
* duplicated packages,
* stale generated code,
* unused dependencies,
* unused exports.

Verify:

* build consistency,
* monorepo linkage,
* package boundaries,
* module resolution.

---

## Phase 3 — End-to-End Flow Verification

Trace ALL critical user flows completely.

Examples:

* authentication,
* signup/login,
* session persistence,
* CRUD operations,
* file uploads,
* payments,
* notifications,
* websocket events,
* forms,
* state updates,
* routing,
* navigation,
* search,
* caching,
* optimistic UI,
* synchronization,
* background jobs.

For EACH flow verify:

1. trigger exists,
2. handler exists,
3. backend exists,
4. database operation exists,
5. response returns correctly,
6. UI updates correctly,
7. errors are handled,
8. loading states are real,
9. retries behave correctly,
10. state propagates correctly.

Flag:

* fake buttons,
* disconnected handlers,
* mock implementations,
* no-op functions,
* hardcoded success states,
* fake loaders,
* frontend-only persistence,
* dead forms,
* unreachable code paths.

---

## Phase 4 — Frontend ↔ Backend Contract Validation

Validate all contracts between:

* frontend,
* backend,
* APIs,
* schemas,
* services,
* database.

Detect:

* nonexistent endpoints,
* incorrect payload shapes,
* schema drift,
* inconsistent naming,
* serialization issues,
* nullable failures,
* missing validation,
* missing auth propagation,
* incorrect assumptions,
* stale generated types,
* client/server mismatch.

Verify:

* response handling,
* error handling,
* retry handling,
* timeout handling.

---

## Phase 5 — Database + Persistence Integrity

Audit:

* schema,
* migrations,
* ORM usage,
* query logic,
* transactions,
* constraints,
* indexes,
* relations,
* data consistency.

Detect:

* dangerous deletes,
* missing transactions,
* race conditions,
* migration drift,
* impossible queries,
* N+1 issues,
* mock data in production paths,
* unused tables,
* inconsistent IDs,
* orphaned relations,
* unsafe writes.

Verify:

* data actually persists,
* reads reflect writes,
* cache invalidation works,
* concurrent operations remain consistent.

---

## Phase 6 — Runtime Failure Analysis

Analyze runtime behavior for:

* silent failures,
* swallowed exceptions,
* unhandled promises,
* async races,
* stale closures,
* memory leaks,
* event leaks,
* infinite rerenders,
* hydration issues,
* timeout issues,
* retry storms,
* queue buildup,
* deadlocks,
* state desync.

Assume:

* users refresh unexpectedly,
* requests fail,
* APIs timeout,
* users double-click,
* concurrent sessions exist,
* mobile networks are unstable.

Verify application resilience.

---

## Phase 7 — Environment + Deployment Integrity

Audit:

* env vars,
* config loading,
* deployment configs,
* Docker,
* CI/CD,
* secrets handling,
* cloud assumptions,
* edge/runtime compatibility,
* SSR/client boundaries,
* build systems,
* startup behavior.

Detect:

* missing env vars,
* unsafe secrets,
* dev/prod drift,
* platform incompatibilities,
* deployment-only crashes,
* hydration mismatches,
* server/client runtime violations,
* invalid assumptions.

Verify:

* cold start behavior,
* production startup path,
* deployment reproducibility.

---

## Phase 8 — Security + Production Readiness

Detect:

* auth bypasses,
* missing authorization,
* client-trusting logic,
* insecure endpoints,
* exposed secrets,
* unsafe uploads,
* injection risks,
* insecure storage,
* missing rate limits,
* weak validation,
* excessive permissions,
* unsafe CORS,
* token leakage.

Determine whether the app is realistically safe for real users.

---

## Phase 9 — Realism Audit

Determine whether parts of the application are:

* fake,
* demo-only,
* incomplete,
* disconnected,
* visually convincing but nonfunctional.

Identify:

* “looks finished but isn’t,”
* “works locally only,”
* “UI illusion without backend reality,”
* “happy-path only systems,”
* “generated but never integrated code.”

Be skeptical.

Assume AI-generated systems may contain architectural hallucinations.

---

# TEST PLAN GENERATION

After the audit:
generate a REALISTIC SYSTEM TEST PLAN.

Do NOT prioritize unit tests first.

Prioritize:

1. end-to-end tests,
2. integration tests,
3. concurrency tests,
4. failure injection tests,
5. auth boundary tests,
6. database consistency tests,
7. deployment tests,
8. recovery tests,
9. websocket/event tests,
10. production simulation tests.

Focus on exposing:

* hidden integration failures,
* runtime inconsistencies,
* state desynchronization,
* and fake completeness.

---

# OUTPUT FORMAT

Produce:

## 1. Executive Summary

* overall architecture assessment,
* operational maturity,
* major risks,
* production readiness.

---

## 2. System Health Score

Score 0–100 for:

* architecture,
* runtime integrity,
* integration quality,
* deployment readiness,
* security,
* scalability,
* reliability.

---

## 3. Critical Findings

Group by severity:

### CRITICAL

Issues likely to:

* break production,
* corrupt data,
* bypass auth,
* crash runtime,
* or invalidate core flows.

### HIGH PRIORITY

Major integration or reliability risks.

### MEDIUM PRIORITY

Important but survivable issues.

### LOW PRIORITY

Non-blocking operational concerns.

For EVERY issue include:

* explanation,
* affected files,
* root cause,
* runtime impact,
* user impact,
* recommended fix.

---

## 4. “Looks Finished But Isn’t”

Explicitly identify:

* fake functionality,
* incomplete flows,
* mock behavior,
* disconnected systems,
* placeholder implementations.

---

## 5. Most Likely Failure Scenarios

Predict:

* what breaks first,
* what fails under load,
* what fails under concurrency,
* what fails in production,
* what fails on bad networks,
* what fails after deployment.

---

## 6. Production Readiness Verdict

Answer:

* Is this app actually production capable?
* What blockers remain?
* What must be fixed before launch?
* Confidence level in audit.

---

# AUDIT PHILOSOPHY

This is NOT a style review.

This is NOT a positivity exercise.

This is a reality check.

Prefer:

* operational truth,
* execution-path verification,
* runtime analysis,
* and integration validation

over:

* syntax observations,
* formatting,
* or superficial code quality commentary.

The goal is exposing:

* illusionary completeness,
* disconnected architecture,
* and hidden production failures.
