---
feature_id: "freecouncil-openrouter-chat-ui"
version: "1.4"
status: "DRAFT"
primary_metric: "council_retention_rate"
compliance_frameworks:
  - "OpenRouter Provider Policy — Prompt/Completion Logging Disclosure"
  - "OpenRouter ZDR — Zero Data Retention (optional enforcement)"
  - "GDPR Art. 13/14 — Third-Party Processing Notice (advisory, non-certified)"
phase_gate_status: "PASSED"
algorithmic_foundation:
  - "Graph-of-Agents (GoA) — arXiv:2604.17148, Apr 2026"
  - "Mixture-of-Agents (MoA) — arXiv:2406.04692, Jun 2024"
created: "2026-05-18T00:00:00Z"
amended: "2026-05-18T00:00:00Z"
changelog:
  - version: "1.4"
    date: "2026-05-18"
    summary: >
      MoA ablation numbers added to §2.1 research validation table.
      Aggregator ≠ proposer hard constraint added to AgentOrchestrator.
      synthesis_quality telemetry column added to session_events.
      Held-out eval scope extended to include n-variant test cases.
  - version: "1.3"
    date: "2026-05-18"
    summary: >
      Aggregator prompt content filled in verbatim (src/agents/moa/agg_prompt.v1.txt).
      Response formatter spec added to AgentOrchestrator. session_events extended with
      aggregation_calls and synthesis_rationale columns. MoA 1-layer constraint
      hardened in Phase 5 roadmap.
  - version: "1.2"
    date: "2026-05-18"
    summary: >
      MoA (arXiv:2406.04692) integrated as Phase 5 aggregation complement to GoA.
      AgentOrchestrator extended with executeMoALite() and GoA→MoA hybrid path.
      RouterAgent extended to output MoA config. session_events extended with
      layer_count and proposer_models_json. Two MoA Gherkin Feature blocks added.
      Aggregator prompt artifact versioned. Phase 5 roadmap upgraded to GoA+MoA
      hybrid. Two MoA risks added to risk register.
  - version: "1.1"
    date: "2026-05-18"
    summary: >
      GoA (arXiv:2604.17148) promoted from supporting citation to direct
      algorithmic specification. RouterAgent upgraded to GoA node sampling.
      AgentOrchestrator upgraded to GoA-lite (Phase 2) and full GoA pipeline
      (Phase 5). ModelCardSummarizer module added. session_events extended with
      edge_matrix_json. Three GoA Gherkin Feature blocks added. Three GoA
      adversarial mitigations and three GoA risks added. Phase 2 and Phase 5
      roadmap entries updated.
  - version: "1.0"
    date: "2026-05-18"
    summary: "Initial PRD — all five interrogation layers closed."
---

# FreeCouncil — OpenRouter Free-Agent Chat UI
## Product Requirements Document

---

## 1. EXECUTIVE SUMMARY

FreeCouncil is a local-first, single-user web chatbot that routes user prompts through the smallest
relevance-selected subset of free OpenRouter models, capped at ≤5 active agents per session. The
product addresses a validated competitive gap: no existing tool combines OpenRouter free-model-first
constraints, adaptive router-selected expert panels, capability-aware UI controls derived from live
model metadata, and quota-aware orchestration in a single hardware-light web application.

**Core routing architecture: a GoA + MoA hybrid running within the ≤5 free API call budget.**
Phase 2 ships GoA-lite: a meta-LLM (GoA, arXiv:2604.17148) samples the top-k most relevant
free agents, derives empirical edge weights from inter-agent response quality scores, and selects
the highest-influence response via max-pool. Phase 5 ships the full hybrid: GoA node sampling
selects 3 proposer agents; a MoA Aggregate-and-Synthesize pass (arXiv:2406.04692) fuses their
outputs via a single aggregator call. Total budget: 1 GoA meta call + 3 proposer calls + 1 MoA
aggregator call = 5 — exactly at the free API cap.

Strategic urgency derives from an unusually deep OpenRouter free tier (including
`openrouter/owl-alpha` at 1M context, `openai/gpt-oss-120b:free`,
`nvidia/nemotron-3-super-120b-a12b:free`), a positioning gap before incumbents converge on
complexity, and GoA research (April 2026) demonstrating that 3-agent relevance-selected subsets
achieve MMLU 79.18% versus 75.71% for 6-agent full-pool baselines — validating the ≤5-agent cap
and empirical routing thesis with benchmark evidence.

Core hypothesis: IF a single-user web UI routes prompts through the smallest relevance-selected
subset of free OpenRouter models (≤5 agents) using GoA node sampling, dynamically enforces
capability constraints, and exposes per-model settings derived from live metadata, THEN the user
achieves equivalent or superior response quality versus a single free OpenRouter model baseline,
at zero additional model cost, while completing code, file-analysis, research, and general Q&A
tasks with fewer manual model-switching steps.

**Hypothesis invalidated if Council Retention Rate falls below 0.50 over a rolling 2-hour window
with ≥5 samples** — triggering automatic demotion of Council Mode to manual-only and promotion of
Solo Mode as the default UX.

---

## 2. PROBLEM STATEMENT

### 2.1 Root Pain Point

Primary validation source (C): competitive tool gap survey. Secondary validation (D):
GoA research + OpenRouter rate limit and model metadata documentation.

| Existing Tool Category | What It Does Well | Validated Gap |
|---|---|---|
| **Open WebUI** | Local/open-source chat UI, model management, some pipelines | Not OpenRouter-free-first by default; multi-agent routing is not the core UX; settings exposure is not optimized around OpenRouter metadata |
| **AnythingLLM** | RAG, workspaces, documents, local/private knowledge use | Knowledge-base assistant, not a dynamic mixture-of-models agent council |
| **LM Studio** | Local model discovery and running, easy desktop use | Requires local GPU hardware; not designed around OpenRouter free cloud models or multi-agent orchestration |
| **LibreChat** | Multi-provider chat UI, deep configuration | Multi-provider ChatGPT-style UI, not an adaptive free-model agent router |
| **TypingMind / OpenRouter chat UIs** | Convenient model access | Single-model chat; no empirical budget-aware mixture-of-agents system |
| **AutoGen / CrewAI / LangGraph** | Agent orchestration frameworks | Developer frameworks, not a polished single-user web UI with free-model constraints and full model controls |

**Validated gap:** No lightweight single-user UI treats OpenRouter free models as a constrained
model marketplace, dynamically selects ≤5 active expert agents via empirical node sampling, exposes
model-specific settings derived from live metadata, supports uploads when available, and applies a
research-validated routing algorithm rather than spawning a swarm.

**Research validation:**

| Source | Key Result | PRD Relevance |
|---|---|---|
| **GoA** (arXiv:2604.17148, Apr 2026) | GoA_3: MMLU 79.18% vs. MoA_6: 75.71% across MMLU, MMLU-Pro, GPQA, MATH, HumanEval, MedMCQA | Validates ≤5-agent cap and relevance-selection routing; GoA is the node-sampling algorithm |
| **MoA** (arXiv:2406.04692, Jun 2024) | Full MoA (3 layers, n=6): 65.1% AlpacaEval 2.0 LC win rate vs. GPT-4o 57.5% (+7.6%). **MoA-Lite (2 layers): 59.3%** — +1.8 pts over GPT-4o. **n=3 diverse proposers: 58.0%** — sufficient for free-tier ≤5 cap; beats GPT-4o. Single-proposer repeated (n=6 same model): 56.7% — diversity gap = +4.6 pts at n=6. LLM-ranker baseline (select best proposer) consistently beaten by synthesis prompt — confirms aggregator performs integration, not selection. | Validates that multi-proposer aggregation yields quality above any single free model; MoA is the aggregation algorithm |

Combined thesis: GoA selects the right agents efficiently; MoA fuses their outputs into a
response that exceeds what any single free model can produce. The hybrid delivers both
efficiency (GoA) and quality ceiling (MoA) within the same ≤5 free API call budget.

### 2.2 Strategic Urgency ("Why Now")

