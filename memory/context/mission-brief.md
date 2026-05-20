---
namespace: context
created: 2026-05-20T15:00:00Z
updated: 2026-05-20T15:00:00Z
status: active
tags: mission, session, issues, freecouncil, phase4, phase5
---

# Mission Brief — Session 2026-05-20 (Second Session)

Complete all 37 open GitHub issues (#56-#92) for the FreeCouncil project.

## Issue Groups

### Phase 4 — Structured Workbench (#56-#67)
- #56: structured_output capability gate in Run Settings UI
- #57: Structured-output toggle in Run Settings
- #58: JSON schema editor UI component
- #59: Backend JSON schema validation service
- #60: Retry-on-invalid JSON backend logic
- #61: Value verification pass agent
- #62: Export structured response to JSON
- #63: Export response to Markdown
- #64: Export structured response to CSV
- #65: PreflightGate STRUCTURED_OUTPUT_UNAVAILABLE
- #66: session_events telemetry for Phase 4 events
- #67: Prompt/profile presets

### Phase 5 — GoA+MoA Hybrid (#70-#87)
- #70: Create versioned MoA aggregator prompt artifact
- #71: Extend RouterAgent AgentPlan with executionMode and moaConfig
- #72: Implement AgentOrchestrator.executeGoAMoAHybrid()
- #73: MoA aggregator prompt rendering
- #74: Enforce aggregator ≠ proposer hard constraint
- #75: Add AGGREGATOR_ROLE_CONFLICT to PreflightGate (ALREADY DONE in shared + preflightGate)
- #76: Phase 5 execution mode routing table
- #77: layers > 1 rejection in RouterAgent
- #78: Two-layer MoA in Deep mode with user confirmation gate
- #79: MoA aggregation fallback chain
- #80: Extend POST /dispatch for goa_moa_hybrid
- #81: Activate Phase 5 session_events telemetry fields
- #82: synthesis_quality field population in TelemetryEngine
- #83: MoA Council Trace UI panel
- #84: Held-out aggregation quality eval suite
- #85: S score history for cross-session model performance
- #86: Within-session cached proposer result reuse
- #87: AgentOrchestrator.executeGoAFull()

### Phase 4+ / Future (#68-#69, #88-#92)
- #68: Semantic vector search
- #69: Provider health monitor
- #88: Per-persona adaptive routing
- #89: Local benchmark suite
- #90: Local file export/import
- #91: Graph extraction from uploaded documents
- #92: Audio/video multimodal input

## Key Existing Files
- shared/index.ts — types (AgentPlan, PreflightContext already has moaConfig + AGGREGATOR_ROLE_CONFLICT)
- backend/src/agents/AgentOrchestrator.ts — executeGoALite implemented
- backend/src/agents/RouterAgent.ts — sampleAgents returns executionMode: 'goa_lite' hardcoded
- backend/src/dispatch/councilDispatch.ts — calls executeGoALite only
- backend/src/modules/preflightGate.ts — AGGREGATOR_ROLE_CONFLICT already implemented
- backend/src/modules/telemetryEngine.ts — all MoA fields already in schema
- frontend/src/app/page.tsx — 1628 lines, Phase 1-3 complete
