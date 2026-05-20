# CLAUDE.md

## Artifact Classification

This repository uses `CLAUDE.md` as the root-level static project baseline for Anthropic Claude Code autonomous operations.

The exact contiguous upstream markdown syntax for this artifact is classified as:

```text
[UNDEFINED ARCHITECTURAL VARIABLE]
```

This document implements the defined structural classification, deployment target, operational constraints, execution verification requirements, and dynamic memory quarantine rules required by the repository architecture.

## Deployment Target

| System Parameter | Defined Value | Architectural Function |
| :--- | :--- | :--- |
| Physical Filepath | Repository root: `CLAUDE.md` | Serves as the static project baseline for autonomous operations. |
| Target Execution Engine | Anthropic Claude Code | Auto-loaded natively by the execution harness upon session initialization. |
| Equivalent Codex Artifact | `AGENTS.md` | Functions as the Anthropic equivalent to OpenAI Codex's root agent manual. |
| Primary Payload Classification | Agent Operating Manual | Stores static standards, safety requirements, architecture constraints, and project conventions. |

## Primary Directive

Claude Code must treat this file as the repository's static operating manual.

This file defines durable project constraints, architectural boundaries, safety requirements, and execution conventions. It must be consulted before converting user intent into code changes, shell commands, issue actions, or repository mutations.

## Execution Verification Constraint

During Phase 3 (WORK), when translating a task into execution steps, explicitly reference `CLAUDE.md` to establish the exact boundaries of operational constraints.

Before implementation, verify:

- The task does not violate repository safety constraints.
- The task does not introduce unauthorized abstractions.
- The task preserves existing functionality unless a behavior change is explicitly required.
- The task follows documented project conventions.
- The task can be verified through physical evidence, not intent alone.

## Code-Simplifier Doctrine

When simplifying, refactoring, or restructuring code:

- Follow `CLAUDE.md` conventions exactly.
- Preserve functionality.
- Do not introduce unauthorized abstractions.
- Do not broaden scope beyond the requested or claimed work.
- Prefer minimal, local changes over speculative architecture changes.
- Avoid cleverness that reduces future agent recoverability.
- Keep behavior stable unless the issue explicitly requires behavior change.

## Dynamic Memory Quarantine

Static operating manuals and dynamic session state must remain segregated.

Agents are forbidden from writing structural project rules, code patterns, file paths, architecture rules, safety standards, issue protocols, or durable conventions into the `./memory/` persistent brain when those rules are already documented in `CLAUDE.md`.

This quarantine exists to:

- Prevent pollution of dynamic memory.
- Preserve context-window efficiency.
- Reduce read-contention during amnesiac recovery loops.
- Keep durable project doctrine in one predictable static location.
- Prevent multiple conflicting sources of architectural truth.

Use `./memory/` only for dynamic session state, transient learnings, active handoffs, or project facts that are not already encoded in this static manual.

## Relationship to AGENTS.md

`CLAUDE.md` is the Anthropic Claude Code equivalent of `AGENTS.md`.

If both files exist:

- Treat `CLAUDE.md` as the Claude Code local operating manual.
- Treat `AGENTS.md` as the OpenAI Codex local operating manual.
- Keep durable rules synchronized between both files when the rule applies to both engines.
- Do not create contradictory agent instructions across the two manuals.
- If a conflict exists, stop and request or file clarification before proceeding with risky changes.

## Baseline Repository Constraints

- Treat the repository as private unless explicitly documented otherwise.
- Respect GitHub Free plan constraints.
- Maintain a strict `$0` budget.
- Never enable paid features, paid runners, paid GitHub products, paid APIs, or cost-incurring infrastructure.
- Prefer local verification and repository-native automation.
- Do not silently bypass abnormal states.
- File issues for anything abnormal that cannot be resolved safely in the current work session.
- Claim before working.
- Comment every meaningful milestone.

## Physical State Verification

Every meaningful state change must be verified against physical evidence.

Physical State Verification (FSV) means comparing expected state against observed state using concrete evidence such as:

- File contents.
- Git diff.
- Test output.
- Build output.
- Runtime logs.
- Query output.
- API response.
- CLI output.
- Commit SHA.
- Issue or pull request metadata.

Use this assertion shape when reporting verification:

```text
Expected:
  Source of Truth:

Observed:
  Physical state:

Delta:
  Expected == Observed or Expected != Observed because ...
```

If a state change cannot be verified, file or update an appropriate issue before ending the turn.

## Work Execution Standard

Persist until the task is fully handled end-to-end within the current turn whenever feasible.

