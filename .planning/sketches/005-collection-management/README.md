---
sketch: 005
name: collection-management
question: "How does creating collections and adding requests feel?"
winner: A
tags: [collections, sidebar, tree, navigation]
---

# Sketch 005: Collection Management

## Design Question
How should collections be organized — created, expanded, searched — and how should requests be added to them? This is the sidebar/navigation surface alongside the request builder.

## How to View
Open `.planning/sketches/005-collection-management/index.html` in a browser.

## Variants
- **A: Tree Sidebar (Postman-standard)** — Expandable tree nodes in a sidebar. Inline creation. Method-colored leaf items. Search filter. Active collection highlighted. Current app uses this pattern.
- **B: Table List + Detail Panel** — Collections as flat table rows. Click to reveal requests in detail pane. Good for managing many collections at a glance. Structured metadata visible (count, last modified).
- **C: Breadcrumb + Flat List** — Breadcrumb nav for collection context. Flat searchable request list. Fast for finding requests by name or URL across collections. Collection switcher dropdown.

## What to Look For
- Creating a collection — which feels most natural?
- Finding a specific request fast — scroll vs search vs filter?
- Managing 3 collections vs 20 — which scales?
- Visual density — which fits best alongside the request builder?
- Request preview (method + URL) — which renders it most scannably?
