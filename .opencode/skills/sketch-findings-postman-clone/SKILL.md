---
name: sketch-findings-postman-clone
description: Validated design decisions, CSS patterns, and visual direction from sketch experiments. Auto-loaded during UI implementation on postman-clone.
---

<context>
## Project: postman-clone

Developer-tool dense Postman/Insomnia-inspired API client for Java Spring developers. Dark theme, method-color-driven accents, compact spacing, monospace fonts where it counts. Colors derive from HTTP method conventions (GET=green, POST=orange, etc.).

Reference points: Postman, Insomnia, IntelliJ IDEA Database tool window. Existing React + Zustand + Electron codebase with CSS custom properties.

Sketch sessions wrapped: 2026-06-05
</context>

<design_direction>
## Overall Direction

**Palette:** Dark (#1a1b1e background, #25262b surface, #373a40 borders). Method colors drive badges and indicators. Accent orange (#f08c00) for primary actions. Blue (#4c9aff) for info/links.

**Typography:** System sans-serif (Inter) for UI controls. JetBrains Mono for code/URLs/values. Tight sizes (10-13px range). Uppercase micro-labels at 10px.

**Spacing:** Compact (4px, 6px, 10px, 14px base scale). Developer-density — every pixel earns its place. No wasted whitespace.

**Layout approach:** Vertical tab strips (002-C) for section navigation. Right-side panels for data browsers (007-D). Attached method badge in URL bar (001-A). Bottom collapsible panels for additional context (010-B).

**Interaction patterns:** Click-to-copy for reference expressions. Inline editing in tables. Auto-fill on row selection. Expand/collapse for data panels. Horizontal step sequence with arrows for chain visualization.
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Request Builder Layout | references/request-builder-layout.md | Attached method badge + vertical tab strip + pill body modes |
| Variables & Collections | references/variables-and-collections.md | Dense table grid for variables, tree sidebar for collections |
| Database Integration | references/database-integration.md | JDBC URL auto-parse, right-side inline-row tree, auto-fill body |
| Chain Requests | references/chain-requests.md | Horizontal step sequence, bottom data panel with step columns |

## Theme

The winning theme file is at `sources/themes/default.css`.

## Source Files

Original sketch HTML files are preserved in `sources/` for complete reference.
</findings_index>

<metadata>
## Processed Sketches

- 001-url-bar-composition (A)
- 002-request-section-grouping (C)
- 003-body-editor-area (A)
- 004-variable-editor (A)
- 005-collection-management (A)
- 006-database-connection (B)
- 007-db-table-row-picker (D)
- 008-db-body-preview (skip)
- 009-chain-overview (A)
- 010-chain-link-builder (B)
</metadata>
