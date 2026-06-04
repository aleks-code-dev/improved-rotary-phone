# Postman v2.1 Collection Fixtures

## Redaction Policy (PITFALLS M-3)

All fixtures in this directory are real Postman v2.1 collection JSONs sourced from public Postman workspaces. Before committing, every fixture was processed through a redaction script that:

1. Strips all `Authorization` header values to `__REDACTED__`
2. Strips all `Cookie` header values to `__REDACTED__`
3. Replaces `api_key`, `access_token`, `password`, and `token` field values with `__REDACTED__`
4. Strips `client_secret` and `client_id` values in OAuth2 configurations to `__REDACTED__`

All other structural content (endpoint URLs, method names, header structures, script text, test assertions, variable scopes) is preserved as-is for accurate round-trip validation.

## Purpose

These fixtures power the `tests/round-trip.test.ts` suite, which asserts that `importPostmanCollection → exportPostmanCollection → importPostmanCollection` produces a structurally equivalent collection for every fixture. This guards against Postman v2.1 format drift and ensures our import/export layer handles all v2.1 features correctly.
