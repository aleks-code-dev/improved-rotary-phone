# Phase 1: UI Design Contract

**Generated:** 2026-06-03 (auto-generated from 01-CONTEXT.md during plan-phase)
**Phase:** 1 — Foundation & Postman Parity
**Source:** `.planning/phases/01-foundation-postman-parity/01-CONTEXT.md` (decisions D-01..D-35)

---

## Look & Feel Anchor

**Postman / Insomnia.** Industry-converged API-client patterns. The user explicitly framed this as a "postman clone" — anyone who has used Postman should feel immediately at home.

## Design Tokens

- **Theme:** System-following with manual dark/light override in Settings → Appearance (D-06). Both themes fully designed. CSS variables; never hardcode colors (D-06).
- **Method badge colors (D-07):**
  - GET = blue
  - POST = green
  - PUT = orange
  - PATCH = purple
  - DELETE = red
  - HEAD / OPTIONS = gray
- **Color tokens:** `agent's Discretion` — pick OKLCH or HSL, but must agree across Monaco and the rest of the UI.
- **Typography:** System font stack. Monospace for code areas (body editor, headers tables, cURL, response body). 13-14px base size in editor panes.

## App Shell (3-Pane Layout, D-01..D-05)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Title bar (native) — File / Edit / View / Help menus                 │
├──────────┬───────────────────────────────────────────────────────────┤
│          │ Tab bar: [● GET /users 1] [POST /login 2] [×]              │
│ Sidebar  ├───────────────────────────────────────────────────────────┤
│          │ Request editor (top)                                       │
│ ▾ Coll.  │ ┌─Sub-tabs: Params | Headers | Body | Auth | Tests | Set─┐│
│   ▾ API  │ │                                                       ││
│     GET..│ │  [editor content]                                      ││
│     POST.│ │                                                       ││
│   ▸ Auth │ └───────────────────────────────────────────────────────┘│
│   ▸ Users│                                                           │
│          │ Status bar: [Helper: ● running] [Env: dev] [Saved 2s ago]│
│ ▾ Env    ├───────────────────────────────────────────────────────────┤
│   dev ●  │ Response viewer (bottom, resizable split)                 │
│   prod   │ ┌─Sub-tabs: Body | Headers | Cookies | Timing ─────────┐ │
│   staging│ │ Pretty | Raw | Preview                                │ │
│          │ │ {                                                     │ │
│ ▸ Hist.  │ │   "id": 1,                                            │ │
│   ● now  │ │   "name": "…"                                         │ │
│   ● 5m   │ │ }                                                     │ │
│          │ └───────────────────────────────────────────────────────┘ │
└──────────┴───────────────────────────────────────────────────────────┘
```

- **Sidebar (left, collapsible):** Collections tree (nested folders, drag-to-reorder), Environments list (with active env indicator), History (per-collection, time-sorted). Each group hideable via sidebar toolbar (D-02).
- **Editor area (center-top):** Tab bar with method badge (color-coded) + truncated name + dirty indicator + close X. Middle-click or X to close. New tab: Ctrl+T. Reopen: Ctrl+Shift+T (D-21, D-22, D-35).
- **Request editor sub-tabs (D-04):** Params (query + path), Headers, Body, Auth, Tests (placeholder for v2), Settings.
- **Response viewer (center-bottom):** Body (pretty / raw / preview), Headers, Cookies, Timing. Pretty-JSON default with monospace, collapsible nodes, Ctrl+F search. Preview tab renders HTML safely (sandboxed iframe, no scripts) (D-05).
- **Status bar (bottom, always visible):** Helper state (●/○/✗), active env, last-save indicator (D-30, D-31).
- **Splitters:** All three regions resizable; widths remembered per-session.

## Body Editor (D-12..D-15)

- **Mode switcher (header):** Horizontal radio row: `none · form-data · url-encoded · raw · binary`. Selecting "raw" opens a content-type dropdown (JSON / XML / Text / GraphQL).
- **Monaco** for raw modes (JSON / XML / Text / GraphQL). JSON language service enabled by default (auto-complete, hover docs, error squiggles, format-on-paste).
- **Form-table** for form-data (key/value/type-text-or-file dropdown) and url-encoded (key/value rows).
- **File upload** for binary mode.
- **Pretty-print button** in toolbar when content is JSON or XML.

## Variables UI (D-08..D-11)

- **Variables tab** in sidebar opens a 4-row table (one row per scope) showing all resolved variables and their source. Quick-add via `+` per scope. Bulk-edit via right-click.
- **`{{name}}` substitution:** lazy at send-time. Unknown variables remain `{{name}}` literal in the sent request and emit a warning chip on the response panel.

## Authentication UI (D-25..D-26)

- **Auth sub-tab** in request editor. Dropdown: None / Bearer Token / Basic Auth / API Key (in header OR query).
- **Bearer:** single token field, type=password with reveal button.
- **Basic:** username + password (password masked).
- **API Key:** key + value, location radio (Header | Query Params).
- **Secret fields** are masked (••••••) with reveal button. Marking "Use env var" pulls from active env.

## cURL Interop (D-16, D-17)

- **"Code" dropdown** in request editor toolbar: "Copy as cURL". (HTTPie / Fetch deferred to v2.)
- **File menu → Import → "cURL command"** or "Raw text". Parses common subset. Unparseable → friendly error.

## History (D-18..D-20)

- **Per-collection history list** in sidebar. Each entry: timestamp, method, URL, status badge. Click → loads request into new tab (response view-only, not re-sent). Right-click → "Re-send in new tab" / "Delete".
- **Search box** at top of history: substring match on URL, method, status. Full-text on body deferred to v2.

## Response Viewer (D-05, D-23, D-24)

- **Sub-tabs:** Body (pretty / raw / preview) | Headers | Cookies | Timing.
- **Body:** Pretty (default, JSON) | Raw (text) | Preview (HTML in sandboxed iframe).
- **Headers:** Key/value table with copy-button per row.
- **Cookies:** Key/value table (per-response, no jar in v1).
- **Timing:** 6-row breakdown: DNS / Connect / TLS / Request / Wait / Response, each in ms. Computed from undici's timing API.
- **Status:** Big status code in top-right (color-coded: 2xx green, 3xx blue, 4xx orange, 5xx red).
- **Body cap:** 1MB for display; larger responses show a "Body truncated to 1MB — download raw" link (m-1).

## Per-Request Settings (D-23)

- **Settings sub-tab:** Timeout (default 30000ms, max 600000ms), Follow redirects (default true, max 10), SSL verify (default true), "Save cookies to jar" (default false in v1).

## Keyboard Shortcuts (D-35)

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd+Enter | Send request |
| Ctrl/Cmd+S | Save request |
| Ctrl/Cmd+Shift+S | Save As |
| Ctrl/Cmd+K | Quick switcher |
| Ctrl/Cmd+T | New request tab |
| Ctrl/Cmd+W | Close current tab |
| Ctrl/Cmd+Shift+T | Reopen last closed tab |
| Ctrl/Cmd+Shift+C | Copy as cURL |
| Ctrl/Cmd+/ | Toggle comment in body |
| Ctrl/Cmd+F | Find in response body |
| F1 | Help / shortcut reference |

## First-Run (D-27, D-28)

- **Modal dialog on first launch:** "Where should PostmanClone store your data?" with default = `app.getPath('userData')` and a "Browse" button.
- **Cloud-sync warning chip** if chosen folder matches Dropbox/OneDrive/iCloud/GoogleDrive path prefixes.
- **Settings → Data location:** current dir, "Change location" button, "Open data folder" reveal in OS file manager.

## Status Bar (D-30, D-31)

- **Helper state indicator:**
  - ● green = running
  - ● yellow = starting
  - ○ gray = not yet started
  - ✗ red = crashed (3+ restarts in 60s)
- **Active env badge** (click to switch)
- **Last-save indicator** ("Saved 2s ago" / "Unsaved changes")
- **Click helper indicator** → opens log file in OS file manager

## Empty States

- **Empty collections:** "Create your first collection" button (D-23 — agent's Discretion, defaults to last-used pattern).
- **Empty history:** "No requests sent yet" with shortcut hint.
- **No envs:** "Create an environment" button.

## Accessibility

- All interactive elements keyboard-reachable (Tab order logical).
- ARIA labels on icon buttons (close tab, copy cURL, etc.).
- Focus visible (CSS outline) on all interactive elements.
- Status bar updates announced via `aria-live="polite"`.

## Out of Scope (v1)

- Detach tab to new window (D-22) — v1.5
- Image / PDF response preview (RESP-01) — v2
- Response assertions (RESP-02) — v2
- Cookie jar (D-32) — v1.5
- Tabs per-collection (D-21) — v1.5
- Global history search (D-20) — v2
- Code generation (TS/Java/Python) (D-39) — v2
- OAuth 2.0 / mTLS (AUTH-01..03) — v2
- GraphQL / gRPC / WebSocket (PROTO-01..03) — v2
- OpenAPI import (IMPRT-01) — v2
