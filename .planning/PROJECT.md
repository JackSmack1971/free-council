# FreeCouncil — OpenRouter Free-Agent Chat UI

## What This Is

FreeCouncil is a local-first, single-user web chatbot that routes user prompts through the smallest relevance-selected subset of free OpenRouter models (≤5 agents per session) using a GoA + MoA hybrid algorithm. It addresses a validated gap: no existing tool combines OpenRouter free-model-first constraints, adaptive router-selected expert panels, capability-aware UI controls derived from live model metadata, and quota-aware orchestration in a single hardware-light web application. The stack is Next.js (frontend) + Express/Node.js (backend) + SQLite, running entirely local.

## Current Milestone: v1.1 Security, Debt & Test Stabilization

**Goal:** Harden security, resolve tech debt (caching, retention, lifecycle), and close critical integration and unit test gaps.

---

## Core Value

A relevance-selected panel of free OpenRouter models must deliver responses that equal or exceed a single free model baseline — if Council Mode doesn't outperform solo, the product has no reason to exist.

---

## Requirements

### Validated

*Inferred from existing implementation as of 2026-06-08 codebase map.*

- ✓ OpenRouter API key entry, validation, and bearer-token forwarding — Phase 1
- ✓ Free-model-only lock with PreflightGate enforcement (FREE_LOCK_VIOLATION) — Phase 1
- ✓ ModelPoolManager: live `/api/v1/models` fetch, free-model filtering, model_snapshots table — Phase 1
- ✓ CapabilityDetector: normalizes raw OpenRouter metadata into stable capability flags — Phase 1
- ✓ ModelCardSummarizer: derives structured card summaries stored in model_snapshots — Phase 1
- ✓ SettingsDeriver: maps model supported_parameters to UI control specs — Phase 1
- ✓ Streaming chat (SSE) with conversation history persisted to SQLite conversations table — Phase 1
- ✓ Quota display with "estimated" label fallback — Phase 1
- ✓ Pre-dispatch API call count preview — Phase 1
- ✓ session_events table with GoA + MoA telemetry columns (edge_matrix_json, layer_count, proposer_models_json, aggregation_calls, synthesis_rationale, synthesis_quality) — Phase 1/2
- ✓ TelemetryEngine: structured event writes to session_events — Phase 1
- ✓ RouterAgent: GoA node sampling via inclusionai/ring-2.6-1t:free, structured JSON AgentPlan output — Phase 2
- ✓ AgentOrchestrator.executeGoALite(): parallel responses, S scoring, τ pruning, max-pool — Phase 2
- ✓ AgentOrchestrator.executeGoAMoAHybrid(): GoA→MoA hybrid, agg_prompt.v1.txt, aggregator≠proposer constraint — Phase 2/5
- ✓ PreflightGate: all 7 violation types including AGGREGATOR_ROLE_CONFLICT — Phase 2
- ✓ Fast/Balanced/Deep/Adaptive reasoning effort modes — Phase 2
- ✓ Council retention rate rollback query + 60s polling (RetentionMonitor) — Phase 2
- ✓ Council Mode demotion banner + re-enable with council_reevaluated_after_ts — Phase 2
- ✓ policy_exceptions table with SHA-256 hash chain — Phase 2
- ✓ CouncilTrace UI: S scores, sampling rationale, agent roles, assigned models — Phase 2
- ✓ AgentProgressPanel: live agent card updates during council streaming — Phase 2
- ✓ OnboardingModal: first-run API key + privacy setup — Phase 2
- ✓ Upload capability detection: pdf_input / image_input gating in toolbar — Phase 3
- ✓ FileProcessor: text, Markdown, JSON, CSV, PDF extraction — Phase 3
- ✓ SQLite FTS5 index for uploaded file chunks (ftsSearchService) — Phase 3
- ✓ Upload privacy disclosure gate (UPLOAD_DISCLOSURE_PENDING) — Phase 3
- ✓ File Analyst routing to openrouter/owl-alpha with fallback — Phase 3
- ✓ Local-only storage: no cloud sync, no telemetry egress outside api.openrouter.ai — Phase 1
- ✓ BUG-01: Fix missing `createRateLimitMiddleware` import in backend/src/routes/upload.ts — v1.0
- ✓ BUG-02: Fix `abortSignal` scope bug in backend/src/agents/RouterAgent.ts — v1.0
- ✓ BUG-03: Fix AbortSignal|undefined passed as number in backend/src/dispatch/councilDispatch.ts — v1.0
- ✓ SEC-01: Add session ownership check to POST /dispatch — v1.0
- ✓ SEC-02: Add requireOwnedSession to PATCH /session/:id/revert — v1.0
- ✓ SEC-03: Gate POST /config behind requireApiKey + validate default_mode enum — v1.0
- ✓ SEC-04: Gate GET /config and GET /quota behind requireApiKey — v1.0
- ✓ DEBT-01: Eliminate dual session store split — persist owner_api_key_hash to sessions SQLite table — v1.0

