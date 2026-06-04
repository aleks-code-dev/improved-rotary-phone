---
sketch: 006
name: database-connection
question: "What does the IntelliJ-style DB connection screen look like?"
winner: B
tags: [database, connection, form, driver]
---

# Sketch 006: Database Connection

## Design Question
How should users connect to a database? This screen needs to handle 4 driver types (PostgreSQL, MySQL, Oracle, H2), connection testing with feedback, and credential security (safeStorage). IntelliJ IDEA's Data Sources dialog is the reference point.

## How to View
Open `.planning/sketches/006-database-connection/index.html` in a browser.

## Variants
- **A: IntelliJ-Style Form** — Driver selector cards (4 DBs), structured fields (host/port/db/user/pass), auto-generated JDBC URL preview. Test Connection button with result. Advanced pool settings section. Matches IntelliJ's Data Sources dialog.
- **B: URL String + Parse** — Single JDBC URL input field. Auto-parses host, port, db, driver on type. Parsed fields displayed in a read-only grid. Power-user mode for devs who know their connection strings.
- **C: Wizard Steps** — 4-step guided wizard: Select Driver → Enter Credentials → Test & Save → View Saved Connections. Good for first-time setup. Progress indicators. Step 4 shows saved connection list with status indicators.

## What to Look For
- Driver selection — cards (A) vs dropdown vs wizard step. Which is fastest?
- Credential security — is the password field clearly marked as encrypted-on-save?
- Test Connection — feedback clarity (success/failure messages)
- Which best handles switching between multiple saved connections?
- Advanced pool settings — how discoverable should they be?
