# Phase 1 Issue Backlog Draft (for GitHub issue creation)

This file captures one indivisible task per issue for **Phase 1 — Single-User OpenRouter Chat (Weeks 1–2)** from `docs/PRD.md`.

## Duplicate-screening basis

Because this environment has no configured `gh` CLI and no authenticated GitHub remote/API context, closed/open issues could not be queried from this workspace. The intended process remains:
1. Enumerate all closed issues (expected: 43 per operator note).
2. Search each proposed issue title with 3–6 distinctive keywords.
3. Suppress creation when duplicate confidence is >=8/10.

## Proposed issues (indivisible tasks)

1. **[ARCH] Missing API key gate enforcement before OpenRouter dispatch**
   - Scope: implement and enforce `API_KEY_MISSING` preflight block.

2. **[ARCH] Free-only lock default is not enforced on model selection path**
   - Scope: implement model dispatch hard block for non-free models.

3. **[ARCH] ModelPoolManager does not refresh `/api/v1/models` snapshots**
   - Scope: add refresh pipeline and in-memory cache update.

4. **[ARCH] CapabilityDetector lacks normalized model capability contract**
   - Scope: normalize raw metadata to stable capability flags.

5. **[ARCH] ModelCardSummarizer output is missing from model snapshot workflow**
   - Scope: derive and persist structured model card summary fields.

6. **[ARCH] Run Settings controls are not derived from supported parameters**
   - Scope: implement SettingsDeriver mapping from `supported_parameters`.

7. **[ARCH] Chat transport lacks streaming + persisted conversation history**
   - Scope: implement streaming response path with local history persistence.

8. **[ARCH] Quota status UI lacks explicit estimated fallback behavior**
   - Scope: expose quota display with "estimated" fallback state.

9. **[ARCH] Pre-dispatch API call preview is absent from run flow**
   - Scope: calculate and display call count before dispatch.

10. **[ARCH] `session_events` base schema/indexes missing for Phase 1 telemetry**
    - Scope: create table/indexes including `edge_matrix_json` column.

11. **[ARCH] TelemetryEngine does not emit Phase 1 required routing/policy events**
    - Scope: emit `routed_to_solo`, `api_key_missing`, `free_lock_rejection`.

## Required per-issue metadata template

Apply for each created issue:
- Labels: exactly one `type:*`, exactly one `priority:*` (default `priority:p2`), plus `status:needs-triage`, `source:agent`, and `agent:<me>`.
- Body must include:
  - Evidence references (`docs/PRD.md` section lines + runtime evidence when applicable)
  - Expected vs observed
  - Scope / blast radius
  - Reproduction or verification steps
  - Suggested next action
  - Traceability footer:

```
---
Executing agent: agent:codex
Session ID: unavailable-in-local-runtime
Commit SHA: <fill at creation time>
```
