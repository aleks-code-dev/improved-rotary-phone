---
sketch: 007
name: db-table-row-picker
question: "How do users browse tables and pick a row from a connected DB?"
winner: D
tags: [database, table, picker, body, tree]
---

# Sketch 007: DB Table & Row Picker

## Design Question
How should users navigate a connected database — browse schemas, tables, columns, and rows — and select a row whose columns will become the request body JSON? This is the picker surface that feeds into body generation.

## How to View
Open `.planning/sketches/007-db-table-row-picker/index.html` in a browser.

## Variants
- **A: Tree Browser (IntelliJ-style)** — Schemas expand to tables in a sidebar tree. Click a table to see its rows in the detail pane with column headers. Click a row to preview JSON at the bottom. Connection switcher at top. Matches IntelliJ's Database tool window.
- **B: Dropdown Cascade** — Cascading dropdowns: Connection → Schema → Table. Rows appear below in a table with search. Select a row via radio button → JSON preview updates. Compact — could fit inside a sidebar panel.
- **C: Modal Browser** — Full modal dialog overlaying the request builder. Table list on left, row data on right with scrolling/search. "Use Selected Row" button confirms. Good for deep exploration before committing to a row.
- **D: Your Vision (Synthesis)** — Right-side tree sidebar. Expand schema → table → first 10 rows appear inline in the tree. Click a row → bottom panel shows full row data, JSON body auto-fills in the editor on the left. One click from DB to populated body.

## What to Look For
- Navigating schema → table → row: which feels most fluid?
- Column visibility — does the table viewer show enough columns to identify the right row?
- JSON preview — is it clear what the output will be?
- Space trade-off: sidebar (A) vs compact dropdown (B) vs full modal (C)
- How would this feel with 50 tables or 10,000 rows?
