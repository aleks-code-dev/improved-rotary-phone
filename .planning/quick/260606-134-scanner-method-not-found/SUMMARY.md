---
quick_id: 260606-134
slug: scanner-method-not-found
status: complete
date: 2026-06-06
commit: 8f0354c
---

# Summary: Fix scanner:scan method not found

## What was done

Fixed the `initialize` handler in `HelperJsonRpcServer.java` to declare all 12 capabilities instead of just 3. The missing capabilities caused the client to reject `scanner:scan` calls even though the handler existed.

## Changes

- `HelperJsonRpcServer.java`: Updated `initialize` response capabilities from 3 to 12 methods
- `HelperJsonRpcServer.java`: Added `continue` after `initialize` write to prevent double-writes
- Rebuilt `postmanclone-helper.jar` and copied to `resources/helper/`

## Commit

`8f0354c` — fix(helper): declare all capabilities in initialize response
