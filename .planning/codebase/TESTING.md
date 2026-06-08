# Testing Patterns

**Analysis Date:** 2026-06-08

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`) — no Jest, Vitest, or Mocha
- Invoked via: `node --import tsx --test --test-concurrency=1 src/**/*.test.ts`
- Config: defined inline in `backend/package.json` scripts, no separate test config file
- `--test-concurrency=1` enforces serial execution (SQLite in-memory shared state)

**Assertion Library:**
- `node:assert` (standard) — used in most tests
- `node:assert/strict` (strict mode) — used in config tests (`corsOptions.test.ts`, `sessionStore.test.ts`, `api.test.ts`)
- Both are used across the codebase; prefer `node:assert/strict` for new tests

**Run Commands:**
```bash
cd backend && npm test              # Run all tests (serial)
```
No watch mode or coverage commands are configured.

## Test File Organization

**Location:**
- Co-located with source files in the same directory
- Every `src/foo/bar.ts` has a sibling `src/foo/bar.test.ts`

**Naming:**
- `<moduleName>.test.ts` — always `.test.ts` suffix, never `.spec.ts`

**Structure:**
```
backend/src/
├── agents/
│   ├── AgentOrchestrator.ts
│   ├── AgentOrchestrator.test.ts
│   ├── RouterAgent.ts
│   └── RouterAgent.test.ts
├── config/
│   ├── corsOptions.ts
│   ├── corsOptions.test.ts
│   ├── logger.ts
│   ├── logger.test.ts
│   └── port.ts, port.test.ts, ...
├── db/
│   ├── migrationRunner.ts
│   ├── migrationRunner.test.ts
│   └── ...
├── dispatch/
│   ├── soloDispatch.ts
│   ├── soloDispatch.test.ts
│   └── ...
├── modules/
│   ├── conversationStore.ts
│   ├── conversationStore.test.ts
│   └── ...
├── routes/
│   ├── api.ts
│   └── api.test.ts
frontend/src/
└── utils/
    ├── api.ts
    └── api.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('ModuleName Tests', () => {
  before(() => {
    runMigrations();               // DB-dependent tests always call this
    originalFetch = globalThis.fetch; // capture before override
  });

  after(() => {
    globalThis.fetch = originalFetch; // always restore globals
  });

  beforeEach(() => {
    db.exec('DELETE FROM table'); // isolation: clear state before each test
  });

  test('should describe behavior in imperative form', () => {
    // arrange → act → assert pattern
  });
});
```

**Patterns:**
- `before()` — run once per suite: DB migrations, global capture
- `after()` — run once per suite: restore globals, close servers
- `beforeEach()` — clear DB tables for isolation in stateful tests
- No `afterEach()` observed
- Test descriptions use `'should ...'` or plain imperative form

## Mocking

**Framework:**
- No mocking library — uses direct `globalThis` overrides

**Global fetch mock pattern:**
```typescript
let originalFetch: typeof fetch;

before(() => {
  originalFetch = globalThis.fetch;
});

after(() => {
  globalThis.fetch = originalFetch;
});

