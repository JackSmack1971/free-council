# FreeCouncil

**A local-first AI workbench for visible, controllable multi-agent chat orchestration.**

FreeCouncil runs a Next.js frontend and Express backend on your machine, routes prompts through OpenRouter models, and visualizes how specialized agents propose, score, influence, and synthesize answers through an interactive radial graph called **CouncilChamber**.

Instead of receiving a black-box AI response, you can watch the council form, reason, compete, and converge.

## Why FreeCouncil Exists

Most AI chat tools hide the orchestration layer.

FreeCouncil makes that layer visible.

You can use it to:

* Run solo or multi-agent chat sessions locally.
* Compare how different agents contribute to an answer.
* Inspect scoring, synthesis quality, winner rationale, and influence weights.
* Experiment with OpenRouter models, including free-tier models.
* Build or extend agent dispatch, gating, telemetry, and visualization logic.

## Demo Flow

After setup, open:

```text
http://localhost:3000
```

Then:

1. Click **API Key** and enter a valid OpenRouter API key.
2. Switch from **Solo** mode to **Council** mode.
3. Choose a reasoning effort level such as **Balanced** or **Deep**.
4. Send a prompt that benefits from multiple perspectives.

Example prompt:

```text
Compare the trade-offs of using TypeScript vs Rust for a high-performance local AI agent framework. Include performance, developer experience, and ecosystem factors.
```

You should see:

* Agent nodes appear in the **CouncilChamber** radial graph.
* Live states progress through `generating`, `evaluating`, and `completed`.
* Edges show influence weights between agents.
* The final response includes a result strip, winner rationale, S-scores, synthesis quality, and the synthesized answer.

## Quickstart

### Prerequisites

* Node.js 18 or newer
* npm
* Git
* An OpenRouter account and API key

### Install and Run

```bash
git clone https://github.com/JackSmack1971/free-council.git
cd free-council

npm install
cp .env.example .env

npm run dev
```

The app starts:

| Service     | URL                     |
| ----------- | ----------------------- |
| Frontend    | `http://localhost:3000` |
| Backend API | `http://localhost:3001` |

Open the frontend URL, follow the onboarding flow, enter your OpenRouter API key, and send your first council-mode prompt.

## Project Structure

| Workspace  | Purpose                                                                            | Best Entry Point            |
| ---------- | ---------------------------------------------------------------------------------- | --------------------------- |
| `frontend` | Next.js UI, chat experience, settings, quota display, CouncilChamber visualization | `frontend/src/app/page.tsx` |
| `backend`  | Express API, session handling, gates, OpenRouter dispatch, telemetry               | `backend/src/index.ts`      |
| `shared`   | Shared TypeScript contracts between frontend and backend                           | `shared/index.ts`           |

## How It Works

FreeCouncil has three main layers:

### Frontend

The frontend provides the chat interface, onboarding, API key entry, local settings, telemetry display, and the **CouncilChamber** visualization.

Key responsibilities:

* Chat UI
* Solo/council mode selection
* Reasoning effort controls
* Agent graph rendering
* Local telemetry display
* Upload and privacy disclosures

### Backend

The backend handles orchestration and safety checks before dispatching requests to OpenRouter.

Key responsibilities:

* Session management
* API routes
* Preflight gates
* OpenRouter dispatch
* GoA and MoA execution paths
* SQLite telemetry persistence

### Shared Contracts

The `shared` package defines the TypeScript interfaces used by both frontend and backend.

Important contracts include:

* `AgentPlan`
* `PreflightContext`
* `GateResult`
* `SessionEvent`
* Model capability flags
* Dispatch and telemetry types

Change shared contracts carefully because they affect both runtime behavior and UI rendering.

## Execution Modes

FreeCouncil currently supports:

| Mode    | Description                                                                             |
| ------- | --------------------------------------------------------------------------------------- |
| Solo    | Sends the prompt through a single selected model path.                                  |
| Council | Runs a multi-agent orchestration flow with proposal, scoring, influence, and synthesis. |

