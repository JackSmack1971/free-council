# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the backend application code. Key areas are `src/routes/` for Express handlers, `src/modules/` for core services, `src/agents/` for orchestration logic and prompts, `src/config/` for environment-driven settings, and `src/db/` for SQLite access and SQL migrations. Entry point: `src/index.ts`. Utility scripts live in `scripts/`. Tests are mostly colocated as `*.test.ts` beside the code they cover, with shared fixtures in `tests/fixtures/`.

## Build, Test, and Development Commands
Run commands from `backend/`.

- `npm install` installs project dependencies.
- `npm run dev` starts the server with `nodemon` and `tsx` for local development.
- `npm run build` compiles TypeScript to `dist/`.
- `npm start` runs the compiled server from `dist/index.js`.
- `npm test` runs the Node test suite serially against `src/**/*.test.ts`.
- `npm run eval-router` executes the router evaluation script in `scripts/run-router-eval.ts`.

## Coding Style & Naming Conventions
Use TypeScript with ES modules, strict typing, and 2-space indentation. Prefer named exports for shared modules. Keep filenames descriptive and consistent with the main symbol, using `camelCase.ts` for modules like `modelPoolManager.ts` and `*.test.ts` for tests. Import local files with explicit `.js` extensions in source, matching the current NodeNext setup. There is no dedicated lint script here, so keep formatting consistent with nearby files and rely on `tsc` for static checks.

## Testing Guidelines
Tests use the built-in `node:test` runner with `assert`. Add or update colocated `*.test.ts` files whenever behavior changes, especially for routes, config parsing, database helpers, and agent orchestration. Prefer deterministic tests with mocked `fetch` and isolated database state. Run `npm test` before opening a PR; run `npm run eval-router` when changing router selection behavior.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit style such as `fix(dispatch): ...` and `fix(config): ...`. Keep commits scoped and imperative. PRs should explain the user-visible or architectural change, link the relevant issue (`Closes #123` or `Refs #123`), and include verification steps. For API or routing changes, include sample requests or response notes; for prompt or evaluation changes, mention the affected fixtures or scripts.

## Security & Configuration Tips
Keep secrets in environment variables via `.env`; never commit credentials. Validate configuration changes in `src/config/` with tests. Treat SQL migrations in `src/db/migrations/` as append-only and review route changes for auth, quota, and input-validation regressions.
