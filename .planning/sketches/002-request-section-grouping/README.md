---
sketch: 002
name: request-section-grouping
question: "How are params, headers, auth, body, and settings organized below the URL bar?"
winner: C
tags: [layout, tabs, navigation, sections]
---

# Sketch 002: Request Section Grouping

## Design Question
How should the five request sections (Params, Headers, Body, Auth, Settings) be organized? This governs how users navigate between sections and how much content is visible at once.

## How to View
Open `.planning/sketches/002-request-section-grouping/index.html` in a browser.

## Variants
- **A: Horizontal Tabs (Postman-standard)** — One row of tabs below URL bar. Only one section visible at a time. Compact and familiar. Current app uses this pattern.
- **B: Stacked Collapsible Sections (Insomnia-style)** — All sections visible simultaneously as accordions. Expand/collapse in place. Multiple sections open at once. Good for cross-referencing headers with body.
- **C: Vertical Tab Strip** — Tabs on the left side, content on the right. Icon + label + badge per tab. IDE-like navigation. More vertical space for content.

## What to Look For
- Can you cross-reference headers while editing the body?
- Which feels faster for toggling between Params → Body → Headers?
- How does each handle the "mostly I just edit Body" use case?
- Space efficiency — which fits more useful content on screen?
- Does the vertical tab strip (C) justify its horizontal space cost?
