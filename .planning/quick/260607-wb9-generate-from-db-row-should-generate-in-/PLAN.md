# Quick Task 260607-wb9: Generate from DB row should generate in camelCase

## Description
When generating JSON from a DB row without an explicit column mapping, the output should use camelCase field names instead of snake_case.

## Root Cause
In `RowToJsonMapper.java`, the auto-mapping logic was mapping DB columns to themselves (same name), keeping snake_case. The `ColumnFieldNameMatcher.snakeToCamel()` utility already exists but wasn't being used.

## Fix
Change the auto-mapping in `RowToJsonMapper.mapRow()` to convert snake_case DB column names to camelCase using the existing `snakeToCamel()` method.

## Files
- `helper/src/main/java/com/postmanclone/helper/db/RowToJsonMapper.java` (line 165)

## Verification
- Build the helper and verify JSON output uses camelCase keys when mapping DB rows
