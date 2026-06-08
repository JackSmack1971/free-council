# Phase 4: Security Audit & Tech Debt Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 4-Security Audit & Tech Debt Hardening
**Areas discussed:** Log redaction policy (SEC-05), Model availability alerts (DEBT-05), Proposer cache trace visibility (DEBT-04), Session list pagination & limit (DEBT-06)

---

## Log Redaction Policy (SEC-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Strict metadata-only logging | Completely strip all request/response headers and payloads from console logs, printing only metadata (method, path, status, latency) | ✓ |
| Selective sanitization | Mask Authorization headers and key prefixes (sk-or-), but allow printing other headers/body fragments for debugging | |
| You decide | Let the agent choose the safest approach during implementation | |

**User's choice:** Strict metadata-only logging
**Notes:** Decided to completely strip all request/response headers and payloads from console/production logs on all dispatch paths to ensure zero key leakage.

---

## Model Availability Alerts (DEBT-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Silent backend recovery | AgentOrchestrator automatically falls back to other available models, and the change is logged or shown in the trace panel, but no global UI banner is shown | ✓ |
| Visual alert banner | Show a yellow warning banner at the top of the chat window indicating that the free model pool has changed or that a configured model is offline | |
| You decide | Let the agent determine the best fallback/alert design during implementation | |

**User's choice:** Silent backend recovery
**Notes:** Backend fallback is preferred over interrupting the main chat interface with global warnings.

---

## Proposer Cache Trace Visibility (DEBT-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Show in UI | Display a "cached" badge next to the agent's name/model in the CouncilTrace UI panel when the response comes from the cache | ✓ |
| Backend-only | Do not show cache status in the UI, only log it to the backend console and telemetry events | |
| You decide | Let the agent decide where and how to expose cache hits during implementation | |

**User's choice:** Show in UI
**Notes:** Decided to display a "cached" badge next to the agent's name/model in the CouncilTrace UI panel when a proposer response is loaded from the session cache.

---

## Session List Pagination & Limit (DEBT-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable query limit | Default to returning the 50 most recent sessions, and support a ?limit= query parameter to allow fetching more | ✓ |
| Hard limit | Return a fixed limit of 100 most recent sessions without pagination/query parameter support | |
| You decide | Let the agent determine the best limit scheme during implementation | |

**User's choice:** Configurable query limit
**Notes:** Supports default load of 50 sessions and query parameter limit for client flexibility.

---

## the agent's Discretion

Deferred to the agent on standard layout/styles for cache badge, exact implementation of hashing, and wiring of ProviderHealthMonitor stop logic.

## Deferred Ideas

None — discussion stayed within phase scope.
