---
phase: 3
phase_name: Auth Middleware Wiring
plan_id: 01-auth-wiring
wave: 1
depends_on: []
files_modified:
  - backend/src/routes/api.ts
  - backend/src/routes/api.sessionAuthz.test.ts
autonomous: true
requirements_addressed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
must_haves:
  - POST /dispatch checks session ownership and rejects mismatching API keys before quota consumption.
  - PATCH /session/:id/revert checks session ownership and restricts revert to the session owner.
  - POST /config gates behind requireApiKey and validates default_mode enum (accept only solo/council).
  - GET /config and GET /quota gate behind requireApiKey.
  - Test suite contains integration tests for all gated endpoints (GET /config, GET /quota, POST /config, PATCH /session/:id/revert, POST /dispatch).
truths:
  - requireApiKey and requireOwnedSession are already defined in api.ts.
  - extractBearerToken and hashApiKey are already defined and imported.
verification:
  - Run npm test --workspace=backend
  - Test api.sessionAuthz.test.ts runs and passes cleanly.
---

# Phase 3 Plan: Auth Middleware Wiring

## Objective

Gate all five unprotected/under-protected routes with `requireApiKey` and session ownership checks backed by SQLite to ensure every mutation and configuration route requires authentication, and unauthorized callers receive 401 or 403.

## Scope

- Modify `POST /dispatch` to require session ownership.
- Modify `PATCH /session/:id/revert` to require session ownership.
- Modify `POST /config`, `GET /config`, and `GET /quota` to require API key authentication.
- Validate `default_mode` in `POST /config`.
- Add test coverage in `api.sessionAuthz.test.ts` to verify authorization rules.

## Tasks

<tasks>

<task id="1">
<read_first>
- backend/src/routes/api.ts
</read_first>
<action>
In `backend/src/routes/api.ts`, modify `POST /dispatch` handler to call `requireOwnedSession(req, res, sessionId)` at the start. If the check returns null, return early (as the response has already been sent).
</action>
<acceptance_criteria>
`backend/src/routes/api.ts` calls `requireOwnedSession` inside the `POST /dispatch` route handler, returning early if null.
</acceptance_criteria>
</task>

<task id="2">
<read_first>
- backend/src/routes/api.ts
</read_first>
<action>
In `backend/src/routes/api.ts`, modify `PATCH /session/:id/revert` handler to call `requireOwnedSession(req, res, sessionId)` instead of just `SessionStore.getSession(sessionId)`. If the check returns null, return early.
</action>
<acceptance_criteria>
`backend/src/routes/api.ts` calls `requireOwnedSession` inside `PATCH /session/:id/revert`, returning early if null.
</acceptance_criteria>
</task>

<task id="3">
<read_first>
- backend/src/routes/api.ts
</read_first>
<action>
In `backend/src/routes/api.ts`, add `requireApiKey` middleware to `POST /config`. Inside the handler, check if `default_mode` is defined. If it is, validate that it is either 'solo' or 'council'; if it is anything else, return HTTP 400 with `{ error: 'Invalid default_mode. Supported modes: solo, council.' }` or similar.
</action>
<acceptance_criteria>
`POST /config` route definition in `backend/src/routes/api.ts` has `requireApiKey` middleware, and returns HTTP 400 if `default_mode` is present but not 'solo' or 'council'.
</acceptance_criteria>
</task>

<task id="4">
<read_first>
- backend/src/routes/api.ts
</read_first>
<action>
In `backend/src/routes/api.ts`, add `requireApiKey` middleware to the route definitions for `GET /config` and `GET /quota`.
</action>
<acceptance_criteria>
`GET /config` and `GET /quota` route definitions in `backend/src/routes/api.ts` include the `requireApiKey` middleware.
</acceptance_criteria>
</task>

<task id="5">
<read_first>
- backend/src/routes/api.sessionAuthz.test.ts
</read_first>
<action>
In `backend/src/routes/api.sessionAuthz.test.ts`, add tests verifying:
- `POST /dispatch` rejects requests without an API key (returns 401) and with a key mismatching the session owner (returns 403).
- `PATCH /session/:id/revert` rejects requests without an API key (returns 401) and with a key mismatching the session owner (returns 403).
- `GET /config` requires an API key (returns 401).
- `GET /quota` requires an API key (returns 401).
- `POST /config` requires an API key (returns 401) and rejects invalid default_mode (returns 400).
</action>
<acceptance_criteria>
Running `npm test --workspace=backend` executes successfully and all new authz tests pass.
</acceptance_criteria>
</task>

</tasks>

## Artifacts this phase produces

No new symbols or files are produced by this phase; only existing API routes are modified.

## Verification

1. Run all backend tests: `npm test --workspace=backend`.
2. Confirm 100% test passage.
