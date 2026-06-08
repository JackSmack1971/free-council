# Phase 4: Security Audit & Tech Debt Hardening - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden security, prevent key leaks, fix cache key collisions, resolve lifecycle write-after-close errors, and improve session query efficiency. This includes:
- SEC-05: Audit all console.* calls in dispatch paths to ensure API keys are not leaked in logs.
- DEBT-04: Fix proposer cache key collision in AgentOrchestrator — replace weak length+prefix hash with SHA-256(prompt).
- DEBT-05: Wire ProviderHealthMonitor into gracefulShutdown to prevent write-after-close on SIGTERM.
- DEBT-06: Add GET /sessions LIMIT clause + push ownership filter into SQL.

</domain>

<decisions>
## Implementation Decisions

### Log Redaction Policy (SEC-05)
- **D-01:** Strict metadata-only logging: Completely strip all request/response headers and body payloads from console/production logs on all dispatch paths. Logs must only print high-level metadata such as HTTP method, path, status, and latency.

### Model Availability Alerts (DEBT-05)
- **D-02:** Silent backend recovery: The AgentOrchestrator will automatically handle fallbacks to other available models or record fallback actions in the trace panel. The UI will not present any global warning banner or alert to the user.

### Proposer Cache Trace Visibility (DEBT-04)
- **D-03:** Show cache status in UI: Display a "cached" badge or label next to the agent's name/model in the CouncilTrace UI panel when a proposer response is loaded from the session cache.

### Session List Pagination & Limit (DEBT-06)
- **D-04:** Configurable query limit: The `GET /sessions` endpoint will default to returning the 50 most recent sessions. It must support a `?limit=` query parameter to allow fetching more.

### the agent's Discretion
- The agent has full discretion on:
  - The precise styling/rendering of the "cached" badge in the UI.
  - The exact implementation details of the SHA-256 hashing helper function.
  - The integration detail of wiring `ProviderHealthMonitor.stop()` into `gracefulShutdown.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Routing and Project Definitions
- [.planning/ROADMAP.md](file:///.planning/ROADMAP.md) — Phase 4 requirements and roadmap sequencing
- [.planning/PROJECT.md](file:///.planning/PROJECT.md) — Core value proposition, stack constraints, and out of scope definitions
- [.planning/REQUIREMENTS.md](file:///.planning/REQUIREMENTS.md) — Requirement details for SEC-05, DEBT-04, DEBT-05, DEBT-06

### Core Backend Implementations
- [backend/src/routes/api.ts](file:///backend/src/routes/api.ts) — Router setup, `/dispatch` endpoint, and `/sessions` retrieval
- [backend/src/agents/AgentOrchestrator.ts](file:///backend/src/agents/AgentOrchestrator.ts) — Proposer caching, Orchestrator execution methods, and API fetch calls
- [backend/src/modules/providerHealthMonitor.ts](file:///backend/src/modules/providerHealthMonitor.ts) — Background polling of OpenRouter free model catalog
- [backend/src/server/gracefulShutdown.ts](file:///backend/src/server/gracefulShutdown.ts) — Shutdown handlers for SIGTERM and SIGINT

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `crypto` (node:crypto module): Already imported in several modules (e.g., `sessionRegistry.ts`). We can import and reuse it in `AgentOrchestrator.ts` for generating the SHA-256 content hashes.
- `installGracefulShutdown` dependencies: The shutdown installer in `gracefulShutdown.ts` takes object parameters, making it easy to add `providerHealthMonitor: { stop: () => void }` without breaking other deps.

### Established Patterns
- Telemetry logging: `TelemetryEngine.record()` is used for system-level and session-level telemetry.
- Configuration persistence: Config table `app_config` and helper `db.prepare()` used for database interaction.

### Integration Points
- `GET /sessions` in `backend/src/routes/api.ts`: Add `LIMIT ?` query and bind limit parameter.
- `AgentOrchestrator` proposer cache: Replace `getCacheKey()` hash with SHA-256. Return `fromCache` metadata with the generator yield items.
- `gracefulShutdown.ts` and `index.ts`: Wire and invoke `ProviderHealthMonitor.stop()` on SIGTERM/SIGINT. Ensure `ProviderHealthMonitor.start()` is called on server initialization.

</code_context>

<specifics>
## Specific Ideas

- No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 4-Security Audit & Tech Debt Hardening*
*Context gathered: 2026-06-08*