### Active

*Immediate priority: fix bugs, security vulnerabilities, and tech debt before advancing the roadmap.*

**Security:**
- [ ] SEC-05: Audit all console.* calls in dispatch paths to confirm API key headers are not captured in logs

**Tech Debt (correctness and reliability):**
- [ ] DEBT-02: Add model_snapshots retention: delete all but last 5 rows after each refresh (currently grows unboundedly)
- [ ] DEBT-03: Add session_events retention in SessionCleanupMonitor (cascade delete events older than SESSION_TTL_MS)
- [ ] DEBT-04: Fix proposer cache key collision in AgentOrchestrator — replace weak length+prefix hash with SHA-256(prompt)
- [ ] DEBT-05: Wire ProviderHealthMonitor into gracefulShutdown to prevent write-after-close on SIGTERM
- [ ] DEBT-06: Add GET /sessions LIMIT clause + push ownership filter into SQL

**Test gaps (security-critical paths untested):**
- [ ] TEST-01: Integration tests for unauthenticated attack paths: POST /config, PATCH /session/:id/revert by non-owner, POST /dispatch with stolen sessionId
- [ ] TEST-02: Unit tests for sessionRegistry.ts (ownership logic, hash collision behavior)
- [ ] TEST-03: Unit tests for modelCardSummarizer.ts (normalization edge cases)

**Phase 4 (Structured Workbench — post-debt-cleanup):**
- [ ] JSON schema editor UI
- [ ] Structured-output toggle per session
- [ ] Schema validation on agent response
- [ ] Retry-on-invalid JSON with configurable max retries
- [ ] Value verification pass (secondary LLM validates structured output)
- [ ] Export to JSON/Markdown/CSV

**Phase 5 (Full GoA+MoA — post-Phase 4):**
- [ ] Full GoA bidirectional message passing (forward + reverse, 2 passes max) + graph pooling in executeGoAFull()
- [ ] Session-scoped proposer result cache (within-session reuse, not cross-session)
- [ ] S score history for cross-session model performance comparison
- [ ] Held-out eval gate for agg_prompt.v1.txt (≥15 human-scored cases across n=3, n=4, conflicting-fact subsets)

### Out of Scope

- Multi-user / team collaboration — single-user architecture by design; multi-tenancy would require RLS, OAuth, and cloud infra
- Local model serving (LM Studio-style) — hard constraint: no GPU, no local inference
- Fine-tuning, model training, or weight modification — outside product category
- Cloud-hosted multi-tenant SaaS — contradicts local-first architecture
- Non-OpenRouter providers — product thesis depends on OpenRouter free-model metadata
- Browser automation / autonomous web agent behavior — chat + routing UI only
- Guaranteed free-model availability — app adapts; cannot guarantee any specific model persists
- Vector database / semantic RAG — SQLite FTS5 is the Phase 1–3 retrieval layer (deferred to Phase 4+)
- Audio and video upload — conditional Phase 3 item, explicitly deferred
- User accounts, login, sync, cloud backup — not needed for single-user local app
- Full GoA bidirectional passing as default mode — exceeds ≤5 call budget for most configs; manual advanced mode only

---

## Context

