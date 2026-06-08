# Repository Guidelines

## Project Structure & Module Organization
This repository is a small monorepo. `frontend/` holds the Next.js UI (`src/`, `public/`), `backend/` holds the Express + TypeScript API (`src/`, `scripts/`, colocated `*.test.ts`), `shared/` contains cross-workspace code, and `tests/eval/` stores evaluation fixtures. This `memory/` directory is for operational context only: keep durable rules in root `AGENTS.md`, put session notes in `memory/context/`, and store generated reports in `memory/reports/`.

## Build, Test, and Development Commands
Run workspace commands from the repository root unless noted.

- `npm install` installs root workspace dependencies.
- `npm run dev` starts frontend and backend together.
- `npm run dev:frontend` runs the Next.js app locally.
- `npm run dev:backend` runs the API with `nodemon` and `tsx`.
- `npm run build --workspace=frontend` builds the UI.
- `npm run build --workspace=backend` compiles backend TypeScript to `dist/`.
- `npm run test --workspace=backend` runs backend tests serially.
- `npm run lint --workspace=frontend` runs ESLint for the UI.

## Coding Style & Naming Conventions
Use TypeScript with 2-space indentation, semicolons, and ES module syntax. Prefer `camelCase` for variables/functions, `PascalCase` for React components and types, and descriptive filenames such as `upload.test.ts` or `run-router-eval.ts`. Keep tests close to the code they verify. Follow nearby patterns instead of introducing a new style.

## Testing Guidelines
Backend tests use Node's built-in test runner via `node --import tsx --test`; name files `*.test.ts`. Frontend changes should at minimum pass `npm run lint --workspace=frontend`. Add or update tests whenever route behavior, orchestration logic, parsing, or config handling changes. Keep evaluation fixtures stable and check in reusable inputs only.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits, for example `fix(dispatch): ...` and `fix(config): ...`. Keep commits scoped, imperative, and tied to one concern. PRs should summarize the change, list verification steps, and reference issues with `Closes #N` or `Refs #N`. Include screenshots only for visible UI changes.

## Agent Workflow & Security
Before working on a GitHub issue, claim it, apply `status:in-progress`, and post milestone comments. Never commit secrets; use `.env.example` as the template and pass credentials through environment variables. Do not store static repo policy in `memory/`; keep this directory lightweight and disposable.