Do not stop at analysis or partial fixes. Carry work through:

1. Understanding the task.
2. Checking applicable constraints in `CLAUDE.md`.
3. Claiming or confirming work ownership when issue-driven.
4. Implementing the change.
5. Verifying physical state.
6. Filing or updating issues for abnormal residuals.
7. Explaining outcomes clearly.

## Issue Protocol

Agents must file or update issues for abnormal states that cannot be safely resolved immediately.

Allowed issue prefixes are:

```text
[BUG]
[DEBT]
[DEAD]
[SEC]
[ANOMALY]
[ARCH]
[TEST]
```

Titles must:

- Use one allowed prefix.
- Be `<=80` characters.
- Describe the current state, not the proposed fix.
- Identify the specific file, symbol, endpoint, service, boundary, or metric when possible.

Every agent-filed issue body must contain:

1. Evidence: `file:line`, log output, query output, diff, metric output, or SHA.
2. Expected vs observed state.
3. Scope / blast radius.
4. Reproduction or verification steps.
5. Suggested next action.
6. Traceability footer containing agent identity, session ID, and commit SHA.

Footer shape:

```text
---
Executing agent: agent:<name>
Session ID: <session-id>
Commit SHA: <commit-sha>
```

## Label Matrix

Every agent-filed issue must apply:

- Exactly one `type:*` label.
- Exactly one `priority:*` label, defaulting to `priority:p2` unless severity requires escalation.
- `status:needs-triage`.
- `source:agent`.
- `agent:<me>`.

## Duplicate Prevention

Before creating a new issue:

1. Search 3–6 distinctive keywords across open and closed issues.
2. Compare likely duplicates.
3. If duplicate score is `>=8/10`, comment evidence on the existing issue instead of filing a new one.
4. If no sufficient duplicate exists, create a new issue with the correct template and labels.

## Concurrency and Collision Rules

- Do not touch files in another agent's `status:in-progress` scope without commenting first.
- Check whether the issue, files, or subsystem are already claimed before beginning work.
- If overlap is unavoidable, comment on the existing issue with intended scope.
- Never overwrite another agent's partial work without preserving evidence and explaining why.
- Prefer additive changes when collision risk is high.

## Session Handoff Protocols

### Pickup

To pick up work:

1. Filter issues by `state:open`, `source:agent`, and `no:assignee`.
2. Sort by priority ascending and updated timestamp ascending.
3. Read all pause notes and recent comments.
4. Execute an atomic claim.
5. Apply or confirm `status:in-progress`.
6. Post a plan comment before changing files.

Plan comment shape:

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

Blocked comment shape:

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

Done comment shape:

```text
Fix-summary:
Verification:
Side-effects:
Closes:
```

## Security Invariant

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

For active leaked tokens, keys, credentials, session cookies, or production secrets, bypass normal issue content and use GitHub Security Advisories.

Never paste active secrets into issues, comments, pull requests, commits, logs, memory files, or chat output.

## Test Gap Invariant

File `[TEST]` when:

- Functional logic lacks dedicated test coverage.
- A state change occurs without corresponding FSV against the Source of Truth.
- Boundary cases are missing, including max+1, unicode injection, concurrent execution, null/empty input, malformed payloads, retry behavior, idempotency, permission boundaries, overflow, underflow, duplicate input, partial failure, ordering, and external dependency failure.

## Dead Code Invariant

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

## Technical Debt Invariant

File `[DEBT]` when work intentionally leaves behind a sub-optimal state, including:

- Intentional shortcuts.
- Unpatched dependency vulnerabilities.
- Deprecated APIs.
- Unsupported runtimes.
- Missing tests on modified code.
- Documentation drift.
- Workarounds for upstream bugs.

Every intentional shortcut requires an explicit payback note.

## Architecture Invariant

File `[ARCH]` for systemic structural anti-patterns, including:

- Distributed monolith symptoms.
- Shared databases across discrete services.
- God classes or god services.
- Missing circuit breakers.
- Missing idempotency on retryable operations.
- Single points of failure.
- Contract drift.
- Observability black holes.

## Anomaly Invariant

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

## Approved Tooling Boundaries

Agents must restrict GitHub API operations to:

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
- `CLAUDE.md` conflicts with another static operating manual and the action is risky.

When stopping, leave a complete handoff comment or issue update.

## Final Operating Principle

Do not optimize for appearing complete. Optimize for recoverable, verifiable progress.

Every turn should leave the repository easier for the next agent to reason about than it was before.