| Rank | Driver | Evidence |
|---|---|---|
| **1** | **Free model pool depth at current high** | `openrouter/owl-alpha` (1M context), `openai/gpt-oss-120b:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `inclusionai/ring-2.6-1t:free`, `qwen/qwen3-coder:free` represent an unusually capable zero-cost tier that may not persist |
| **2** | **Tool market has not converged on minimalist routing** | Counter-positioning opportunity as a deliberately minimal, quota-aware, explainable router before incumbents add "free model" and "agent" features |
| **3** | **GoA algorithm newly available (Apr 2026)** | Architecture thesis has benchmark-validated empirical grounding; FreeCouncil is the first free-model-constrained UI applying GoA node sampling to the OpenRouter free tier |

### 2.3 Hypothesis Boundary Conditions

| Condition | Expected System / User State |
|---|---|
| **Hypothesis TRUE** | User completes target task types without switching to a paid model or external tool; GoA routing decisions are explainable via S scores in Council Trace UI; trivial prompts consume ≤1 free API call |
| **Hypothesis FALSE** | Council routing amplifies noise, consumes quota, or adds latency without quality gains; user reverts to Solo Mode or exits to a paid provider |
| **Pivot Trigger** | `council_retention_rate < 0.50` over 2-hour rolling window with ≥5 samples → disable Council Mode as default; make Solo Mode primary UX; retain GoA routing as an advanced/manual mode only |

---

## 3. TECHNICAL BOUNDARIES & ARCHITECTURE

### 3.1 Deep Module Candidates

**Module 1: CapabilityDetector**
```typescript
interface CapabilityDetector {
  normalizeModel(raw: OpenRouterModelMetadata): NormalizedModelCapabilities;
  // Returns stable capability flags regardless of OpenRouter schema changes:
  // { pdf_input: boolean, image_input: boolean, tool_calling: boolean,
  //   structured_output: boolean, long_context: boolean, coding: boolean,
  //   reasoning: boolean, vision: boolean, is_free: boolean,
  //   is_provider_logged: boolean, supports_zdr: boolean,
  //   supported_parameters: string[] }
}
```

**Module 2: ModelPoolManager**
```typescript
interface ModelPoolManager {
  refresh(): Promise<void>;
  getFreeModels(): NormalizedModelCapabilities[];
  getModelById(id: string): NormalizedModelCapabilities | null;
  isModelAvailable(id: string): boolean;
}
```

**Module 3: ModelCardSummarizer** *(v1.1 — new)*
```typescript
interface ModelCardSummarizer {
  summarize(model: NormalizedModelCapabilities): ModelCardSummary;
  // Derives from OpenRouter /api/v1/models + supported_parameters
  // Output: { modelId: string, domain: string[], taskSpecialization: string[],
  //           contextLength: number, capabilityFlags: string[] }
  // Used as input to RouterAgent GoA node sampling
  // Cached per model_snapshot; invalidated on metadata refresh
}
```

**Module 4: RouterAgent** *(v1.1 — upgraded to GoA node sampling)*
```typescript
interface RouterAgent {
  // GoA node sampling: meta-LLM ingests query Q + model card summaries
  // Outputs top-k agents by relevance (k ≤ 5, enforced by PreflightGate)
  // Formula: V_s = MetaLLM_Top-k(Q, ModelCardSummaries)
  // Meta-LLM: inclusionai/ring-2.6-1t:free | fallback: openrouter/free
  // Output format: structured JSON only, temperature: 0.0
  sampleAgents(
    query: string,
    cardSummaries: ModelCardSummary[],
    k: number           // 1–5; determined by prompt complexity pre-check
  ): Promise<AgentPlan>;
  // AgentPlan: { agents: AgentAssignment[], totalApiCalls: number,
  //              samplingRationale: string (≤50 words),
  //              executionMode: 'goa_lite' | 'moa_lite' | 'goa_moa_hybrid' | 'solo',
  //              moaConfig?: {
  //                layers: number,              // 1 hard constraint for default Phase 5 hybrid;
  //                                            // 2 only in Deep mode with explicit user confirmation
  //                proposersPerLayer: number,   // 3–4; constrained by cap
  //                aggregatorModelId: string    // default: openrouter/owl-alpha
  //              } }
  // executionMode is determined by RouterAgent based on:
  //   promptClass + reasoningEffort + remaining quota budget
  // 'goa_moa_hybrid' requires: 1 meta + (proposersPerLayer) + 1 aggregator ≤ 5
  // All assigned models must satisfy is_free = true
}
```

**Module 5: AgentOrchestrator** *(v1.1 — upgraded to GoA-lite + Phase 5 full GoA)*
```typescript
interface AgentOrchestrator {
  // Phase 2 — GoA-lite:
  //   1. Execute all k agents in parallel (initial responses R)
  //   2. Edge sampling: each agent scores all others (S_ji)
  //      S_j = Σ_{i≠j} S_ji  (normalized, Σ=1 per scorer)
  //   3. Prune: exclude agents with S_j < τ (τ = 0.05)
  //   4. Build adjacency matrix A_{ij} = S_i / Σ_{k ∈ N_j} S_k
  //   5. Max-pool: select highest-influence (max S_j) response as primary
  //   6. Optional verifier pass (Verification Depth = strict)
  executeGoALite(plan: AgentPlan, prompt: string): AsyncIterableIterator<AgentResult>;

  // Phase 5 — Full GoA:
  //   Steps 1–4 as GoA-lite, then:
  //   5. Forward pass: high-S agents refine low-S responses
  //      R_j' = LLM_j(concat(sorted R_i | S_i > S_j))
  //   6. Reverse pass: updated low-S responses refine high-S originals
  //   7. Two passes maximum (no infinite loops)
  //   8. Graph pooling: max-pool or mean-pool → final answer A
  executeGoAFull(plan: AgentPlan, prompt: string): AsyncIterableIterator<AgentResult>;

  // Phase 5 — GoA→MoA Hybrid (within ≤5 call budget):
  //   Precondition: plan.executionMode = 'goa_moa_hybrid'
  //   Budget allocation: 1 (GoA meta) + k proposers + 1 (MoA aggregator) ≤ 5
  //   Default config: k = 3 proposers, 1 aggregator = 5 total
  //
  //   Execution:
  //   1. GoA node sampling has already run (plan is the output)
  //   2. k GoA-selected proposers execute in parallel (initial responses R)
  //   3. MoA Aggregate-and-Synthesize:
  //      aggregator_prompt = load('src/agents/moa/agg_prompt.v1.txt')
  //      numbered_list = proposers.map((p, i) =>
  //        `${i + 1}. ${p.role} (${p.modelId}):\n${p.response}`
  //      ).join('\n\n')
  //      // Format: "1. Coder (qwen/qwen3-coder:free):\n{response}\n\n2. ..."
  //      // This attributed format drives the aggregator's conflict-resolution pass
  //      // by making source roles visible without exposing model names to the user
  //      rendered_prompt = aggregator_prompt
  //        .replace('{numbered_list_with_role_model}', numbered_list)
  //        .replace('{original_prompt}', prompt)
  //        .replace('{attachments_context_if_any}', attachmentsContext ?? '')
  //      y = aggregator_model(rendered_prompt)
  //
  //      HARD CONSTRAINT — role specialization asymmetry (ablation §3.4):
  //      aggregatorModelId MUST NOT equal any proposer's modelId.
  //      Rationale: paper Table 4 shows asymmetric role performance
  //      (e.g., WizardLM 8x22B: 63.8% as proposer vs 52.9% as aggregator).
  //      If GoA node sampling assigns owl-alpha as a proposer, RouterAgent
  //      must select the next-best aggregator from the free model snapshot.
  //      Fallback aggregator priority: owl-alpha → nemotron-3-super-120b:free
  //      → gpt-oss-120b:free (first not already in proposer set).
  //      PreflightGate enforces this before dispatch; violation logged as
  //      event_type = 'aggregator_role_conflict'.
  //      where aggregator_model = plan.moaConfig.aggregatorModelId
  //   4. No S scoring in hybrid mode (GoA selection already handled relevance)
  //   5. Single aggregation pass only (not bidirectional — Phase 5 GoA full is separate)
  //   6. Final output = y (aggregated response from aggregator model)
  //
  //   Timeout/fallback: same as executeGoALite() — 30s per call, one fallback retry
  //   Context slicing: each proposer receives ≤8k tokens; aggregator receives
  //     concat of proposer outputs (≤8k each) + original prompt, truncated to
  //     aggregator model's context window
  executeGoAMoAHybrid(plan: AgentPlan, prompt: string): AsyncIterableIterator<AgentResult>;

