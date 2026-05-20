---
namespace: context
created: 2026-05-20T13:00:00Z
updated: 2026-05-20T13:00:00Z
status: active
tags: mission, session, issues, freecouncil
---

# Mission Brief

Complete all 9 open GitHub issues for the FreeCouncil project (issues #46-#54).

## Active Issues
- #46 - Extend POST /dispatch for Council Mode routing pipeline (backend)
- #47 - Routing mode and system mode selector UI (frontend)
- #48 - Extend TelemetryEngine for Phase 2/3 event types (backend)
- #49 - reverted_to_solo abort action and telemetry (backend+frontend)
- #50 - ZDR mode toggle in Run Settings UI (frontend)
- #51 - POST /upload multipart HTTP endpoint (backend)
- #52 - 429 rate limit exponential backoff (backend)
- #53 - First-run onboarding flow (frontend)
- #54 - Frontend Council Mode SSE stream handler (frontend)

## Key Files
- backend/src/modules/telemetryEngine.ts
- backend/src/dispatch/soloDispatch.ts
- backend/src/dispatch/councilDispatch.ts
- backend/src/routes/api.ts
- backend/src/index.ts
- frontend/src/app/page.tsx
- frontend/src/utils/api.ts
- shared/index.ts
