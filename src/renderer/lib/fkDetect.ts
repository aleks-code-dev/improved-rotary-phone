/**
 * Detects foreign key field patterns in JSON body keys.
 * Supports: camelCase ending with `Id` (e.g. categoryId) and
 * snake_case ending with `_id` (e.g. product_id).
 */
export function isFkField(key: string): boolean {
  return /Id$/.test(key) || /_id$/.test(key);
}

/**
 * Converts a FK field name to a snake_case search term by stripping the
 * `Id` / `_id` suffix and converting the remainder to snake_case.
 *
 * Examples:
 *   categoryId   → category
 *   product_id   → product
 *   userId       → user
 *   user_name_id → user_name
 */
export function toSnakeCaseFk(key: string): string {
  let base: string;
  if (key.endsWith('_id')) {
    base = key.slice(0, -3);
  } else if (key.endsWith('Id')) {
    base = key.slice(0, -2);
  } else {
    return key;
  }
  // Convert camelCase to snake_case, then lowercase
  return base
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/__/g, '_');
}
