---
status: testing
phase: 01-foundation-postman-parity
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md
started: 2026-06-04T00:30:00Z
updated: 2026-06-04T21:45:00Z
---

## Current Test

number: 12
name: Method Picker & URL Bar
expected: |
  The request editor shows a color-coded HTTP method dropdown (GET=green, POST=blue, PUT=orange, PATCH=yellow, DELETE=red, HEAD=gray, OPTIONS=gray) and a URL input bar. Selecting a method changes the dropdown color. Typing a URL enables the Send button.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test (Build)
expected: `npm run dev` should launch the Electron app without errors.
result: pass

### 2. NPM Dependencies
expected: All pinned dependencies from STACK.md present.
result: pass

### 3. JVM Helper JAR
expected: Fat JAR >= 500KB, responds to JSON-RPC initialize.
result: pass
note: Fixed: Shadow plugin, bare JSON-RPC response format, Gradle wrapper.

### 4. App Launch & 3-Pane UI
expected: Electron window with sidebar, request editor, response viewer, status bar.
result: pass

### 5. JVM Helper Status Bar
expected: Status bar shows `Healthy (pid <N>, v0.1.0)` within 5s.
result: pass
note: Fixed: findJava() scan coverage, exe path vs dir path, bundled JAR dev mode path.

### 6. Diagnose Connection Probe
expected: Clicking "Diagnose Connection" shows error with timing in response panel.
result: pass
note: Fixed: anySignalOf() mock, result display wiring, stale .js files.

### 7. Helper Restart
expected: Clicking "Restart helper" restarts helper within 5s.
result: pass

### 8. Supervisor Crash Policy
expected: 3 kills in 60s → red offline with manual restart button.
result: pass

### 9. First Run Data Dir Picker
expected: On first launch, modal asks where to store data with cloud-sync warning.
result: pass

### 10. Settings Persistence
expected: Quit and relaunch → helper Healthy immediately, state restored.
result: pass

### 11. Logging
expected: `<userData>/logs/` contains `app.log` and `helper.log`.
result: pass
note: Fixed: stderr pipe wired to helper.log.

### 12. Method Picker & URL Bar
expected: Color-coded method dropdown (GET green, POST blue, DELETE red, etc.) + URL input that enables Send button when non-empty.
result: [pending]

### 13. Params Tab
expected: Key/value table for query parameters. Add/remove rows. Values update in real time.
result: [pending]

### 14. Headers Tab
expected: Key/value table for request headers. Common Headers dropdown. Add/remove rows.
result: [pending]

### 15. Body Tab & Monaco Editor
expected: Switch between body modes (none/raw/urlencoded/form-data/binary). Raw mode shows Monaco JSON editor with syntax highlighting and error squiggles. Form-data and urlencoded show key/value tables.
result: [pending]

### 16. Auth Tab
expected: Select auth type (None/Bearer/Basic/API Key). Secret fields are masked with reveal toggle. Bearer shows token input, Basic shows username/password, API Key shows key/value/location.
result: [pending]

### 17. Settings Tab
expected: Timeout, redirect, SSL, cookie jar settings. Cookie jar is disabled (v1.5 placeholder).
result: [pending]

### 18. Send Request
expected: Fill URL, method, optional params/headers/body → click Send (or Ctrl+Enter). Request executes, response appears in viewer. Sending state shows loading indicator.
result: [pending]

### 19. Response Status & Timing
expected: After send, response viewer shows: status code (color-coded: 2xx green, 3xx blue, 4xx orange, 5xx red), response time in ms, response size. 1MB+ bodies show truncation banner with Save-to-file button.
result: [pending]

### 20. Response Body Views
expected: Body tab shows Pretty (formatted JSON), Raw (plain text), and Preview (sandboxed iframe for HTML) sub-views. Pretty mode auto-formats JSON with indentation.
result: [pending]

### 21. Response Headers
expected: Headers tab shows all response headers with key/value columns. Each row has a copy button.
result: [pending]

### 22. cURL Generate & Copy
expected: Click "Copy cURL" (or Ctrl+Shift+C) copies a valid cURL command to clipboard. Command includes method, URL, headers, and body.
result: [pending]

### 23. cURL Import
expected: Paste a cURL command into the import field. Method, URL, headers, and body auto-populate the editor.
result: [pending]

### 24. Keyboard Shortcuts
expected: Ctrl+Enter sends request. Ctrl+Shift+C copies cURL. Ctrl+F focuses find. Ctrl+/ toggles comment. Escape cancels request.
result: [pending]

### 25. Collections - Create & Browse
expected: Sidebar Collections section shows collections. Click "New Collection" → enter name → collection appears in tree. Click collection to expand and see its requests.
result: [pending]

### 26. Collections - Save Request
expected: Fill out a request → click Save → choose collection → request saved. Reopen collection and the request is there.
result: [pending]

### 27. Environments
expected: Sidebar Environments section shows environments. Active environment has indicator. Can create and switch environments.
result: [pending]

### 28. Variables
expected: Sidebar Variables tab shows variables across scopes (Local, Data, Environment, Collection, Global). Use `{{variable_name}}` syntax in URL or headers.
result: [pending]

### 29. Auth with Env Variable Binding
expected: In Auth tab, set type to Bearer. Click env-var binding to link token to `{{my_token}}` from an environment. Request sends with resolved value.
result: [pending]

### 30. History
expected: After sending a request, it appears in Sidebar History section. Shows method, URL, timestamp, and status. Entries are searchable.
result: [pending]

### 31. Tab Persistence
expected: Open a few tabs with different requests. Close and reopen the app. Tabs restore with URLs, methods, and dirty state preserved.
result: [pending]

### 32. Tab Drag Reorder
expected: Drag a tab horizontally to reorder it. Visual indicator shows drop position. Tabs maintain order after release.
result: [pending]

### 33. Postman v2.1 Import
expected: File → Import → pick a Postman v2.1 collection JSON file. Preview shows item/folder counts. Click Import → collection appears in sidebar.
result: [pending]

### 34. Postman v2.1 Export
expected: Right-click a collection → Export → pick save location. Output is valid Postman v2.1 JSON. Re-importing produces identical structure.
result: [pending]

### 35. Settings - Data Location
expected: Settings → Data Location shows current data directory path. Change location and Open data folder buttons work.
result: [pending]

### 36. Settings - Network
expected: Settings → Network shows Diagnose Connection button. Clicking runs the probe and displays DNS/Connect/TLS/Wait/Total timing results.
result: [pending]

## Summary

total: 36
passed: 11
issues: 0
pending: 25
skipped: 0
blocked: 0

## Gaps

[none yet]
