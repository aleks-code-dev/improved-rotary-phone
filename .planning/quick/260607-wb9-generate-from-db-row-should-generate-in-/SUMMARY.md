---
quick_id: 260607-wb9
status: complete
---

# Quick Task 260607-wb9: Generate from DB row should generate in camelCase

## Summary
Fixed `RowToJsonMapper.java` to use camelCase field names when auto-mapping DB columns without an explicit mapping.

## Changes
- `helper/src/main/java/com/postmanclone/helper/db/RowToJsonMapper.java:165` — Changed auto-mapping from `dbCol` (snake_case) to `ColumnFieldNameMatcher.snakeToCamel(dbCol)` (camelCase)

## Result
When generating a request body from a DB row, the JSON keys will now be in camelCase (e.g., `userName` instead of `user_name`).
