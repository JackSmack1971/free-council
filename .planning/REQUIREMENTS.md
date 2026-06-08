# Requirements: FreeCouncil — OpenRouter Free-Agent Chat UI

**Defined:** 2026-06-08
**Core Value:** A relevance-selected panel of free OpenRouter models must deliver responses that equal or exceed a single free model baseline

## v1.1 Requirements

### Security

- [ ] **SEC-05**: Audit all `console.*` calls in dispatch paths to confirm API key headers are not captured in logs.

### Tech Debt

- [ ] **DEBT-02**: Add model_snapshots retention: delete all but last 5 rows after each refresh.
- [ ] **DEBT-03**: Add session_events retention in SessionCleanupMonitor (cascade delete events older than SESSION_TTL_MS).
- [ ] **DEBT-04**: Fix proposer cache key collision in AgentOrchestrator — replace weak length+prefix hash with SHA-256(prompt).
- [ ] **DEBT-05**: Wire ProviderHealthMonitor into gracefulShutdown to prevent write-after-close on SIGTERM.
- [ ] **DEBT-06**: Add GET /sessions LIMIT clause + push ownership filter into SQL.

### Test Gaps

- [ ] **TEST-01**: Integration tests for unauthenticated attack paths: POST /config, PATCH /session/:id/revert by non-owner, POST /dispatch with stolen sessionId.
- [ ] **TEST-02**: Unit tests for sessionRegistry.ts (ownership logic, hash collision behavior).
- [ ] **TEST-03**: Unit tests for modelCardSummarizer.ts (normalization edge cases).

## Future Requirements

### Phase 4 (Structured Workbench)

- **WORK-01**: JSON schema editor UI.
- **WORK-02**: Structured-output toggle per session.
- **WORK-03**: Schema validation on agent response.
- **WORK-04**: Retry-on-invalid JSON with configurable max retries.
- **WORK-05**: Value verification pass (secondary LLM validates structured output).
- **WORK-06**: Export to JSON/Markdown/CSV.

### Phase 5 (Full GoA+MoA)

- **GOA-01**: Full GoA bidirectional message passing (forward + reverse, 2 passes max) + graph pooling in executeGoAFull().
- **GOA-02**: Session-scoped proposer result cache.
- **GOA-03**: S score history for cross-session model performance comparison.
- **GOA-04**: Held-out eval gate for agg_prompt.v1.txt (≥15 human-scored cases across n=3, n=4, conflicting-fact subsets).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user / team collaboration | Single-user local app design limits need. |
| Local model serving | Hard constraint: no GPU, no local inference. |
| Vector database / semantic RAG | SQLite FTS5 is sufficient; semantic RAG is deferred. |
| Audio/video upload | Explicitly deferred. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-05 | Phase 4 | Pending |
| DEBT-02 | Phase 5 | Pending |
| DEBT-03 | Phase 5 | Pending |
| DEBT-04 | Phase 4 | Pending |
| DEBT-05 | Phase 4 | Pending |
| DEBT-06 | Phase 4 | Pending |
| TEST-01 | Phase 6 | Pending |
| TEST-02 | Phase 6 | Pending |
| TEST-03 | Phase 6 | Pending |

**Coverage:**
- v1.1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-08*
*Last updated: 2026-06-08 after initial definition*
