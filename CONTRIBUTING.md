# Contributing

## Scope

This repository is a monorepo with `frontend`, `backend`, and `shared` workspaces. Keep changes
focused and update the relevant tests and docs together when behavior changes.

## Before You Change Code

- Read the relevant package README and source entrypoint.
- Prefer the existing module boundaries instead of creating new ones.
- Update `shared/index.ts` first if a data contract changes across packages.

## Development Workflow

1. Install dependencies with `npm install` from the repository root.
2. Run the affected workspace in development mode.
3. Add or update colocated tests for the behavior you changed.
4. Run the relevant build or test commands before opening a PR.

## Testing Expectations

- Backend changes should usually be covered by `cd backend && npm test`.
- Frontend changes should be checked with `cd frontend && npm run build` and
  `cd frontend && npm run lint`.
- If a change affects shared types, verify both packages still compile.

## Commit and PR Guidance

- Use short, scoped commits.
- Prefer conventional commit subjects where practical.
- Describe the user-visible change and the verification you ran.
- Link the related issue when one exists.

## Security

- Do not commit secrets, API keys, or tokens.
- Review auth, upload, config, and dispatch changes carefully.
- If a change touches persisted data or runtime configuration, verify the physical state rather than
  assuming the intended state.

