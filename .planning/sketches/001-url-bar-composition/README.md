---
sketch: 001
name: url-bar-composition
question: "How should the method selector and URL input sit together?"
winner: A
tags: [layout, toolbar, url]
---

# Sketch 001: URL Bar Composition

## Design Question
How should the HTTP method selector and URL input compose visually? This is the most prominent surface in the request builder — it sets the character of the entire tool.

## How to View
Open `.planning/sketches/001-url-bar-composition/index.html` in a browser.

## Variants
- **A: Attached Badge (Postman-style)** — Colored method badge fused to the URL input in a single control. Click badge to open method picker dropdown. Compact, iconic, familiar.
- **B: Separated Controls** — Method dropdown stands alone with distinct styling. URL has a protocol prefix. Separate Send button group. More horizontal space, clearer visual hierarchy.
- **C: Terminal-Style Single Line** — Freeform single-input where user types `GET https://...`. Method parsed from first token. No dropdown — keyboard-first, curl-like minimalism.

## What to Look For
- Which feels most natural for rapid request construction?
- Scanability at a glance — can you instantly read the method + URL?
- Method switching ergonomics — how easy is it to change GET → POST?
- How does each variant handle the method color convention?
- At 900px vs 375px — which holds up best?
