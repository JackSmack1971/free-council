# Phase 4: Security Audit & Tech Debt Hardening - Research

**Researched:** 2026-06-08
**Domain:** Backend security audit, performance optimization, and system resilience
**Confidence:** HIGH

## Summary

This research outlines the mitigation path for the security logging audit, proposer caching collision, graceful shutdown database write-after-close errors, and session retrieval query limit. We have audited the dispatch logging paths to identify error logging that exposes API keys, verified that the proposer cache key generation can be replaced with `node:crypto`'s SHA-256 hash, mapped out how to wire `ProviderHealthMonitor` into the server shutdown sequence, and analyzed the sessions endpoint database query to apply a limit clause.

**Primary recommendation:** Use custom sanitization for all logging in dispatch paths, replace the weak cache hashing in `AgentOrchestrator` with a SHA-256 hash from `node:crypto`, integrate `ProviderHealthMonitor` with `installGracefulShutdown` in `index.ts`, and parse/pass `limit` to the SQLite query for `/sessions`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SEC-05 Log Redaction | API / Backend | — | Log sanitization must be done at the logger/router boundary to capture and filter all dispatch path outputs. |
| DEBT-04 Proposer Cache Hashing | API / Backend | — | Cache key hashing and state management belong to the agent orchestration layer in the backend. |
| DEBT-04 Proposer Cache UI Badge | Browser / Client | — | The CouncilTrace React component needs to render a "cached" badge when the response is loaded from the cache. |
| DEBT-05 Health Monitor Lifecycle | API / Backend | — | Starting/stopping background monitors is a backend server lifecycle management task. |
| DEBT-06 Session Pagination | Database / Storage | API / Backend | Restricting records fetched must be pushed to SQL for performance, with the API handling request param parsing. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:crypto | Built-in | Cryptographic hash functions (SHA-256) | Standard node library; fast, memory-safe, and avoids external dependencies. |
| node:sqlite | Built-in (Experimental) | SQL database queries | Fast, process-native, zero-dependency SQLite driver. |

## Architecture Patterns

### System Architecture Diagram

```
[HTTP Client] ──(GET /sessions?limit=50)──> [Express Router]
                                                   │
                                                   ▼
[HTTP Client] ──(POST /dispatch)──────────> [Express Router] ────> [AgentOrchestrator]
                                                   │                       │
                                             (Log Errors)                  ▼
                                                   │               [Proposer Cache (SHA-256)]
                                                   ▼
                                        [Log Sanitizer Helper]
                                                   │
                                                   ▼
                                            [console.error]
```

### Pattern 1: SHA-256 Proposer Cache Key Generation
```typescript
import crypto from 'node:crypto';

function getCacheKey(modelId: string, prompt: string): string {
  const hash = crypto.createHash('sha256').update(prompt).digest('hex');
  return `${modelId}|${hash}`;
}
```

### Pattern 2: Log Sanitizer Helper
```typescript
export function sanitizeError(err: unknown): string {
  if (!err) return '';
  const message = err instanceof Error ? err.message : String(err);
  // Redact bearer tokens or key-like strings in messages
  return message.replace(/Bearer\s+[a-zA-Z0-9_\-]+/gi, 'Bearer [REDACTED]')
                .replace(/sk-[a-zA-Z0-9_\-]+/gi, 'sk-[REDACTED]');
}
```

### Anti-Patterns to Avoid
- **Logging full exception objects in dispatch paths:** Throwing raw fetch or axios error objects into `console.error` dumps request configs, headers, and credentials straight into production logs.
- **Hand-rolling prompt hashes:** Simple hashes like `length + slice` lead to high collision rates when prompts have similar structures.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| String Hashing | Custom summation / custom slice hashing | `node:crypto` SHA-256 | Hand-rolled hashes have collision rates that break cache lookups. |

## Common Pitfalls

### Pitfall 1: Leaking API Keys via Network Error Dumps
- **What goes wrong:** When `fetch` fails (e.g. timeout or auth error), the caught error object contains the request config which stores the Authorization headers.
- **Why it happens:** Passing the whole `err` object to `console.error` prints its inspectable properties.
- **How to avoid:** Log only `err.message` or manually construct a sanitized log line.

### Pitfall 2: Stale Cache Entries
- **What goes wrong:** Using SHA-256 prompt hash works great but does not account for configuration settings (e.g., temperature).
- **How to avoid:** The session cache is already scoped per session and model, which is sufficient since settings are stable within a session.

## Code Examples

### Graceful Shutdown Setup
```typescript
// In index.ts
import { ProviderHealthMonitor } from './modules/providerHealthMonitor.js';

ProviderHealthMonitor.start();

installGracefulShutdown({
  server,
  retentionMonitor: RetentionMonitor,
  providerHealthMonitor: ProviderHealthMonitor, // Wired!
  checkpointDatabase,
  closeDatabase
});
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `node:crypto` is available without external package installs. | Standard Stack | None — standard Node.js module since early v0.10. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js Test Runner |
| Config file | none |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-05 | Logging does not output API keys / authorization headers | unit | `npm test` | ✅ `backend/src/routes/api.errorHandling.test.ts` |
| DEBT-04 | Proposer cache uses SHA-256 prompt hash and returns fromCache | unit | `npm test` | ✅ `backend/src/agents/AgentOrchestrator.test.ts` |
| DEBT-05 | ProviderHealthMonitor is stopped on graceful shutdown | unit | `npm test` | ✅ `backend/src/server/gracefulShutdown.test.ts` |
| DEBT-06 | GET /sessions supports custom limit parameter in SQL | unit | `npm test` | ✅ `backend/src/routes/api.sessionPersistence.test.ts` |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Verify session ownership in API requests |
| V5 Input Validation | yes | Sanitize and validate query params (like `limit`) |
| V6 Cryptography | yes | Use standard SHA-256 for prompt hashing |
| V8 Data Protection | yes | Redact logs to prevent PII/credential leak |

### Known Threat Patterns for OpenRouter API
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential Leakage | Information Disclosure | Redact Authorization headers from error logs and traces |

## Sources

### Primary (HIGH confidence)
- Node.js Documentation - `node:crypto` and `node:sqlite` features.
- Local Codebase - audited `backend/src/routes/api.ts`, `backend/src/agents/AgentOrchestrator.ts`, and `backend/src/server/gracefulShutdown.ts`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Standard libraries.
- Architecture: HIGH - Verified files exist and code runs.
- Pitfalls: HIGH - Common Node/OpenRouter logging concerns.

**Research date:** 2026-06-08
**Valid until:** 2026-07-08