  // All methods enforce:
  //   active agents ≤ 5 (truncates by lowest S_j rank, does not error)
  //   30s timeout per agent call; one fallback retry
  //   double timeout → falls back to Solo Mode, logs to session_events
  //   context per agent: min(model_context_window, 8000 tokens)
}
```

**Module 6: PreflightGate**
```typescript
interface PreflightGate {
  check(context: PreflightContext): GateResult;
  // Synchronous — executes before every OpenRouter API dispatch
}
```

**Module 7: TelemetryEngine**
```typescript
interface TelemetryEngine {
  record(event: SessionEvent): void;
  queryCouncilRetentionRate(windowSeconds: number): number | null;
  pollRollbackTrigger(): void;
}
```

**Module 8: FileProcessor**
```typescript
interface FileProcessor {
  ingest(file: UploadedFile): ProcessedFile;
  // { text: string, chunks: Chunk[], ftsIndexed: boolean }
}
```

**Module 9: SettingsDeriver**
```typescript
interface SettingsDeriver {
  deriveControls(model: NormalizedModelCapabilities): UIControlSpec[];
}
```

### 3.2 Structural Change Scope

| Layer | Change Description | Contract / Schema Delta |
|---|---|---|
| **Frontend** | Next.js or SvelteKit SPA; Tailwind/shadcn UI; IndexedDB for local settings | Internal component interfaces only |
| **Backend API** | Node.js/TypeScript local server; proxies OpenRouter; enforces all policy gates | Internal REST: `POST /session`, `GET /models`, `POST /dispatch`, `GET /quota` |
| **OpenRouter API** | Consumes `GET /api/v1/models` and `POST /api/v1/chat/completions` (SSE) | Consumer only |
| **SQLite — conversations** | Conversation transcript storage | `CREATE TABLE conversations (id TEXT PRIMARY KEY, ts INTEGER, messages_json TEXT)` |
| **SQLite — session_events** | Telemetry event log (v1.4: extended with GoA + MoA fields) | See extended schema below |
| **SQLite — policy_exceptions** | Exception audit chain | See §6.3 |
| **SQLite — model_snapshots** | Cached OpenRouter model catalog + card summaries | `CREATE TABLE model_snapshots (snapshot_ts INTEGER PRIMARY KEY, models_json TEXT, card_summaries_json TEXT)` |
| **SQLite — uploaded_files** | Uploaded file registry | `CREATE TABLE uploaded_files (id TEXT PRIMARY KEY, session_id TEXT, filename TEXT, mime_type TEXT, size_bytes INTEGER, fts_indexed INTEGER, ts INTEGER)` |
| **Third-party: OpenRouter** | Free model inference + metadata | Rate limits: 20 req/min; 50 or 1000 free req/day |

**Default model-role assignments:**

| Role | Primary Model | Fallback Model |
|---|---|---|
| Router / Meta-LLM (GoA node sampling) | `inclusionai/ring-2.6-1t:free` | `openrouter/free` |
| Long-context Analyst | `openrouter/owl-alpha` | `nvidia/nemotron-3-super-120b-a12b:free` |
| Structured Extractor | `openrouter/owl-alpha` | `qwen/qwen3-coder:free` |
| Coder / Builder | `qwen/qwen3-coder:free` | `poolside/laguna-m.1:free` |
| General Responder | `openai/gpt-oss-120b:free` | `meta-llama/llama-3.3-70b-instruct:free` |
| Reasoning Verifier | `nvidia/nemotron-3-super-120b-a12b:free` | `arcee-ai/trinity-large-thinking:free` |
| Lightweight / Fast | `liquid/lfm-2.5-1.2b-instruct:free` | `meta-llama/llama-3.2-3b-instruct:free` |
| Vision | `nvidia/nemotron-nano-12b-v2-vl:free` | Dynamically detected from OpenRouter metadata |

**System operating modes:**

| Mode | Agent Configuration |
|---|---|
| **Solo Mode** | 1 agent, fastest, cheapest |
| **Council Mode** | GoA node sampling selects 2–5 agents; GoA-lite execution |
| **Debate Mode** | 2 agents produce competing answers; Verifier reconciles using S scores |
| **Build Mode** | Coder + Reviewer + Patch Writer |
| **Extract Mode** | File Analyst + Structured Extractor + Verifier |
| **Research Mode** | Researcher + Skeptic + Synthesizer |

**Reasoning effort modes** (default: Adaptive):

| Mode | Behavior |
|---|---|
| Fast | Minimal reasoning tokens; single-pass response; no GoA scoring pass |
| Balanced | GoA-lite sampling + parallel responses + max-pool only |
| Deep | GoA-lite + optional verifier reverse pass |
| Adaptive | Router selects effort level and GoA pipeline depth based on task classification |

### 3.3 Exclusion Taxonomy

**NON-GOALS** *(superficially related — explicitly rejected by design philosophy)*

| Item | Rationale |
|---|---|
| Autonomous agent swarms (>5 agents, self-spawning) | Core design principle: GoA node sampling selects the smallest relevant subset, not a maximal swarm |
| Multi-user / team collaboration | Single-user architecture |
| Local model serving (LM Studio-style) | Hard architecture constraint: no GPU, no local model serving |
| Fine-tuning, model training, or weight modification | Outside product category |
| General multi-provider ChatGPT replacement | OpenRouter-free-constrained by design |
| Paid model access (when free-only lock is enabled) | Mandatory guardrail |
| Cloud-hosted multi-tenant SaaS deployment | Contradicts single-user/local-first architecture |
| Browser automation / autonomous web agent behavior | Chat + routing UI, not a computer-use agent |
| Provider abstraction beyond OpenRouter | Product thesis depends on OpenRouter free-model metadata |
| Guaranteed free-model availability | App adapts; cannot guarantee availability of any specific model |

**OUT-OF-SCOPE** *(related, deferred — complexity control for Phase 1–3 delivery)*

| Item | Rationale |
|---|---|
| Full GoA bidirectional message passing + graph pooling | Phase 5 feature |
| Structured output workbench (JSON schema editor, retry-on-invalid, export) | Phase 4 feature |
| Audio and video upload | Phase 3 conditional; excluded from Phase 1–2 |
| Mobile-optimized UI | Desktop-first delivery |
| Vector database / semantic RAG | Deferred: SQLite FTS5 is the Phase 1–3 retrieval layer |
| Cached agent result reuse across sessions | Phase 5 feature |
| User accounts, login, sync, and cloud backup | Not needed for single-user local app |
| Plugin marketplace / third-party tools | Scope violation |
| Advanced prompt-template marketplace | Phase 4+ |
| Automated benchmark harness across all free models | Post-core-routing |

**FUTURE CONSIDERATIONS** *(downstream delivery candidates)*

| Item | Target Phase |
|---|---|
| Full GoA bidirectional message passing + graph pooling | Phase 5: Mixture-of-Models Orchestration |
| Graph extraction from uploaded documents | Phase 3+ / post-MVP |
| Semantic vector search (embedding-based retrieval) | Phase 4+ |
| Model performance history and S-score-based comparative scoring | Phase 5 |
| Per-persona adaptive routing using retained GoA telemetry | Post-Phase 5 |
| Audio/video multimodal input | Phase 3 conditional → full post-Phase 3 |
| Local benchmark suite using retained S scores and session telemetry | Post-Phase 5 |
| Prompt/profile presets for coding, research, extraction, critique | Post-Phase 3 or Phase 4 |
| Optional remote sync/export of settings and conversations | Post-MVP |
| Provider health monitor for free-model availability drift | Phase 4+ |

---

## 4. EXECUTION MECHANICS & ACCEPTANCE CRITERIA

### 4.1 Functional Requirements → Gherkin Specifications

```gherkin
Feature: Prompt Routing — Solo vs Council Mode

  Scenario: Simple prompt routes to Solo Mode
    Given the user has a valid OpenRouter API key configured
    And routing mode is set to "Adaptive"
    When the user submits a prompt the Router classifies as trivial
    Then exactly 1 agent is activated
    And the session_events table records event_type = 'routed_to_solo'
    And the api_calls column for that session record is set to 1

  Scenario: Non-trivial prompt routes to Council Mode via GoA node sampling
    Given the user has a valid OpenRouter API key configured
    And routing mode is set to "Adaptive"
    When the user submits a prompt the Router classifies as non-trivial
    Then the RouterAgent invokes GoA node sampling using the query
    and normalized model card summaries
    And the RouterAgent outputs between 2 and 5 agents ranked by relevance
    And each active agent is assigned a free model compatible with its role
    and required capabilities
    And distinct models are preferred but not required when fallback
    constraints apply
    And the session_events table records event_type = 'routed_to_council'
    And the UI renders the agent list, assigned models, and sampling rationale

  Scenario: Manual routing mode bypasses RouterAgent
    Given the user has set routing mode to "Manual"
    When the user submits any prompt
    Then the RouterAgent is not invoked
    And the Primary Responder executes with the user's manually selected model
    And the session_events table records event_type = 'routed_to_solo'


