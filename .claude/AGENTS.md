# Repository Guidelines

## Project Structure & Module Organization
This repository is a Node/TypeScript monorepo with three workspaces: `frontend/`, `backend/`, and `shared/`. The Next.js UI lives in `frontend/src/app`, reusable React components in `frontend/src/components`, and browser utilities in `frontend/src/utils`. The Express API lives in `backend/src`, organized by `routes/`, `modules/`, `agents/`, `dispatch/`, `config/`, and `db/`. Shared cross-workspace code belongs in `shared/`. Long-form docs live in `docs/` and `docs2/`; evaluation assets live under `tests/eval/`.

## Build, Test, and Development Commands
Run commands from the repository root unless noted.

- `npm run dev`: starts frontend and backend together.
- `npm run dev:frontend`: runs the Next.js app only.
- `npm run dev:backend`: runs the API with `nodemon` and `tsx`.
- `npm run build --workspace=frontend`: builds the Next.js app.
- `npm run build --workspace=backend`: compiles backend TypeScript with `tsc`.
- `npm run lint --workspace=frontend`: runs ESLint for the frontend.
- `npm run test --workspace=backend`: runs backend `*.test.ts` files with the Node test runner.

## Coding Style & Naming Conventions
Follow the existing TypeScript style: 2-space indentation, single quotes, and semicolons. Use PascalCase for React components and classes (`AgentProgressPanel.tsx`, `ModelPoolManager.ts`), camelCase for functions and variables, and kebab-free file names except where framework conventions apply. Keep backend route handlers small and move reusable logic into `modules/` or `config/`.

## Testing Guidelines
Backend tests are colocated beside implementation as `*.test.ts`; mirror that pattern for new coverage. Prefer focused unit tests for config, database helpers, dispatch logic, and routes. Run `npm run test --workspace=backend` before opening a PR. If you add eval fixtures or manual checks, place them under `tests/eval/` and describe how to run them in the PR.

## Commit & Pull Request Guidelines
Recent history follows conventional-style subjects such as `fix(dispatch): ...` and often references an issue number, for example `(#108)`. Keep commits scoped and descriptive. PRs should include the problem, the affected paths, verification performed, and linked issues (`Closes #123` or `Refs #123`). Add screenshots for frontend changes and note any config or `.env.example` updates explicitly.

## Security & Configuration Tips
Never commit real API keys, session data, or database dumps. Use `.env.example` as the source of truth for required variables. Treat `free_council.db` as local state, not a portable fixture, and document any migration or seed expectations in the PR.
