# Phase 1: TypeScript Build - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Restore a clean TypeScript build: fix all three compiler errors (upload.ts, RouterAgent.ts, councilDispatch.ts) so that `tsc --noEmit` exits with code 0 and prints zero diagnostics. No new features, no structural refactors — strictly compile-clean.

</domain>

<decisions>
## Implementation Decisions

### Abort Signal Side Effect
- **D-01:** After removing the trailing `abortSignal` argument from `RouterAgent.sampleAgents()` call in councilDispatch.ts, the loss of client-disconnect cancellation is **accepted silently**. RouterAgent's internal `AbortSignal.timeout(timeoutMs)` (30s) still prevents hangs. Abort propagation is a future concern — not in Phase 1 scope.

### Error Surface Policy
- **D-02:** Policy is **fix all errors tsc discovers** — not just the 3 documented. The ROADMAP success criterion is zero diagnostics. If tsc reveals additional errors beyond upload.ts / RouterAgent.ts / councilDispatch.ts, they must all be resolved before Phase 1 closes.

### Verification Gate
- **D-03:** Phase 1 is complete when **`tsc --noEmit` exits with code 0 and prints no diagnostics**. No test suite run required — the test suite runs via tsx and is independent of the TypeScript build gate. TEST-01 through TEST-03 are tracked separately per REQUIREMENTS.md.

### Specific Fix Approach (pre-determined by ROADMAP + STATE)
- **D-04:** `upload.ts` fix: import `createRateLimitMiddleware` from `../middleware/rateLimit.js` (function is exported from `backend/src/middleware/rateLimit.ts:28`).
- **D-05:** `RouterAgent.ts:114` fix: replace `signal: abortSignal` (undefined variable) with `signal: AbortSignal.timeout(timeoutMs)` — derives the abort signal from the existing `timeoutMs` parameter.
- **D-06:** `councilDispatch.ts:103` fix: remove the trailing `abortSignal` argument from the `sampleAgents()` call — **positional removal, not a type cast** (locked in STATE.md). `timeoutMs` will use its default `RouterAgent.SAMPLE_AGENTS_TIMEOUT_MS` (30000ms).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and Roadmap
- `.planning/REQUIREMENTS.md` — BUILD-01, BUILD-02, BUILD-03 requirements with acceptance criteria
- `.planning/ROADMAP.md` §Phase 1 — Success criteria (all four must be TRUE before phase closes)

### Source Files Being Modified
- `backend/src/routes/upload.ts:10` — missing `createRateLimitMiddleware` import (TS2304)
- `backend/src/agents/RouterAgent.ts:114` — out-of-scope `abortSignal` reference (TS2552)
- `backend/src/dispatch/councilDispatch.ts:103` — `AbortSignal|undefined` passed as `number` (TS2345)

### Fix Source
- `backend/src/middleware/rateLimit.ts` — exports `createRateLimitMiddleware(options: RateLimitOptions)` at line 28; this is the import target for upload.ts

### TypeScript Configuration
- `backend/tsconfig.json` — TypeScript compiler config for backend (target: ES2022, module: NodeNext); this is the tsconfig that must pass

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/middleware/rateLimit.ts:28` — `createRateLimitMiddleware` already exists and is exported; no new implementation needed, only the import statement in upload.ts
- `AbortSignal.timeout(ms)` — built-in Node.js API (available in Node 18+, confirmed target is Node 22); no external dependency needed

### Established Patterns
- Import style: `backend/src/routes/upload.ts` uses `import ... from '../modules/...js'` — note the `.js` extension required by NodeNext module resolution
- `RouterAgent.ts` already has `timeoutMs` as a named parameter with a default value; the fix stays within the existing signature, just changes the `signal` expression

### Integration Points
- `councilDispatch.ts` is the only caller of `RouterAgent.sampleAgents()` that passes an explicit `timeoutMs`-position argument — removing it is a local change with no other callers to update

</code_context>

<specifics>
## Specific Ideas

No specific references beyond what is locked in decisions. All fix approaches are mechanically derived from the ROADMAP success criteria and the compiler errors themselves.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-typescript-build*
*Context gathered: 2026-06-07*
