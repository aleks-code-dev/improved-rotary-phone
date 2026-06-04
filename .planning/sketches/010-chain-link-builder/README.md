---
sketch: 010
name: chain-link-builder
question: "How does the chain link builder show previous link data and let users reference it?"
winner: B
tags: [chain, builder, data-reference, jsonata]
---

# Sketch 010: Chain Link Builder

## Design Question
When editing a specific chain link (step N), how does the user see and reference data from ALL previous steps (1 through N-1)? The request builder is identical to the main one, but must also expose previous-step response data (body, headers, status, URL params) for use in this step's request.

## How to View
Open `.planning/sketches/010-chain-link-builder/index.html` in a browser.

## Variants
- **A: Right Data Panel** — Builder on left, previous-step data browser on right. Data organized by step. Hover/click to copy reference path (e.g., `$step1.response.body.id`). Matches the DB panel pattern from sketch 007-D.
- **B: Bottom Data Panel** — Builder full-width on top, collapsible data panel below with step response columns. Each column is one previous step. Keeps builder at full width.
- **C: Inline Reference Picker** — No persistent panel. **Pick Data** buttons next to editable fields open a popup showing available data. Click a value to insert the reference expression. Contextual, minimal chrome.

## What to Look For
- Reference expression clarity — can you tell what `$step1.response.body.id` means?
- Which keeps the builder most usable while still showing previous data?
- Consistency with sketch 007-D (right panel pattern)
- How does the chain context (which step, which chain) display?
- Click-to-copy vs type-to-reference — which feels more productive?