Council mode is the main differentiator. It exposes intermediate orchestration signals that are usually hidden in AI systems.

## Local Data and Privacy

FreeCouncil is local-first by design.

| Data              | Storage                                    |
| ----------------- | ------------------------------------------ |
| API key           | Browser session only by default            |
| Frontend state    | Browser `localStorage`                     |
| Backend telemetry | Local SQLite database: `free_council.db`   |
| Prompt dispatch   | Sent from your local backend to OpenRouter |

Your OpenRouter key is sent only to the backend instance you are running locally. No project telemetry leaves your machine unless you explicitly export or transmit it.

## Common Commands

Run these from the repository root unless noted otherwise.

| Command                        | Purpose                             |
| ------------------------------ | ----------------------------------- |
| `npm install`                  | Install all workspace dependencies  |
| `npm run dev`                  | Start frontend and backend together |
| `cd frontend && npm run dev`   | Start only the frontend             |
| `cd backend && npm run dev`    | Start only the backend              |
| `cd frontend && npm run build` | Build the frontend                  |
| `cd frontend && npm run lint`  | Run frontend linting                |
| `cd backend && npm test`       | Run backend tests                   |

## Development Workflow

When changing shared contracts:

1. Update `shared/index.ts` first.
2. Update frontend and backend consumers.
3. Add or update colocated tests.
4. Confirm both workspaces still compile.
5. Run the relevant test and build commands before opening a PR.

For contribution rules, review:

```text
CONTRIBUTING.md
```

## Current Status

FreeCouncil is in active early development.

| Area             | Status                    |
| ---------------- | ------------------------- |
| Frontend         | Active development        |
| Backend          | Active development        |
| Shared contracts | Stable but still evolving |
| CI               | Not configured yet        |
| Releases         | No published releases yet |
| License          | MIT                       |

Expect breaking changes while the orchestration model, visualization layer, and shared contracts continue to evolve.

## Testing

Backend dispatch paths currently have automated coverage, including council and solo flows.

Run:

```bash
cd backend
npm test
```

Frontend checks:

```bash
cd frontend
npm run build
npm run lint
```

## Contributing

Contributions are welcome, especially improvements to:

* CouncilChamber visualization
* Mobile responsiveness
* Agent scoring displays
* Preflight gates
* Model capability detection
* OpenRouter model support
* Telemetry clarity
* Test coverage
* Documentation

Good first issues include:

* Improve mobile collapse behavior for the radial graph.
* Add more S-score display options.
* Add a new preflight gate.
* Improve onboarding copy.
* Add screenshots or an animated demo GIF.
* Expand backend dispatch test coverage.

Larger changes, such as new execution modes or shared contract redesigns, should start with a GitHub issue so the architecture stays clean.

## Useful References

| File                        | Purpose                                                                         |
| --------------------------- | ------------------------------------------------------------------------------- |
| `DESIGN.md`                 | Architecture, data lifecycle, visualization rules, and anti-theater principles  |
| `CONTRIBUTING.md`           | Contributor checklist, module boundaries, commit style, and review expectations |
| `AGENTS.md`                 | Guidance for AI-assisted development                                            |
| `CLAUDE.md`                 | Claude-specific development guidance                                            |
| `frontend/src/app/page.tsx` | Main UI orchestration                                                           |
| `backend/src/routes/api.ts` | REST endpoints and preflight enforcement                                        |
| `backend/src/dispatch/`     | GoA and MoA execution logic                                                     |
| `shared/index.ts`           | Shared contract layer                                                           |

## License

FreeCouncil is released under the MIT License.

See:

```text
LICENSE
```

---

**FreeCouncil is for people who want to understand AI orchestration, not just consume its output.**

Clone it, run it locally, open council mode, and watch the agents work.