**Existing codebase state (2026-06-08):** Phases 1–3 are fully completed. The dispatch layer, agent layer, module layer, and DB layer exist and match the PRD specification. Gating middleware restricts endpoint access, and session ownership survives process restarts because the SQLite database acts as the single source of truth. All 106 automated backend tests pass successfully.

**Known broken state:** None. Milestone v1.0 Stabilization successfully resolved all three build failures, gated mutation/config endpoints, and eliminated the dual session store split.

**Supporting operating documents:** `docs/hardeningprompt.md` (14-axis system hardening reference) and `docs/superprompt.md` (unified AI agent operating doctrine) define agent standards for FSV, issue protocol, and security hardening. All agent work on this repo should conform to those standards.

**Primary metric:** Council Retention Rate = `completed_in_council / routed_to_council` over a rolling 2-hour window. Hypothesis invalidated if rate < 0.50 with ≥5 samples — triggers automatic demotion of Council Mode.

**Algorithmic foundation:** Graph-of-Agents (GoA, arXiv:2604.17148) for node sampling + Mixture-of-Agents (MoA, arXiv:2406.04692) for aggregation. Budget constraint: 1 GoA meta + 3 proposers + 1 aggregator = 5 total free API calls maximum.

---

## Constraints

- **Budget**: $0 — only free OpenRouter models, free GitHub plan, no paid infra
- **API cap**: ≤5 free OpenRouter API calls per session (enforced by PreflightGate BUDGET_VIOLATION gate)
- **Runtime**: node:sqlite experimental API (Node.js 22.5+); breaking changes possible — single adapter at `backend/src/db/connection.ts`
- **Architecture**: Single-user local-first; no horizontal scaling, no multi-tenancy
- **Free-only lock**: Default enabled; all agent assignments must satisfy `is_free = true`; paid model access only if user explicitly disables lock with persistent yellow banner
- **Privacy**: No application-owned cloud sync; no telemetry egress outside `api.openrouter.ai`; API key never logged, never stored in SQLite
- **Import order**: `db → modules → agents → dispatch → routes` (acyclic; circular imports forbidden)
- **Shared types**: All cross-boundary interfaces live in `shared/index.ts` exclusively

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GoA node sampling as routing algorithm | arXiv:2604.17148 shows GoA_3 achieves MMLU 79.18% vs 75.71% for 6-agent full pool — validates ≤5-agent cap | — Pending validation |
| MoA Aggregate-and-Synthesize as fusion layer | arXiv:2406.04692: n=3 diverse proposers (58.0% AlpacaEval) beats GPT-4o (57.5%) and any single proposer | — Pending validation |
| 1-layer MoA hard constraint under ≤5 call budget | 2-layer MoA requires ≥7 calls (1 meta + n_layer1 + n_layer2 + 1 agg) — exceeds free cap for any meaningful proposer count | ✓ Good |
| SQLite (node:sqlite) for all persistence | Zero additional infra; local-first; FTS5 available natively | ⚠ Revisit — node:sqlite is experimental; adapter isolates risk |
| SSE for streaming | All LLM responses stream as Server-Sent Events; no JSON buffering | ✓ Good |
| Aggregator ≠ proposer hard constraint | MoA paper Table 4 shows asymmetric role performance; same model as both degrades output | ✓ Good |
| SessionRegistry (in-memory) + SessionStore (SQLite) dual-store | Original design separated ownership from persistence | ✗ Replaced with SQLite single source of truth |
| src/agents/router/prompt.v1.txt + src/agents/moa/agg_prompt.v1.txt versioned | Any prompt change requires re-running held-out eval before deploy | ✓ Good |
| PreflightGate as single enforcement point | Centralized policy before every dispatch prevents bypass | ✓ Good |
| Phase ordering hard constraint (BUILD → SESSION → AUTH) | Prevents regressions where restart causes legitimate sessions to 403. | ✓ Good |
| Strategy B chosen for session ownership | SessionStore (SQLite) acts as the single source of truth; avoids sync code and startup hydration. | ✓ Good |
| Positional correction for BUG-03 | Trailing parameter removed from signature rather than cast to type to ensure consistency. | ✓ Good |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-08 after v1.1 Security, Debt & Test Stabilization milestone start*
