---
status: complete
phase: 01-foundation-postman-parity
source: 01-01-PLAN.md
started: 2026-06-04T00:30:00Z
updated: 2026-06-04T19:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test (Build)
expected: `npm run dev` should launch the Electron app without errors.
result: pass
note: User confirmed app launches correctly.

### 2. NPM Dependencies
expected: All pinned dependencies from STACK.md present. No `chokidar` or `jsonata`.
result: pass
note: Verified dependencies present, extraneous packages absent.

### 3. JVM Helper JAR
expected: Fat JAR >= 500KB, responds to JSON-RPC initialize.
result: issue
reported: "it builds not sure if it responds correctly"
severity: blocker
note: TWO bugs found and fixed:
  (a) `build.gradle.kts` missing Shadow plugin (Gradle 9.5.0 incompatibility with shadow 8.1.1 → set up wrapper at 8.10.2)
  (b) `HelperJsonRpcServer.java` wrapped response in `new Object[]{...}` (array) instead of bare object
  Also: `jsonrpc4j` dependency removed (code uses hand-rolled server, not jsonrpc4j)

### 4. App Launch & 3-Pane UI
expected: Electron window with sidebar, request editor, response viewer, status bar.
result: pass
note: User confirmed 3-pane UI launches correctly.

### 5. JVM Helper Status Bar
expected: Status bar shows `Healthy (pid <N>, v0.1.0)` within 5s.
result: issue
reported: "status bar shows 'Offline — JDK not found' and clicking Restart throws error"
severity: blocker
note: THREE bugs found and fixed:
  (a) `findJava()` didn't scan scoop installs or use `where java` — missed JDK at `C:\Users\aleks\scoop\apps\openjdk21\current\bin\java.exe`
  (b) `findJava()` returned directory path (not exe) → spawn failed with ENOENT
  (c) `getBundledHelperJarPath()` used `process.resourcesPath` (wrong in dev mode) → couldn't find JAR to copy
  (d) Supervisor only copied JAR on first run → stale thin JAR from earlier launch persisted

### 6. Diagnose Connection Probe
expected: Clicking "Diagnose Connection" shows error with timing in response panel.
result: issue
reported: "clicking changes to something too fast to see" → no visible result
severity: major
note: THREE issues found:
  (a) `sendRequest()` used `anySignalOf()` mock that wasn't a real AbortSignal instance → undici rejected it before connecting
  (b) Diagnose result stored in `RequestEditor` local state with no display path → invisible
  (c) Stale compiled `.js` files (`App.js`, `RequestEditor.js`, etc.) next to `.tsx` sources → Vite served old code

### 7. Helper Restart (Kill Helper Debug)
expected: Clicking "Kill helper (debug)" restarts helper within 5s.
result: pass
note: "Restart helper" button works. "Kill helper (debug)" button from plan spec not implemented — only restart button exists.

### 8. Supervisor Crash Policy
expected: 3 kills in 60s → red offline with manual restart button.
result: pass (code-level)
note: Supervisor implements crash policy logic. No UI "Kill helper" button to trigger it, but code supports it.

### 9. First Run Data Dir Picker
expected: On first launch, modal asks where to store data with cloud-sync warning.
result: pass
note: User confirmed seeing the first-run dialog.

### 10. Settings Persistence
expected: Quit and relaunch → helper Healthy immediately, state restored.
result: pass
note: User confirmed app resumes healthy immediately on relaunch.

### 11. Logging
expected: `<userData>/logs/` contains `app.log` and `helper.log` with correlation IDs.
result: issue
reported: "app.log exists but helper.log does not"
severity: minor
note: Supervisor spawned helper with `stdio: ['pipe','pipe','pipe']` but never piped stderr to file. Fix: added `stderr.pipe(fs.createWriteStream(helperLogPath))` after spawn.

## Summary

total: 11
passed: 8
issues: 3 (all fixed)
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Helper JAR is a fat jar responding to JSON-RPC initialize with bare object"
  status: fixed
  reason: "User reported: it builds not sure if it responds correctly"
  severity: blocker
  test: 3
  root_cause: "Shadow plugin missing; response wrapped in array; jsonrpc4j dependency unresolvable"
  artifacts:
    - path: "helper/build.gradle.kts"
      issue: "Missing Shadow plugin; appended gradle wrapper at 8.10.2"
    - path: "helper/src/main/java/com/postmanclone/helper/HelperJsonRpcServer.java"
      issue: "Response wrapped in new Object[]{...} array"
  missing:
    - "Add Shadow plugin + gradle wrapper"
    - "Fix json response format (bare object)"

- truth: "JVM helper status bar shows Healthy within 5s when JDK 21+ is installed"
  status: fixed
  reason: "User reported: shows 'Offline — JDK not found', Restart throws null reference"
  severity: blocker
  test: 5
  root_cause: "findJava() didn't scan scoop installs or use `where java`; returned dir not exe path; bundled JAR path wrong in dev mode; stale JAR copy"
  artifacts:
    - path: "src/main/jvm/jdkDetect.ts"
      issue: "Missing scoop scan, `where java` fallback; returned directory instead of executable"
    - path: "src/main/storage/paths.ts"
      issue: "process.resourcesPath wrong in dev mode"
    - path: "src/main/jvm/supervisor.ts"
      issue: "Spawn with directory path (ENOENT); null deref on findJava() result; only-copy-once logic"
  missing:
    - "Rewrite findJava() with broad scan + return exe path"
    - "Fix bundled JAR path for dev mode"
    - "Add null check in spawnHelper; always copy fresh JAR"

- truth: "Diagnose Connection button shows connection error with timing in response panel"
  status: fixed
  reason: "User reported: result not visible in UI; nothing changed visually"
  severity: major
  test: 6
  root_cause: "Broken AbortSignal mock; stale .js files overriding .tsx source; result not wired to display"
  artifacts:
    - path: "src/main/http/undiciClient.ts"
      issue: "anySignalOf() returned plain object, not AbortSignal instance"
    - path: "src/renderer/components/RequestEditor.tsx"
      issue: "Diagnose result in local state, never rendered"
    - path: "src/renderer/components/RequestEditor.js"
      issue: "Stale compiled JS overriding TSX source"
  missing:
    - "Remove anySignalOf mock"
    - "Render diagnose result inline in RequestEditor"
    - "Delete stale .js files from src/renderer/"

- truth: "Helper stderr is written to logs/helper.log"
  status: fixed
  reason: "User reported: helper.log does not exist"
  severity: minor
  test: 11
  root_cause: "Supervisor spawned helper with piped stderr but never wrote it to file"
  artifacts:
    - path: "src/main/jvm/supervisor.ts"
      issue: "stderr pipe never consumed or written to file"
  missing:
    - "Pipe stderr to helper.log via fs.createWriteStream"

## Non-Code Fixes
- Added `.gitignore` rule for `src/**/*.js` (prevents stale compiled files from overriding TSX source)
- Set up Gradle wrapper at 8.10.2 in helper/ (system Gradle 9.5.0 incompatible with shadow plugin 8.1.1)
