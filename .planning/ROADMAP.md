# Roadmap: PostmanClone

## Overview

PostmanClone is a desktop API client built for Java Spring developers. Milestone v2.1 shipped the full 3-process architecture, CORE Postman parity, Spring project detection, DTO/DB body generation, and workflow chains with response mapping. Milestone v3 is a UI redesign grounded in 9 validated design sketches (dated 2026-06-05) that established a developer-tool-dense visual direction: dark theme, method-color accents, vertical tab strips, attached URL bar, table grid variable editor, tree sidebar, IntelliJ-style DB tool window, horizontal chain step sequence, and bottom data panel for response mapping.

## Milestones

- ✅ **v2.1 Core + Spring + Chains** - Phases 1-4 (shipped 2026-06-06)
- 🚧 **v3.0 UI Redesign** - Phases 5-9 (in progress)

## Phases

<details>
<summary>✅ v2.1 Core + Spring + Chains (Phases 1-4) - SHIPPED 2026-06-06</summary>

### Phase 1: Foundation & Postman Parity
**Goal**: Establish the 3-process desktop architecture (Electron renderer + Node main + Java 21 helper) and ship a fully usable Postman alternative covering all CORE requirements.
**Plans**: 3 plans

Plans:
- [x] 01-01: Scaffold 3-process architecture (Electron 42 + Vite 8 + React 19 + TS, preload contextBridge, JSON-RPC 2.0 stdio wire, JVM helper supervisor with restart policy)
- [x] 01-02: HTTP client + request/response editor (CORE-01, CORE-05, CORE-06, CORE-08, CORE-02) — main-process undici 7 client, Monaco body editor, response viewer
- [x] 01-03: Collections, variables, auth, history, import/export (CORE-03, CORE-04, CORE-07, CORE-09, CORE-10) — Postman v2.1 storage layout, 4-scope resolver, electron-store + safeStorage

### Phase 2: Spring Project Detection
**Goal**: User can point the app at a local Spring project and see every `@RestController` endpoint in a sidebar — clicking one builds a prefilled request with the DTO body shape already filled in.
**Plans**: 3 plans

Plans:
- [x] 02-01: JVM helper scanner module + IPC pipeline (SPRING-01, SPRING-02, SPRING-03)
- [x] 02-02: Sidebar EndpointsTree + Scan Progress UI (SPRING-04)
- [x] 02-03: Click-to-prefill + DtoClassPanel + Rescan (SPRING-05)

### Phase 3: Body Generation (DTO + DB)
**Goal**: User can generate valid-shape request bodies either from a DTO schema or from real database rows.
**Plans**: 3 plans

Plans:
- [x] 03-01: DTO schema body generation + cycle detection (BODY-01..03)
- [x] 03-02: DB connection management (DB-01, DB-02, DB-07)
- [x] 03-03: Table→row selection + column→field mapping UI (DB-03..06)

### Phase 4: Workflow Chains & Response Mapping
**Goal**: User can build ordered multi-step chains where later steps reference earlier responses.
**Plans**: 3 plans

Plans:
- [x] 04-01: Chain data model + orchestrator + IPC (CHAIN-01, CHAIN-03, CHAIN-04, CHAIN-05)
- [x] 04-02: Chain editor UI + sidebar integration (CHAIN-01..04)
- [x] 04-03: Data panel + preview resolved body (MAP-01..04)

</details>

### 🚧 v3.0 UI Redesign (In Progress)

**Milestone Goal:** Apply the 9 validated sketch winners across all renderer UI surfaces. Tighten density, apply the dark theme with method-color accents, switch to vertical tab strips for section navigation, and ship the IntelliJ-style DB tool window. Preserve all IPC contracts, main process logic, and storage layout — only the renderer UI changes.

**Design system source:** `.opencode/skills/sketch-findings-postman-clone/references/` and `.planning/sketches/themes/default.css`

**Constraint:** Renderer-only changes (`src/renderer/`). No main process, IPC, JVM helper, or storage changes. Reuse existing Zustand stores and TanStack Query hooks.

#### Phase 5: Design System & Theme Foundation
**Goal**: Establish the new visual foundation — design tokens, theme CSS, and shared component primitives (buttons, badges, method-color mappings). All other phases depend on this.
**Depends on**: Phase 4
**Requirements**: REDESIGN-01
**Status**: Complete (2026-06-06)
**Success Criteria** (what must be TRUE):
  1. ✓ The renderer loads the new design tokens from `theme-dark.css` matching `default.css` (colors, spacing, typography, radii) and the existing light theme still functions. Legacy oklch tokens preserved for backward compat.
  2. ✓ A shared `<MethodBadge method="..." />` primitive exists at `src/renderer/components/ui/MethodBadge.tsx`, renders with the correct method color (GET=green, POST=orange, PUT=blue, PATCH=purple, DELETE=red, HEAD/OPTIONS=gray), and is used by `MethodPicker` (refactored to wrap a `<MethodBadge>` + transparent `<select>`).
  3. ✓ A shared `<VerticalTabStrip>` and `<PillBar>` primitive exist in `src/renderer/components/ui/` and are exported via `index.ts`. The existing `RequestEditor.SubTabs` is the next consumer (Phase 6).
  4. ✓ A `<SendButton>` (accent orange) and `<IconButton>` primitive exist and are exported. They will replace ad-hoc buttons in Phase 6.
