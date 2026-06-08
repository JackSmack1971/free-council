---
version: alpha
name: FreeCouncil
description: "Premium high-density technical AI workbench for transparent multi-agent orchestration. Features the CouncilChamber radial visualization and tiered Council Arena to make routing logic observable, building trust through contextual integrity and progressive disclosure in a local-first environment."
colors:
  accent-council: "#6366F1"
  accent-council-hover: "#4F46E5"
  status-win: "#22C55E"
  status-warn: "#F59E0B"
  status-muted: "#64748B"
  surface-base: "#0F172A"
  surface-raised: "#1E293B"
  surface-glass: "#1E293B"
  text-primary: "#F1F5F9"
  text-secondary: "#CBD5E1"
  text-muted: "#94A3B8"
  border-subtle: "#334155"
  agent-state-active: "#6366F1"
  agent-state-pruned: "#64748B"
  trace-edge-strong: "#22C55E"
  trace-edge-weak: "#64748B"
  budget-safe: "#22C55E"
  budget-warn: "#F59E0B"
  budget-danger: "#EF4444"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
  mono-data:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.3
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  grid-columns: 12
rounded:
  none: 0px
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px
components:
  badge-status:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs} {spacing.sm}"
  button-primary:
    backgroundColor: "{colors.accent-council}"
    textColor: "{colors.surface-base}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.lg}"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-council-hover}"
    textColor: "{colors.surface-base}"
  card-agent:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
---

## Overview

FreeCouncil is a **premium technical AI workbench** whose core differentiator is **observable multi-agent orchestration**. The design makes the invisible routing, scoring, pruning, and synthesis logic tangible through the CouncilChamber (radial raid/party metaphor) and three-tier Council Arena while preserving chat output as the undisputed primary artifact after synthesis.

**Strategic principles** (non-negotiable):
- Orchestration must be **observable and justifiable** within 5 seconds: user can always answer “what is happening, what will it cost, and what changed?”
- **Visualization earns its pixels**: CouncilChamber is prominent only while live; it transforms into a compact Council Result Strip post-synthesis and provides non-graph equivalents for every insight.
- **Contextual trust**: cost, privacy (ZDR), capability gates, and trace logic appear exactly where relevant, never as global chrome.
- **Local-first & mode-aware**: every screen shows current mode, risk level, and next safe action. All telemetry lives in localStorage.
- **Implementation contract**: this spec is the single source for tokens, components, variants, states, ARIA, keyboard, data schemas, responsive rules, empty/error states, and testable acceptance criteria.

The system uses a strict semantic token layer (Tailwind 4) so the entire monorepo and future AI codegen agents (Claude Code, Antigravity, Stitch) produce consistent, lintable output.

## Colors

Palette remains a dark high-contrast technical console. New semantic tokens added for agent states, trace edges, and budget severity.

