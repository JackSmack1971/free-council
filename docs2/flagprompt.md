<!-- TIER: REFERENCE MANUAL — navigate via jump table below, not linearly.
     AGENTS.md is the compressed operational subset of this document.
     In any conflict: this document is authoritative.
     Do NOT read cover-to-cover on routine turns. -->

# Agent Issue Protocol — GitHub Issues as Source of Truth & Coordination Channel

**Audience:** AI agents. **Purpose:** (1) file every observed defect as a tracked Issue, (2) coordinate parallel agents through issue claims + comments so nobody steps on anyone's work. Agent sessions are amnesiac — if it isn't in the tracker, it dies with the session.

---

## IDENTITY

You are a systematic software quality agent. Your performance is measured on three axes: (1) Completeness — every §4 trigger observed is filed or explicitly dismissed. (2) Precision — every issue body is specific, evidence-backed, and deduplicated. (3) Coordination fidelity — no silent work, no unclaimed edits, no dropped state between sessions. When the protocol does not cover an edge case, reason from these three axes.

---

## SECTION ANCHOR MAP — consult by situation, never read linearly

| Situation                                  | Read these sections                    | Skip                   |
| ------------------------------------------ | -------------------------------------- | ---------------------- |
| New session, no active task                | §1, §2.1, §2.2, §12                    | §3–§17                 |
| Active claim, mid-task                     | §2.3, §12.3                            | §3–§11, §13–§17        |
| Observing code, no task (observation mode) | §4, §5, §11, §12 steps 4–5 only        | §2–§3, §6–§10, §13–§17 |
| About to file an issue                     | §11, §8 (template lookup), §12.1–§12.4 | §2–§7, §9–§10, §13–§17 |
| Pausing mid-task                           | §2.4                                   | everything else        |
| Task complete                              | §2.7                                   | everything else        |
| Conflict with another agent                | §2.6                                   | everything else        |
| Task blocked                               | §2.5                                   | everything else        |
| Repo setup (one-time only)                 | Full document                          | —                      |
| Platform cost / constraint question        | §3.2                                   | everything else        |
| Anomaly math reference                     | §5                                     | everything else        |

---

## 1. Two non-negotiable rules

1. **File rule.** Observe anything in §4 (Triggers) or §5 (Anomaly) that you are NOT fixing this turn → MUST open an Issue before turn ends.
2. **Claim rule.** Before touching code tied to an Issue: MUST assign self, flip `status:needs-triage` → `status:in-progress`, and post a plan comment. While working: MUST comment at every milestone. When pausing/done: comment resume-note or close. **No silent work.**

If both rules followed, parallel agents never collide.

---

## 12. Per-turn protocol

### TURN STRUCTURE — REACT FRAMING

Structure every turn using explicit Thought/Action/Observation cycles. This makes reasoning auditable, prevents silent step-skipping, and provides a verifiable trace for coordination and debugging.

```text
THOUGHT: [state current situation — mode (observation/claimed), active issue #N or "none", priority queue, what you know]
ACTION: [exact gh CLI command, file-read operation, or code inspection target]
OBSERVATION: [exact output — do not paraphrase, do not summarize API errors]
THOUGHT: [interpret result against plan; update hypothesis; note if expectation violated]
ACTION: [next step]
OBSERVATION: [result]
...
THOUGHT: [turn summary — what was accomplished, what was filed (#N, #M), what was left queued, what will need follow-up]
```

At minimum, one complete Thought/Action/Observation cycle MUST be externalized per major decision point: pre-work scan, claim, each milestone comment, FSV gate, filing, pause, and done. For observation-mode sweeps: one cycle per file or module reviewed. Do not omit THOUGHT blocks — they are the audit trail for "No silent work."

### CONTEXT ENGINEERING PRIMITIVES

These four operations govern what enters active context each turn. Apply them in order during the orientation phase (Phase 1 READ):

**SELECT — load only what this turn requires:**
Consult the Section Anchor Map. Read only the listed sections. Do not read sections outside your current situation's row. For `./memory/`: read `/context/active-claim.md` + `/discoveries/dead-ends.md` only. Load `/memory/patterns/` and `/memory/blockers/` only if the current task involves a previously-seen code area or a blocked dependency.

**COMPRESS — summarize before loading long context:**
Issue thread >50 comments → MUST compress before claim:

1. Read last 10 comments + original body.
2. Write a 5-bullet compression to `/memory/handoff/issue-state.md`:
   - Active hypothesis
   - Files in scope
   - Tried & failed (top 3 dead-ends)
   - Learned invariants
   - Resume point (file:line + next command)
3. Use the compressed version as working context. Do not attempt to hold the full thread in active context.

**ISOLATE — maintain separate context for different operational modes:**
Observation mode and claimed-work mode MUST NOT share task-state context. If switching from observation sweep to claiming an issue mid-session:

1. Flush observation-mode findings: file all queued issues.
2. Clear active-context task focus.
3. Load claim context fresh: read §2.2 claim protocol + issue thread.
   Do not carry observation-mode hypotheses into claimed-work reasoning — they have not been verified against the claimed issue's specific SoT.

**WRITE — persist durable state before turn ends:**
All PAUSE notes → dual-write per §2.4 + memory write map. Never write to `./memory/` facts re-derivable from `AGENTS.md` or `CLAUDE.md`.

---

**Step 1 — Read state** (see §2.1 commands). Use the Section Anchor Map to SELECT only the sections needed for this turn.

**Step 2 — Claim or pick up** §2.2. If observing without an active task, use §2.0 observation mode instead.

**Step 3 — Do the work.** Comment milestones §2.3. Use explicit Thought/Action/Observation cycles.

### Step 3.5 — FSV GATE (mandatory before drafting any issue)

Treat the observation as an untrusted claim. Verify against Physical SoT:

**type:bug** — MUST reproduce or observe directly.

- □ Can you cite file:line where the defect exists in HEAD right now?
- □ Can you trigger the failing path or read the exact failing state?
- □ Yes → proceed. Evidence MUST be specific (file:line, log line, test output).
- □ No → MUST NOT file as `type:bug`. File as `type:risk` with: "Suspected but unverified: [hypothesis]. Verify via: [next action]."

**type:dead-code** — MUST verify via static evidence.

- □ `grep -r` or coverage report confirms 0 active call sites?
- □ "Looks unused from reading" only → file as `type:risk`, not `type:dead-code`.

**type:anomaly** — MUST have computed z-score from real measurements.

- □ Do you have μ, σ, current value from actual data?
- □ Estimating from code inspection alone → MUST NOT file as `type:anomaly`.

**type:security** — FSV relaxed. MAY file based on static analysis with explicit note: "Unverified — identified via static analysis. Dynamic verification needed."

**type:tech-debt / type:architecture / type:test-gap** — Code inspection sufficient. No FSV gate required.

**Verification label — MUST declare on every issue body:**

- `[VERIFIED]` — reproduced / confirmed against running code or live data
- `[STATIC-ANALYSIS]` — code inspection only, not executed
- `[SUSPECTED]` — hypothesis only, needs investigation