**Plans**: 1 plan

Plans:
- [x] 05-01: Design tokens, theme CSS, shared UI primitives (MethodBadge, VerticalTabStrip, PillBar, SendButton, IconButton) — completed 2026-06-06

#### Phase 6: Request Builder Redesign
**Goal**: Apply sketches 001-A (URL bar attached method badge), 002-C (vertical tab strip sections), 003-A (pill bar body modes) to the request editor — the most visible surface in the app.
**Depends on**: Phase 5
**Requirements**: REDESIGN-02
**Status**: Complete (2026-06-06)
**Success Criteria** (what must be TRUE):
  1. ✓ The URL bar is a single bordered container with the method badge attached on the left, URL input (monospace) in the middle, and the send button (accent) on the right. The method badge opens a dropdown when clicked.
  2. ✓ Request section navigation (Params / Headers / Body / Auth / Settings) is a vertical tab strip on the left (140px min-width) with the active tab showing a left border accent. Each tab shows an icon + label + count badge (live counts: enabled params, enabled headers, body content presence, auth configured).
  3. ✓ The Body section uses a horizontal pill bar at the top for mode selection (none / form-data / url-encoded / raw / binary), with a content-type selector below for raw mode. The Monaco editor fills the remaining vertical space.
  4. ✓ Existing functionality is preserved — sending requests, viewing responses, switching tabs all continue to work; only the visual layout changes. Save / Copy as cURL / Diagnose actions moved to a secondary toolbar row below the URL bar.
**Plans**: 1 plan

Plans:
- [x] 06-01: URL bar (001-A), vertical tab strip (002-C), body pill bar (003-A) — refactor RequestEditor.tsx, SubTabs.tsx, BodyTab.tsx — completed 2026-06-06

#### Phase 7: Sidebar & Variable Editor Redesign
**Goal**: Apply sketches 004-A (table grid variable editor) and 005-A (tree sidebar collections) — the sidebar gets a polished tree and a dense table editor for variables.
**Depends on**: Phase 5
**Requirements**: REDESIGN-03
**Status**: Complete (2026-06-06)
**Success Criteria** (what must be TRUE):
  1. ✓ The Collections tree uses the tree sidebar pattern from sketch 005-A: compact rows (`4px var(--ds-space-2)` padding), icon per node (folder 📁 / request), right-aligned count badge, monospace for URLs, `<MethodBadge size="xs">` for methods, rotating chevron (`transform: rotate(90deg)`) on expand, search filter input.
  2. ✓ The Variables editor uses the table grid pattern from sketch 004-A: dense rows (`3px 6px` padding), inline editing of name/value columns (`border: 1px solid transparent` with focus ring), secret checkbox toggle (`-webkit-text-security: disc`), scope column with colored badges (Env=blue, Collection=orange, Global=green), `✕` delete button, environment switcher chips, bulk export toolbar (Copy JSON / Copy .env).
  3. ✓ Sidebar section switching (Collections / Endpoints / Environments / History / Variables) uses `<IconButton variant="solid|ghost">` from Phase 5 design system.
  4. ✓ Endpoints tree, Environments list, History list all follow the same tree pattern: compact rows, rotating chevrons, count badges, monospace fonts, method-color accent borders. Search input on Endpoints tree.
  5. ✓ Existing functionality is preserved — creating folders, saving requests, switching environments, viewing history, selecting endpoints all continue to work.
**Plans**: 1 plan

Plans:
- [x] 07-01: Collections tree (005-A), variables table editor (004-A), Endpoints/Environments/History trees — refactor Sidebar.tsx, CollectionsTree.tsx, VariablesTab.tsx, EnvironmentsList.tsx, HistoryList.tsx, EndpointsTree.tsx, DtoClassPanel.tsx — completed 2026-06-06

