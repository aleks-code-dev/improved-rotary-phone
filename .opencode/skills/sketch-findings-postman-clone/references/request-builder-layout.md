# Request Builder Layout

## Design Decisions

### URL Bar: Attached Badge (001-A)
Colored HTTP method badge fused to the URL input in a single compact control. Click badge to open method dropdown. Method color drives badge background (GET=green, POST=orange, PUT=blue, PATCH=purple, DELETE=red). URL field uses monospace font. Send button attached to the right.

**Key properties:** Single border-radius container wrapping method + URL + send. Method badge `min-width: 80px`, `font-weight: 700`. URL input `font-family: var(--font-mono)`.

### Section Navigation: Vertical Tab Strip (002-C)
Tabs on the left side (130px min-width), content on the right. Active tab has left border accent in `var(--color-accent)`. Badges show counts. Each tab: icon + label + count badge. This frees vertical space for deeper content editing.

**Key properties:** `border-left: 2px solid` for active state. Badges: `background: var(--color-primary)`, `border-radius: var(--radius-full)`.

### Body Editor: Pill Bar (003-A)
Horizontal mode pills (none/raw/form-data/urlencoded/binary) at top. Content-type selector on second row for raw mode. Editor fills remaining vertical space below. Mode switching toggles between JSON editor and key/value form UI.

**Key properties:** Mode pills: `border: 1px solid var(--color-border)`, active: `border-color: var(--color-primary)`. Editor background: `#0d1117`.

## CSS Patterns
- All toolbars use `display: flex; align-items: stretch` with single border-radius wrapper
- Method colors map: GET=#2f9e44, POST=#f08c00, PUT=#4c9aff, PATCH=#9c3ce0, DELETE=#e03131
- Vertical tab active indicator: `border-left` accent on the tab strip
- Body editor uses dark code-editor background (`#0d1117`) with syntax-colored JSON keys/values

## HTML Structures
- Toolbar: `<div>` flex row with method badge `<div>`, URL `<input>`, send `<button>`
- Vertical tab strip: `<div>` flex row with `flex-direction: column` for tabs, `<div>` flex:1 for content
- Body pills: horizontal `<div>` with pill buttons, content-type `<select>`, editor `<textarea>`

## What to Avoid
- Horizontal tabs for section navigation (002-A, B) — rejected. Vertical strip (C) won for content depth.
- Separated method+URL controls (001-B) — rejected. Attached badge (A) is more compact and Postman-standard.

## Origin
Synthesized from sketches: 001, 002, 003
Source files available in: sources/001-sketch/, sources/002-sketch/, sources/003-sketch/
