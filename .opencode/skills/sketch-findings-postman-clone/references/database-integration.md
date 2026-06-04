# Database Integration

## Design Decisions

### DB Connection: JDBC URL + Auto-Parse (006-B)
Single JDBC URL input field that auto-parses into driver, host, port, and database read-only fields. Connection name above. Username and password fields below. Power-user mode — most Spring developers know their connection strings. The URL `jdbc:postgresql://host:port/db` serves as the single input, with parsed fields displayed in a grid for verification.

**Key properties:** URL input on dark background (`#0d1117`) with monospace font. Parsed grid: 2-column CSS grid with labels as uppercase text. Password stored via Electron `safeStorage` (OS keychain).

### DB Table/Row Picker: Right Tree + Inline Rows (007-D)
Right-side tree sidebar. Schemas expand to tables, tables expand to show first 10 rows inline. Click a row → bottom detail panel shows all column values, JSON body auto-fills in the editor on the left. DB badge appears in the editor. "Load 10 more" link at bottom of inline row list.

**Key properties:** Tree sidebar on the right (340px), builder on the left. Inline rows: compact, showing row ID + name preview. Detail panel: max-height 180px with sticky header. DB badge: `background: var(--color-primary)`, `border-radius: var(--radius-full)`.

## CSS Patterns
- JDBC URL input mimics code editor: dark background, monospace, border on focus
- Parsed field grid uses `display: grid; grid-template-columns: auto 1fr` for label/value pairs
- Tree inline rows: `display: flex` with small font (10px), truncated text preview
- Row detail panel: sticky header, grid layout for column/value pairs

## HTML Structures
- JDBC URL input with `oninput` handler that parses and updates parsed fields
- Tree sidebar: nested `<div>` nodes with `va-tnode`/`vd-tnode` classes for expand/collapse
- Inline rows: `<div>` list inside tree children, with `onclick` to select and populate body

## What to Avoid
- IntelliJ-style driver cards (006-A) — rejected. URL string + parse (B) is faster for developers.
- Modal table browser (007-C) — rejected. Inline tree (D) keeps context and is one click from row to body.
- Separate body preview confirmation step (008) — skipped. Row click is the accept action in 007-D.

## Origin
Synthesized from sketches: 006, 007
Source files available in: sources/006-sketch/, sources/007-sketch/
