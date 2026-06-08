# Testing

## Backend Tests

The backend package uses Node's built-in test runner with colocated `*.test.ts` files.

Run them from `backend/`:

```bash
npm test
```

This executes the test suite under `backend/src/**/*.test.ts`.

## Frontend Checks

The frontend package has colocated test files such as `frontend/src/utils/api.test.ts`, but it does
not currently define a dedicated `test` script in `frontend/package.json`.

Run the available checks from `frontend/`:

```bash
npm run build
npm run lint
```

## What To Test

When changing behavior, cover the code path that actually owns the state:

- route and auth changes in `backend/src/routes/`
- gate logic in `backend/src/modules/preflightGate.ts`
- session and ownership logic in `backend/src/modules/sessionRegistry.ts` and
  `backend/src/modules/sessionStore.ts`
- model selection and orchestration in `backend/src/agents/`
- API client behavior in `frontend/src/utils/api.ts`

## Manual Verification Targets

Some flows are easiest to verify end-to-end in the browser:

- SSE streaming dispatch
- model selection and config loading
- upload authorization and disclosure gating
- session revert behavior
- config read/write behavior

## Useful Test Adjacent Commands

- `cd backend && npm run eval-router` - run the router evaluation script.
- `cd backend && npm run build` - catch TypeScript regressions before running tests.
- `cd frontend && npm run build` - ensure the UI compiles after changes.

