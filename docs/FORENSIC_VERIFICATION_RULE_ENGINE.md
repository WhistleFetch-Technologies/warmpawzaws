# Forensic Verification: Rule Engine (Attribute + Service Style/Type)

**Date:** 2026-01-30  
**Scope:** Strict code-level verification of rule engine attribute column, keys API `unit`, and full migration for `service_style` / `service_type`. No lines skipped.

---

## 1. Verification Script

Run:

```bash
node scripts/forensic-verification-rule-engine.js
```

Exit code 0 = all checks passed; exit code 1 = one or more failures.

---

## 2. Checks Performed (38 total)

### 2.1 Migration 091 (`db/migrations/091_discovery_rules_service_style_type.sql`)

| Check | What is verified |
|-------|------------------|
| `MIGRATION_091_EXISTS` | File exists |
| `MIGRATION_091_SERVICE_STYLE_COL` | `ADD COLUMN IF NOT EXISTS service_style TEXT NOT NULL DEFAULT ''` |
| `MIGRATION_091_SERVICE_TYPE_COL` | `ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT ''` |
| `MIGRATION_091_DROP_CONSTRAINT` | `DROP CONSTRAINT IF EXISTS discovery_rules_role_id_rule_key_applies_to_flow_city_key` |
| `MIGRATION_091_NEW_CONSTRAINT` | New unique constraint name `discovery_rules_role_key_flow_city_style_type_key` |
| `MIGRATION_091_UNIQUE_COLS` | `UNIQUE (role_id, rule_key, applies_to_flow, city, service_style, service_type)` |
| `MIGRATION_091_INDEXES` | Partial indexes on `service_style` and `service_type` |

### 2.2 Rule Engine (`backend/lambda/src/lib/rule-engine.ts`)

| Check | What is verified |
|-------|------------------|
| `RULE_ENGINE_SIGNATURE` | `getDiscoveryRules(roleId, flow?, serviceStyle?, serviceType?)` |
| `RULE_ENGINE_STYLE_NORMALIZE` | `const style = (serviceStyle && serviceStyle.trim()) \|\| ''` |
| `RULE_ENGINE_TYPE_NORMALIZE` | `const type = (serviceType && serviceType.trim()) \|\| ''` |
| `RULE_ENGINE_WHERE_STYLE` | WHERE clause for `service_style` (empty or match $3) |
| `RULE_ENGINE_WHERE_TYPE` | WHERE clause for `service_type` (empty or match $4) |
| `RULE_ENGINE_ORDER` | ORDER BY specificity (role 'all' first, then empty style/type) |
| `RULE_ENGINE_PARAMS` | Params `[roleId, flow \|\| '', style, type]` |
| `RULE_ENGINE_LOOP` | `extractRuleValue(row.rule_value)` and `(result as any)[key] = val` |
| `RULE_ENGINE_GET_RULE_NUMBER_ARGS` | `getRuleNumber` / `getRuleNumberArray` accept optional `serviceStyle`, `serviceType` |
| `RULE_ENGINE_GET_RULE_NUMBER_CALL` | Both call `getDiscoveryRules(roleId, flow, serviceStyle, serviceType)` |

### 2.3 Admin API (`backend/lambda/src/endpoints/discovery-rules-admin.ts`)

| Check | What is verified |
|-------|------------------|
| `ADMIN_GET_QUERY_STYLE` | GET reads `service_style` / `serviceStyle` from query |
| `ADMIN_GET_SELECT` | SELECT includes `service_style`, `service_type` |
| `ADMIN_GET_FILTER_STYLE` | GET filter: `COALESCE(service_style...)` and `service_style = $idx` |
| `ADMIN_GET_FILTER_TYPE` | GET filter for `service_type` |
| `ADMIN_POST_INSERT_COLS` | INSERT columns include `service_style`, `service_type` |
| `ADMIN_POST_CONFLICT` | ON CONFLICT on `(role_id, rule_key, applies_to_flow, city, service_style, service_type)` |
| `ADMIN_POST_NORMALIZE` | `style` / `type` normalized from body |
| `ADMIN_PUT_FIELDS` | PUT handles `service_style`, `service_type` in body |
| `ADMIN_KEYS_UNIT` | GET /keys returns `unit` (e.g. `km`, `minutes`) per key |

### 2.4 Rule Book UI (`apps/admin-web/.../DiscoveryRulesManager.tsx`)

| Check | What is verified |
|-------|------------------|
| `UI_INTERFACE` | `DiscoveryRule` has `service_style?`, `service_type?` |
| `UI_FORM_STATE` | Form state includes `service_style`, `service_type` |
| `UI_FILTER_STATE` | `filterServiceStyle`, `filterServiceType` state |
| `UI_LOAD_PARAMS` | `loadRules` passes `service_style`, `service_type` in URL params |
| `UI_TABLE_HEADERS` | Table has "Service style" and "Service type" headers |
| `UI_TABLE_CELLS` | Table renders `rule.service_style`, `rule.service_type` |
| `UI_ATTRIBUTE_COLUMN` | Attribute column from `attributeForRule(rule, keys)` |
| `UI_FORM_FIELDS` | Add/Edit form has "Service style (optional)" and "Service type (optional)" |
| `UI_SAVE_BODY` | PUT/POST body includes `service_style`, `service_type` |
| `UI_OPEN_EDIT` | `openEdit` sets `form.service_style`, `form.service_type` from rule |
| `UI_VALUE_LABEL_UNIT` | Value label uses key `type` and `unit` from keys API |

### 2.5 Discovery Call Site (`backend/lambda/src/endpoints/service-discovery.ts`)

| Check | What is verified |
|-------|------------------|
| `DISCOVERY_BY_STYLE_CALL` | `/customer/services/by-style` calls `getDiscoveryRules(..., serviceStyle \|\| undefined, category \|\| undefined)` |

---

## 3. Resolution Order (Rule Engine)

1. Platform defaults  
2. Rules with `role_id = 'all'`, no style, no type  
3. Rules with `role_id = 'all'` + matching `service_style` (+ optional `service_type`)  
4. Rules with specific `role_id`, no style, no type  
5. Rules with specific `role_id` + matching `service_style` (+ optional `service_type`)  

More specific rows override less specific (ORDER BY ensures least-specific first).

---

## 4. Files Touched

- `db/migrations/091_discovery_rules_service_style_type.sql`
- `backend/lambda/src/lib/rule-engine.ts`
- `backend/lambda/src/endpoints/discovery-rules-admin.ts`
- `apps/admin-web/components/admin/platform-settings/integrations/ruleBook/DiscoveryRulesManager.tsx`
- `backend/lambda/src/endpoints/service-discovery.ts` (by-style only)

---

## 5. Prerequisite

Migration **091** must be run on the database before the backend uses `service_style` / `service_type` in queries; otherwise the rule engine and admin API will hit "column does not exist" until the migration is applied.
