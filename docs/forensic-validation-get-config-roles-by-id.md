# Forensic Validation: GET /config/roles/:roleId

**Date:** 2026-02-02  
**Scope:** Backend fix for role-by-id lookup (DB-only, API contract compliant).  
**File:** `backend/lambda/src/endpoints/roles.ts` — `GetRoleByIdHandler`.

---

## 1. API contract

| Contract | Expectation |
|----------|-------------|
| **GET /config/roles** | List active roles from DB (`roles` table, `is_active = true`). |
| **GET /config/roles/:roleId** | Return a single role from DB by primary key `id` (or by name fallback). No in-memory list matching. |
| **404** | When no role exists for the given `:roleId`. |
| **400** | When `:roleId` is missing or empty after normalization. |

---

## 2. Request path (trace)

| Step | Component | Code / behavior |
|------|-----------|-----------------|
| 1 | Route | `app.get('/config/roles/:roleId', ...)` — Hono binds path param `roleId`. |
| 2 | Event build | `event.pathParameters = { roleId: c.req.param('roleId') }` — param explicitly set (overrides `createApiGatewayEvent`). |
| 3 | Handler | `GetRoleByIdHandler.execute(event, context)` → `handle(handlerContext)` with `context.event.pathParameters`. |
| 4 | Read param | `rawRoleId = context.event.pathParameters?.roleId` — safe if `pathParameters` is undefined. |
| 5 | Normalize | `roleId = normalizeRoleIdFromPath(rawRoleId ?? '')` — trim and strip optional `{ }`. |
| 6 | Validate | `if (!roleId) return this.error('Role ID is required', 400)`. |

**Conclusion:** Path parameter flows correctly from route → event → handler; empty/missing `roleId` yields 400.

---

## 3. Normalization

```ts
function normalizeRoleIdFromPath(roleId: string): string {
  const s = (roleId || '').trim();
  if (s.length >= 38 && s.startsWith('{') && s.endsWith('}')) {
    return s.slice(1, -1).trim();
  }
  return s;
}
```

| Input | Output |
|-------|--------|
| `"af6587d6-ed2f-4785-a625-10f737511049"` | Same (valid UUID). |
| `"  af6587d6-...  "` | Trimmed UUID. |
| `"{af6587d6-ed2f-4785-a625-10f737511049}"` | `af6587d6-ed2f-4785-a625-10f737511049`. |
| `undefined` / `null` | `''` (then 400). |

**Conclusion:** Normalization is correct and does not alter valid UUIDs.

---

## 4. DB lookup (UUID path)

| Step | Code | Validation |
|------|------|------------|
| UUID check | `UUID_REGEX.test(roleId)` | Standard UUID pattern; matches catalog IDs. |
| Query | `SELECT * FROM roles WHERE id = $1::uuid AND is_active = true LIMIT 1` | Parameterized; single placeholder. |
| Param | `[roleId]` | One argument; no SQL injection. |
| Schema | `roles.id UUID PRIMARY KEY` (db/schema.sql) | Column is UUID; `$1::uuid` is correct. |
| Contract | `is_active = true` | Same as list endpoint; only active roles returned. |
| Result | `byId?.rows?.length` then `roles = byId.rows` | Uses pg `QueryResult.rows`; null-safe. |

**Conclusion:** UUID path is correct: single DB query by primary key, active-only, parameterized, schema-aligned.

---

## 5. DB lookup (name fallbacks)

| Fallback | Code | When used |
|----------|------|-----------|
| 1 | `select('roles', { name: roleNameNorm, is_active: true })` | When `roleId` is not a UUID (e.g. role code like `groomer_solo`). |
| 2 | `query('SELECT * FROM roles WHERE LOWER(name) = LOWER($1) AND is_active = true LIMIT 1', [roleId])` | When first name lookup returns no row. |

`select()` builds `WHERE name = $1 AND is_active = $2`; both are from DB. No list-based resolution.

**Conclusion:** Name fallbacks are DB-only and consistent with “by id or by name” contract.

---

## 6. Response and downstream

| Step | Code | Validation |
|------|------|------------|
| Role | `const role = roles[0]` | After at least one successful lookup. |
| Permissions | `select('role_permissions', { role_id: effectiveRoleId })` | `effectiveRoleId = role.id` (DB UUID); `role_id` gets UUID cast in `select()`. |
| Response shape | `success`, `...role`, `roleId`, `roleName`, `roleCode`, `capabilities`, `config`, etc. | Matches existing contract and list-item shape. |
| 404 | `return this.error('Role not found', 404)` | Only when all lookups (id + name) return no row. |

**Conclusion:** Response and permission loading are correct; 404 only when role truly not found in DB.

---

## 7. Edge cases

| Case | Handling |
|------|----------|
| Missing path param | `pathParameters?.roleId` → undefined → `normalizeRoleIdFromPath('')` → `''` → 400. |
| Empty string after trim | `!roleId` → 400. |
| UUID with braces | `normalizeRoleIdFromPath` strips `{ }`. |
| Invalid UUID format | Not matched by `UUID_REGEX` → UUID query skipped → name fallbacks run; if no match → 404. |
| Valid UUID not in DB | Single row query returns 0 rows → name fallbacks (won’t match UUID string) → 404. |
| Inactive role | `AND is_active = true` in UUID query and name query → not returned; 404. |

**Conclusion:** Edge cases are covered; no list-based fallback; 400/404 semantics are correct.

---

## 8. Consistency with GET /config/roles

| Aspect | GET /config/roles | GET /config/roles/:roleId |
|--------|-------------------|----------------------------|
| Table | `roles` | `roles` |
| Active filter | `is_active: true` (default) | `is_active = true` in SQL |
| Lookup | N/A | By `id = $1::uuid` then by name |
| Permissions | Batch `role_permissions` | `select('role_permissions', { role_id })` |
| Response fields | Same normalized shape | Same normalized shape |

**Conclusion:** By-id uses same table, same active filter, and same response contract as the list.

---

## 9. Validation summary

| Check | Status |
|-------|--------|
| Path param flow | OK |
| Normalization | OK |
| UUID query (parameterized, schema-correct) | OK |
| Name fallbacks (DB-only) | OK |
| No list-based resolution | OK |
| 400 for missing/empty roleId | OK |
| 404 only when role not in DB | OK |
| Response shape and permissions | OK |
| Contract alignment with list endpoint | OK |

**Overall:** The fix is validated. GET /config/roles/:roleId resolves roles **only from the DB** (by id then by name), respects the API contract, and does not use any in-memory list matching.

---

## 10. If 404 persists for a given UUID

- **Cause:** That UUID is not present in `roles` for this environment (e.g. different DB, old/stale id in client).
- **Backend:** Correct behavior is 404; no change needed for contract.
- **Client:** Clear stale `vendorRole` in localStorage and/or refetch role from profile so the client uses an id that exists in the current DB (already handled in vendor-web `useVendorCapabilities` fallback and profile fetch).
