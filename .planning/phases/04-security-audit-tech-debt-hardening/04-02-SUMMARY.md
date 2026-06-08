# Plan 04-02 Summary: Proposer Caching & Teardown Lifecycles

## Scope & Purpose
Harden proposer response caching by switching from a weak length+prefix hash to a secure SHA-256 hash. Wire background monitor lifecycles into graceful server shutdown, and add cache tracing visibility to the frontend UI with a "cached" badge.

## Changes Implemented

### Backend
- **[AgentOrchestrator.ts](file:///c:/workspaces/free-council/backend/src/agents/AgentOrchestrator.ts)**:
  - Replaced weak proposer cache keys with SHA-256 hashes generated from the prompt text via Node's `crypto` module.
  - Propagated the `fromCache` boolean metadata through the generator yields for proposer completions.
- **[gracefulShutdown.ts](file:///c:/workspaces/free-council/backend/src/server/gracefulShutdown.ts)**:
  - Added optional `providerHealthMonitor` field to `ShutdownDeps`.
  - Stopped `ProviderHealthMonitor` gracefully on `SIGTERM`/`SIGINT` signals.
- **[index.ts](file:///c:/workspaces/free-council/backend/src/index.ts)**:
  - Imported and started `ProviderHealthMonitor` on server initialization.
  - Passed `ProviderHealthMonitor` instance to the graceful shutdown handler.

### Frontend
- **[CouncilTrace.tsx](file:///c:/workspaces/free-council/frontend/src/components/CouncilTrace.tsx)**:
  - Added `fromCache` boolean to `TraceAgent` interface.
  - Rendered a styled `"cached"` badge in the Trace details view for both standard GoA-lite and MoA hybrid views.

### Verification & Tests
- **[AgentOrchestrator.test.ts](file:///c:/workspaces/free-council/backend/src/agents/AgentOrchestrator.test.ts)**:
  - Added test verifying cache hits yield `fromCache: true` and cache misses yield `fromCache: false`, and that separate prompts with different SHA-256 hashes do not cause collisions.
- **[gracefulShutdown.test.ts](file:///c:/workspaces/free-council/backend/src/server/gracefulShutdown.test.ts)**:
  - Added assertion checking that `providerHealthMonitor.stop()` is executed during graceful shutdown.

## Verification Results
- All 16 backend unit tests are passing successfully.
- Frontend builds and type-checks successfully without errors.
