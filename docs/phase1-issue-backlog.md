# Phase 1 GitHub Issue Plan (Executable Backlog)

This backlog translates **Phase 1 — Single-User OpenRouter Chat (Weeks 1–2)** from `docs/PRD.md` into one indivisible GitHub issue per task.

## Source-of-Truth mapping

Phase 1 requirements are listed in `docs/PRD.md` §7, lines 1090–1100.

## Duplicate-screening protocol (required before filing each issue)

For each candidate issue:
1. Run 3–6 keyword searches against **open + closed** issues.
2. Compare candidate against any likely matches.
3. If duplicate confidence is `>=8/10`, **do not create** a new issue; comment on the existing issue with evidence.

Example search pattern:

```bash
gh issue list --state all --search "API_KEY_MISSING preflight" --limit 50
gh issue list --state all --search "free-only lock model dispatch" --limit 50
gh issue list --state all --search "session_events edge_matrix_json" --limit 50
```

## Issue set (11 indivisible tasks)

> All titles use allowed prefix `[ARCH]`, stay <=80 chars, and describe current state.

### 1) [ARCH] API key dispatch gate is missing in preflight path
- Type label: `type:architecture`
- Priority: `priority:p2`
- Keywords: `API_KEY_MISSING`, `preflight`, `dispatch`, `OpenRouter`

### 2) [ARCH] Free-only lock is not enforced on model dispatch
- Type label: `type:architecture`
- Priority: `priority:p2`
- Keywords: `free-only`, `FREE_LOCK_VIOLATION`, `model dispatch`, `fallback`

### 3) [ARCH] ModelPoolManager lacks live /api/v1/models refresh loop
- Type label: `type:architecture`
- Priority: `priority:p2`
- Keywords: `ModelPoolManager`, `/api/v1/models`, `refresh`, `snapshot`

### 4) [ARCH] CapabilityDetector normalization contract is not implemented
- Type label: `type:architecture`
- Priority: `priority:p2`
- Keywords: `CapabilityDetector`, `normalizeModel`, `capability flags`

### 5) [ARCH] ModelCardSummarizer output is absent from model snapshot flow
- Type label: `type:architecture`
- Priority: `priority:p2`
- Keywords: `ModelCardSummarizer`, `model_snapshots`, `card summaries`

### 6) [ARCH] SettingsDeriver is not mapping supported_parameters to controls
- Type label: `type:architecture`
- Priority: `priority:p2`
- Keywords: `SettingsDeriver`, `supported_parameters`, `Run Settings`

### 7) [ARCH] Streaming chat path lacks persisted conversation history
- Type label: `type:architecture`
- Priority: `priority:p2`
- Keywords: `streaming chat`, `conversation history`, `SQLite`

### 8) [ARCH] Quota indicator has no estimated fallback state
- Type label: `type:architecture`
- Priority: `priority:p2`
- Keywords: `quota display`, `estimated`, `fallback`, `UI`

### 9) [ARCH] Pre-dispatch API call budget preview is missing
- Type label: `type:architecture`
- Priority: `priority:p2`
- Keywords: `pre-dispatch`, `api call count preview`, `budget`

### 10) [ARCH] session_events base schema/indexes are incomplete for Phase 1
- Type label: `type:architecture`
- Priority: `priority:p2`
- Keywords: `session_events`, `edge_matrix_json`, `indexes`, `telemetry`

### 11) [ARCH] TelemetryEngine omits required Phase 1 routing/policy events
- Type label: `type:architecture`
- Priority: `priority:p2`
- Keywords: `TelemetryEngine`, `routed_to_solo`, `api_key_missing`, `free_lock_rejection`

## Copy/paste issue body template

Use this body for each issue; adjust scope/evidence/title-specific details:

```md
Evidence:
- docs/PRD.md:1090-1100 (Phase 1 requirement list)
- <additional file:line or CLI evidence>

Expected:
- SoT: Phase 1 requirement is implemented and verifiable in runtime + storage.

Observed:
- Physical state: requirement not implemented or not verifiable from current code path.

Delta:
- Expected != Observed because <specific gap>.

Scope / blast radius:
- <module(s), runtime path(s), telemetry/data effects>

Reproduction / verification:
1. <step>
2. <step>
3. <step>

Suggested next action:
- Implement <smallest atomic fix> and add verification evidence.

---
Executing agent: agent:codex
Session ID: local-cli
Commit SHA: <fill at filing time>
```

## Batch creation script (run once GitHub CLI + auth are available)

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
COMMON_LABELS="status:needs-triage,source:agent,agent:codex,type:architecture,priority:p2"

create_issue () {
  local title="$1"
  local body="$2"

  # duplicate check
  local existing
  existing=$(gh issue list --repo "$REPO" --state all --search "$title" --limit 5 --json number,title)
  if [ "$(echo "$existing" | jq 'length')" -gt 0 ]; then
    echo "SKIP (possible duplicate): $title"
    echo "$existing" | jq -r '.[] | "  #\(.number) \(.title)"'
    return 0
  fi

  gh issue create --repo "$REPO" --title "$title" --label "$COMMON_LABELS" --body "$body"
}
```
