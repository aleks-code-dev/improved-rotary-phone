# Quick Task 20260607-fk-lookup: FK Lookup Button in Body Editor

**Description:** When a request body JSON has a foreign key field (e.g. `categoryId`, `product_id`), show a lookup button at the end of that line in the editor. Clicking it opens a dialog with a search bar (pre-filled with snake_case derived from the FK name, e.g. `categoryId` → `category`) and a list of DB tables that match the search.

**Created:** 2026-06-07

## Task 1: Create FkLookupDialog component

**Files:**
- `src/renderer/components/Database/FkLookupDialog.tsx` (new)

**Action:** Create a modal dialog component that:
1. Takes props: `isOpen`, `onClose`, `onSelectRow`, `connectionId`, `searchTerm`, `tables`
2. Shows a search input pre-filled with the snake_case search term
3. Shows a scrollable list of DB table names filtered by the search term
4. When a table is clicked, loads its rows via `window.api.db.fetchRows`
5. Shows rows in a compact table; clicking a row calls `onSelectRow(row)`
6. Styled with the project's CSS variables (dark theme, mono font)

**Verify:** Component renders without errors, search filters tables, row selection works

**Done:** Component created with full dialog UI

## Task 2: Add FK detection + button overlay to BodyTab

**Files:**
- `src/renderer/components/RequestEditor/BodyTab.tsx` (modify)
- `src/renderer/lib/fkDetect.ts` (new — utility)

**Action:**
1. Create `fkDetect.ts` with a function `isFkField(key: string): boolean` that detects foreign key patterns:
   - Ends with `Id` (camelCase): `categoryId`, `userId`
   - Ends with `_id` (snake_case): `category_id`, `user_id`
2. Create `toSnakeCaseFk(key: string): string` that derives the search term:
   - `categoryId` → `category`
   - `product_id` → `product`
   - Strip `_id` suffix, convert to snake_case
3. In `BodyTab.tsx`, when body is `raw` + `application/json`:
   - Parse the JSON body to find all root-level keys
   - For each key where `isFkField(key)` is true, render a small FK lookup button in the toolbar (next to Format/Generate buttons)
   - Button shows the field name + 🔍 icon
   - Clicking opens `FkLookupDialog` with the derived search term
4. When a row is selected from the dialog, update the JSON body value for that FK field with the row's primary key or first column value

**Verify:** FK fields detected correctly, button appears, dialog opens with correct search, selection updates body

**Done:** FK detection works, button renders, dialog integrates with body editor

## Task 3: Wire connection state + polish

**Files:**
- `src/renderer/components/RequestEditor/BodyTab.tsx` (modify)

**Action:**
1. Pass `selectedConnectionId` from `useDbSelection` to the FK lookup flow
2. If no DB connection is selected, show tooltip "Connect to a DB first" on FK buttons
3. Load table list from `window.api.db.listTables` when dialog opens
4. Handle empty state (no tables, no matching tables)
5. Ensure dialog is keyboard-accessible (Escape to close)

**Verify:** Works with/without DB connection, empty states handled, keyboard nav works

**Done:** Full integration complete, edge cases handled
