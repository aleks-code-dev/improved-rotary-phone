---
sketch: 009
name: chain-overview
question: "How are chains listed, created, and how do users navigate between chain links?"
winner: A
tags: [chain, navigation, links, steps]
---

# Sketch 009: Chain Overview & Navigation

## Design Question
How should request chains be visualized and navigated? Users need to see the sequence of links, add/remove steps, run the chain, and click into individual links to edit them.

## How to View
Open `.planning/sketches/009-chain-overview/index.html` in a browser.

## Variants
- **A: Horizontal Step Sequence** — Connected steps with arrows flowing left→right. Each step shows method, URL, and status. Click to edit. "+" at the end to add. Run Chain button executes all. Good for linear flow visualization.
- **B: Vertical Expandable List** — Each link as an expandable row. Expanded view shows what previous link data this step references (e.g., `$step1.response.body.id → 201`). Detail-rich — good for debugging data flow between steps.
- **C: Tab Bar + Builder** — Chain links as tabs. Active link's full request builder renders below (identical to the main builder). Chain context badge in the header. Familiar tab pattern. "+" adds a new tab.

## What to Look For
- Which makes the flow between steps clearest?
- Running the chain — which has the best "Run Chain" placement?
- Adding/removing steps — which feels most natural?
- How obvious is it which chain you're in?
- Which pairs best with clicking into a link to edit its request?
