---
phase: 4
slug: security-audit-tech-debt-hardening
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-08
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test |
| **Config file** | none |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~50 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 50 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | SEC-05 | T-04-01 | Sanitize error logs in solo/council dispatch paths to prevent token leakage | unit | `npm test` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | DEBT-06 | — | Filter by owner and limit returned sessions in GET /sessions | unit | `npm test` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 1 | DEBT-04 | — | Proposer cache key generated via SHA-256 hash of prompt | unit | `npm test` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 1 | DEBT-05 | — | ProviderHealthMonitor stop is invoked during server graceful shutdown | unit | `npm test` | ✅ | ⬜ pending |
| 04-02-03 | 02 | 1 | DEBT-04 | — | Cached proposer responses display a "cached" badge in CouncilTrace component | UI | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-08
