# Roadmap: FreeCouncil — OpenRouter Free-Agent Chat UI

## Milestones

- ✅ **v1.0 Stabilization** — Phases 1-3 (shipped 2026-06-08)
- ⬜ **v1.1 Security, Debt & Test Stabilization** — Phases 4-6 (Current)

## Phases

<details>
<summary>✅ v1.0 Stabilization (Phases 1-3) — SHIPPED 2026-06-08</summary>

- [x] **Phase 1: TypeScript Build** - Restore clean `tsc --noEmit` by fixing all three compiler errors (upload.ts, RouterAgent.ts, councilDispatch.ts)
- [x] **Phase 2: Session Ownership Persistence** - Persist `owner_api_key_hash` to SQLite and redirect ownership checks away from the in-memory registry (completed 2026-06-08)
- [x] **Phase 3: Auth Middleware Wiring** - Gate all five unprotected routes with `requireApiKey` and session ownership checks backed by SQLite (completed 2026-06-08)

</details>

<details open>
<summary>⬜ v1.1 Security, Debt & Test Stabilization (Phases 4-6)</summary>

- [x] **Phase 4: Security Audit & Tech Debt Hardening** — Address logging security (SEC-05), cache collisions (DEBT-04), lifecycle write errors (DEBT-05), and query performance/scoping (DEBT-06) (completed 2026-06-08)
- [ ] **Phase 5: Retention & Cleanup Monitors** — Implement database retention policies for snapshots and session events to prevent unbounded database growth (DEBT-02, DEBT-03)
- [ ] **Phase 6: Verification & Test Gaps** — Close testing gaps with unit tests for session registry, model card summarizer, and unauthenticated integration tests (TEST-01, TEST-02, TEST-03)

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. TypeScript Build | v1.0 | 2/2 | Complete | 2026-06-08 |
| 2. Session Ownership Persistence | v1.0 | 1/1 | Complete | 2026-06-08 |
| 3. Auth Middleware Wiring | v1.0 | 1/1 | Complete | 2026-06-08 |
| 4. Security Audit & Tech Debt Hardening | v1.1 | 2/2 | Complete | 2026-06-08 |
| 5. Retention & Cleanup Monitors | v1.1 | 0/1 | Pending | — |
| 6. Verification & Test Gaps | v1.1 | 0/1 | Pending | — |

---

### Phase 4: Security Audit & Tech Debt Hardening

**Goal:** Harden security, prevent key leaks, fix cache key collisions, resolve lifecycle write-after-close errors, and improve session query efficiency.
**Requirements:** SEC-05, DEBT-04, DEBT-05, DEBT-06
**Depends on:** Phase 3
**Plans:** 2 plans

Plans:
- [x] 04-01-PLAN: Log Redaction & Session Limits (completed 2026-06-08)
- [x] 04-02-PLAN: Caching, Lifecycles, and UI Badge (completed 2026-06-08)

### Phase 5: Retention & Cleanup Monitors

**Goal:** Implement database retention limits on model snapshots and session events to avoid unbounded size growth.
**Requirements:** DEBT-02, DEBT-03
**Depends on:** Phase 4
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 5 to break down)

### Phase 6: Verification & Test Gaps

**Goal:** Author robust tests to close security-critical integration and unit test coverage gaps.
**Requirements:** TEST-01, TEST-02, TEST-03
**Depends on:** Phase 5
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 6 to break down)
