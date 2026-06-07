---
quick_id: 260607-vcx
status: complete
---

# Quick Task 260607-vcx: DB row values should use proper types

## Summary
Fixed `RowToJsonMapper.java` to preserve proper JSON types when generating from DB rows.

## Changes
- `helper/src/main/java/com/postmanclone/helper/db/RowToJsonMapper.java:176-178` — Changed from `bodyNode.put(dtoField, value.toString())` to `bodyNode.set(dtoField, mapper.valueToTree(value))` to preserve Integer, Boolean, and other native types.

## Result
JSON output now contains proper types:
- `"age": 25` instead of `"age": "25"`
- `"active": true` instead of `"active": "true"`
- `"name": "John"` (strings remain strings)
