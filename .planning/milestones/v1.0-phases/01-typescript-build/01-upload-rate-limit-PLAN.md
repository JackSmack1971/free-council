---
phase: 1
phase_name: TypeScript Build
plan_id: 01-upload-rate-limit
wave: 1
objective: Restore the upload route's rate limiter import so the existing middleware stack compiles and remains active.
requirements_addressed:
  - BUILD-01
  - BUILD-02
must_haves:
  - Import `createRateLimitMiddleware` in `backend/src/routes/upload.ts` using the existing NodeNext `.js` path style.
  - Preserve the current upload handler structure and limiter configuration.
  - Do not introduce any behavior change beyond making the already-wired middleware compile and run.
truths:
  - `backend/src/middleware/rateLimit.ts` already exports `createRateLimitMiddleware`.
  - `backend/src/routes/upload.ts` already instantiates `uploadRateLimiter` at module scope.
verification:
  - `tsc --noEmit` exits with code 0 and prints no diagnostics.
  - The upload route file shows the restored import and no unrelated changes.
---

# Phase 1 Plan: Upload Rate Limit Import

## Objective

Restore the missing `createRateLimitMiddleware` import in `backend/src/routes/upload.ts` so the upload limiter is both type-correct and active at runtime.

## Scope

This plan is limited to the one missing import in `upload.ts`. It does not change the limiter settings, multipart parsing, session lookup, or any other route behavior.

## Tasks

1. Add the missing `createRateLimitMiddleware` import from `../middleware/rateLimit.js`.
2. Keep the existing `uploadRateLimiter` initialization unchanged so the route stack stays identical.
3. Re-run the TypeScript compiler after the edit to confirm the symbol resolves cleanly.

## Verification

1. Run `tsc --noEmit` from the backend/project root used by the repository.
2. Confirm there are no diagnostics related to `upload.ts`.
3. Review the diff to verify the change is limited to the import line.

## Done Criteria

This plan is done when the import exists, the build is still clean, and no extra upload-route behavior has changed.