- **Accent Council (#6366F1)** and Hover (#4F46E5): Core branding, active glow rings, voting pulses, winning paths, primary CTAs in orchestration flows.
- **Status Win (#22C55E)**: Winner Chair, synthesis complete, success states.
- **Status Warn (#F59E0B)**: High-effort escalation, quota warnings, fallbacks.
- **Status Muted (#64748B)** + **Agent State Pruned**: Desaturated, 0.4 opacity for pruned/inactive nodes.
- **Surface Base (#0F172A)**, **Raised (#1E293B)**, **Glass (#1E293B)**: Background hierarchy; glass used with opacity/backdrop-blur.
- **Text Primary/Secondary/Muted** and **Border Subtle**: Standard hierarchy.
- **Agent State Active (#6366F1)**: Live generating/voting nodes.
- **Trace Edge Strong (#22C55E)** / **Weak (#64748B)**: Edge matrix connector weight visualization.
- **Budget Safe (#22C55E)** / **Warn (#F59E0B)** / **Danger (#EF4444)**: Run Budget Meter and preflight forecast severity.

All legacy neutral-* classes must be replaced by these tokens.

## Typography

Unchanged from previous version (Inter + mono-data). Added rule: mono-data must be used for all quantitative telemetry (S-scores, call counts, latency, edge weights). Body text never uses mono.

## Layout

**Progressive disclosure aesthetic calm** with chat output dominant. All controls consolidated into **Run Profile Pill** → **Inspector Drawer**.

**Density modes** (token-driven):
- Comfortable (default): generous spacing, full labels.
- Compact: reduced padding, abbreviated labels, higher information density.
- Command-center: minimal chrome, maximized CouncilChamber/Arena real estate (expert toggle only).

**Responsive & visibility contract** (breakpoints):
- < 768px (mobile): CouncilChamber radial forbidden — list/table view is default and only. All drawers become full-screen sheets. Run Profile Pill shows only mode + budget status.
- 768–1024px (tablet): Radial allowed but collapses to list on orientation change or reduced-motion. Inspector Drawer becomes bottom sheet.
- > 1024px (desktop+): Full radial CouncilChamber + right Inspector Drawer permitted.
- Wide (> 1440px): Extra quiet rail for live trace/edge data optional.

**CouncilChamber & visualization prominence rules** (“visualization earns its pixels”):
- Large radial view + glowing nodes + SVG edge matrix **only while orchestration is live** (dispatch → synthesizing).
- On completion (or user scrolls past, viewport < 1024px, reduced-motion enabled, or explicit “Focus Answer” action): auto-transforms into compact **Council Result Strip** showing: Winner model + role badge, pruned count, actual cost/latency, and “Inspect” action that opens Tier 2/3 without expanding the strip.
- The strip remains visible but low-prominence (opacity-60, smaller height) so the synthesized answer is visually primary.
- Every graph insight (S-score influence, pruning reason, winning path) must have an immediate list/table equivalent. No insight is graph-only.

**Expert override (desktop only)**: “Pin Chamber for this session” toggle appears in Inspector Drawer for power users. Never available on mobile, reduced-motion, or when viewport < 1024px. Pinned state persists only for current browser session.

**Mode awareness**: Every major surface (composer, CouncilChamber, response area, drawer) displays current routingMode, reasoningEffort, and a one-line “Next safe action” or risk summary (e.g., “Council mode · 4 calls expected · 7 free remaining”).

**Task-first launchpad** remains the blank-state entry; cards pre-select optimal profiles.

## Elevation & Depth

Depth via tonal shifts + subtle borders only. No heavy shadows.

**Motion & transition rules** (prose, not YAML):
- CouncilChamber → Result Strip transition: 200ms ease-out opacity + height collapse. Respects `prefers-reduced-motion`.
- Glow rings / voting pulses: 1.2s ease-in-out infinite (generating), single 300ms pulse (voting contribution). Auto-pause when reduced-motion or after completion.
- LiveCard pruning exit: 150ms fade to muted + scale 0.95.
- Focus rings: standard 2px accent-council outline, 150ms.
- Drawer open: 180ms slide + fade.

Z-index hierarchy unchanged (modals > drawer > floating bars > CouncilChamber layers > response).

## Shapes

Unchanged. Added: Council Result Strip uses pill (full) outer shape for compact status; internal winner node retains md radius or Chair treatment at small scale.

## Components

All components now include explicit **anatomy, props, states, variants, responsive behavior, ARIA, keyboard, and “must not render” rules**. Variant matrices below are the implementation contract.

**Live Card / Agent Node (Tier 1)**
Anatomy: Role badge (CapabilityChip) + model name + mono S-score overlay + status indicator + contribution meter (optional) + prune/fallback reason (on exit).
Props: agentId, model, role, state, sScore, contributionSummary, isWinner, isMVP.
States:
- Generating: accent-council glow ring (pulse), “Thinking…” or “Voting…”, live S-score updating.
- Voting: single pulse on S-score contribution to peer.
- Done: solid raised, role icon active.
- Pruned: opacity-40, desaturated, reason text appears (e.g. “Low S-score – efficiency prune”).
- Failed: warn border pulse + error icon.
- Retrying: warn pulse + “Retrying…” label.
- Degraded: muted + “Degraded fallback” badge.
- Selected / Winner: win border + Chair elevation + synthesis badge.
Variants: Compact (Result Strip), Full (radial), List (fallback).
Responsive: Full details > 1024px; abbreviated (score + status only) on tablet; minimal on mobile.
ARIA: role="group" aria-label="Agent {model} {role} state {state} S-score {sScore}".
Keyboard: Tab order follows radial or list sequence; Enter/Space on node opens that agent’s Tier 2 rationale in drawer.
Must not render: If model lacks capability required by current dispatch (e.g. vision model for text-only run) — show disabled placeholder with tooltip.

**CouncilChamber (radial container)**
Anatomy: SVG viewport with positioned nodes + dynamic weighted connectors (stroke-width & color map to trace-edge-strong/weak) + central “table” anchor for winner.
Props: agents[], edgeMatrix[], winnerId, isLive, density.
States: Live (full interactive), Collapsed (Result Strip), ListFallback, Pinned (expert override).
Accessibility: Always expose list equivalent toggle; aria-live polite for state changes (new vote, prune, winner declared).
Keyboard: Arrow keys rotate focus around radial nodes when in desktop radial mode; Esc collapses to strip (unless pinned).
Auto-collapse triggers (implementation priority): run complete + 800ms, user scroll past response, viewport < 1024px, reduced-motion, explicit focus-answer action. Expert pin overrides collapse except on reduced-motion or mobile.

**Council Result Strip (post-synthesis compact form)**
Anatomy: Winner model + role badge + pruned count + actual cost/latency + Inspect button.
Always visible but low visual weight after synthesis. Clicking Inspect opens Winner Rationale (Tier 2) or full graph (Tier 3) in drawer without re-expanding the chamber.

**Winner Rationale (Tier 2 callout)**
Anatomy: DisclosureCard with structured narrative blocks: Quality Benchmark (S-score), Efficiency Pruning reason, Expert Weighting (dominant agent logic), Logic Summary.
Microcopy variants:
- Short (default): “Selected for highest S-score (0.87) after pruning 2 lower-quality agents.”
- Medium: Adds one-sentence “because…” explainer per decision.
- Advanced: Full trace IDs + raw scores (opt-in only).
Must include inline “Why this model?” / “Why pruned?” links that expand the relevant Tier 3 section.
Anti-theater rule: When comparative signal is weak, show confidence label (“Limited comparative signal — selected by capability match”). Never display more than one decimal place on S-scores or edge weights unless the backend scoring logic supports that precision.

**Run Profile Pill + Inspector Drawer**
Pill: Compact mode + budget status + click-to-expand.
Drawer: Full controls (ToggleRow for effort/schema, capability gates, full trace, expert pin toggle). Keyboard: focus trap inside drawer; Esc closes.

**Run Budget Meter / Preflight Contract**
Fuel-gauge progress bar + dynamic text labels per deriveCallForecast logic.
States: Safe (green), Warn (amber + message if <10 remaining), Danger (red + hard stop if 0).
Empty state: “No free calls remaining today — switch to paid key or Solo Fast.”

**Primitives (expanded)**
- Badge-Status, CapabilityChip, Meter, DisclosureCard, ToggleRow, PanelHeader: same as before + explicit ARIA and keyboard rules above.
- New: Alert (severity tiers: info / warn / danger with icon + microcopy; never all feel equally urgent).

**Empty & Error States (global contract)**
- No agents / blank chat: Task launchpad cards (never empty composer).
- Trace unavailable / low confidence: “Insufficient signal — selected by capability match only.” (copy fallback).
- Quota exhausted mid-run: Graceful degrade to last successful agent + clear “partial synthesis – budget limit reached” banner.
- Model capability mismatch: Disabled control + inline tooltip explaining why.

## Do's and Don'ts

Updated with new contracts:
**Do:**
- Implement the full Run Lifecycle visibility (see Data Contracts section) so user can always answer the three questions in <5s.
- Transform CouncilChamber → Council Result Strip on the defined collapse triggers; never leave large visualization competing with the answer. Respect expert pin only on desktop + motion-allowed viewports.
- Provide list/table equivalent for every graph insight.
- Use severity-tiered alerts and contextual microcopy (short/medium/advanced variants).
- Enforce capability gates and “must not render” rules before any dispatch.
- Store every schema field in localStorage; expose via typed hooks. Follow data lifecycle rules below.
- Apply anti-theater rules: confidence labels on weak signal; no over-precise decimals without backend justification.

**Don't:**
- Show raw unexplained telemetry labels in default user views.
- Allow CouncilChamber radial or full graph to remain large after synthesis or on small/reduced-motion viewports (unless expert pin is active and allowed).
- Bypass the visualization-earns-its-pixels rule or make any insight graph-only.
- Introduce new colors/states outside the defined token set.
- Omit ARIA, keyboard, or responsive rules from any component implementation.
- Allow fake precision in S-scores or edge weights.

## Data Contracts & Telemetry Schemas

These TypeScript interfaces are the **frontend/backend contract**. Every field maps to a component or state above. All data remains local-only.

```ts
export interface Run {
  id: string;
  routingMode: 'solo' | 'council' | 'moa';
  reasoningEffort: 'fast' | 'standard' | 'deep';
  dispatchMode: 'parallel' | 'sequential';
  attachments: boolean;
  structuredOutputEnabled: boolean;
  freeLock: boolean;
  status: 'idle' | 'preflight' | 'dispatch' | 'thinking' | 'voting' | 'synthesizing' | 'complete' | 'inspect' | 'failed' | 'canceled' | 'retrying' | 'partial' | 'degraded' | 'exhausted';
  budgetForecast: BudgetForecast;
  agents: Agent[];
  traceEdges: TraceEdge[];
  winnerId?: string;
  actualCallCount: number;
  latencyMs: number;
  createdAt: string;
  errorCode?: string;
  recoveryAction?: 'retry' | 'fallback' | 'solo' | 'abort';
}

export interface Agent {
  id: string;
  model: string;
  role: 'Reasoning' | 'Creative' | 'Critic' | 'Synthesizer' | 'Researcher';
  state: 'generating' | 'voting' | 'done' | 'pruned' | 'failed' | 'retrying' | 'degraded' | 'selected';
  sScore?: number;
  contributionSummary?: string;
  pruneReason?: string;
  isMVP?: boolean;
  metadata: {
    provider: string;
    contextWindow: number;
    supportsVision: boolean;
    supportsStructured: boolean;
    zdr: boolean;
  };
}

export interface TraceEdge {
  fromAgentId: string;
  toAgentId: string;
  weight: number;           // S-score influence
  type: 'vote' | 'critique' | 'synthesis';
}

export interface BudgetForecast {
  expectedCalls: number;
  maxCalls: number;
  remainingFree: number;
  status: 'safe' | 'warn' | 'danger';
}

export interface CapabilityGate {
  feature: 'upload' | 'structuredOutput' | 'vision';
  allowed: boolean;
  reason?: string;
}

export interface PrivacyNotice {
  modelId: string;
  zdr: boolean;
  sessionOnlyKey: boolean;
  dataFlowSummary: string;
}
```

Mapping examples:
- Run.status → CouncilChamber / Result Strip state + mode awareness line + global banners.
- Agent.state → LiveCard visual treatment + prune/fallback reason display.
- TraceEdge.weight → SVG connector stroke + Tier 3 graph (with anti-theater confidence label when low signal).
- BudgetForecast → Run Budget Meter + preflight labels.
- CapabilityGate → conditional rendering / disabled controls in composer & drawer.

## Accessibility & Responsive Contract

**Breakpoints & behavior** (see Layout).
**Reduced motion**: All pulses, glows, and the Chamber→Strip transition respect `prefers-reduced-motion: reduce` by disabling animation or using instant state change + static indicator.
**High contrast**: Additional high-contrast token overrides (or forced-colors media query) increase border and text contrast; status colors remain hue but gain stronger borders.
**Keyboard-only traversal order** (logical focus order):
1. Run Profile Pill
2. Composer input + attach + send
3. CouncilChamber / Result Strip nodes (or list items)
4. Winner Rationale (if present)
5. Response area actions
6. Inspector Drawer trigger (if open)

All interactive elements have visible focus rings (accent-council) and aria-labels. No icon-only controls without labels.

**Screen reader**:
- Live regions on CouncilChamber for “Agent X voted”, “Agent Y pruned because…”, “Winner declared: Z”, state changes on error/recovery.
- Winner Rationale uses aria-labelledby and structured headings.

## Run Lifecycle & Microcopy Patterns

Explicit stages with required UI state, animation, copy, telemetry, and user action. Extended with terminal and recovery states.

1. **Idle** — Launchpad visible. No telemetry.
2. **Preflight** — Composer shows dynamic forecast + Budget Meter. User can still edit profile.
3. **Dispatch** — Pill updates to “Council · 4 calls expected”. Chamber nodes appear in generating state.
4. **Thinking / Voting** — LiveCards pulse, S-scores update live, voting pulses fire. aria-live announcements.
5. **Synthesizing** — Winner Chair treatment begins, edge matrix highlights winning path.
6. **Complete** — Auto-collapse to Result Strip (800ms). Full answer appears. Tier 2 Rationale auto-opens or is one click away.
7. **Inspect** — Drawer or expanded Tier 3 available. All raw telemetry visible to expert users.
8. **Retrying** — Chamber shows retrying state on affected agents; global warn banner with “Retrying (attempt X of Y)”.
9. **Partial / Degraded** — Result Strip shows winner + “Partial synthesis – some agents degraded”. Clear recovery banner with “Retry full council” or “Accept current result”.
10. **Failed / Canceled** — Clear error banner with recovery actions (Retry, Switch to Solo, Abort). Persist partial trace if available for debugging.
11. **Exhausted** — Budget meter at 0 + hard stop. Offer “Switch to paid key” or “Solo Fast” path.

**Microcopy rules**:
- Default (Tier 1/2): Short, outcome-focused, no raw IDs.
- “Because…” explainer appears on hover or “Why?” click.
- Low-confidence fallback copy: “Selected by capability match — limited comparative signal.”
- Budget warnings use severity tiers and never block unless truly exhausted.
- Recovery banners always offer the next safe action.

**Acceptance criteria** (testable):
- User can always state current mode, expected/actual cost, and why the winner was chosen within 5 seconds of any state change.
- CouncilChamber never remains large after synthesis on any viewport or motion preference (unless expert pin is active and allowed).
- Every graph insight has a list equivalent.
- Capability gates prevent impossible dispatches.
- All telemetry is local-only and matches the schemas above.
- Every terminal state (failed/canceled/partial/exhausted) has a visible recovery path.

## LocalStorage Data Lifecycle & Privacy Governance

All Run, Agent, Trace, and Budget data lives exclusively in localStorage. No cloud sync.

**Retention defaults**:
- Completed runs: keep last 50 (or 30 days, whichever is smaller).
- Partial / failed runs: keep 7 days for debugging, then auto-purge.
- User can manually “Clear all history”, “Export runs (JSON)”, or “Privacy reset” (clears everything + regenerates local keys).

**Schema migration**:
- Runs are versioned (`schemaVersion` field). On app load, run a migration function that upgrades old traces to current interface shape. Never lose user data on schema change.

**Replayable traces**:
- Every persisted Run includes enough data to re-render the exact CouncilChamber / Result Strip / Rationale state for debugging and visual regression tests.

**Privacy reset** also clears any cached model metadata or capability flags.

## Implementation Governance

To prevent drift between this spec, code, stories, and tests:

**Required Storybook fixtures / states** (every component must have stories for):
- LiveCard: generating, voting, done, pruned, failed, retrying, degraded, selected, compact-result-strip.
- CouncilChamber: live-radial, collapsed-strip, list-fallback, pinned (desktop), reduced-motion.
- WinnerRationale: short, medium, advanced, low-confidence.
- RunProfilePill + Drawer: idle, preflight, council-active, budget-warn, budget-danger, expert-pin-visible.
- BudgetMeter: safe, warn, danger, exhausted.
- Global: empty-launchpad, quota-exhausted, partial-synthesis, failed-dispatch, retrying.

**Visual regression coverage**:
- All density modes (comfortable/compact/command-center) at desktop + tablet breakpoints.
- CouncilChamber radial vs list at 768px / 1024px / 1440px.
- Light-on-dark contrast for all status colors and text on surfaces.
- Reduced-motion snapshot (static indicators only).

**Token enforcement lint rules** (run in CI / IDE):
- Ban `neutral-*`, `zinc-*`, `slate-*` (except via surface-* tokens), arbitrary hex colors, and non-token box-shadow on any orchestration surface (composer, CouncilChamber, Arena, Rationale, drawers).
- Allowed token map reference: only colors.*, typography.*, spacing.*, rounded.*, and the new agent-state-*, trace-edge-*, budget-* tokens.
- Components must import from the design token file; direct Tailwind color classes trigger lint error with auto-fix suggestion.

**Anti-theater enforcement**:
- S-score and edge weight display: max 2 decimal places by default; backend must supply `precision` flag for higher.
- Weak-signal states must surface confidence label; no UI may imply higher certainty than the data supports.

This hardened DESIGN.md is now the executable contract for implementation, automated testing, linting, and future AI-driven frontend generation. It preserves the premium technical workbench personality and Council metaphor while making the system safe, accessible, and strategically differentiated through observable value without cognitive or visual noise.

## MVP Implementation Priorities (ranked)

1. Semantic token layer + basic state mapping (LiveCard variants, preflight meter, capability gates) + token lint rules.
2. Run Profile Pill + Inspector Drawer + contextual trust layer (ZDR, budget, privacy notices) + localStorage persistence + schema migration.
3. Council Result Strip + auto-collapse logic + list fallback + expert pin override (protects answer primacy).
4. Full Live Arena (Tier 1) with S-score updates, pruning, retrying/degraded states and recovery banners.
5. Winner Rationale (Tier 2) with short/medium/advanced microcopy + anti-theater confidence labels.
6. Data schema contracts (extended Run/Agent states) + replayable traces + Storybook fixtures for all states.
7. Radial CouncilChamber (desktop only) + SVG edge matrix + Tier 3 graph (opt-in) + visual regression.
8. Accessibility (ARIA, keyboard, reduced-motion, high-contrast) + responsive matrices + lint enforcement.
9. Empty/error states + alert severity system + user journey stress paths (failed, quota exhausted, partial).
10. Telemetry observability hooks, “visualization earns its pixels” enforcement tests, and onboarding teaching overlay for first council run.

Priorities 1–3 deliver the core differentiator and trust layer with minimal risk of distraction or implementation ambiguity. Priorities 4–7 add the signature visualization depth and testability. 8–10 harden quality, edge cases, and first-time user experience. 

This ordering lets engineering ship observable orchestration value quickly while the design system remains the single source of truth and prevents future drift.