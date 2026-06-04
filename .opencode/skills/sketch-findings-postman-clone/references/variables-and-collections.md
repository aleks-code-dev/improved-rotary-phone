# Variables & Collections

## Design Decisions

### Variable Editor: Dense Table Grid (004-A)
Inline-editable table with columns: Variable name, Initial value, Current value, Type, Scope, Secret toggle. Environment switcher dropdown in the panel header. Scope shown as colored badges (env=blue, coll=orange, global=green). Secret type showed as masked dots with a checkbox toggle. Bulk export toolbar at bottom with JSON copy button.

**Key properties:** Table with minimal padding (`3px 6px`), inputs `border: 1px solid transparent` — shows border only on focus. Secret inputs: `-webkit-text-security: disc`.

### Collection Management: Tree Sidebar (005-A)
Expandable tree nodes in a sidebar. Collections as top-level nodes with chevron expand/collapse. Requests as leaf items with method-color badges (GET/POST/etc.). Inline creation with Enter to confirm. Search filter at top. Active collection highlighted. Request items show method badge + name.

**Key properties:** Tree items: `padding: 4px var(--space-2)`, `border-radius: var(--radius-1)`. Method badges on items: `font-size: 9px`, colored background. Expand chevron: `transform: rotate(90deg)` on expanded.

## CSS Patterns
- Scope badges use semi-transparent backgrounds: `rgba(color, 0.15)` background, solid text color
- Tree nodes use chevron rotation for expand/collapse animation
- Secret input masking via CSS `-webkit-text-security: disc` (not type=password which adds browser chrome)
- Inline creation uses `border: 1px dashed` for the "+" placeholder before confirming

## HTML Structures
- Variable table: standard `<table>` with `<thead>` for column headers, `<tbody>` for data rows
- Collection tree: nested `<div>` nodes with `padding-left` indentation per nesting level
- Inline creation: `<input>` with Enter handler, Create/Cancel buttons

## What to Avoid
- Card-list variable display (004-B) — rejected. Table grid (A) is denser and scales to many variables.
- Collection table + detail panel (005-B), breadcrumb navigation (005-C) — rejected. Tree sidebar (A) matches Postman expectations.

## Origin
Synthesized from sketches: 004, 005
Source files available in: sources/004-sketch/, sources/005-sketch/
