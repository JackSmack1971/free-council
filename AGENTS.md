# AGENTS.md

## Artifact Classification

This repository uses `AGENTS.md` as the root-level, auto-loaded baseline constraint layer for OpenAI Codex.

The exact, contiguous upstream markdown syntax for this artifact is classified as:

```text
[UNDEFINED ARCHITECTURAL VARIABLE]
```

This document implements the defined artifact classification, initialization directives, operating invariants, Physical State Verification (FSV) expectations, and GitHub synchronization protocols required for deterministic multi-agent execution.

## Deployment Target

| Parameter | Defined Value | Systemic Function |
| :--- | :--- | :--- |
| Physical Filepath | `AGENTS.md` | Top-of-repository agent operating manual. |
| Target Engine | OpenAI Codex | Natively loaded by Codex; functions equivalently to `CLAUDE.md` for Claude Code. |
| Primary Directive | Operational memory & invariants | Prevents pollution of the dynamic `./memory/` namespace by supplying static code patterns, conventions, and architectural rules. |

## Required Startup Instruction

When initializing an agent in this repository, the operator must bind the agent to the zero-budget constraint and issue protocol using the following exact instruction:

```text
Read AGENTS.md. Private repo, GitHub Free plan, $0 budget — never enable paid features. File issues for anything abnormal. Claim before working. Comment every milestone.
```

## Budget and Repository Constraints

- Treat the repository as private.
- Assume GitHub Free plan constraints.
- Maintain a strict `$0` budget.
- Never enable paid features, paid runners, paid GitHub products, external paid APIs, or infrastructure that creates cost exposure.
- Prefer local verification and repository-native automation.
- Do not pollute `./memory/` with static conventions, repo rules, or durable operating doctrine. Store those here.

## Codex Execution Guidance

Persist until the task is fully handled end-to-end within the current turn whenever feasible: do not stop at analysis or partial fixes; carry changes through implementation, verification, and a clear explanation of outcomes.

## Core Operating Invariants

- Claim before working.
- Comment every milestone.
- File issues for anything abnormal.
- Verify physical state, not just intended state.
- Prefer small, atomic, reversible changes.
- Keep handoffs explicit enough for an amnesiac agent to resume without hidden context.
- Do not silently bypass defects, verification gaps, security concerns, architectural flaws, dead code, technical debt, or anomalies.

## Physical State Verification

Every meaningful state change must be verified against the Source of Truth.

FSV means comparing the expected state against the observed physical state through concrete evidence such as:

- File contents.
- Test output.
- Git diff.
- Runtime logs.
- Query output.
- API response.
- CLI output.
- Commit SHA.
- Issue or PR metadata.

Use the following assertion shape when reporting verification:

```text
Expected:
  SoT:

Observed:
  Physical state:

Delta:
  Expected == Observed or Expected != Observed because ...
```

If a state change cannot be verified, file a `[TEST]` issue before ending the turn.

## Concurrency and Collision Rules

- Do not touch files in another agent's `status:in-progress` scope without commenting first.
- Before beginning work, check whether the relevant issue, files, or subsystem are already claimed.
- If overlap is unavoidable, comment on the existing issue with intended scope and wait for a safe handoff path where possible.
- Never overwrite another agent's partial work without preserving evidence and explaining the reason.
- Prefer additive changes when collision risk is high.

## Issue Filing Constraints

Before creating any new issue:

1. Search 3–6 distinctive keywords across open and closed issues.
2. Compare likely duplicates.
3. If duplicate score is `>=8/10`, comment evidence on the existing issue instead of filing a new one.
4. If no sufficient duplicate exists, create a new issue using the appropriate template and labels.

### Allowed Title Prefixes

Issue title prefix must be strictly one of:

```text
[BUG]
[DEBT]
[DEAD]
[SEC]
[ANOMALY]
[ARCH]
[TEST]
```

### Title Requirements

