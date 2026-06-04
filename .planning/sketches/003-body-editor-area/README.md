---
sketch: 003
name: body-editor-area
question: "How does the body editor integrate with body mode selection and the surrounding tab layout?"
winner: A
tags: [body, editor, layout, modes]
---

# Sketch 003: Body Editor Area

## Design Question
How should the body mode selector (none/raw/form-data/urlencoded/binary), content-type picker, and the editor itself be arranged within the body tab? Builds on the vertical tab strip from sketch 002-C.

## How to View
Open `.planning/sketches/003-body-editor-area/index.html` in a browser.

## Variants
- **A: Pill Bar + Full-Height Editor** — Horizontal pill selector for body modes (Postman-standard). Content-type on separate sub-row. Editor fills remaining vertical space. Familiar, clear labeling.
- **B: Compact Mode Bar** — Mode and content-type on a single thin row. Line numbers in editor. Dropdown instead of pills saves space. Editor dominates the panel.
- **C: Side Mode Selector** — Body modes as a nested vertical strip inside the body panel, mirroring the outer tab pattern from sketch 002. Content-type in editor header. Consistent nesting.

## What to Look For
- Which makes mode switching feel fastest? (none → raw → form-data)
- How discoverable are the modes to a first-time user?
- Editor space: which gives the body editor the most room?
- Consistency with the vertical tab strip pattern from sketch 002
- How does each handle the form-data / urlencoded key-value UI vs the raw JSON editor?
