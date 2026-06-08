---
phase: 2
phase_name: Session Ownership Persistence
plan_id: 01-session-owner
wave: 1
objective: Persist owner_api_key_hash to SQLite sessions table and verify ownership checks durable across restarts.
requirements_addressed:
  - SESSION-01
  - SESSION-02
must_haves:
  - SQLite schema migration 008_session_owner.sql adding owner_api_key_hash to sessions table.
  - SessionStore methods read/write ownerApiKeyHash.
  - POST /session persists the hashed API key to the DB.
  - api.ts ownership guards and GET /sessions join and query sessions table by API key hash.
  - upload.ts uses SessionStore for session retrieval and verifies API key hash ownership.
truths:
  - The SQLite database connections and migration runners are already set up.
  - api.ts and upload.ts currently use SessionRegistry (in-memory) for ownership checks.
verification:
  - Full backend test suite runs and passes (101/101 tests pass).
  - Test suites for session creation, persistence, authz, and rate limiting pass cleanly.
---

# Phase 2 Plan: Session Ownership Persistence

## Objective

Durable session ownership using SQLite. By adding `owner_api_key_hash` to the `sessions` table in SQLite, we allow session ownership to survive server/process restarts. Ownership checks in auth-gated routes are redirected from the in-memory registry to SQLite.

## Scope

- DB migration `008_session_owner.sql` to add `owner_api_key_hash` TEXT column to `sessions` table.
- Update `SessionStore` and interfaces in `sessionStore.ts`.
- Update route handlers in `api.ts` and `upload.ts` to query session ownership from DB.
- Wire `createSessionRateLimiter` to `POST /session` route.
- Fix and verify all affected tests.

## Tasks

1. Create SQLite migration `008_session_owner.sql`.
2. Update `SessionStore` to query/insert `owner_api_key_hash`.
3. Modify ownership verification logic in `api.ts` and `upload.ts`.
4. Run tests and fix any test issues (including rate limiting, uploads, and disconnect tests).

## Verification

1. Run all backend tests: `npm test --workspace=backend`.
2. Confirm 100% test passage.
