---
sketch: 004
name: variable-editor
question: "How should env and collection variable key/value tables look?"
winner: A
tags: [variables, editor, sidebar, table]
---

# Sketch 004: Variable Editor

## Design Question
How should environment and collection variables be displayed and edited? This covers both the environment switcher (Dev/Staging/Prod) and the variable key/value editor with scope badges, secret masking, and type selection.

## How to View
Open `.planning/sketches/004-variable-editor/index.html` in a browser.

## Variants
- **A: Table Grid (Postman-style)** — Dense inline editing table with columns for name, initial value, current value, type, scope, secret toggle. Environment switcher in header. Bulk export toolbar. Best for many variables.
- **B: Card List** — Each variable as a card with name, scope badge, and field pairs. Better readability for smaller variable sets (~10 or fewer). Hover reveals remove action.
- **C: JSON / Code Editor** — All variables as raw JSON array. Power-user approach. Familar to developers. Matches Postman v2.1 environment format 1:1. Copy/paste between environments.

## What to Look For
- Which feels fastest for editing 5-10 variables?
- How clear is scope (env vs collection vs global) in each variant?
- Secret masking — is it obvious which values are secrets?
- Environment switching (Dev→Staging→Prod) — which makes context clear?
- Which would you prefer when debugging a request with unresolved `{{variables}}`?
