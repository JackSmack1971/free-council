# Coding Conventions

**Analysis Date:** 2026-06-08

## Naming Patterns

**Files:**
- Source files use `camelCase` for modules and object-style singletons: `conversationStore.ts`, `modelPoolManager.ts`
- Source files use `PascalCase` for class-based modules: `RouterAgent.ts`, `AgentOrchestrator.ts`
- Test files co-located with source, named `<sourcefile>.test.ts`: `conversationStore.test.ts`
- Config files are `camelCase` descriptors: `corsOptions.ts`, `dailyQuota.ts`, `requestTimeout.ts`
- DB-layer files are `camelCase` noun phrases: `migrationRunner.ts`, `ftsSearchService.ts`, `uploadedFilesRepo.ts`

**Functions:**
- Named exports use `camelCase`: `runMigrations`, `limitContext`, `dispatchSoloChat`, `buildCorsOptions`
- Config factory functions follow `resolve*` or `get*` prefix conventions: `resolvePort`, `resolveLogLevel`, `getDailyApiQuotaLimit`, `getRequestTimeoutMs`
- Boolean-returning helpers are predicate-style: `isCorsOriginAllowed`, `hasSessionCache`

**Variables:**
- `camelCase` throughout: `sessionId`, `fetchCount`, `currentFreeModels`
- Constants use `SCREAMING_SNAKE_CASE` for module-level config values: `MODEL_SNAPSHOT_TTL_MS`, `LONG_CONTEXT_THRESHOLD`, `DEFAULT_CORS_ORIGINS`, `DEFAULT_SOLO_FALLBACK_MODEL_ID`

**Types/Interfaces:**
- `PascalCase` for all `interface` and `type` definitions: `SessionState`, `RateLimitOptions`, `DispatchOptions`, `SearchResult`
- Exported interfaces co-located with the module that owns them (not in a separate `types.ts`)

**Classes:**
- `PascalCase` static-method classes used as namespaces: `RouterAgent`, `CapabilityDetector`, `FtsSearchService`, `UploadedFilesRepo`, `TelemetryEngine`
- Singleton object-literal pattern (not class) used for stateful singletons: `ConversationStore`, `ModelPoolManager`, `SessionRegistry`, `PreflightGate`

## Code Style

**Formatting:**
- No ESLint or Prettier config detected at repo root or backend — formatting is not tooling-enforced
- Consistent 2-space indentation observed throughout
- Trailing commas used in multi-line objects and arrays
- Single quotes for string literals in TypeScript source

**TypeScript:**
- `strict: true` in `backend/tsconfig.json` — strict null checks, strict function types enforced
- `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`
- `.js` extension used in all local imports (required by NodeNext ESM): `import { db } from '../db/connection.js'`
- ESM throughout — `"type": "module"` in `backend/package.json`
- `any[]` is used for messages arrays and run settings — typed loosely where OpenRouter API shapes are dynamic
- Explicit return types omitted on most functions; TypeScript infers them

## Import Organization

**Order (observed pattern):**
1. Node built-ins: `import fs from 'fs'`, `import crypto from 'node:crypto'`
2. Third-party packages: `import express from 'express'`
3. Shared workspace: `import { AgentPlan } from 'shared'`
4. Local relative imports: `import { db } from '../db/connection.js'`

**Path Aliases:**
- No path aliases configured. All imports are relative or use the `shared` workspace package name.

**ESM note:**
- All imports require explicit `.js` extension for local files even though source files are `.ts`

## Error Handling

**Patterns:**
- `try/catch` with `console.error` for non-fatal internal errors (database writes, network calls that can be retried)
- Fatal validation errors (`throw new Error(...)`) used in config resolution: `resolvePort` throws on invalid PORT
- Callback-based error propagation in dispatch functions: `onError(err)` callback instead of thrown exceptions
- HTTP API routes return structured `{ error: string }` JSON bodies; never expose raw error messages (uses constants like `GENERIC_REQUEST_ERROR`)
- `AbortError` (`DOMException`) caught specifically to detect request timeouts in `AgentOrchestrator`
- Fallback chains: network refresh fails → SQLite snapshot cache → empty state

**Error constants pattern** (`backend/src/routes/api.ts`):
```typescript
export const GENERIC_REQUEST_ERROR = 'An internal error occurred processing your request.';
export const GENERIC_CONFIG_READ_ERROR = 'Failed to read configuration.';
export const GENERIC_CONFIG_UPDATE_ERROR = 'Failed to update configuration.';
```

## Logging

**Framework:** `console` (patched at startup by `configureConsoleLogging`)

**Implementation:** `backend/src/config/logger.ts` — replaces `console.log/warn/error` with no-ops based on `LOG_LEVEL` env var

**Patterns:**
- All log statements prefix with `[ModuleName]`: `[AgentOrchestrator]`, `[ModelPoolManager]`, `[RouterAgent]`
- `console.log` for informational progress messages
- `console.warn` for recoverable failures and degraded-mode alerts
- `console.error` for unexpected exceptions that were caught and handled
- Log level controlled via `LOG_LEVEL` env var (`debug` | `info` | `warn` | `error`), defaults to `info`

## Comments

**When to Comment:**
- Inline comments explain non-obvious algorithm steps (GoA scoring math, token estimation approximation)
- Section headers used in long functions: `// 1. Filter models`, `// 2. Generate model card summaries`
- `// TODO` / `// FIXME` used sparingly

**TSDoc/JSDoc:**
- Not used — no JSDoc block comments observed on exported functions

## Function Design

**Size:** Functions kept focused; long orchestration logic split into static methods on class namespaces

**Parameters:** Config functions accept `envValue: string | undefined = process.env.VAR_NAME` pattern to enable pure unit testing without process mutation

**Return Values:**
- Synchronous functions return typed values or `null` for missing-entity cases
- Async functions return `Promise<T>` — never `void` for async network calls
- Streaming generators use `async function*` pattern in `AgentOrchestrator`

## Module Design

**Exports:**
- Named exports only — no default exports observed
- Object-literal singletons for stateful services: `export const ConversationStore = { ... }`
- Static-method classes for pure logic namespaces: `export class RouterAgent { static ... }`
- Standalone exported functions for config resolvers: `export function resolvePort(...)`

**Barrel Files:**
- Not used — imports always reference the specific source module directly

## Environment Injection Pattern

Config functions accept `env` as a parameter defaulting to `process.env`, enabling injection in tests without global mutation:

```typescript
// backend/src/config/corsOptions.ts
export function parseCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] { ... }

// backend/src/config/port.ts
export function resolvePort(envValue: string | undefined = process.env.PORT): number { ... }
```

---

*Convention analysis: 2026-06-08*
