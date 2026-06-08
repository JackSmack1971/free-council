# Phase 3: Auth Middleware Wiring - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Gate all five unprotected routes with `requireApiKey` and session ownership checks backed by SQLite to ensure every mutation and configuration route requires authentication, and unauthorized callers receive 401 or 403.

</domain>

<decisions>
## Implementation Decisions

### API Route Gating
- **POST /dispatch ownership:** Gated via `requireOwnedSession` to reject unauthorized callers before processing/quota consumption (returning 401 for missing key, 403 for mismatch).
- **PATCH /session/:id/revert ownership:** Gated via `requireOwnedSession` to restrict revert access to the session owner.
- **GET /config and GET /quota authentication:** Gated via `requireApiKey` middleware to prevent unauthorized reads of config or quota details.
- **Non-existent session handling:** Return HTTP 404 ("Session not found") when requesting gated routes with session IDs that do not exist.

### Configuration Mutability & Validation
- **POST /config authentication:** Gated via `requireApiKey` middleware.
- **POST /config mode validation:** Validate that `default_mode` (if provided) is strictly either 'solo' or 'council'; reject other values with HTTP 400 Bad Request.
- **POST /config parameter handling:** Ignore unrecognized parameter keys to allow forwards compatibility.
- **POST /config write mechanism:** Synchronously write updates to the `app_config` SQLite table using `db.prepare(...).run(...)` to match existing patterns.

### Security & Logging Integrity
- **Logging auth failures:** Log warnings for authorization failures (e.g. route path, failure reason) but never log raw API keys, bearer tokens, or sensitive credentials.
- **Header preservation:** Keep request headers intact rather than stripping them, enabling downstream forwarding of OpenRouter keys.
- **Rate limiting order:** Execute rate-limiting middleware before authentication/authorization middleware to protect backend databases and logic from exhaustion.
- **Minimal failure details:** Return minimal error responses (e.g. "API key is missing" or "Forbidden") when authentication/authorization checks fail.

### the agent's Discretion
- Code style, internal helper names, and exact implementation structure of validation logic are at the agent's discretion.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireApiKey` middleware defined in [api.ts](file:///c:/workspaces/free-council/backend/src/routes/api.ts#L118)
- `requireOwnedSession` helper defined in [api.ts](file:///c:/workspaces/free-council/backend/src/routes/api.ts#L125)
- `SessionStore.getSession` and other DB methods in [sessionStore.ts](file:///c:/workspaces/free-council/backend/src/modules/sessionStore.ts)

### Established Patterns
- Express route definitions with middleware arrays.
- Validation checks returning JSON error payloads `{ error: string }`.
- Checking hashes of Bearer tokens using `hashApiKey` from `sessionRegistry.ts`.

### Integration Points
- `POST /dispatch` in [api.ts](file:///c:/workspaces/free-council/backend/src/routes/api.ts#L228)
- `PATCH /session/:id/revert` in [api.ts](file:///c:/workspaces/free-council/backend/src/routes/api.ts#L516)
- `GET /config` and `POST /config` in [api.ts](file:///c:/workspaces/free-council/backend/src/routes/api.ts#L563)
- `GET /quota` in [api.ts](file:///c:/workspaces/free-council/backend/src/routes/api.ts#L452)

</code_context>

<specifics>
## Specific Ideas

- Ensure tests in `api.sessionAuthz.test.ts` and `api.test.ts` are updated or added to cover the new authentication and authorization requirements (specifically POST/dispatch ownership, PATCH/revert ownership, config authentication, and GET/quota authentication).

</specifics>

<deferred>
## Deferred Ideas

- Audit all `console.*` calls in dispatch paths for API key header capture (deferred as SEC-05).
- Complete removal of `SessionRegistry` (deferred as dead code removal).

</deferred>
