# Phase 1: Foundation & Postman Parity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 1 — Foundation & Postman Parity
**Areas discussed:** App layout, theme, variable scoping, body editor, cURL interop, history, tabs, per-request settings, auth, first-run, helper-offline mode, cookie jar, proxy, keyboard shortcuts, Postman import/export, code generation
**Mode:** auto (--auto) — all gray areas auto-resolved with Postman-converged recommended defaults; no interactive questions asked

---

## App layout

| Option | Description | Selected |
|--------|-------------|----------|
| 3-pane Postman-style | Sidebar (left) / request editor (center-top) / response viewer (center-bottom) with resizable splitters | ✓ |
| IDE-style with bottom drawer | Same as above but response is a drawer that slides up from bottom | |
| Single-page sequential | Tabs for each section in a single column | |

**Auto-selected:** 3-pane Postman-style (industry standard, what the user means by "postman clone")
**Notes:** Resizable splitters, collapsible sidebar, status bar at bottom for helper state.

## Theme & appearance

| Option | Description | Selected |
|--------|-------------|----------|
| System-following with manual override | Detect OS theme, allow manual dark/light toggle in Settings | ✓ |
| Light only | v1 ships light theme only | |
| Dark only | v1 ships dark theme only (developer convention) | |

**Auto-selected:** System-following with manual override. Both themes fully designed. Dark/light CSS variables — never hardcode colors.

## Variable scoping (CORE-03)

| Option | Description | Selected |
|--------|-------------|----------|
| 4 scopes (Local / Data / Env / Collection / Global) | Standard Postman scopes, lazy `{{name}}` substitution | ✓ |
| 2 scopes (Env + Global) | Minimal — envs hold all vars, global holds cross-env | |
| 5 scopes (add Workspace) | Add workspace-level for team mode | |

**Auto-selected:** 4 scopes. Standard precedence `Local > Data > Env > Collection > Global`. No script-based mutation in v1.

## Body editor

| Option | Description | Selected |
|--------|-------------|----------|
| Monaco for raw, form for form/url-encoded, file upload for binary | Hybrid — best of each mode | ✓ |
| All-Monaco | Single Monaco editor with mode-aware language service | |
| Custom lightweight | Hand-rolled editor, no Monaco | |

**Auto-selected:** Monaco for raw (JSON / XML / Text / GraphQL), form-table for form-data / url-encoded, file upload for binary. Pretty-print button for JSON/XML.

## cURL interop (CORE-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Both: generate cURL from request + import cURL to request | Full interop | ✓ |
| Generate only | Output cURL, don't accept input | |
| Neither | User manages cURL externally | |

**Auto-selected:** Both directions. Stable cURL template with `--data-raw`, `-u`, `-H`. Import parser handles common subset. Unparseable cURL → friendly error.

## History (CORE-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-collection (capped 100), click loads to new tab | v1 baseline | ✓ |
| Per-collection + global searchable | Global index in v1 | |
| Unbounded (DB-backed) | SQLite history, no cap | |

**Auto-selected:** Per-collection, cap 100, JSON files. Click loads request to a new tab. Search within collection (substring on URL/method/status). Global search deferred to v2.

## Tabs

| Option | Description | Selected |
|--------|-------------|----------|
| Top tabs, persist across restarts, drag-reorder | Industry standard | ✓ |
| No tabs (single active request) | Simpler but less useful | |
| Tabs but no persistence | Ephemeral tabs | |

**Auto-selected:** Top tabs, persist across restarts, drag-reorder. Detach to new window = v1.5.

## Per-request settings

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in request editor (Settings sub-tab) | Per-request, in context | ✓ |
| Per-collection only (one setting for all requests) | Simpler but less flexible | |
| Modal dialog | Modal blocks flow | |

**Auto-selected:** Inline sub-tab. Defaults: 30s timeout, follow redirects, SSL verify. Cookie jar save = false in v1 (no jar yet).

## Authentication (CORE-07)

| Option | Description | Selected |
|--------|-------------|----------|
| None / Bearer / Basic / API key | v1 baseline | ✓ |
| Add OAuth 2.0 in v1 | Heavy — auth code flow, refresh, token store | |
| Add mTLS in v1 | Certificate management | |