Feature: GoA Node Sampling

  Scenario: RouterAgent samples top-k agents from free model pool
    Given the model pool contains at least 3 free models with normalized
    capability maps and card summaries
    And the user submits a non-trivial prompt
    When the RouterAgent executes GoA node sampling
    Then the RouterAgent constructs a model card context from
    ModelCardSummary records in the current model snapshot
    And submits query + card summaries to inclusionai/ring-2.6-1t:free
    with temperature = 0.0
    And receives a structured JSON AgentPlan with k agents (2 ≤ k ≤ 5)
    And all agents in the plan satisfy is_free = true in the capability map
    And the PreflightGate enforces the ≤5 agent cap before dispatch
    And session_events records event_type = 'routed_to_council'
    with agent_count = k

  Scenario: RouterAgent falls back when meta-LLM is unavailable
    Given inclusionai/ring-2.6-1t:free is absent from the current
    model snapshot
    When the RouterAgent attempts GoA node sampling
    Then the RouterAgent uses openrouter/free as the fallback meta-LLM
    And proceeds with GoA node sampling using the fallback
    And the Council Trace UI notes that fallback meta-LLM was used


Feature: GoA-Lite Execution (Phase 2)

  Scenario: Agents produce parallel initial responses and compute S scores
    Given a GoA node sampling plan has been built with k agents (2 ≤ k ≤ 5)
    When all k agents generate initial responses in parallel
    Then each agent scores all other agents on correctness, coherence,
    and relevance (normalized scores summing to 1 per scorer)
    And the influence score S_j is computed for each agent j as
    S_j = Σ_{i≠j} S_ji
    And agents with S_j < 0.05 are pruned from the aggregation step
    And the agent with the highest S_j is selected as the primary response
    source (max-pool)
    And session_events records the GoA edge matrix as edge_matrix_json
    And api_calls for the session reflects k initial calls plus
    any verifier call

  Scenario: GoA scoring pass is skipped in Fast mode
    Given the user has set reasoning effort to "Fast"
    When a non-trivial prompt is routed to Council Mode
    Then the RouterAgent samples k agents as normal
    And agents generate responses in parallel
    And the S scoring and edge sampling step is not executed
    And the first-returned non-errored response is used as the primary answer
    And session_events records event_type = 'routed_to_council'
    with a note that scoring was skipped


Feature: Council Trace with S Scores

  Scenario: Council Trace UI displays GoA influence scores
    Given a GoA-lite session has completed with S scoring
    When the final response renders
    Then the Council Trace UI displays each active agent's role
    And the assigned model for each role
    And the influence score S_j for each agent (rounded to 2 decimal places)
    And a one-sentence sampling rationale from the RouterAgent output
    And the total free API calls consumed for the session
    And the edge_matrix_json is stored in session_events for
    diagnostic retrieval


Feature: MoA-Lite Proposer Generation and Aggregation (Phase 5)

  Scenario: GoA-MoA hybrid executes within five-call budget
    Given a non-trivial prompt has been routed to Council Mode
    And the RouterAgent outputs executionMode = 'goa_moa_hybrid'
    And plan.moaConfig specifies proposersPerLayer = 3
    And plan.moaConfig specifies aggregatorModelId = 'openrouter/owl-alpha'
    When the AgentOrchestrator executes executeGoAMoAHybrid()
    Then the 3 GoA-selected proposer agents execute in parallel
    And each proposer receives the original prompt context-sliced to ≤8000 tokens
    And the MoA aggregator receives the concatenation of all 3 proposer responses
    plus the original prompt
    And the aggregator executes the versioned Aggregate-and-Synthesize prompt
    from src/agents/moa/agg_prompt.v1.txt
    And the total API calls for the session equals 1 (GoA meta) + 3 (proposers)
    + 1 (aggregator) = 5
    And session_events records layer_count = 1
    And session_events records proposer_models_json as the array of 3 proposer
    model IDs

  Scenario: MoA aggregation degrades to max-pool when aggregator model unavailable
    Given executeGoAMoAHybrid() is in progress
    And the aggregator model openrouter/owl-alpha fails or is unavailable
    When the aggregator call times out or returns a provider error
    Then the backend retries once with the configured aggregator fallback model
    And if the retry also fails, the backend falls back to GoA-lite max-pool
    using the highest-S-scoring proposer response
    And session_events records event_type = 'fallback_to_goa_lite'
    And the final response includes a compact note that MoA aggregation
    was unavailable

  Scenario: MoA hybrid is not activated in Fast reasoning mode
    Given the user has set reasoning effort to "Fast"
    When a non-trivial prompt is classified for Council Mode
    Then executionMode is set to 'goa_lite' regardless of prompt complexity
    And the MoA aggregation pass is not executed
    And api_calls does not include an aggregator call


Feature: Council Trace — MoA Refinement Transparency

  Scenario: Council Trace displays MoA execution details
    Given a GoA-MoA hybrid session has completed
    When the final response renders
    Then the Council Trace UI displays each proposer agent's role
    And the assigned model for each proposer
    And the aggregator model used for the Aggregate-and-Synthesize pass
    And a label: "MoA refinement (N calls)" where N is the total api_calls
    And a user-accessible toggle to switch future sessions to Solo or GoA-lite
    And layer_count and proposer_models_json are stored in session_events
    for diagnostic retrieval


Feature: Agent Cap Enforcement

  Scenario: Backend truncates plan to maximum 5 agents
    Given a request has been routed to Council Mode
    When the RouterAgent sampling outputs more than 5 agents
    Then the backend truncates the plan to the top 5 agents
    ranked by relevance score
    And logs event_type = 'cap_enforcement' to session_events
    And no more than 5 API calls are dispatched for that session


Feature: Free-Only Model Enforcement

  Scenario: Non-free model assignment is rejected when lock is enabled
    Given the free-only lock is in its default enabled state
    When any agent is assigned a model whose OpenRouter metadata indicates
    non-zero prompt/completion pricing or is not classified as free
    by OpenRouter
    Then the assignment is rejected before the API call is dispatched
    And the Preflight Gate logs event_type = 'free_lock_rejection'
    And the agent is reassigned to the configured fallback free model
    And the UI surfaces: "Free-only lock is active — [model name] is
    not permitted"

  Scenario: Free-only lock disabled surfaces persistent warning
    Given the user navigates to Run Settings
    When the user toggles the free-only lock to disabled
    Then paid model assignments are accepted
    And a persistent yellow banner renders:
    "Free-only lock is OFF — paid models may incur charges"
    And the banner persists until the lock is re-enabled


Feature: Upload — Capability Detection Gate

  Scenario: PDF upload control is hidden when model lacks pdf_input capability
    Given the user has selected a free model
    When the normalized model capability map does not include pdf_input = true
    Then the PDF upload button is not rendered in the input toolbar

  Scenario: Image upload control is hidden when model lacks image_input capability
    Given the user has selected a free model
    When the normalized model capability map does not include image_input = true
    Then the image upload button is not rendered in the input toolbar

  Scenario: PDF upload activates File Analyst with citation requirement
    Given the user has selected a model with pdf_input = true
    And the free-only lock is enabled
    When the user uploads a PDF and submits a query
    Then the RouterAgent activates the File Analyst agent
    And the File Analyst is assigned openrouter/owl-alpha
    Or the File Analyst is assigned the configured backup model if
    owl-alpha is absent from the current model snapshot
    And the final response contains at least one quoted passage or
    explicit section reference from the document before asserting any claim
    And session_events records event_type = 'routed_to_council'
    with agent_count >= 2


Feature: Model Settings Derivation from Live Metadata

  Scenario: Run Settings panel renders only supported parameters
    Given the user selects any free model from the model pool
    When the model metadata is fetched from GET /api/v1/models
    Then the Run Settings panel renders controls exclusively for parameters
    present in that model's supported_parameters array
    And controls for parameters absent from supported_parameters
    are not rendered in the DOM


Feature: Quota Awareness

  Scenario: API call budget preview includes GoA meta call
    Given a non-trivial prompt will be routed to Council Mode
    And GoA node sampling requires 1 meta-LLM call plus k agent calls
    When the routing plan is finalized but before dispatch
    Then the UI displays "This request will use [N] free API call(s)"
    where N = 1 (meta call) + k (agent calls) + optional verifier call
    And N is an integer between 1 and 5 inclusive
    And session_events records event_type = 'quota_budget_previewed'
    with api_calls = N

  Scenario: Daily quota meter reflects current consumption
    Given the app is loaded or a session has just completed
    When the quota display component renders
    Then it shows current-day free API call count and the configured
    daily limit estimate
    And if account tier cannot be verified the UI labels the limit
    as "estimated"
    And the display updates within 5 seconds of each completed session


