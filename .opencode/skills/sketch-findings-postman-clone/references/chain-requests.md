# Chain Requests

## Design Decisions

### Chain Overview: Horizontal Step Sequence (009-A)
Connected steps with arrows flowing left→right. Each step card shows: step number, HTTP method badge, URL preview, run status. Click a step to open its request builder. "+" button at the end adds a new step. "Run Chain" button executes all steps in sequence. Chain name and step count in header.

**Key properties:** Step cards: `min-width: 150px`, `border: 2px solid var(--color-border)`. Active step: `border-color: var(--color-primary)`. Arrows between steps: `→` character. Add button: dashed border, matching step dimensions.

### Chain Link Builder: Bottom Data Panel (010-B)
Request builder on top (identical to main builder: method + URL + tabs + body editor). Collapsible data panel below showing previous step responses as columns. Each column = one previous step, showing its response body fields with Copy path buttons. Reference expressions use `$stepN.response.body.field` syntax, highlighted in purple.

**Key properties:** Data panel: collapsible with chevron rotation. Step columns: flex layout with min-width 200px. Reference expressions: `background: rgba(156,60,224,0.2)`, `color: var(--color-method-patch)`.

## CSS Patterns
- Horizontal step sequence: `display: flex` with `overflow-x: auto` for scrolling
- Step arrows: simple text characters with color `var(--color-text-dim)`
- Bottom data panel: `border-top` separator, collapsible with `max-height` transition
- Reference expression highlighting: semi-transparent purple background + bold purple text

## HTML Structures
- Step sequence: `<div>` flex row with step cards, arrow spans, and add button
- Chain context bar: colored top bar with chain badge + step indicator
- Bottom data panel: collapsible `<div>` with step columns in a flex row

## What to Avoid
- Vertical expandable chain list (009-B) — rejected. Horizontal steps (A) better visualize data flow.
- Tab bar chain navigation (009-C) — rejected. Steps with arrows are clearer for sequence.
- Right-side data panel (010-A) — rejected. Bottom panel (B) keeps builder full-width.

## Origin
Synthesized from sketches: 009, 010
Source files available in: sources/009-sketch/, sources/010-sketch/