#### Phase 8: Database Integration Redesign
**Goal**: Apply sketches 006-B (JDBC URL + Parse connection form) and 007-D (right tree + inline rows table picker) — the DB tool window gets an IntelliJ-style polish.
**Depends on**: Phase 5
**Requirements**: REDESIGN-04
**Status**: Complete (2026-06-06)
**Success Criteria** (what must be TRUE):
  1. ✓ The DB connection form uses the JDBC URL + auto-parse pattern from sketch 006-B: a single JDBC URL input (dark `--ds-editor-bg` background, monospace, `--ds-radius-1` border on focus), a 4-column parsed grid (Driver / Host / Port / Database, all uppercase labels, monospace values), and a 2-column user/password field row below. Test Connection uses `<IconButton variant="outline">`. Save Connection is a solid primary button.
  2. ✓ The DB table picker uses the right-tree + inline-rows pattern from sketch 007-D: mode switcher (First N / By ID / WHERE) replaced with `<PillBar>`, table rows with rotating chevron + count badge, inline rows showing first 3 key=value pairs in monospace, "Load 10 more →" link at the bottom. Clicking a row triggers `onRowSelect`.
  3. ✓ The DB row detail uses the 007-D sticky header pattern: `position: sticky; top: 0` header with a "DB Row" pill badge (`var(--ds-primary)` background, rounded full) and the schema.table name in monospace, then a 2-column grid (key in muted / value in regular, with `NULL` shown italic in muted). The `Use this row → body` button is a solid primary button.
  4. ✓ The ColumnFieldMapping editor uses the type-compatibility color indicators: green dot for exact match, orange for compatible (auto-converts), red for incompatible. The coverage badge shows "X/Y required" with color matching the state (all green / partial orange / none red). A legend below the table explains each color. Action buttons row uses dashed-border ghost buttons + a solid primary Apply button.
  5. ✓ All four database components are migrated to `--ds-*` design tokens (no legacy oklch references remain).
  6. ✓ `DatabasePanel` container is created and wired into `App.tsx` as a toggleable right-pane tool window (340px wide). StatusBar gets a `🗄 Database` toggle button that highlights when active. The panel composes the four refactored DB components: left column (130px) = connections list with db-type emoji icons (🐘 🐬 🔴 💧 🗄) + connection-status dot; right column = selected connection's workspace (form when creating, tree + row detail when browsing). Clicking `Use this row → body` auto-fills the active tab's body editor with the row's JSON.
  7. ✓ Existing functionality is preserved — connecting, browsing tables, mapping columns, generating bodies all work end-to-end.
**Plans**: 1 plan

Plans:
- [x] 08-01: DB connection form (006-B), DB table picker + inline rows (007-D), column-field mapping panel + DatabasePanel container integration — refactor Database/DbConnectionForm.tsx, DbTableTree.tsx, DbRowDetail.tsx, ColumnFieldMapping.tsx; create DatabasePanel.tsx; wire into App.tsx; add DB toggle to StatusBar — completed 2026-06-06

#### Phase 9: Chain UI Redesign
**Goal**: Apply sketches 009-A (horizontal step sequence) and 010-B (bottom data panel chain link builder) — chains get a visual step ribbon and a collapsible bottom data panel for response field reference.
**Depends on**: Phase 5
**Requirements**: REDESIGN-05
**Success Criteria** (what must be TRUE):
  1. The chain header shows a horizontal step sequence (009-A): each step as a card with method badge, name, and an arrow between steps. Clicking a step scrolls to its body. The active step has an accent border.
  2. The chain link builder has a collapsible bottom data panel (010-B) showing the previous step's response tree. Steps are arranged in columns; clicking a field in the data panel copies its JSONata reference (`$['step-id'].body.path`).
  3. The ChainDataPanel and ChainStepColumn components render the data tree with monospace JSON, copy-path button on each node, and a clear source→target mapping view.
  4. Existing functionality is preserved — running chains, editing steps, mapping responses to body/header/URL fields, previewing resolved bodies all continue to work.
**Plans**: 1 plan

Plans:
- [ ] 09-01: Chain horizontal steps (009-A), bottom data panel (010-B) — refactor Chain/ChainHeader, StepSequence, StepCard, ChainRequestBuilder, ChainDataPanel, ChainStepColumn, PreviewResolvedModal, ChainValidationBanner, UnresolvedRefWarning

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Postman Parity | v2.1 | 3/3 | Complete | 2026-06-04 |
| 2. Spring Project Detection | v2.1 | 3/3 | Complete | 2026-06-06 |
| 3. Body Generation (DTO + DB) | v2.1 | 3/3 | Complete | 2026-06-06 |
| 4. Workflow Chains & Response Mapping | v2.1 | 3/3 | Complete | 2026-06-06 |
| 5. Design System & Theme Foundation | v3.0 | 1/1 | Complete | 2026-06-06 |
| 6. Request Builder Redesign | v3.0 | 1/1 | Complete | 2026-06-06 |
| 7. Sidebar & Variable Editor Redesign | v3.0 | 1/1 | Complete | 2026-06-06 |
| 8. Database Integration Redesign | v3.0 | 1/1 | Complete | 2026-06-06 |
| 9. Chain UI Redesign | v3.0 | 0/1 | Not started | - |

**Coverage:**

- v1 requirements: 34 total (shipped in v2.1)
- v3 redesign requirements: 5 total (REDESIGN-01..05)
- Mapped to phases: 5/5 ✓

**Phase distribution:**

- Phase 5: 1 requirement (REDESIGN-01)
- Phase 6: 1 requirement (REDESIGN-02)
- Phase 7: 1 requirement (REDESIGN-03)
- Phase 8: 1 requirement (REDESIGN-04)
- Phase 9: 1 requirement (REDESIGN-05)