**Auto-selected:** 4 types in v1. OAuth 1/2, mTLS = v2. Auth credentials in env vars, masked in UI.

## First-run & data dir

| Option | Description | Selected |
|--------|-------------|----------|
| Data-dir picker with cloud-sync warning | v1 baseline | ✓ |
| Use app.getPath('userData') with no prompt | Simpler | |
| No data dir concept (DB-backed) | Wrong choice — research says JSON files | |

**Auto-selected:** Data-dir picker on first run. Cloud-synced path detection (Dropbox/OneDrive/iCloud/GoogleDrive prefixes + known folder ids). Warning shown but not blocking.

## Helper-offline mode

| Option | Description | Selected |
|--------|-------------|----------|
| CORE works without helper; status bar shows state; auto-restart on crash | v1 baseline | ✓ |
| Helper required for all features | Wrong — CORE doesn't need Java | |
| No offline mode (helper always on) | Couples Phase 1 to JVM | |

**Auto-selected:** CORE works without helper. Supervisor: exp backoff 1s→30s, max 3 in 60s. Status bar always visible. Manual "Restart helper" button after backoff exhausted.

## Cookie jar

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to v1.5 | Simplifies v1, no auto-cookie logic | ✓ |
| Include in v1 | More "complete" Postman parity | |

**Auto-selected:** Defer to v1.5. v1 history records cookies per response but does not auto-resend. Captured as v1.5 candidate.

## Proxy

| Option | Description | Selected |
|--------|-------------|----------|
| Per-environment (Postman-style) | One proxy per env | ✓ |
| Global | One proxy for whole app | |
| Per-request | Most flexible but heaviest UI | |

**Auto-selected:** Per-env. Empty = no proxy. Auth via user:pass in URL.

## Keyboard shortcuts

| Option | Description | Selected |
|--------|-------------|----------|
| Standard Postman set: Ctrl+Enter (send), Ctrl+S (save), Ctrl+T (new tab), etc. | Industry standard | ✓ |
| Custom / minimal | Just Send + Save | |
| Vim-style | Heavy customization | |

**Auto-selected:** Standard Postman set. Full list in D-35.

## Postman v2.1 import/export (CORE-10)

| Option | Description | Selected |
|--------|-------------|----------|
| Import + Export + round-trip test fixture | Full interop with verification | ✓ |
| Import + Export, no round-trip test | Less work, but round-trip is unverified | |
| Just import (let Postman handle export) | One-way | |

**Auto-selected:** Import + Export + 20+ real Postman collection round-trip test fixture in `tests/fixtures/postman/`. PITFALLS low-confidence area; build the fixture in Phase 1 to de-risk Phase 5 chain round-trip.

## Code generation

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to v2 (TS/Java/Python client code-gen) | v1 is about sending requests, not generating code to send from elsewhere | ✓ |
| Include cURL + HTTPie + Fetch in v1 | Multiple code-gen styles | |
| Include full typed client generation | Heavy | |

**Auto-selected:** Defer all code-gen to v2. v1 = cURL only (CORE-02).

---

## the agent's Discretion

- Exact keybinding for "Send" if the user has remapped `Enter` OS-wide — fall back to plain `Enter` when `Ctrl+Enter` doesn't work.
- Default empty-state for new tabs (blank request vs. last-used request).
- Common headers pre-populated (Content-Type, Accept, User-Agent?).
- Response timing format (ms vs auto-format `3.2s`).
- Color tokens (OKLCH vs HSL) — pick what Monaco and rest of UI agree on.

## Deferred Ideas

(See `01-CONTEXT.md` § Deferred Ideas for the full list. Summary:)

- **v1.5 candidates:** Cookie jar, detach tab to window, per-request proxy, global history search, image/PDF preview, response assertions, tabs persistence per-collection.
- **v2 candidates:** OAuth 2.0, mTLS, OAuth1, code generation, OpenAPI import, scripting engine, WebSocket/gRPC/GraphQL.
- **Already in v1 but other phases:** Spring scan (Phase 2), DTO body (Phase 3), DB body (Phase 4), chains (Phase 5), response→body mapping (Phase 5).