- Prefix must match the issue type.
- Title must be `<=80` characters.
- Title must describe the current state, not the proposed fix.
- Title must identify the specific symbol, file, endpoint, service, boundary, or signal when possible.

### Required Body Payload

Every agent-filed issue body must contain:

1. Evidence: `file:line`, log output, query output, diff, metric output, or SHA.
2. Expected vs observed state.
3. Scope / blast radius.
4. Reproduction or verification steps.
5. Suggested next action.
6. Traceability footer containing agent identity, session ID, and commit SHA.

Use this footer shape:

```text
---
Executing agent: agent:<name>
Session ID: <session-id>
Commit SHA: <commit-sha>
```

### Required Label Matrix

Every agent-filed issue must apply:

- Exactly one `type:*` label.
- Exactly one `priority:*` label, defaulting to `priority:p2` unless severity requires escalation.
- `status:needs-triage`.
- `source:agent`.
- `agent:<me>`.

## Issue Type Matrix

| Prefix | Type Label | Default Priority | Purpose |
| :--- | :--- | :--- | :--- |
| `[BUG]` | `type:bug` | `priority:p2` | Reproducible defects, stack traces, test flakes, FSV disagreements, uncovered 5xx/4xx responses. |
| `[DEBT]` | `type:tech-debt` | `priority:p2` | Sub-optimal states categorized as works-but-should-improve. |
| `[DEAD]` | `type:dead-code` | `priority:p2` | Structurally unused or redundant logic requiring extraction or deletion. |
| `[SEC]` | `type:security` | `priority:p1` | Vulnerabilities, cryptographic weaknesses, boundary failures, or exploitation vectors. |
| `[ANOMALY]` | `type:anomaly` | `priority:p2` or `priority:p1` | Statistical deviations across continuous metrics or repository-derived signals. |
| `[ARCH]` | `type:architecture` | `priority:p2` | Deep structural/systemic flaws requiring strategic refactoring. |
| `[TEST]` | `type:test-gap` | `priority:p2` | Missing test coverage or missing Physical State Verification. |

## Anomaly Filing Rule

Any metric signal with deviation greater than `2σ` requires filing a `type:anomaly` issue.

The anomaly body must contain:

```text
signal:
μ:
σ:
current:
z:
window:
cause hypothesis:
scope:
```

Escalate to `priority:p1` when `|z| >= 3`.

Use robust IQR detection when sample size is small or the distribution is skewed:

```text
>1.5×IQR outside [Q1,Q3]
```

Zero-infrastructure computable signals include:

- File length from `git log --numstat`.
- Function complexity.
- PR diff size.
- Test runtime.
- TODO density.
- Open-issue age.

## Security Filing Rule

Invoke `[SEC]` immediately upon detecting security weaknesses, including:

- Weak or custom cryptography.
- SQL, NoSQL, OS, template, or prompt injection.
- Missing authentication or authorization.
- Missing input validation.
- Missing output encoding.
- Missing CSRF protection.
- Verbose error disclosure.
- Missing security headers or TLS protections.
- Hardcoded secrets.

For active leaked tokens, keys, credentials, session cookies, or production secrets, bypass public issue content and use GitHub Security Advisories.

Never paste active secrets into issues, comments, pull requests, commits, logs, or chat output.

If hardcoded credentials were removed, still file or update a security tracking item so rotation is not lost.

## Dead Code Verification Gate

Operate under:

```text
delete, don't comment
```

Before deleting dead code, verify it is not implicitly invoked by:

- Reflection.
- Dependency Injection.
- Dynamic dispatch.
- Generated SDKs.
- Framework routing conventions.
- Runtime registration.
- External integrations.

If dead code cannot be safely removed in the current turn, file `[DEAD]`.

## Test Gap Rule

File `[TEST]` when any of the following is observed:

- Functional logic lacks dedicated test coverage.
- A state change occurs without corresponding FSV against the Source of Truth.
- Boundary cases are missing, including max+1, unicode injection, concurrent execution, null/empty input, malformed payloads, retry behavior, idempotency, permission boundaries, overflow, underflow, duplicate input, partial failure, ordering, and external dependency failure.

## Technical Debt Rule

File `[DEBT]` when work intentionally leaves behind a sub-optimal state, including:

- Intentional shortcuts.
- Unpatched dependency vulnerabilities.
- Deprecated APIs.
- Unsupported runtimes.
- Missing tests on modified code.
- Documentation drift.
- Workarounds for upstream bugs.

Every intentional shortcut requires an explicit payback note.

## Architecture Rule

File `[ARCH]` for systemic structural anti-patterns, including:

- Distributed monolith symptoms.
- Shared databases across discrete services.
- God classes or god services.
- Missing circuit breakers.
- Missing idempotency on retryable operations.
- Single points of failure.
- Contract drift.
- Observability black holes.

## Session Handoff Protocols

### Pickup

To pick up work:

1. Filter issues by `state:open`, `source:agent`, and `no:assignee`.
2. Sort by priority ascending and updated timestamp ascending.
3. Read all pause notes and recent comments.
4. Execute an atomic claim.
5. Apply or confirm `status:in-progress`.
6. Post a plan comment before changing files.

The plan comment must include:

```text
Plan:
- Scope:
- Files likely touched:
- Verification:
- Collision risk:
```

### Pause

When pausing work, comment with:

```text
Done:
Tried-failed:
Learned:
Resume-at:
Hypothesis:
Claim status:
```

Keep the claim only if continued ownership is intentional. Otherwise explicitly release it.

### Blocked

When blocked:

1. Apply `status:blocked`.
2. Comment the reason.
3. Cross-link the specific blocker.
4. Include the next unblock condition.

Use this shape:

```text
Blocked:
Reason:
Specific blocker:
Unblock condition:
```

### Done

When done:

1. Comment final outcome.
2. Include fix summary.
3. Include verification evidence.
4. Include known side effects.
5. Close through a PR using `Closes #N` when applicable.

Use this shape:

```text
Fix-summary:
Verification:
Side-effects:
Closes:
```

## Milestone Commenting

Comment every meaningful milestone, including:

- Claim.
- Plan.
- First successful reproduction.
- Failed reproduction with evidence.
- Implementation complete.
- Verification complete.
- Blocked state.
- Pause handoff.
- Done state.

Milestone comments must be factual, evidence-backed, and brief.

## Approved Tooling Boundaries

Agents must restrict API operations to:

- `gh` CLI.
- GitHub REST API.
- GitHub GraphQL API.
- Official GitHub MCP server.

Do not use unofficial GitHub automation, paid GitHub features, or third-party paid services.

## Git and Pull Request Rules

- Keep changes scoped.
- Do not force-push shared branches unless explicitly authorized.
- Prefer branch names that identify the issue number and type.
- Include issue references in commit messages or PR bodies where useful.
- Do not close issues without verification evidence.
- Use `Closes #N` in the PR when the change fully resolves the issue.
- Use `Refs #N` when the change is partial or related.

## Verification Output Standard

At the end of a completed task, report:

```text
Changed:
Verified:
Issues filed or updated:
Residual risk:
```

If no verification was possible, state why and file `[TEST]`, `[BUG]`, or another appropriate issue before ending the turn.

## Non-Negotiable Stop Conditions

Stop and escalate when:

- Active secrets are discovered.
- A destructive migration is required.
- Production data could be modified or deleted.
- The requested action enables paid features.
- Another agent owns the target files and has not acknowledged overlap.
- The fix requires credentials or permissions not available in the current environment.

When stopping, leave a complete handoff comment or issue update.

## Final Operating Principle

Do not optimize for looking complete. Optimize for recoverable, verifiable progress.

Every turn should leave the repository easier for the next agent to reason about than it was before.