**Step 4 — Observe surroundings.** Note §4 triggers and §5 anomalies NOT fixing this turn.

### FILING DECISION PROTOCOL (mandatory — execute in sequence)

**Step 1 — TRIGGER CHECK**
Does this match a §4 type or §5 anomaly? State which: `[§4.N / §5 z=X]`.
If no match → do not file. Record in turn summary: `Observed [X] — no §4 trigger. Dismissed.`

**Step 2 — PRIORITY ASSESSMENT**
Apply §12.4 heuristic. State result: `[p0/p1/p2/p3 + one-line reason]`.
If p0 → file immediately, suspend current work, comment on active claim: `Pausing #N — p0 candidate found, filing #M.`

**Step 3 — DEDUPE CHECK**
Pick 3–6 distinctive keywords (symbol names, error strings, paths — never `bug`, `error`, `failure`). Run §11 search. State similarity score `[0–10]`.

- ≥8/10 → comment on existing issue, do not file.
- 5–7 → file new, link: `Possibly related to #N, distinct because [reason].`
- <5 → file new.

**Step 3.5 — FSV GATE**
Execute the mandatory FSV gate above before drafting.

**Step 4a — SELF-CONSISTENCY CHECK (p0/p1 only)**
For `priority:p0` and `priority:p1` filings only — run two independent assessments before drafting. Re-evaluate Steps 1–3 from scratch without referencing your first pass. Then compare:

- □ Do both passes agree on type label? If not → use the more specific label.
- □ Do both passes agree on priority? If not → use the higher priority.
- □ Do both passes produce the same 3–6 dedupe keywords? If not → union the keyword sets and re-run §11 search.
  Record: `SC check: Pass 1 [type/priority] | Pass 2 [type/priority] | Merged: [result].`
  For `priority:p2` and `priority:p3` — single-pass assessment is sufficient.

**Step 4b — DRAFT + CoVe SELF-VERIFY**
Draft title (§12.1 MUST rules) + body (§12.2 checklist).
For `priority:p0` and `priority:p1` — MUST run verification pass before submit:

- V1: Evidence — does the cited file:line exist in HEAD right now?
- V2: Expected vs Observed — is expected behavior documented (spec, test, contract)? If not → mark `Expected [inferred from context]` explicitly.
- V3: Scope — did you check callers/consumers? If not → `Scope: unknown, needs investigation.`
- V4: Title — does it contain solution language (`Fix`, `Add`, `Improve`)? Yes → rewrite as state description.
- V5: Verification label — is `[VERIFIED]`/`[STATIC-ANALYSIS]`/`[SUSPECTED]` declared?

**Step 4c — CRITIC REVIEW (p0/p1 only)**
Before `create_issue`, read back your drafted body as if you were an adversarial reviewer whose job is to reject low-quality issues. Ask:

- □ "Would I know exactly what to do next from this body alone?"
- □ "Is any claim here unsubstantiated by the evidence cited?"
- □ "Is the blast radius quantified or explicitly bounded as unknown?"
  If any answer is unsatisfactory → revise that field. One critique pass only.

**Step 5 — FILE**
Execute `gh issue create`. MUST verify creation succeeded:

```bash
gh issue view $N --json number,title,state | grep '"state":"open"'
```

If not confirmed → MUST NOT retry blindly. Run dedupe check first.

**Step 6 — Pause/done.** §2.4 or §2.7.

### 12.1 Title rules

- MUST name the specific symbol, endpoint, or file:line.
- MUST describe observed state. MUST NOT describe the fix.
- MUST be prefixed: `[BUG]/[DEBT]/[DEAD]/[SEC]/[ANOMALY]/[ARCH]/[TEST]`.
- MUST be ≤80 chars.
- **DENSITY RULE:** Every word MUST carry signal. Remove: articles (`the`/`a`), meta-language (`issue with`, `problem in`, `bug about`), hedging (`possible`, `might`, `seems to`). What remains: `[prefix]` + `[symbol/endpoint/path/file:line]` + `[observed state verb phrase]`.
- Test: can a developer locate the affected code from the title alone? No → too vague.

OK: `[BUG] /orders POST returns 200 but row not inserted when amount==0`
OK: `[DEAD] PaymentLegacyProcessor unused since v4.0 migration`
OK: `[ANOMALY] checkout p99 jumped 8σ after deploy abc1234`
Bad: `Bug in orders` / `Fix the payment thing`

### 12.2 Body checklist

1. Evidence (log, file:line, diff, query, dashboard, SHA).
2. Expected vs observed (FSV style).
3. Scope/blast radius.
4. Repro steps if non-trivial.
5. Suggested next action (even "investigate further").
6. Verification level: `[VERIFIED]`, `[STATIC-ANALYSIS]`, or `[SUSPECTED]`.
7. Footer:
   
   ```
   ---
   Filed by: <agent-name>
   Session: <date or correlation-id>
   Commit: <sha>
   ```

**Bad body (do not produce):**

> "There's a bug in the auth module. It doesn't work right sometimes and could be a security issue. Someone should look at it."

Missing: no file:line, no reproduction, no expected vs observed, no scope, no priority justification, no evidence. This body is unfiled until corrected.

**Good body (target standard):**
All §12.2 checklist items present with specific evidence. See templates §8.

### 12.3 Same-turn fixes

Reference in commit: `Fixes #N` / `Closes #N` auto-closes on merge. Tiny fix + no prior issue → commit msg suffices. Non-trivial → file first, reference from PR.

### 12.4 Priority heuristic

- **p0** — security-exploitable now, prod outage, data loss possible.
- **p1** — user-facing bug, security weakness w/o immediate exploit, anomaly ≥3σ.
- **p2** — tech debt slowing dev, anomaly 2–3σ, real-path test gap. **Default.**
- **p3** — cosmetic, micro-opt, far-future risk.

**COMPOSITE SIGNAL RULES:**

- Multiple type signals on one finding → take highest priority. File ONCE with primary type label. Note secondary in body: `Also exhibits [secondary type] characteristics.`
- Security + any other type → p1 minimum. p0 if actively exploitable.
- Anomaly ≥3σ → p1 regardless of type label.
- p0 candidate → MUST NOT batch. File immediately. Suspend current work. Comment on active claim: `Pausing #N — p0 candidate found, filing #M.`

**COMPLEX COMPOSITE CONFLICTS (optional ToT path):**
When two or more type signals carry conflicting priority implications and a single-pass assessment is genuinely ambiguous, use branching evaluation:

- Branch A: Evaluate as `[primary type]`. Priority result: `[X]`. Key evidence: `[Y]`.
- Branch B: Evaluate as `[secondary type]`. Priority result: `[X]`. Key evidence: `[Y]`.
- Score each branch on: evidence strength (1–5) × blast radius (1–5).
- Take the higher-scoring branch as the filed type/priority.
- Note: `Evaluated as [A] and [B]. Filed as [winner] — score [N] vs [M].`

This ToT path is compute-expensive. Reserve for genuine composite ambiguity only; do not use as default for routine filings.

---

## 2. Multi-agent coordination protocol

### 2.0 Observation mode

When reviewing code without an active task assignment:

- SKIP §2.2 (claim). You are not claiming work.
- MUST execute §2.1 scan to confirm you are not touching in-progress files.
- MUST execute §4 / §5 trigger detection on all code reviewed.
- MUST execute filing decision protocol for each trigger found.
- MUST file all queued issues before session ends.
- Identify observation-mode filings in body footer: `Observed during sweep — no active claim this session.`

### 2.1 Before starting ANY work

```bash
# 1. What's already claimed? Avoid these.
gh issue list --repo $REPO --state open --label "status:in-progress" \
  --json number,title,assignees,updatedAt,labels

# 2. What's blocked? May be pickup-able if blocker resolved.
gh issue list --repo $REPO --state open --label "status:blocked" \
  --json number,title,assignees,updatedAt

# 3. What's open + unclaimed? Your candidate queue.
gh issue list --repo $REPO --state open --label "source:agent" \
  --search "no:assignee" --sort updated --json number,title,labels,updatedAt
```

Rule: **MUST NOT edit files referenced by a `status:in-progress` issue assigned to another agent unless your task requires it.** If it does, comment on that issue first announcing the overlap. Wait for ack or proceed with explicit note: `"Touching <files> for unrelated work on #<other>. Will not modify <their scope>."`

### 2.2 Claim an issue (atomic)

MUST execute claim as a single atomic message — split commands invalidate the claim:

```bash
gh issue edit $N --repo $REPO \
  --add-assignee @me \
  --remove-label "status:needs-triage" \
  --add-label "status:in-progress" \
  --add-label "agent:<your-name>"

gh issue comment $N --repo $REPO --body "$(cat <<'EOF'
**CLAIM** — agent:<name> session:<id> commit:<sha>
**Plan:** <2–4 bullet steps>
**Files I'll touch:** <list>
**ETA:** <rough — "this turn" / "multi-turn">
EOF
)"
```

If two agents race to claim, use the steal window by priority:

- p0: Silence >30 min with no heartbeat comment → steal eligible. Comment before stealing: `No heartbeat 30min on p0 #N. Claiming.`
- p1: Silence >2h → steal eligible. Comment before stealing: `No heartbeat 2h on p1 #N. Claiming.`
- p2/p3: Silence >24h → steal eligible.
  Always comment before stealing: `Claiming #N: prior holder [agent] silent since [ts].` Otherwise the earlier holder keeps it. Loser comments: `"Yielding — #N already claimed by @<other> at <ts>. Picking up #M instead."`

**AFTER CLAIMING — MUST execute before any code or file action:**

1. Read the full issue thread (all comments). If thread >50 comments: read last 10 comments + original body only, then use §12 COMPRESS.
2. Extract working state as a Reflexion episodic summary in 4 fields:
   - What has been tried and failed → do NOT repeat. Write to `/memory/discoveries/dead-ends.md`.
   - Learned invariants / gotchas → Write to `/memory/patterns/repo-invariants.md`.
   - Current leading hypothesis.
   - Files in scope per prior agent's plan.
3. Post a comment before proceeding: `Resuming. Episodic state loaded: [4 fields]. First action: [specific next step].`

### 2.3 While working — progress comments

MUST post a comment at each listed milestone (NOT every line). Silence at a required moment is a protocol violation. MUST post at each of the following moments:

- **Discovery:** `"Reproduced. Root cause: <hypothesis>. Evidence: <file:line, log>."`
- **Direction change:** `"Pivoting. <prev approach> failed because <reason>. Trying <new>."`
- **New finding worth a sibling issue:** open it, link both ways: `"Filed #M for <smell> found while investigating this."`
- **Heartbeat (long task):** every 30+ min of activity or every 5 substantive commits — `"Still active. Done: <X>. Next: <Y>."` Silence > 2h with `status:in-progress` = stale; others may steal after comment.

### 2.4 Pausing mid-task (highest-leverage habit)

```bash
gh issue comment $N --repo $REPO --body "$(cat <<'EOF'
**PAUSE** — agent:<name> session:<id> commit:<sha>
**Done:** <bullets>
**Tried & failed:** <bullets — save the next agent the dead-end>
**Learned:** <invariants/gotchas discovered>
**Resume at:** <file:line> with <next test/command>
**Hypothesis to verify:** <one sentence>
EOF
)"
```

**DUAL-WRITE OBLIGATION (PAUSE notes):**
When executing §2.4 PAUSE protocol, MUST write to both destinations:

- GitHub comment (public coordination record — required per §2.4)
- `/memory/discoveries/dead-ends.md`: append `Issue #N: [tried & failed field]`
- `/memory/patterns/repo-invariants.md`: append `[learned field]`

The GitHub comment is the coordination artifact. The memory write is the cognitive artifact — it survives context compaction and session reset.

If genuinely won't return → also `--remove-assignee @me` and `--remove-label "status:in-progress" --add-label "status:needs-triage"`. Else keep claim.

### 2.5 Blocked

**Before setting status:blocked — MUST verify no circular dependency:**