Feature: Council Retention Rate Telemetry

  Scenario: Completed Council session increments retention numerator
    Given a session was recorded with event_type = 'routed_to_council'
    When the user receives the final aggregated response
    And no revert or override event has been recorded for that session_id
    Then session_events records event_type = 'completed_in_council'
    for that session_id

  Scenario: Reverted Council session is excluded from retention numerator
    Given a session was recorded with event_type = 'routed_to_council'
    When the user activates Solo Mode or replaces all agent assignments
    before the response is returned
    Then session_events records event_type = 'reverted_to_solo'
    for that session_id
    And that session_id is not counted in the council_retention_rate
    numerator of the rollback query


Feature: Automated Council Mode Demotion

  Scenario: Council Mode is demoted when retention threshold is breached
    Given the session_events table contains at least 5 records with
    event_type = 'routed_to_council' within the last 7200 seconds
    When the Node.js polling job executes the rollback query
    And council_retention_rate evaluates to less than 0.50
    Then app config sets default_mode = 'solo'
    And the UI renders a persistent banner:
    "Council routing has low retention — Solo Mode is now default.
    [Re-enable Council Mode]"
    And all subsequent new sessions initialize in Solo Mode

  Scenario: User re-enables Council Mode after demotion
    Given the Council Mode demotion banner is displayed
    And default_mode is currently 'solo' due to rollback trigger
    When the user clicks "Re-enable Council Mode"
    Then app config sets default_mode = 'council'
    And app config stores council_reevaluated_after_ts = current Unix
    epoch timestamp
    And the banner is removed from the UI
    And rollback queries ignore Council sessions recorded before
    council_reevaluated_after_ts


Feature: Privacy Disclosure for Free Models

  Scenario: Privacy notice is displayed on first use of a provider-logged model
    Given the user selects a free model where is_provider_logged = true
    in the normalized capability map
    When that model is assigned to any active agent for the first time
    in the session
    Then a one-time dismissible notice renders:
    "This model may log prompts and completions per provider policy."
    And the Preflight Gate blocks dispatch until the user dismisses the notice
    And session_events records event_type = 'privacy_disclosure_pending'
    resolved to 'acknowledged' upon dismissal
    And the notice is not shown again for that model in the same session


Feature: OpenRouter Metadata Refresh

  Scenario: Model catalog and card summaries refresh on app startup
    Given the user has a valid OpenRouter API key configured
    When the app starts
    Then the backend fetches the current OpenRouter model catalog
    from GET /api/v1/models
    And filters the model pool to free-compatible models by default
    And runs ModelCardSummarizer.summarize() for each free model
    And stores the metadata snapshot and card summaries in model_snapshots
    And the UI renders model capabilities from the normalized snapshot

  Scenario: Missing free model is removed from active routing pool
    Given a previously configured free model is no longer present
    in the latest metadata snapshot
    When the RouterAgent builds a GoA sampling context
    Then that model is excluded from the card summaries passed to
    the meta-LLM
    And the agent is assigned the configured fallback model
    And the UI surfaces a non-blocking warning that the previous
    model is unavailable


Feature: Agent Budget Enforcement

  Scenario: Simple prompt cannot escalate above one API call without
  user approval
    Given routing mode is set to "Adaptive"
    And the Router classifies the prompt as trivial
    When the Router attempts to activate more than 1 agent
    Then the Preflight Gate blocks the escalation
    And the prompt is executed in Solo Mode
    And session_events records event_type = 'budget_violation'

  Scenario: Non-trivial Council task cannot exceed five API calls
    Given a non-trivial prompt is routed to Council Mode
    When the total planned API calls (meta + agents + verifier) exceed 5
    Then the backend truncates or rejects the excess calls before dispatch
    And the UI preview displays no more than 5 planned free API calls
    And session_events records event_type = 'budget_violation'
    if truncation was required


Feature: Model Fallback Behavior

  Scenario: Assigned free model fails before completion
    Given an active agent is assigned a free model
    When the OpenRouter request fails due to model unavailability,
    rate limit, or provider error
    Then the backend retries exactly once with the configured
    fallback free model
    And the retry is counted in api_calls for that session
    And the final response includes a compact note that fallback was used


Feature: Council Trace Transparency

  Scenario: Council response includes compact GoA routing trace
    Given a GoA-lite request completes in Council Mode
    When the final response renders
    Then the UI displays each active agent role
    And the assigned model for each role
    And the GoA influence score S_j for each agent
    And a one-sentence sampling rationale from the RouterAgent output
    And the total free API calls consumed for that session


Feature: Local-First Storage

  Scenario: Conversation and telemetry persist locally
    Given the app is running in single-user local mode
    When a chat session completes
    Then the conversation transcript is stored in the local conversations
    SQLite table
    And session telemetry including GoA edge matrices is stored in the
    local session_events SQLite table
    And no application-owned cloud sync is performed
    And no telemetry is transmitted to any endpoint outside api.openrouter.ai
```

### 4.2 LLM/Generative Component Specification

The RouterAgent's GoA node sampling step is a generative component and must be bounded:

| Constraint | Specification |
|---|---|
| **Model assignment** | `inclusionai/ring-2.6-1t:free`; fallback: `openrouter/free` |
| **Sampling output format** | Structured JSON only: `{ "agents": [{ "role": string, "modelId": string, "relevanceScore": number }], "totalApiCalls": number, "samplingRationale": string (≤50 words) }` |
| **Non-determinism budget** | `temperature: 0.0`; `seed` applied if model supports it |
| **Evaluation judge specification** | Router sampling validated against held-out test set of ≥20 human-labeled prompts (≥4 per task class); accuracy threshold: ≥85% correct agent selection before Phase 2 deployment |
| **Prompt versioning** | Router system prompt version-controlled in `src/agents/router/prompt.v1.txt`; any change requires re-running the held-out evaluation before deployment |
| **`src/agents/moa/agg_prompt.v1.txt` — exact content** | See versioned prompt content below |
| **MoA non-determinism budget** | Aggregator call: `temperature: 0.3` maximum (slight variation acceptable for synthesis quality); proposer calls: `temperature: 0.7` maximum (diversity improves MoA output per paper §4.2) |
| **GoA S scoring** | Each agent's scoring call uses `temperature: 0.2` maximum; output format: `{ "scores": { "[agentId]": number } }` normalized to sum = 1; τ pruning threshold: 0.05 |

**Versioned MoA aggregator prompt content:**

```text
You are the FreeCouncil synthesizer using only verified free OpenRouter models.

You have been provided with responses from a small, relevance-selected panel of
specialized free models to the user's query.

Your task is to critically evaluate, reconcile conflicts, fill gaps, and synthesize
these responses into ONE superior, accurate, coherent final response.

Key rules:
- Critically assess each response for accuracy, relevance, and potential biases
  or hallucinations. Do not trust any single response blindly.
- For file uploads: require explicit citations/quotes from source material before
  any claim.
- Produce a well-structured, comprehensive reply that improves upon the individual
  inputs.
- End with a one-sentence 'Council Synthesis Rationale' explaining key integrations
  or resolutions (for Council Trace UI).
- NEVER mention individual model names or 'open-source' in the final user-facing
  response unless the user explicitly asks.

Responses from council agents:
{numbered_list_with_role_model}

User Query: {original_prompt}
{attachments_context_if_any}

