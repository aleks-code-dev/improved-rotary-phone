# Sketch Manifest

## Design Direction
Developer-tool dense — Postman/Insomnia-informed request builder optimized for constructing requests.
Information-rich, compact spacing, monospace where it counts. Every pixel earns its place.
The builder is a power tool, not a design showcase. Colors derive from HTTP method conventions.

## Reference Points
- Postman / Insomnia — table editors, tabbed panels, collapsible sections
- The existing PostmanClone React app (Electron + Zustand + CSS custom properties)

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | url-bar-composition | How should the method selector and URL input sit together? | A | [layout, toolbar, url] |
| 002 | request-section-grouping | How are params, headers, auth, and body modes organized? | C | [layout, tabs, navigation] |
| 003 | body-editor-area | How does the body editor integrate with other request sections? | A | [body, editor, layout] |
| 004 | variable-editor | How should env and collection variable key/value tables look? | A | [variables, editor, sidebar] |
| 005 | collection-management | How does creating collections and adding requests feel? | A | [collections, sidebar, tree] |
| 006 | database-connection | What does the IntelliJ-style DB connection screen look like? | B | [database, connection, form] |
| 007 | db-table-row-picker | How do users browse tables and pick a row from a connected DB? | D | [database, table, picker, body] |
| 008 | db-body-preview | How is generated JSON from DB rows previewed and accepted into the request body? | null | [database, body, preview, json] |