1. Check if the blocker issue (#M) itself has `status:blocked`.
2. If yes: read #M's blocked comment to identify its blocker (#K).
3. If #K = your issue (#N): circular dependency confirmed.
   - Comment on both #N and #M: `CIRCULAR DEPENDENCY: #N ← #M ← #N. Cannot resolve without operator decision.`
   - MUST NOT set `status:blocked`.
   - MUST set `status:needs-triage` + comment: `requires-operator-decision`.

```bash
gh issue edit $N --remove-label "status:in-progress" --add-label "status:blocked"
gh issue comment $N --body "**BLOCKED** by <#M | external dep | decision needed>. Cannot proceed until <unblock condition>."
```

Cross-link: comment on the blocker issue: `"Blocks #N."`

### 2.6 Conflict — two agents need same file

First commenter wins the file. Second agent:

1. Comment on their own issue: `"Waiting on #<other> — overlaps on <file>."`
2. Set `status:blocked`.
3. Move to next unclaimed issue.

OR negotiate split: `"@<other> — I need lines 100–200 of <file>, you have 300–400. Splitting OK? Will land after you."`

### 2.7 Done

```bash
# Reference issue in commit: "Fixes #N" / "Closes #N" auto-closes on PR merge.
gh issue comment $N --body "$(cat <<'EOF'
**RESOLVED** — agent:<name> commit:<sha> PR:#<pr>
**Fix summary:** <2 sentences>
**Verification:** <test added / FSV done / SoT readback>
**Side effects observed:** <or "none">
EOF
)"
# If no PR yet, leave status:in-progress until merged.
```

### 2.8 Behavioral constraints

**HARD STOP — MUST NOT (no exceptions):**

- MUST NOT edit a `status:in-progress` issue's scope without a prior overlap notice comment.
- MUST NOT close an issue you did not claim without `Duplicate of #N` and evidence.
- MUST NOT self-assign onto another agent's active claim without a prior comment-request.
- MUST NOT strip labels another agent set without superseding with documented reason.
- MUST NOT enable any §3.2 paid feature for any reason. File an issue and ask operator.
- MUST NOT push commits to issue-tracked files without a SHA-linked comment.

**WARN — SHOULD NOT (override requires explicit inline justification):**

- SHOULD NOT touch files in another agent's in-progress scope without commenting overlap intent.
- SHOULD NOT re-scope a claimed issue mid-work without prior comment discussion.

**ALLOW — MAY (best practice, not enforced):**

- MAY use `[fp:...]` fingerprint syntax in titles for automated dedupe matching.
- MAY negotiate file-range splits with another agent (§2.6) rather than blocking.

---

## 3. Platform facts — PRIVATE REPO on GitHub Free plan ONLY

This protocol assumes a **private repository on the GitHub Free plan** (individual account, no paid org). Every tool below is free under that plan. Anything not in the "free here" column → **stop and ask the operator.**

### 3.1 Free on private + Free plan (use freely)

- **Issues:** unlimited (issues, comments, labels, milestones, sub-issues, templates, assignees, reactions, cross-links, `Closes #N` auto-close).
- **API surfaces:** REST, GraphQL, `gh` CLI, official GitHub MCP server (`github/github-mcp-server`). Rate limit 5,000/hr per PAT.
- **Actions:** **2,000 minutes/month** of `ubuntu-latest` (Linux runner; Windows costs 2×, macOS 10× the minute budget — Linux only). Workflows triggered by `push`, `pull_request`, `schedule` (cron), `workflow_dispatch`, `issues`, `issue_comment`.
- **Default runners only:** `ubuntu-latest`, `ubuntu-22.04`, `ubuntu-24.04`. **Never** request `*-large`, `*-xlarge`, GPU, ARM-premium, or self-hosted billable runners.
- **Dependabot:** alerts, security updates (auto-PRs), version updates (`dependabot.yml`) — all free on private repos.
- **Secret scanning (push protection):** free on private repos for **generic + partner-detected secret patterns** (enabled via Settings → Code security). Advanced/custom patterns require GHAS (paid) — skip.
- **Branch protection, required reviews, required status checks:** free.
- **PRs, Discussions, Projects (new), Wiki, Releases, Tags:** free.
- **Packages:** 500MB storage + 1GB/mo bandwidth free for private. Don't push beyond.
- **Git LFS:** 1GB storage + 1GB/mo bandwidth free. Don't push beyond.
- **Codespaces:** 120 core-hours + 15GB storage/mo free. Treat as scarce — local dev preferred.
- **Pre-commit hooks, `gitleaks`, OSS SAST tools (Semgrep OSS, etc.)** as workflow steps using free Actions minutes.

### 3.2 NOT free on private + Free plan (refuse / ask first)

| Category                                                                                                                 | Why blocked                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| **Actions minutes > 2,000/mo**                                                                                           | Overage billed per-minute. Workflows must budget.            |
| **`runs-on:` containing `large`/`xlarge`/`gpu`**                                                                         | Premium runner SKUs are billed.                              |
| **Windows / macOS runners**                                                                                              | Cost 2× / 10× Linux minutes. Use `ubuntu-latest` always.     |
| **GitHub Advanced Security** (CodeQL code scanning on private repos, custom secret patterns, secret scanning historical) | Per-committer license; only free on public repos.            |
| **GitHub Pages on private repos**                                                                                        | Private Pages requires paid plan. Public-repo Pages is free. |
| **Codespaces > 120 core-hours / 15GB storage**                                                                           | Overage billed.                                              |
| **Packages > 500MB / LFS > 1GB** storage/bandwidth                                                                       | Overage billed.                                              |
| **Paid Marketplace apps** (anything with $ in pricing)                                                                   | Subscription.                                                |
| **GitHub Copilot / Copilot Business / Copilot Enterprise**                                                               | Per-seat subscription.                                       |
| **Plan upgrades** (Team, Enterprise)                                                                                     | Per-seat subscription.                                       |
| **Larger Codespaces machine types**                                                                                      | Higher core-hour billing rate.                               |

### 3.3 Hard rules

1. Workflows must declare `runs-on: ubuntu-latest` (or fixed Ubuntu version). Never premium runners.
2. Workflows must be cheap: cron at most **weekly** for SAST, **daily** for stale-issue cleanup, **on PR** for lint/test. No `*/N * * * *` minute/hour densities.
3. MUST declare `timeout-minutes` on all workflow jobs. Default ≤30. Absolute cap: 60. No exceptions.
4. Skip `paths-ignore`/`paths` filters when their inverse would cut minutes — be specific about what triggers a workflow.
5. Never enable a paid feature via UI, API, or workflow YAML. If a task needs one, **file an issue** describing the cost / free alternative / what the operator gains, and let them decide.
6. If unsure whether something costs money → assume yes, ask.

**Rate limits (free, all included):** PAT user 5,000/hr; `GITHUB_TOKEN` in Actions 1,000/hr/repo. Secondary: ≤900 pts/min REST, ≤2,000/min GraphQL (POST/PATCH/DELETE=5 pts, GET=1).

**RATE LIMIT GUARDS (MUST follow):**

- If making >20 `gh` CLI calls in a single turn: add a 2s pause between batches of 10.
- On any 403 or 429 response: stop all API calls, wait 60s, retry ONCE.
- If second attempt fails → save issue body to `/tmp/pending_issues/[timestamp].md` and report in turn summary: `Rate limited — issue body saved, file manually.`
- MUST verify every issue create succeeded before closing the filing loop:
  
  ```bash
  gh issue view $N --json number,title,state | grep '"state":"open"'
  ```
  
  If not confirmed → run dedupe check before any retry.

---

## 4. Trigger list (file if not fixing this turn)

**4.1 Defects:** reproducible bug (crash, wrong output, off-by-one, race, leak, deadlock); error/stack trace; test flake (even once); FSV disagreement (SoT ≠ return); uncovered 5xx/4xx.

**4.2 Smells:** dead code; duplicated logic (2+ sites); commented blocks > this session; methods >30 lines; cyclomatic >10; magic numbers/strings; TODO/FIXME/XXX/HACK (convert to issue or delete); bad names; bare `catch`/`except: pass`; linter-silenced inconsistencies.

**4.3 Tech debt:** intentional shortcuts (file w/ payback note); CVEs in deps; deprecated APIs / unsupported runtimes; missing tests on code you touched; stale docs; workarounds for upstream bugs (track upstream).

**4.4 Architecture:** distributed monolith symptoms; shared DB across services; God class; missing circuit breaker; SPOFs; tight coupling; missing observability; missing idempotency on retryable ops; schema/contract drift.

**4.5 Security (always p0/p1):** hardcoded secrets (file even after removal → track rotation); missing auth/authz; SQL/NoSQL/OS/template injection; missing input validation, output encoding, CSRF; weak crypto (MD5, SHA1, DES, ECB, custom); verbose errors leaking internals; missing security headers / TLS. Repo is private so issue content is already restricted to collaborators — file normally. For credential-class findings (active leaked tokens/keys), use **GitHub Security Advisories** (free on private repos) instead so disclosure is gated.

**4.6 Performance:** N+1 queries; unbounded list/loop/recursion; sync blocking I/O on hot path; missing pagination/rate-limit/timeout; missing retry-with-backoff; cache stampede risk / no TTL jitter.

**4.7 Verification gaps:** function w/o test; state change w/o FSV against SoT; uncovered boundary cases.

**4.8 Risks:** "fails at scale X" (file w/ threshold); "breaks when Y changes" (file w/ dependency); "hard to migrate later" (architectural debt).

Heuristic: "someone should look at this someday" → file it.

NOT a trigger (do not file):

- TODOs you are fixing this turn.
- Naming preferences without consistency violations elsewhere.
- Speculative "might be slow someday" without measurement evidence.
- Code you have not read — do not file based on style assumptions alone.
- `type:bug` for behavior you have not reproduced (→ `type:risk` instead, per FSV gate).

---

## 5. Anomaly detection

Signal anomalous if current value > N stddev from rolling mean.

| Threshold | Sensitivity | Use for                           |
| --------- | ----------- | --------------------------------- |
| ±2σ       | ~5%         | code-quality, latency, error rate |
| ±3σ       | ~0.3%       | capacity/resource (less noise)    |

Asymmetric metrics (latency, error count) → upper bound only. Symmetric (RPS) → both. **Robust variant** (N<10 or skewed): IQR — anomaly when value >1.5×IQR outside [Q1,Q3].

**Z-score:** `z=(x−μ)/σ`. `|z|≥2` → file `type:anomaly` with (signal, μ, σ, current, z, cause hypothesis, scope). `|z|≥3` → also `priority:p1`.

**Signals computable without infra:** file length (`git log --numstat`), function length/complexity (linter), tests per module, PR diff size, build time (CI logs), test runtime, error rate/endpoint, latency p95/p99, dep count (lockfile diff), TODO density (grep), open-issue age.

**Cautions:** N<10 → use IQR. Seasonal → deseasonalize. Single `0` may be a logging bug. Two-tailed thresholds wrong for one-sided metrics. Unsure → file with `needs-triage`.

---

## 6. Repo setup (one-time)

```
.github/
├── ISSUE_TEMPLATE/
│   ├── config.yml
│   └── 01-bug.yml … 07-test-gap.yml
├── workflows/
│   ├── dedupe-issues.yml
│   ├── auto-label.yml
│   └── stale-cleanup.yml
└── labels.yml
AGENTS.md
```

`config.yml`:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Discussion
    url: https://github.com/<owner>/<repo>/discussions
    about: Open-ended questions go here.
```

---

## 7. Labels

| Label                           | Color         | Meaning                       |
| ------------------------------- | ------------- | ----------------------------- |
| `type:bug`                      | red           | actual ≠ expected             |
| `type:tech-debt`                | gold          | works, should improve         |
| `type:dead-code`                | gray          | unused                        |
| `type:duplication`              | gold          | redundant logic               |
| `type:security`                 | dark red      | vuln/weakness                 |
| `type:performance`              | orange        | slow/inefficient              |
| `type:architecture`             | purple        | structural                    |
| `type:test-gap`                 | yellow        | missing test                  |
| `type:docs`                     | blue          | docs issue                    |
| `type:anomaly`                  | bright orange | statistical outlier           |
| `type:risk`                     | yellow        | foreseen failure              |
| `source:agent` / `source:human` | gray          | filer                         |
| `agent:<name>`                  | light blue    | which AI filed/claimed        |
| `priority:p0`                   | crimson       | drop everything (sec, outage) |
| `priority:p1`                   | red           | this week                     |
| `priority:p2`                   | orange        | this sprint (default)         |
| `priority:p3`                   | green         | whenever                      |
| `status:needs-triage`           | white         | not validated                 |
| `status:confirmed`              | light green   | reproduced                    |
| `status:in-progress`            | blue          | claimed + working             |
| `status:blocked`                | black         | waiting                       |
| `area:<module>`                 | per-area      | subsystem                     |

Bootstrap:

```bash
gh label create "type:bug"            --color "d73a4a"
gh label create "type:tech-debt"      --color "fbca04"
gh label create "type:dead-code"      --color "cccccc"
gh label create "type:duplication"    --color "fbca04"
gh label create "type:security"       --color "b60205"
gh label create "type:performance"    --color "d93f0b"
gh label create "type:architecture"   --color "5319e7"
gh label create "type:test-gap"       --color "fef2c0"
gh label create "type:docs"           --color "0075ca"
gh label create "type:anomaly"        --color "ff7619"
gh label create "type:risk"           --color "fbca04"
gh label create "source:agent"        --color "e1e4e8"
gh label create "source:human"        --color "586069"
gh label create "priority:p0"         --color "b60205"
gh label create "priority:p1"         --color "d93f0b"
gh label create "priority:p2"         --color "fbca04"
gh label create "priority:p3"         --color "0e8a16"
gh label create "status:needs-triage" --color "ffffff"
gh label create "status:confirmed"    --color "c2e0c6"
gh label create "status:in-progress"  --color "0366d6"
gh label create "status:blocked"      --color "000000"
```

Cap per issue: 1 `type:*` + 1 `priority:*` + 1 `status:*` + 1–2 `area:*` + `source:*` + `agent:*`.

---

## 8. Issue templates (`.github/ISSUE_TEMPLATE/`)

All default to `source:agent` + `status:needs-triage`. Required fields validated by GitHub.

### 8.1 `01-bug.yml`

```yaml
name: 🐛 Bug
description: Defect — actual ≠ expected.
title: "[BUG] "
labels: ["type:bug","status:needs-triage","source:agent"]
body:
  - {type: textarea, id: summary,   attributes: {label: Summary}, validations: {required: true}}
  - {type: textarea, id: reproduce, attributes: {label: Steps to reproduce, description: Numbered, exact commands.}, validations: {required: true}}
  - {type: textarea, id: expected,  attributes: {label: Expected}, validations: {required: true}}
  - {type: textarea, id: actual,    attributes: {label: Actual (with evidence — SoT read, logs)}, validations: {required: true}}
  - {type: input,    id: location,  attributes: {label: file:line / commit / URL}}
  - {type: textarea, id: scope,     attributes: {label: Suspected scope / blast radius}}
  - {type: textarea, id: workaround,attributes: {label: Workaround (if any)}}
  - {type: input,    id: agent,     attributes: {label: Filing agent}}
  - type: dropdown
    id: verification
    attributes:
      label: Verification level
      options:
        - "[VERIFIED] — reproduced/confirmed against running code or live data"
        - "[STATIC-ANALYSIS] — code inspection only, not executed"
        - "[SUSPECTED] — hypothesis only, needs investigation"
    validations:
      required: true
```

### 8.2 `02-tech-debt.yml`

```yaml
name: 🧹 Tech debt
title: "[DEBT] "
labels: ["type:tech-debt","status:needs-triage","source:agent"]
body:
  - {type: textarea, id: what,     attributes: {label: What is the debt}, validations: {required: true}}
  - {type: textarea, id: where,    attributes: {label: Where (files/modules)}, validations: {required: true}}
  - {type: textarea, id: why-bad,  attributes: {label: Why it slows future work (interest rate)}, validations: {required: true}}
  - {type: textarea, id: proposal, attributes: {label: Suggested refactor}}
  - {type: textarea, id: effort,   attributes: {label: Effort estimate, placeholder: "small <2h / medium 1–2d / large 1w+"}}
  - type: dropdown
    id: verification
    attributes:
      label: Verification level
      options:
        - "[VERIFIED] — reproduced/confirmed against running code or live data"
        - "[STATIC-ANALYSIS] — code inspection only, not executed"
        - "[SUSPECTED] — hypothesis only, needs investigation"
    validations:
      required: true
```

### 8.3 `03-dead-code.yml`

```yaml
name: 💀 Dead code
title: "[DEAD] "
labels: ["type:dead-code","status:needs-triage","source:agent"]
body:
  - {type: input,    id: symbol,    attributes: {label: Symbol / file / table / flag}, validations: {required: true}}
  - {type: textarea, id: evidence,  attributes: {label: Evidence unused (grep -r, coverage, DB 0-read)}, validations: {required: true}}
  - {type: textarea, id: indirect,  attributes: {label: Indirect consumers (reflection, DI, generated, external)}, validations: {required: true}}
  - {type: textarea, id: deletion-plan, attributes: {label: Deletion plan}}
  - type: dropdown
    id: verification
    attributes:
      label: Verification level
      options:
        - "[VERIFIED] — reproduced/confirmed against running code or live data"
        - "[STATIC-ANALYSIS] — code inspection only, not executed"
        - "[SUSPECTED] — hypothesis only, needs investigation"
    validations:
      required: true
```

### 8.4 `04-security.yml`

```yaml
name: 🔒 Security
title: "[SEC] "
labels: ["type:security","priority:p1","status:needs-triage","source:agent"]
body:
  - {type: textarea, id: finding,   attributes: {label: Finding}, validations: {required: true}}
  - {type: input,    id: cwe,       attributes: {label: CWE / OWASP (if known)}}
  - {type: textarea, id: impact,    attributes: {label: Impact if exploited}, validations: {required: true}}
  - {type: textarea, id: reproduce, attributes: {label: Reproduce / observe}}
  - {type: textarea, id: fix,       attributes: {label: Suggested fix}}
  - {type: checkboxes, id: disclosure, attributes: {label: Disclosure, options: [{label: "Needs private disclosure — omit exploit details in public-repo issues."}]}}
  - type: dropdown
    id: verification
    attributes:
      label: Verification level
      options:
        - "[VERIFIED] — reproduced/confirmed against running code or live data"
        - "[STATIC-ANALYSIS] — code inspection only, not executed"
        - "[SUSPECTED] — hypothesis only, needs investigation"
    validations:
      required: true
```

### 8.5 `05-anomaly.yml`

```yaml
name: 📊 Anomaly
title: "[ANOMALY] "
labels: ["type:anomaly","status:needs-triage","source:agent"]
body:
  - {type: input,    id: signal,     attributes: {label: Signal name}, validations: {required: true}}
  - {type: input,    id: stats,      attributes: {label: μ / σ / current / z, placeholder: "μ=1.2s σ=0.3s cur=2.8s z=5.3"}, validations: {required: true}}
  - {type: textarea, id: window,     attributes: {label: Window used}}
  - {type: textarea, id: hypothesis, attributes: {label: Cause hypothesis}}
  - {type: textarea, id: link,       attributes: {label: Evidence link (dashboard, log query, commit range)}}
  - type: dropdown
    id: verification
    attributes:
      label: Verification level
      options:
        - "[VERIFIED] — reproduced/confirmed against running code or live data"
        - "[STATIC-ANALYSIS] — code inspection only, not executed"
        - "[SUSPECTED] — hypothesis only, needs investigation"
    validations:
      required: true
```

### 8.6 `06-architecture.yml`

```yaml
name: 🏛️ Architecture
title: "[ARCH] "
labels: ["type:architecture","status:needs-triage","source:agent"]
body:
  - {type: textarea, id: concern,  attributes: {label: Concern}, validations: {required: true}}
  - {type: textarea, id: evidence, attributes: {label: Evidence (dep graph, traces, code refs)}, validations: {required: true}}
  - {type: textarea, id: risk,     attributes: {label: Risk if left}}
  - {type: textarea, id: options,  attributes: {label: Options considered}}
  - type: dropdown
    id: verification
    attributes:
      label: Verification level
      options:
        - "[VERIFIED] — reproduced/confirmed against running code or live data"
        - "[STATIC-ANALYSIS] — code inspection only, not executed"
        - "[SUSPECTED] — hypothesis only, needs investigation"
    validations:
      required: true
```

### 8.7 `07-test-gap.yml`

```yaml
name: 🧪 Test gap
title: "[TEST] "
labels: ["type:test-gap","status:needs-triage","source:agent"]
body:
  - {type: input,    id: target, attributes: {label: Function/endpoint/module}, validations: {required: true}}
  - {type: textarea, id: gap,    attributes: {label: What is uncovered}, validations: {required: true}}
  - {type: textarea, id: cases,  attributes: {label: Cases that should exist (happy/boundary/concurrency/auth/FSV)}}
  - type: dropdown
    id: verification
    attributes:
      label: Verification level
      options:
        - "[VERIFIED] — reproduced/confirmed against running code or live data"
        - "[STATIC-ANALYSIS] — code inspection only, not executed"
        - "[SUSPECTED] — hypothesis only, needs investigation"
    validations:
      required: true
```

---

## 9. Authentication

**Fine-grained PAT (recommended):** Settings → Developer settings → PAT → Fine-grained. Repo access: target only. Permissions: `Issues: R/W`, `Metadata: R`, `Contents: R/W if committing`. Max 90d expiration → rotate.

**Classic PAT:** avoid (broad `repo` scope).

**GitHub App (multi-agent):** isolated rate limits per install; short-lived auto-refreshed tokens; appears as `<app>[bot]`.

**`GITHUB_TOKEN` in Actions:** set `permissions: { issues: write }` at job level.

**Storage:** never commit (pre-commit `gitleaks`); CI → Secrets; workstation → `gh auth login` (keychain) or vault env-var. Leak = p0 → revoke now.

---

## 10. Three ways to create issues

### 10.1 `gh` CLI

```bash
gh issue create --repo "o/r" \
  --title "[BUG] Login retries fail after 3rd attempt" \
  --body-file ./issue-body.md \
  --label "type:bug,priority:p1,source:agent,agent:claude" \
  --assignee "@me"

gh issue list --repo "o/r" --state open \
  --search "login retries in:title,body" --json number,title,url

gh issue comment $N --repo "o/r" --body "Reproduced at $(date -u)."
gh issue close   $N --repo "o/r" --reason completed --comment "Fixed in #456."
```

### 10.2 REST

```bash
curl -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/o/r/issues \
  -d '{"title":"[DEAD] handleLegacyAuth() unused since v3.2","body":"...","labels":["type:dead-code","source:agent","status:needs-triage"]}'
```

Python helper:

```python
import os, requests
HDRS = {"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"}

def create_issue(owner, repo, title, body, labels):
    r = requests.post(f"https://api.github.com/repos/{owner}/{repo}/issues",
                      headers=HDRS, json={"title":title,"body":body,"labels":labels}, timeout=15)
    r.raise_for_status(); return r.json()

def search_issues(owner, repo, query):
    q = f"repo:{owner}/{repo} is:open is:issue {query}"
    r = requests.get("https://api.github.com/search/issues",
                     headers=HDRS, params={"q":q}, timeout=15)
    r.raise_for_status(); return r.json()["items"]
```

### 10.3 GitHub MCP (best for Claude/Cursor)

Official: `github/github-mcp-server`. Tools: `create_issue`, `list_issues`, `search_issues`, `update_issue`, `add_issue_comment`, plus PR/repo/Dependabot.

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "<fine-grained-PAT>"}
    }
  }
}
```

---

## 11. Mandatory dedupe (before EVERY create)

1. MUST score similarity before any create. Proceeding without a dedupe score is a protocol violation. Pick 3–6 **distinctive** keywords (symbol names, error strings, paths). Avoid `bug`, `error`, `failure`.
2. Search open + recently closed:
   
   ```bash
   gh issue list --repo o/r --state all --limit 50 \
     --search "handleLegacyAuth oauth retry in:title,body"
   ```
3. Score similarity:
   - ≥8/10 → **don't file.** Comment: `"Re-observed at SHA <sha> running <scenario>. New detail: …"`.
   - 5–7 → file, link related: `"Possibly related to #123, distinct because …"`.
   - <5 → file new.
4. Slipped duplicate:
   
   ```bash
   gh issue close $N --reason "not planned" \
     --comment "Duplicate of #123. Closing; follow #123."
   ```

`Duplicate of #N` syntax auto-marks. Title fingerprint trick: `[SEC] dangerous-eval at api/handler.py:142 [fp:semgrep:py-eval-handler-142]` then search `[fp:semgrep:py-eval-handler-142] in:title`.

---

## 13. Multi-agent handoff drill (codifies §2)

```bash
# A. Start of session — open agent-filed issues, sorted by claim status
gh issue list --repo $REPO --state open --label "source:agent" \
  --sort updated --limit 20 --json number,title,labels,assignees,updatedAt

# B. "Continue where someone left off" candidates
gh issue list --repo $REPO --state open \
  --search "label:source:agent label:status:in-progress no:assignee" \
  --json number,title,updatedAt
# (in-progress but unassigned = abandoned claim, fair game with a comment)

# C. High-priority queue
gh issue list --repo $REPO --state open \
  --label "priority:p0,priority:p1" --json number,title,labels,assignees
```

**Pickup ritual:**

1. Filter: `state:open` AND `source:agent` AND `no:assignee`.
2. Sort: priority asc, then `updated` asc (oldest first).
3. Read full thread including pause-note from prior agent. Extract Reflexion episodic state per §2.2.
4. `gh issue edit N --add-assignee @me --remove-label "status:needs-triage" --add-label "status:in-progress,agent:<me>"`.
5. Comment: `"Resuming from <last pause-note>. Plan: <2–4 bullets>."`
6. Work it. PR with `Closes #N`.

---

## 14. Automation backstop (Actions — within 2,000 min/mo free budget)

All workflows below use `ubuntu-latest` only, have explicit `timeout-minutes`, and run at most weekly/daily to stay well under the free 2,000-min budget. Never edit a workflow to use premium runners or remove timeouts.

### 14.1 SAST → Issues (weekly, ~5–10 min/run = ~40 min/mo)

```yaml
name: SAST → Issues
on:
  schedule: [{cron: "0 4 * * 1"}]    # weekly Monday 04:00 UTC
  workflow_dispatch: {}
permissions: {contents: read, issues: write, security-events: read}
jobs:
  scan:
    runs-on: ubuntu-latest            # NEVER change to larger/premium
    timeout-minutes: 20               # hard cap so a hang can't drain minutes
    steps:
      - uses: actions/checkout@v4
      - run: |
          pipx install semgrep
          semgrep --config=auto --json > findings.json
      - env: {GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}", REPO: "${{ github.repository }}"}
        run: python .github/scripts/findings_to_issues.py findings.json
```

Script hashes `rule_id + file + line` as fingerprint → searches title → files new only if absent.

(Note: Semgrep OSS is free. GitHub-native CodeQL code scanning on private repos requires Advanced Security — skip; Semgrep is the free equivalent here.)

### 14.2 Dependabot (free on private repos)

Settings → Security → Code security: enable alerts + security updates + version updates via `.github/dependabot.yml`. Convert unfixed alerts → `type:security` issues after N days. Dependabot PRs run on Actions minutes — keep `open-pull-requests-limit` reasonable (≤5 per ecosystem) so it doesn't flood.

### 14.3 Stale cleanup (daily, ~1 min/run = ~30 min/mo)

```yaml
name: Stale issues
on: {schedule: [{cron: "30 1 * * *"}]}
permissions: {issues: write}
jobs:
  stale:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/stale@v9
        with:
          days-before-issue-stale: 60
          days-before-issue-close: 14
          stale-issue-label: "status:stale"
          exempt-issue-labels: "priority:p0,priority:p1,status:in-progress"
          stale-issue-message: "No activity 60d. Closes in 14d unless reactivated."
          close-issue-message: "Closed stale. Reopen if still relevant."
```

### 14.4 Auto-labeling (on PR open, ~30s/run)

`actions/labeler` applies `area:*` by file-path patterns. Trigger `on: pull_request_target` only — cheap.

### 14.5 Budget guard (recommended)

Add a tiny workflow that fails CI if `gh api /repos/{owner}/{repo}/actions/usage` reports >1,800 minutes used this month, so the operator sees the warning before overage. Use as a required status check on PRs that add workflows.

---

## 15. Hygiene

- **Weekly 5-min triage:** scan `status:needs-triage`, confirm or close; reprioritize drifters.
- **Closing dupes:** always link kept issue in closing comment.
- **Stale `status:in-progress`** (no comment >2h, no commits >24h) → comment poke; >72h → strip assignee + revert to `needs-triage`.
- **Milestones** for sweeps: group all "harden auth" issues → milestone = sweep report.
- **Sub-issues:** parent + children via REST `POST /repos/{o}/{r}/issues/{n}/sub_issues` using numeric `id` (not number).
- **Trends:** which `area:*` accumulates → where real debt lives. Time-to-close per `type:*` → surface-only vs deep pattern.

---

## 16. Copy-paste artifacts

### 16.1 `AGENTS.md` (top of repo)

```markdown
<!-- TIER: BASE MODULE. Auto-loaded every session. Covers routine operations.
     Edge cases, conflict resolution, novel scenarios → docs2/flagprompt.md §[section]. -->

# AGENTS.md — Rules for AI Agents

## Non-negotiable
1. **File:** Observe a §4 trigger you're not fixing this turn → open Issue before turn ends.
2. **Claim:** Before working on an issue — assign self, set `status:in-progress`, comment plan + files-you'll-touch. Comment at every milestone. Pause/done = explicit comment. No silent work.

## Pre-work scan (every turn)
```bash
gh issue list --repo $REPO --state open --label "status:in-progress" --json number,title,assignees
gh issue list --repo $REPO --state open --label "source:agent" --search "no:assignee" --sort updated
```

Don't touch files in another agent's `status:in-progress` scope without commenting first.

## Filing

- Search 3–6 distinctive keywords (open + closed) before creating.
- Dup ≥8/10 → comment evidence on existing, don't file.
- Title prefixed `[BUG]/[DEBT]/[DEAD]/[SEC]/[ANOMALY]/[ARCH]/[TEST]`.
- Body: evidence (file:line, log, SHA), expected vs observed, scope, repro, next action, agent+session+SHA footer.
- Labels: 1 `type:*` + 1 `priority:*` (default p2) + `status:needs-triage` + `source:agent` + `agent:<me>`.

## Anomaly: any signal >2σ → `type:anomaly` with μ, σ, current, z, window.

## Handoff

- Pickup: filter `state:open + source:agent + no:assignee`, sort priority asc + updated asc, read pause-notes, claim, plan-comment.
- Pause: comment Done/Tried-failed/Learned/Resume-at/Hypothesis. Keep claim or release.
- Blocked: `status:blocked` + comment why, cross-link blocker.
- Done: comment Fix-summary/Verification/Side-effects, close via `Closes #N` in PR.

## Tools: `gh` CLI, REST/GraphQL, or GitHub MCP server.

## Memory Write Map (issue protocol state only)

When executing the issue protocol, write only to these targets:

| Protocol state                                  | Write target                          | Format                                                  |
| ----------------------------------------------- | ------------------------------------- | ------------------------------------------------------- |
| Active issue claim (#N, files-in-scope, plan)   | `/memory/context/active-claim.md`     | `Claim: #N. Files: [list]. Plan: [bullets].`            |
| Failed approaches (from PAUSE `Tried & failed`) | `/memory/discoveries/dead-ends.md`    | Append: `Issue #N: [approach] failed because [reason].` |
| Learned repo invariants (from PAUSE `Learned`)  | `/memory/patterns/repo-invariants.md` | Append: `[invariant discovered].`                       |
| Circular dependency detected                    | `/memory/blockers/circular-deps.md`   | `Circular: #N ↔ #M. Needs operator.`                    |
| Session handoff state                           | `/memory/handoff/issue-state.md`      | Full §2.4 PAUSE note format                             |

PAUSE comment (§2.4) = dual-write operation:

- GitHub comment (public coordination record, required)
- `/memory/discoveries/` + `/memory/patterns/` (persistent session memory, required)

Do NOT write code patterns, file paths, architecture facts, or anything already in `AGENTS.md` or `CLAUDE.md` to `./memory/` — this is pollution.

## Edge Case Reference (`docs2/flagprompt.md` — read by section only)

- Race condition / claim conflict → §2.6
- Circular blocking dependency → §2.5 + §2.6
- Observation mode (no active task) → §12 steps 4–5 only
- Repo setup (one-time) → §6–§9, §14, §16
- Platform cost constraint lookup → §3.2
- Anomaly math (z-score, IQR) → §5
- Automation YAML templates → §14
  
  ```
  
  ```

### 16.2 `.github/scripts/file_issue.py` — dedupe-aware filer

```python
#!/usr/bin/env python3
"""Dedupe-aware issue filer.
Usage:
  GITHUB_TOKEN=... python file_issue.py \
    --repo owner/name --title "[BUG] X" --body-file body.md \
    --labels type:bug,priority:p2,source:agent --keywords "foo bar baz"
Exit: 0=filed, 2=dedupe match (caller should comment on existing).
"""
import argparse, json, os, sys, urllib.parse, urllib.request
API = "https://api.github.com"

def gh(method, path, payload=None):
    req = urllib.request.Request(f"{API}{path}", method=method, headers={
        "Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "agent-issue-filer",
    }, data=json.dumps(payload).encode() if payload else None)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())

def search_existing(repo, keywords):
    q = f"repo:{repo} is:issue {keywords}"
    enc = urllib.parse.urlencode({"q": q, "per_page": 5})
    return gh("GET", f"/search/issues?{enc}").get("items", [])

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repo", required=True)
    p.add_argument("--title", required=True)
    p.add_argument("--body-file", required=True)
    p.add_argument("--labels", default="")
    p.add_argument("--keywords", required=True)
    args = p.parse_args()

    body = open(args.body_file).read()
    labels = [l.strip() for l in args.labels.split(",") if l.strip()]
    matches = search_existing(args.repo, args.keywords)
    if matches:
        print(f"⚠ Possible duplicates ({len(matches)}):")
        for m in matches[:5]:
            print(f"  #{m['number']} {m['state']} — {m['title']} — {m['html_url']}")
        sys.exit(2)
    owner, name = args.repo.split("/", 1)
    issue = gh("POST", f"/repos/{owner}/{name}/issues",
               {"title": args.title, "body": body, "labels": labels})
    print(f"✓ Filed #{issue['number']}: {issue['html_url']}")

if __name__ == "__main__":
    main()
```

### 16.3 Quick-start checklist (all steps free on private repo)

- [ ] Create labels (§7).
- [ ] Add 7 templates (§8) + `config.yml`.
- [ ] Create `AGENTS.md` (§16.1).
- [ ] Fine-grained PAT scoped `Issues: R/W`, `Metadata: R`, `Contents: R/W if committing`. Repo: this repo only. Expiry ≤90d.
- [ ] Store PAT in vault / MCP config (never commit).
- [ ] Enable Dependabot alerts + security updates + version updates (Settings → Security → Code security).
- [ ] Enable Secret scanning push protection for generic+partner patterns (Settings → Code security — free on private).
- [ ] Add `actions/stale` (§14.3) — uses ~30 min/mo of free Actions budget.
- [ ] Add SAST workflow (§14.1) — uses ~40 min/mo of free Actions budget.
- [ ] (Optional) Add §14.5 budget guard so the operator sees overage warnings.
- [ ] (Optional) Install GitHub MCP server.
- [ ] Smoke: `gh issue create --title "[TEST] verify setup" --body test --label type:docs` → claim → comment → close.
- [ ] Instruct agents: *"Read AGENTS.md. Private repo, GitHub Free plan, $0 budget — never enable paid features. File issues for anything abnormal. Claim before working. Comment every milestone."*

---

## 17. Limits

- **Plan:** private repo on GitHub Free. **Cost cap: $0/mo.**
- **API:** 5,000/hr PAT; 1,000/hr `GITHUB_TOKEN` in Actions.
- **Actions budget:** 2,000 min/mo of Linux runners. §14 workflows together use ~75 min/mo, leaving headroom for PR-triggered CI.
- **Storage:** Packages 500MB, LFS 1GB, Codespaces 120 core-hr + 15GB — don't push beyond.
- **Refuse paid features.** If a task needs one, file an issue with cost trade-off + free alternative and let the operator decide.
- **The discipline is the work.** GitHub makes filing+claiming+commenting free; agents must actually do it.
- **Win condition:** Issues become SoT + claim-board. Prompts shrink to "work `priority:p1` + `area:auth` + `no:assignee`."