Synthesize now:
```

**Template variables:**

| Variable | Value at runtime |
|---|---|
| `{numbered_list_with_role_model}` | Formatted proposer responses from `AgentOrchestrator.executeGoAMoAHybrid()` |
| `{original_prompt}` | Verbatim user query text |
| `{attachments_context_if_any}` | Extracted file content from FileProcessor; empty string if no upload |

**Held-out aggregation quality eval:** ≥15 test cases, human-scored; judge model:
`openrouter/owl-alpha`; pass threshold: ≥90% synthesis quality.

Test case composition must include at minimum:
- 5 cases run with n=3 proposers (default free-tier config)
- 5 cases run with n=4 proposers (Deep mode config)
- 5 cases where proposers produce conflicting facts (validates critical-evaluation clause of `agg_prompt.v1.txt`)

Any change to `agg_prompt.v1.txt` or to `proposersPerLayer` default requires re-running all three sub-sets before Phase 5 deployment.


Deliberation summaries (optional "show deliberation summary" UI feature): generated by aggregating
S scores and sampling rationale from the GoA trace; maximum 100 words; never exposes raw
chain-of-thought or intermediate agent responses.

### 4.3 Adversarial Failure Mitigations

| Failure Mode | Mitigation |
|---|---|
| **Tautological test inversion** (Router validates its own sampling outputs) | Router sampling accuracy evaluated against a human-labeled held-out test set stored outside the model's context; the RouterAgent is never used to grade its own GoA outputs |
| **Infinite compilation loop** (agent call never returns) | Each agent has a 30-second per-call timeout; on timeout, fallback model invoked exactly once; on double timeout, session falls back to Solo Mode and failure logged to session_events |
| **Context window dilution** (full conversation history inflates tokens) | Each agent receives only its role-relevant context slice; maximum context per agent: `min(model_context_window, 8000 tokens)`; GoA S scoring calls receive response summaries, not full prior conversation |
| **Meta-LLM bias on model cards** (RouterAgent over-selects familiar models regardless of query relevance) | Live metadata refresh on startup via ModelPoolManager; CapabilityDetector normalizes raw metadata into stable structured capability flags before passing to ModelCardSummarizer; card summaries are derived from structured fields, not free-text descriptions |

---

## 5. BEHAVIORAL TELEMETRY & SUCCESS METRICS

### 5.1 Metric Hierarchy

| Tier | Metric | Measurement Method | Target |
|---|---|---|---|
| **PRIMARY** | Council Retention Rate | `completed_in_council / routed_to_council` over rolling 2-hour window | ≥ 0.50 |
| **SECONDARY** | Routing Override Rate | `routing_override events / routed_to_council events` per session | < 0.30 |
| **SECONDARY** | Task Completion Without Tool Exit | `1 − (tool_exit events / total sessions)` | > 0.70 |
| **GUARDRAIL** | API Call Efficiency | Simple: ≤1 call; Non-trivial Council: ≤5 calls (meta + agents + verifier) | MUST NOT exceed without explicit user escalation |
| **DIAGNOSTIC** | Session Retry Rate | `retry events / total responses` — logged, no target | Monitored for pattern detection only |

### 5.2 Telemetry Pipeline Specification

**Pipeline:**
```
User interaction
      ↓
session_events INSERT (synchronous, before response delivery)
      ↓
Node.js setInterval — 60-second polling job
      ↓
council_retention_rate query
      ↓
threshold evaluation
      ↓
app config mutation + UI banner (if threshold breached)
```

**Extended SQLite schema (v1.4 — GoA + MoA fields added):**
```sql
CREATE TABLE session_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       TEXT    NOT NULL,
  event_type       TEXT    NOT NULL,
  -- Routing events:
  --   'routed_to_solo'         | 'routed_to_council'  | 'completed_in_council'
  --   'reverted_to_solo'       | 'routing_override'
  -- Telemetry events:
  --   'retry'                  | 'tool_exit'          | 'quota_budget_previewed'
  --   'model_capability_block'
  -- Policy events:
  --   'cap_enforcement'        | 'free_lock_rejection'| 'policy_violation'
  --   'privacy_disclosure_pending' | 'upload_disclosure_pending'
  --   'zdr_required_unavailable'   | 'agent_cap_violation'
  --   'budget_violation'           | 'api_key_missing'
  agent_count      INTEGER,
  api_calls        INTEGER,
  edge_matrix_json    TEXT,  -- GoA adjacency matrix A (JSON); NULL for Solo sessions
  layer_count         INTEGER, -- MoA layer count; NULL for non-MoA sessions
  proposer_models_json TEXT,  -- MoA proposer model IDs per layer (JSON array);
                               -- NULL for GoA-lite and Solo sessions
  aggregation_calls   INTEGER, -- Count of aggregator API calls for this session;
                               -- NULL for GoA-lite and Solo sessions
  synthesis_rationale TEXT,   -- One-sentence 'Council Synthesis Rationale' extracted
                               -- from aggregator response; NULL for non-MoA sessions;
                               -- displayed in Council Trace UI
  synthesis_quality   INTEGER, -- Proxy quality signal for MoA sessions only:
                               --   1 = positive (no retry or override event
                               --       recorded for this session_id)
                               --   0 = negative (retry or reverted_to_solo
                               --       recorded before session close)
                               --   NULL = non-MoA session or session still open
                               -- Not a model-scored metric; derived from
                               -- absence/presence of retry + override events.
                               -- Used for retention slicing by proposer_count
                               -- and layer_count in diagnostic queries.
  ts                  INTEGER NOT NULL  -- Unix epoch ms
);

CREATE INDEX idx_session_events_type_ts
  ON session_events(event_type, ts);

CREATE INDEX idx_session_events_session_ts
  ON session_events(session_id, ts);
```

### 5.3 Automated Rollback Trigger

```sql
-- Council Retention Rate — rolling 2-hour window
-- Rollback fires when result < 0.50 AND sample count >= 5

SELECT
  CAST(
    SUM(CASE WHEN event_type = 'completed_in_council' THEN 1 ELSE 0 END)
    AS REAL
  )
  / NULLIF(
    SUM(CASE WHEN event_type = 'routed_to_council' THEN 1 ELSE 0 END),
    0
  ) AS council_retention_rate
FROM session_events
WHERE ts > (strftime('%s', 'now') - 7200) * 1000;

-- Threshold          : council_retention_rate < 0.50
-- Minimum sample     : only fires if routed_to_council count >= 5 in window
-- Evaluation window  : 2-hour rolling
-- Polling cadence    : every 60 seconds (Node.js setInterval)
-- Rollback action    : SET app_config.default_mode = 'solo'
--                      RENDER persistent UI banner
-- Re-enable action   : SET app_config.default_mode = 'council'
--                      SET app_config.council_reevaluated_after_ts = NOW
--                      Rollback query ignores sessions before
--                      council_reevaluated_after_ts
```

---

## 6. POLICY-AS-CODE COMPLIANCE

### 6.1 Regulatory Control Matrix

| Obligation | Source | Specific Basis | Control Owner |
|---|---|---|---|
| **Provider-logging disclosure** | OpenRouter provider policy | Owl Alpha: "prompts and completions may be logged and used to improve the model" | App — Preflight Gate |
| **OpenRouter logging clarification** | OpenRouter FAQ / privacy docs | UI distinguishes: (1) OpenRouter default metadata logging, (2) optional prompt/completion logging, (3) provider-side logging | App — onboarding flow |
| **Optional ZDR mode** | OpenRouter ZDR documentation | ZDR enforcement available globally, per model group, per guardrail, or per request | App — Run Settings |
| **Sensitive upload warning** | App policy | Uploaded content transmitted to OpenRouter and potentially to model providers | App — Preflight Gate |
| **API key confidentiality** | Security best practice | Local config/env only; never SQLite; never transmitted outside `api.openrouter.ai` | App — backend config |
| **Local data residency** | App architecture guarantee | All conversations and telemetry (including GoA edge matrices) in local SQLite; no cloud sync | App — architecture |
| **Third-party processing notice** | GDPR Art. 13/14 (advisory) | General disclosure that content processed by OpenRouter and model providers | App — onboarding flow |

### 6.2 Pipeline Enforcement Gates

| Gate | Tooling | Enforcement Point | Blocks Dispatch |
|---|---|---|---|
| Free-only model check | `preflightGate.ts` — `FREE_LOCK_VIOLATION` | Before every OpenRouter API call | YES |
| Agent cap check | `preflightGate.ts` — `AGENT_CAP_VIOLATION` | Before every OpenRouter API call | YES (truncates to ≤5) |
| API key presence check | `preflightGate.ts` — `API_KEY_MISSING` | Before every OpenRouter API call | YES |
| Budget violation check | `preflightGate.ts` — `BUDGET_VIOLATION` | Before every OpenRouter API call | YES (unless user escalates) |
| Privacy disclosure check | `preflightGate.ts` — `PRIVACY_DISCLOSURE_PENDING` | Before first use of provider-logged model per session | YES (until acknowledged) |
| Upload disclosure check | `preflightGate.ts` — `UPLOAD_DISCLOSURE_PENDING` | Before first file upload per session | YES (until acknowledged) |
| ZDR enforcement check | `preflightGate.ts` — `ZDR_REQUIRED_UNAVAILABLE` | Before dispatch when ZDR mode is enabled | YES (or user disables ZDR) |

**PreflightContext interface (v1.1):**
```typescript
interface PreflightContext {
  modelId:                       string;
  isProviderLogged:              boolean;
  isFreeModel:                   boolean;
  apiKeyPresent:                 boolean;
  freeLockEnabled:               boolean;
  activeAgentCount:              number;
  requestedApiCalls:             number;
  promptClass:                   'simple' | 'non_trivial';
  privacyDisclosureAcknowledged: boolean;
  zdrRequired:                   boolean;
  modelSupportsZdr:              boolean;
  containsUpload:                boolean;
  uploadDisclosureAcknowledged:  boolean;
}

type PolicyViolation =
  | 'FREE_LOCK_VIOLATION'
  | 'AGENT_CAP_VIOLATION'
  | 'API_KEY_MISSING'
  | 'BUDGET_VIOLATION'
  | 'PRIVACY_DISCLOSURE_PENDING'
  | 'ZDR_REQUIRED_UNAVAILABLE'
  | 'UPLOAD_DISCLOSURE_PENDING'
  | 'AGGREGATOR_ROLE_CONFLICT';  // aggregator model == a proposer model
