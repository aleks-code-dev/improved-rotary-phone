---
quick_id: 260606-134
slug: scanner-method-not-found
status: complete
---

# Fix: scanner:scan method not found

## Problem

When pointing the app at a Spring project, user gets:
"Method not found: scanner:scan. Check that the project is a valid Spring Boot project with source code accessible on disk."

## Root Cause

The `initialize` handler in `HelperJsonRpcServer.java` had a hardcoded capabilities list with only 3 methods:
- `initialize`
- `helper.ping`
- `classpath:walkDto`

The client validates capabilities before calling methods, so `scanner:scan` was rejected even though the handler existed in the code.

## Fix

1. Updated `initialize` response to declare all 12 capabilities
2. Added `continue` after `initialize` write to prevent double-writes to stdout

## Files Modified

- `helper/src/main/java/com/postmanclone/helper/HelperJsonRpcServer.java`
- `resources/helper/postmanclone-helper.jar` (rebuilt)
