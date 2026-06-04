---
phase: 01
slug: foundation-postman-parity
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-04T20:00:00Z
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer → preload | Untrusted UI. Only typed `window.api.*` exposed via contextBridge. | IPC invoke args |
| preload → main | Untrusted renderer data. Every channel Zod-validated at handler. | IPC invoke args |
| main → filesystem | User-chosen data dir. Could be inside cloud-synced folder. Warning chip. Atomic writes prevent corruption. | User data / settings |
| main → JVM helper | Trusted main process writes JSON-RPC to helper stdin. Helper validates inputs. | JSON-RPC 2.0 commands |
| main → target HTTP (outbound) | Untrusted user-configured URLs in future phases. Phase 1: fixed probe URL only. | HTTP requests |
| helper → Spring project (future) | Read-only on user project paths. Validated via path prefix check. Not exercised in Phase 1. | File read operations |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Spoofing | IPC channel | mitigate | Zod 4 schema validation on all 9 `ipcMain.handle` channels; invalid payload returns `{ok:false, error:{code:'INVALID_PAYLOAD'}}` — never throws raw | closed |
| T-01-02 | Tampering | Renderer UI | mitigate | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` in BrowserWindow; preload only exposes `ipcRenderer.invoke` + `ipcRenderer.on` — no `send`; renderer has no `window.api.fetch` | closed |
| T-01-03 | Repudiation | Logs | mitigate | Log format includes `{scope}` for traceability; full per-request UUID correlation ID deferred to 01-02 (HTTP request context) | closed |
| T-01-04 | Information Disclosure | History / logs | mitigate | `redact.ts`: 4 regex patterns strip `Authorization`, `Cookie`, `X-API-Key`, `Proxy-Authorization` values before file write; `secretMask.ts`: masks secrets for storage (consumed by 01-03 auth UI + history serializer) | closed |
| T-01-05 | Denial of Service | Body size | mitigate | `undiciClient.ts` probe-only in Phase 1 (no body parsing); 1MB body cap contract defined for 01-02. No body = no overflow risk in 01-01. | closed |
| T-01-06 | Elevation of Privilege | Renderer code exec | mitigate | CSP meta in `index.html`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` | closed |
| T-01-07 | Tampering | Helper JAR | mitigate | JAR copied from bundled resources (dev: `app.getAppPath()+resources/helper/`; prod: `process.resourcesPath+helper/`) to userData on init; always overwrites stale copy | closed |
| T-01-08 | Spoofing | JDK path | mitigate | `jdkDetect.findJava()` validates via `where java`, JAVA_HOME, PATH, scoop apps, common install dirs; returns only executables with version >= 17 | closed |
| T-01-09 | Information Disclosure | Data dir on cloud sync | mitigate | First-run picker + Settings page warn if path is inside Dropbox/OneDrive/iCloud/GoogleDrive; `cloudSync.ts` detects all 4 providers | closed |
| T-01-10 | Denial of Service | Long paths on Windows | mitigate | `atomicWrite.ts` prepends `\\?\` prefix for paths > 240 chars on Windows; applied to all file writes and helper JAR copy | closed |
| T-01-11 | Tampering | Package supply chain | mitigate | 12 npm packages + 3 Maven packages from well-known registries (npm, Maven Central); all versions pinned exactly; no postinstall scripts; verified via RESEARCH §Package Legitimacy Audit | closed |
| T-01-12 | Denial of Service | Helper crash loop | mitigate | Supervisor: exp backoff 1s→2s→4s→8s→16s→30s; max 3 restarts in 60s window; after exhausted → `state=offline` with manual restart required; `windowsHide: true` on spawn | closed |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-04 | 12 | 12 | 0 | UAT + verify-work workflow (auto) |

---

## Accepted Risks Log

No accepted risks — all threats have verified mitigations.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (none)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-04
