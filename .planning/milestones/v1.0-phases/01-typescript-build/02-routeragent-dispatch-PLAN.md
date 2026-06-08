---
phase: 1
phase_name: TypeScript Build
plan_id: 02-routeragent-dispatch
wave: 1
objective: Fix the RouterAgent timeout signal and remove the stale positional argument from council dispatch so the build is clean and runtime timeout semantics are correct.
requirements_addressed:
  - BUILD-01
  - BUILD-03
must_haves:
  - Replace the out-of-scope `abortSignal` reference in `backend/src/agents/RouterAgent.ts` with `AbortSignal.timeout(timeoutMs)`.
  - Remove the trailing `abortSignal` argument from the `RouterAgent.sampleAgents()` call in `backend/src/dispatch/councilDispatch.ts`.
  - Preserve the existing timeout default and accept the already-decided loss of client-disconnect cancellation in Phase 1.
truths:
  - `RouterAgent.sampleAgents()` already accepts `timeoutMs` and uses `RouterAgent.SAMPLE_AGENTS_TIMEOUT_MS` as its default.
  - `councilDispatch.ts` is the only explicit caller passing a timeout-position argument that is now wrong.
  - The phase context has already locked the abort-propagation tradeoff to the minimal compile fix.
verification:
  - `tsc --noEmit` exits with code 0 and prints no diagnostics.
  - `RouterAgent.ts` no longer references an undefined `abortSignal` variable.
  - `councilDispatch.ts` no longer passes a trailing `AbortSignal` object where a timeout number is expected.
---

# Phase 1 Plan: RouterAgent and Council Dispatch Timeout Fixes

## Objective

Fix the type error in `backend/src/agents/RouterAgent.ts` and the positional-argument bug in `backend/src/dispatch/councilDispatch.ts` so the build is clean and the timeout path is internally consistent.

## Scope

This plan is limited to the two linked TypeScript fixes that affect abort handling. It does not widen the API, add a new signal parameter, or rework the routing contract.

## Tasks

1. Replace `signal: abortSignal` with `signal: AbortSignal.timeout(timeoutMs)` in `RouterAgent.ts`.
2. Remove the trailing `abortSignal` argument from the `RouterAgent.sampleAgents()` call in `councilDispatch.ts`.
3. Re-run the compiler after both edits to make sure the remaining build is clean.

## Verification

1. Run `tsc --noEmit` from the project/backend root.
2. Confirm the RouterAgent file no longer references an undefined variable.
3. Confirm the council dispatch call still passes the intended arguments in the correct order.

## Done Criteria

This plan is done when the compiler is clean and the timeout behavior matches the phase decision recorded in context.
