# Repository Guidelines

## Project Structure & Module Organization
This repository is a Node.js monorepo. `frontend/` contains the Next.js app, `backend/` contains the Express + TypeScript API, `shared/` holds cross-workspace code, `tests/` stores evaluation fixtures, and `scripts/` contains standalone utilities such as [`eval-moa-aggregation.ts`](C:\workspaces\free-council\scripts\eval-moa-aggregation.ts). Keep script-specific inputs near the owning app when they are runtime assets, for example `backend/src/agents/moa/agg_prompt.v1.txt`.

## Build, Test, and Development Commands
Run commands from the repository root unless noted.

- `npm install` installs workspace dependencies.
- `npm run dev` starts frontend and backend together.
- `npm run dev:frontend` runs Next.js locally.
- `npm run dev:backend` runs the backend with `nodemon` and `tsx`.
- `npm run build --workspace=backend` compiles backend TypeScript.
- `npm run test --workspace=backend` runs backend tests with Node’s built-in test runner.
- `npx ts-node scripts/eval-moa-aggregation.ts --api-key=...` runs the MoA evaluation script and writes JSON results under `tests/eval/moa-aggregation/`.

## Coding Style & Naming Conventions
Use TypeScript with 2-space indentation, semicolons, and ES module imports. Prefer descriptive camelCase for variables and functions, PascalCase for types/interfaces, and kebab-case for script filenames such as `eval-moa-aggregation.ts`. Keep scripts deterministic, fail fast on missing configuration, and use explicit relative paths when reading repo assets.

## Testing Guidelines
Backend tests live beside source files as `*.test.ts` and run through `node --test` via `tsx`. Evaluation fixtures live under `tests/eval/`; keep them stable and check in only reusable inputs, not ad hoc output files unless they are needed for review. Add or update tests whenever backend behavior, prompts, or evaluation criteria change.

## Commit & Pull Request Guidelines
Recent history favors Conventional Commit style, for example `fix(dispatch): address PR 138 review findings (#108)`. Keep commits scoped and reference the related issue when available. PRs should summarize the user-visible change, list verification performed, link issues with `Closes #N` or `Refs #N`, and include screenshots only for frontend UI changes.

## Agent Workflow & Security
Before working on an issue, claim it, apply `status:in-progress`, and leave milestone comments as documented in the root `AGENTS.md`. Do not commit secrets; use `.env.example` as the template and pass API keys through environment variables or CLI flags.
