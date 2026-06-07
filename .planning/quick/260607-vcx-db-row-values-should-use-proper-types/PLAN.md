# Quick Task 260607-vcx: DB row values should use proper types

## Description
When generating JSON from a DB row, all values were strings. They should use proper types (number, boolean, string) based on the database column type.

## Root Cause
In `RowToJsonMapper.java:178`, the code was calling `value.toString()` on the normalized value, which converted all types to strings.

## Fix
Use `mapper.valueToTree(value)` to convert the Java object to a proper `JsonNode`, preserving the original type (Integer, Boolean, String, etc.).

## Files
- `helper/src/main/java/com/postmanclone/helper/db/RowToJsonMapper.java`

## Verification
- Build compiles successfully
- JSON output now contains proper types (numbers, booleans) instead of all strings
