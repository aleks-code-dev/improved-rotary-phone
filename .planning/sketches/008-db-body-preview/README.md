---
sketch: 008
name: db-body-preview
question: "How is generated JSON from DB rows previewed and accepted into the request body?"
winner: skip
tags: [database, body, preview, json, confirmation]
---

# Sketch 008: DB Body Preview & Confirmation

## Design Question
After picking a DB row (sketch 007), how is the generated JSON presented and how does the user confirm, reject, or navigate between rows? This covers the moment between "I picked a row" and "the body is ready to send."

## How to View
Open `.planning/sketches/008-db-body-preview/index.html` in a browser.

## Variants
- **A: Direct Overwrite + Badge** — Body replaces immediately. DB badge in the editor header shows source. Footer with table/row context and column mapping info. User edits freely after. "Pick different row" button to change selection.
- **B: Side-by-Side Diff** — Left pane shows previous body, right shows DB-generated body. Green for added, red for removed, gray for unchanged. "Accept All" / "Reject" buttons. Good when replacing an existing body (PUT/PATCH).
- **C: Toast Confirm + Undo** — Body replaces instantly with a green toast: "Body populated from users row #3" and an Undo button. Footer has row navigation arrows (◀ #3 of 1,203 ▶) to browse adjacent rows. Dismiss toast to clear source indicator.

## What to Look For
- Which confirmation mechanism feels safest? (Badge vs toast vs diff)
- Undo — how important is it to revert a row selection?
- Row browsing (C's ◀ ▶ arrows) — useful for scanning test data?
- Schema mapping visibility — do you need to see which columns mapped to which JSON keys?
- Which pairs best with sketch 007's right-side tree picker?