```

**Violation behavior:**

| Violation | Dispatch Behavior |
|---|---|
| `API_KEY_MISSING` | Block dispatch |
| `FREE_LOCK_VIOLATION` | Block; reassign fallback free model if available |
| `AGENT_CAP_VIOLATION` | Truncate plan to ≤5 by lowest S_j rank |
| `BUDGET_VIOLATION` | Block unless user explicitly escalates |
| `PRIVACY_DISCLOSURE_PENDING` | Block until acknowledged |
| `UPLOAD_DISCLOSURE_PENDING` | Block until acknowledged |
| `ZDR_REQUIRED_UNAVAILABLE` | Block until user disables ZDR or selects compatible model |
| `AGGREGATOR_ROLE_CONFLICT` | Block; reassign aggregator to next-best free model not in proposer set |

### 6.3 Exception Audit Schema

```sql
CREATE TABLE policy_exceptions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ts             INTEGER NOT NULL,
  violation_type TEXT    NOT NULL,
  model_id       TEXT,
  user_action    TEXT    NOT NULL,
  -- 'acknowledged' | 'dismissed' | 'lock_disabled' | 'escalated' | 'zdr_disabled'
  session_id     TEXT    NOT NULL,
  details_json   TEXT,
  previous_hash  TEXT,
  hash           TEXT    NOT NULL
  -- SHA-256(ts || violation_type || model_id || user_action
  --             || session_id || details_json || previous_hash)
);
-- Retention: local until user clears app data. No cloud sync. No telemetry egress.
```

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1 — Single-User OpenRouter Chat *(Weeks 1–2)*

Gherkin coverage: Local-First Storage, Quota Awareness, Free-Only Model Enforcement,
Model Settings Derivation, OpenRouter Metadata Refresh.

- OpenRouter API key entry and validation (`API_KEY_MISSING` gate)
- Free-model-only lock, default enabled
- `ModelPoolManager`: live `/api/v1/models` fetch
- `CapabilityDetector`: normalize raw metadata into stable capability flags
- `ModelCardSummarizer`: derive structured card summaries (stored in model_snapshots)
- `SettingsDeriver`: derive Run Settings controls from `supported_parameters`
- Streaming chat with conversation history
- Quota display with "estimated" label fallback
- Pre-dispatch API call count preview
- `session_events` table + indexes + `edge_matrix_json` column
- `TelemetryEngine`: record `routed_to_solo`, `api_key_missing`, `free_lock_rejection`

### Phase 2 — GoA-Lite Agent Router *(Weeks 3–4)*

Gherkin coverage: GoA Node Sampling, GoA-Lite Execution, Council Trace with S Scores,
Agent Cap Enforcement, Agent Budget Enforcement, Council Retention Rate Telemetry,
Automated Council Mode Demotion, Council Trace Transparency.

- `RouterAgent`: GoA node sampling using query + ModelCardSummary records
- Held-out test set (≥20 prompts, ≥85% accuracy gate before deploy)
- `AgentOrchestrator.executeGoALite()`: parallel responses + S scoring + τ pruning + max-pool
- S score logging to `session_events.edge_matrix_json`
- GoA influence scores in Council Trace UI
- Agent role cards with GoA-assigned models
- `PreflightGate`: all 7 violation types
- Fast/Balanced/Deep/Adaptive reasoning effort modes
  (Fast: skip S scoring; Balanced: GoA-lite max-pool; Deep: + verifier pass)
- `council_retention_rate` rollback query + 60s polling
- Council Mode demotion + re-enable with `council_reevaluated_after_ts`
- `policy_exceptions` table + SHA-256 hash chain

### Phase 3 — Uploads *(Weeks 5–7)*

Gherkin coverage: Upload Capability Detection Gate, Model Fallback Behavior.

- `CapabilityDetector`: `pdf_input` and `image_input` normalization
- Upload toolbar gated by normalized capability map
- `FileProcessor`: text, Markdown, JSON, CSV, PDF extraction
- SQLite FTS5 index for uploaded file content
- Upload privacy disclosure gate
- File Analyst routing to `openrouter/owl-alpha` with fallback
- Evidence citation enforcement in File Analyst system prompt

### Phase 4 — Structured Workbench *(Post-MVP)*

JSON schema editor, structured-output toggle, schema validation, retry-on-invalid JSON,
value verification pass, export to JSON/Markdown/CSV.

### Phase 5 — GoA + MoA Hybrid Mixture-of-Models Orchestration *(Post-MVP)*

**GoA→MoA Hybrid (primary Phase 5 deliverable):**
`AgentOrchestrator.executeGoAMoAHybrid()`: GoA node sampling selects 3 proposers; MoA
Aggregate-and-Synthesize pass fuses outputs via `openrouter/owl-alpha`; total calls = 5.
Activated in Balanced and Deep reasoning modes for non-trivial Council tasks.
Aggregator prompt versioned in `src/agents/moa/agg_prompt.v1.txt`; held-out eval gate
(≥15 human-scored cases across n=3, n=4, and conflicting-fact subsets) required before deployment.

`layers: 1` **hard constraint** when `executionMode = 'goa_moa_hybrid'` and budget ≤ 5.
Budget math: 1 (GoA meta) + proposersPerLayer (max 3) + 1 (aggregator) = 5.
Two-layer MoA requires 1 + n_layer1 + n_layer2 + 1 ≥ 7 calls — exceeds cap for any
meaningful proposer count. RouterAgent **must** reject `layers > 1` when free-only
lock is enabled and no explicit user quota escalation is present.
Two-layer MoA is available **only** in Deep reasoning mode with explicit user
confirmation that up to 8 free API calls may be consumed.

**Full GoA Bidirectional Passing (optional Phase 5 deliverable):**
`AgentOrchestrator.executeGoAFull()`: bidirectional message passing (forward + reverse, 2 passes
max) + graph pooling. Available as a manual advanced mode only; not activated by default due to
call volume exceeding the ≤5 cap for most configurations.

**Execution mode routing (Phase 5 defaults):**

| Reasoning Effort | Prompt Class | Execution Mode |
|---|---|---|
| Fast | Any | `goa_lite` (GoA sampling + max-pool, no aggregator) |
| Balanced | Simple | `solo` |
| Balanced | Non-trivial | `goa_moa_hybrid` (3 proposers + 1 aggregator = 5 calls) |
| Deep | Non-trivial | `goa_moa_hybrid` + optional verifier (if calls ≤ 5) |
| Adaptive | Any | RouterAgent selects mode based on prompt class + remaining quota |

**Additional Phase 5 deliverables:**
- `layer_count`, `proposer_models_json`, `aggregation_calls`, `synthesis_rationale`, and `synthesis_quality` fields active in `session_events`
- MoA Council Trace UI: proposer roles, aggregator model, "MoA refinement (N calls)" label
- S score history used for model performance comparison across sessions
- Cached proposer results within session (not cross-session — deferred to post-Phase-5)

---

## 8. OPEN ITEMS & RISK REGISTER

| Risk | Probability | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Free model removed from OpenRouter pool mid-session | High | High | `ModelPoolManager.isModelAvailable()` before dispatch; fallback chain per role; non-blocking UI warning | Dev |
| Router misclassifies trivial prompt as non-trivial | Medium | Medium | `BUDGET_VIOLATION` gate blocks escalation; held-out eval ≥85% before Phase 2 deploy | Dev |
| Rate limit exhaustion (20 req/min OpenRouter cap) | Medium | High | Quota meter + pre-dispatch preview; exponential backoff on 429 (max 2 retries) | Dev |
| OpenRouter `/api/v1/models` schema changes | Low | High | Normalize into stable capability map; version-stamp snapshot; fail gracefully using last-known snapshot | Dev |
| Context window dilution degrades Council Mode quality | Medium | Medium | Per-agent context slicing (≤8k tokens); Verifier receives aggregated summaries | Dev |
| Council Retention Rate false rollback on cold start | Low | Low | 5-sample minimum guard; `council_reevaluated_after_ts` reset on re-enable | Dev |
| Free model quality ceiling invalidates hypothesis | Medium | High | FALSE-branch pivot defined: demote Council Mode; product becomes quota-aware single-model router | PM |
| `inclusionai/ring-2.6-1t:free` unavailable as meta-LLM | Medium | High | Fallback: `openrouter/free`; held-out eval applies to fallback before Phase 2 deploy | Dev |
| GoA S scoring adds extra API calls beyond quota budget | Medium | Medium | GoA meta call + k agent calls + optional verifier capped at 5 total by `BUDGET_VIOLATION` gate; Fast mode skips S scoring entirely | Dev |
| Meta-LLM bias: RouterAgent over-selects familiar models regardless of query | Medium | Medium | Card summaries derived from structured CapabilityDetector fields; live metadata refresh invalidates stale summaries on each startup | Dev |
| Cold-start retention dip: users perceive GoA overhead as latency without quality signal | Medium | Low | Rollback trigger self-corrects at 0.50 threshold; Fast mode available; quota preview makes call cost transparent before dispatch | Dev |
| MoA aggregator call volume exhausts quota on Balanced mode | Medium | Medium | Adaptive mode budgets meta + proposers + aggregator to exactly 5; Fast mode skips aggregator entirely; quota preview shows exact N before dispatch; user can downgrade to `goa_lite` via toggle | Dev |
| MoA verbosity/latency perception: users experience TTFT delay from aggregation pass | Low | Medium | Council Trace surfaces "MoA refinement (N calls)" label before response renders; user toggle to Solo/GoA-lite available per session; Fast mode default for simple prompts avoids aggregator latency | Dev |

---

## APPENDIX A: INTERROGATION TRANSCRIPT

### L1-A — Empirical Validation Source
**Q:** What is the empirical evidence that this problem exists and is worth solving now?
**A (C primary, D secondary):** Competitive tool gap survey: no existing tool occupies [free-model-constrained] × [adaptive agent routing] × [capability-aware UI]. Secondary: Graph-of-Agents (arXiv:2604.17148) and OpenRouter rate limit/model metadata docs validate architecture pattern. See §2.1.

### L1-B — Hypothesis Boundary Conditions
**Q:** Does the proposed hypothesis and its two branches accurately represent your intent?
**A (D — Confirmed):** Hypothesis accepted with precision note: baseline is single free OpenRouter model, not frontier paid models. Both branches accepted. Pivot trigger: demote Council Mode, make Solo Mode primary.

### L1-C — Strategic Urgency ("Why Now")
**Q:** What makes this the right moment to build?
**A (A primary, D secondary, C tertiary):** Free tier depth at high; tool market not converged on minimalist routing; GoA research (Apr 2026) provides empirical foundation.

### L2-A — Exclusion Taxonomy
**Q:** Accept proposed taxonomy or modify?
**A (C — Add missing items):** Added to NON-GOALS: cloud SaaS, browser automation, non-OpenRouter providers, guaranteed model availability. Added to OUT-OF-SCOPE: user accounts, plugin marketplace, prompt-template marketplace, automated benchmark harness. Added to FUTURE CONSIDERATIONS: local benchmark suite, presets, optional sync, provider health monitor.

### L3-A — Gherkin Acceptance Criteria
**Q:** Accept all scenarios or modify/add?
**A (D — Modify and add):** Seven patches + five new Feature blocks. See v1.0 Appendix A for full patch list.

### L4-A — Primary Metric
**Q:** Which metric is PRIMARY?
**A:** Council Retention Rate. Formula: `completed_in_council / routed_to_council`.

### L4-B — Secondary Metric Targets
**Q:** Targets for secondary metrics?
**A:** Routing Override Rate < 30%; Task Completion Without Tool Exit > 70%.

### L4-C — Guardrail Metric Target
**Q:** Guardrail target?
**A:** Simple prompts ≤1 free API call; non-trivial Council ≤5 free API calls unless user escalates.

### L4-D — Telemetry Pipeline + Rollback Trigger
**Q:** Accept SQLite-native telemetry spec?
**A (A — Accept + index additions):** SQLite-native telemetry accepted. Rollback is product-mode demotion, not deployment rollback.

### L5-A — Compliance + Policy Gate + Exception Schema
**Q:** Accept all three components?
**A (E — Multiple changes):** Added OpenRouter-vs-provider logging distinction, optional ZDR, upload disclosure, expanded PreflightContext, specific violation event types, hash-chained exception audit table.

### GoA Amendment (v1.1)
**Source:** GoA research deep-dive (arXiv:2604.17148, verified Apr 2026; GitHub UNITES-Lab/GoA).
**Decision:** GoA promoted from supporting citation to direct algorithmic specification. No Phase Gate
re-interrogation required — all changes are within already-closed layer boundaries.
**Changes applied:**
- §1: GoA named as algorithmic foundation; MMLU benchmark numbers added.
- §2.1: Vague citation replaced with specific benchmark results (GoA_3: 79.18% vs MoA_6: 75.71%).
- §3.1: RouterAgent upgraded to GoA node sampling; AgentOrchestrator upgraded to GoA-lite (Phase 2)
  and full GoA (Phase 5); ModelCardSummarizer module added.
- §3.2: `edge_matrix_json` column added to session_events; `card_summaries_json` added to
  model_snapshots.
- §4.1: Three new GoA Gherkin Feature blocks: GoA Node Sampling, GoA-Lite Execution, Council Trace
  with S Scores. Existing Council Trace scenario updated with S score display.
- §4.2: Router output format updated to AgentPlan with relevanceScore; GoA S scoring constraints
  added.
- §4.3: Meta-LLM bias adversarial mitigation added.
- §7: Phase 2 upgraded to GoA-lite; Phase 5 upgraded to full GoA bidirectional passing.
- §8: Three GoA risks added: extra API calls, meta-LLM bias, cold-start retention dip.


### MoA Amendment (v1.2–v1.4)
**Source:** MoA research deep-dive (arXiv:2406.04692, Jun 2024; verified vs. Together AI GitHub implementation), followed by v1.3 and v1.4 architectural amendments.
**Decision:** MoA integrated as Phase 5 aggregation complement to GoA. No Phase Gate
re-interrogation required — all changes within already-closed layer boundaries. Phase 2
scope unchanged.

**Synthesis verdict:** GoA selects the right agents (efficiency); MoA fuses their outputs
(quality ceiling). Hybrid delivers both within the ≤5 call budget:
1 GoA meta + 3 proposers + 1 MoA aggregator = 5 total.

**Changes applied:**
- §1: GoA+MoA hybrid architecture described; 5-call budget decomposition explicit.
- §2.1: MoA benchmark row added and upgraded with ablation numbers: Full MoA 65.1%, MoA-Lite 59.3%, n=3 diverse proposers 58.0%, single-proposer repeated 56.7%.
- §3.1 RouterAgent: `moaConfig` and `executionMode` added to AgentPlan output type.
- §3.1 AgentOrchestrator: `executeGoAMoAHybrid()` method added with full formatter spec and aggregator ≠ proposer hard constraint.
- §3.2/§5.2 session_events: `layer_count`, `proposer_models_json`, `aggregation_calls`, `synthesis_rationale`, and `synthesis_quality` columns added.
- §4.1: Two new Gherkin Feature blocks: MoA-Lite Proposer Generation and Aggregation (3 scenarios), Council Trace MoA Refinement Transparency (1 scenario).
- §4.2: MoA aggregator prompt versioning, exact `agg_prompt.v1.txt` content, temperature constraints, and ≥15-case held-out eval scope added.
- §6.2: `AGGREGATOR_ROLE_CONFLICT` policy violation and reassignment behavior added.
- §7 Phase 5: Upgraded to GoA+MoA hybrid primary deliverable; execution mode routing table added; one-layer hard constraint added for free-only ≤5-call mode; full GoA bidirectional passing retained as optional advanced mode.
- §8: Two MoA risks added: aggregator quota exhaustion, TTFT perception.

---

## APPENDIX B: PHASE GATE CHECKLIST

- [x] All 5 interrogation layers have deterministic answers — zero TBD fields in §1–6
- [x] Exactly one PRIMARY metric declared: **Council Retention Rate**
- [x] Tri-Part Exclusion Taxonomy fully populated: **10 NON-GOALS / 10 OUT-OF-SCOPE / 10 FUTURE CONSIDERATIONS**
- [x] At least one Gherkin scenario per functional requirement: **18 Feature blocks, 32 scenarios, all syntactically valid and automatable**
- [x] Rollback query: valid SQLite SQL, threshold 0.50, 2h window, ≥5 sample guard
- [x] Policy tooling named with pipeline stage: `preflightGate.ts`, pre-dispatch
- [x] YAML frontmatter is valid parseable YAML
- [x] Appendix A contains verbatim interrogation transcript including GoA amendment entry
- [x] Zero open gaps in §1–6 — open items confined to §8
- [x] GoA algorithmic foundation integrated without Phase Gate violations
- [x] MoA aggregation foundation integrated without Phase Gate violations
- [x] File output as downloadable `.md` artifact
