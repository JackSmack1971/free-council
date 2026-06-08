# Frontend

This package contains the Next.js UI for FreeCouncil.

## What It Does

- Renders the chat interface and routing controls.
- Persists browser preferences locally through IndexedDB with localStorage fallback.
- Calls the backend API through `frontend/src/utils/api.ts`.
- Displays model metadata, council traces, onboarding, and upload prompts.

## Key Files

- `src/app/page.tsx` - main application screen.
- `src/app/layout.tsx` - root layout and metadata.
- `src/components/` - council trace, agent progress, and onboarding UI.
- `src/utils/api.ts` - API client and API base resolution.
- `src/utils/db.ts` - browser persistence helper.

## Scripts

- `npm run dev` - start the Next.js dev server.
- `npm run build` - build the frontend.
- `npm run start` - start the production server.
- `npm run lint` - run ESLint.

## Configuration

The frontend reads `NEXT_PUBLIC_API_URL` to find the backend API. If it is not set, development
defaults to `http://localhost:3001/api/v1` and production defaults to `/api/v1`.

## Testing

There is a colocated test file at `src/utils/api.test.ts`. The package does not currently define a
dedicated `test` script, so use `npm run build` and `npm run lint` as the standard checks.