test('...', async () => {
  globalThis.fetch = async (url: any, init: any) => {
    const body = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'mock response' } }] })
    } as Response;
  };
  // ... test logic
});
```

**Streaming response mock (SSE pattern):**
```typescript
globalThis.fetch = async (url, options) => {
  return {
    ok: true,
    body: {
      getReader() {
        let i = 0;
        const mockChunks = ['data: {"choices":[{"delta":{"content":"Hello"}}]}', 'data: [DONE]'];
        return {
          async read() {
            if (i < mockChunks.length) {
              return { value: new TextEncoder().encode(mockChunks[i++] + '\n\n'), done: false };
            }
            return { value: undefined, done: true };
          }
        };
      }
    }
  } as Response;
};
```
Reference: `backend/src/dispatch/soloDispatch.test.ts`

**Express server spin-up for integration tests:**
```typescript
before(async () => {
  const app = express();
  app.use(express.json());
  app.use(apiRouter);
  return new Promise<void>((resolve) => {
    server = app.listen(0, () => {  // port 0 = OS assigns free port
      port = (server.address() as any).port;
      resolve();
    });
  });
});
after(() => { server.close(); });
```
Reference: `backend/src/routes/api.test.ts`

**Test helper exports (production code):**
- `resetRateLimitersForTest()` exported from `backend/src/middleware/rateLimit.ts` for test isolation
- Pattern: production modules export test-reset helpers when they hold module-level state

**What to Mock:**
- `globalThis.fetch` — all external HTTP calls (OpenRouter API, model listings)
- `globalThis.setTimeout` — when testing timeout/retry behavior
- Module-level state via exported reset helpers

**What NOT to Mock:**
- SQLite `db` connection — tests use the real in-memory database (`:memory:` resolved by `resolveDbPath`)
- `runMigrations()` — always called for real in `before()`

## Fixtures and Factories

**Test Data:**
- Inline object literals per test — no shared fixture files
- Session IDs generated with `Date.now()` suffix for uniqueness: `'test-session-' + Date.now()`
- Model capability fixtures declared as module-level `const` arrays in test files

```typescript
// RouterAgent.test.ts — module-level fixture
const dummyModels: NormalizedModelCapabilities[] = [
  {
    modelId: 'qwen/qwen-2.5-72b-instruct:free',
    contextLength: 32000,
    // ... all fields explicitly set
  },
  // ...
];
```

**Location:**
- No separate `__fixtures__` or `fixtures/` directories
- All test data is inline in the `.test.ts` file that uses it

## Coverage

**Requirements:** None enforced — no coverage thresholds, no Istanbul/c8 configuration

**View Coverage:**
- Not configured. Running `npm test` produces pass/fail output only.

## Test Types

**Unit Tests:**
- Config resolver tests: pure function tests with injected env values — no DB, no network
- Module logic tests: test exported functions/methods directly
- Examples: `backend/src/config/port.test.ts`, `backend/src/config/corsOptions.test.ts`, `backend/src/dispatch/soloDispatch.test.ts` (limitContext function)

**Integration Tests (DB-backed):**
- All tests that call `runMigrations()` in `before()` are integration tests against the real SQLite `:memory:` DB
- Verify both behavior AND side-effects (telemetry rows, policy_exception rows) in same test
- Examples: `backend/src/modules/preflightGate.test.ts`, `backend/src/modules/telemetryEngine.test.ts`, `backend/src/agents/AgentOrchestrator.test.ts`

**HTTP Integration Tests:**
- Spin up a real Express server on a random port, then hit it with `fetch`
- Example: `backend/src/routes/api.test.ts`

**E2E Tests:**
- Not present in the codebase

**Frontend Tests:**
- Single test file: `frontend/src/utils/api.test.ts`
- Uses `node:test` + `node:assert/strict` (same pattern as backend)
- Pure function tests, no DOM or component rendering

## Common Patterns

**Async Testing:**
```typescript
test('async operation succeeds', async () => {
  const generator = AgentOrchestrator.executeGoALite(plan, prompt, 'dummy-key', sessionId);
  const results: AgentResult[] = [];
  for await (const chunk of generator) {
    results.push(chunk);
  }
  assert.strictEqual(results.length, 6);
});
```

**Error/Rejection Testing:**
```typescript
test('throws a clear error for invalid PORT values', () => {
  assert.throws(
    () => resolvePort('abc'),
    /PORT must be an integer between 1 and 65535/
  );
});
```

**Callback-based error testing:**
```typescript
test('dispatchSoloChat should block on API key missing', async () => {
  let errorCalled = false;
  await dispatchSoloChat({
    // ...
    onError: (err) => {
      errorCalled = true;
      assert.ok(err.message.includes('API_KEY_MISSING'));
    }
  });
  assert.ok(errorCalled);
});
```

**DB side-effect assertion:**
```typescript
// Assert both return value AND DB record in same test
const res = PreflightGate.check(context);
assert.strictEqual(res.violation, 'API_KEY_MISSING');

const row = db.prepare('SELECT * FROM session_events WHERE session_id = ? AND event_type = ?')
  .get(sessionId, 'api_key_missing');
assert.ok(row);
```

---

*Testing analysis: 2026-06-08*
