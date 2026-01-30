# Full Migration: Service Style & Service Type

**Scope:** Rule engine scoped by **service_style** (at_home, at_center, tele) and **service_type** (grooming, training, veterinary, etc.) in addition to role and flow.

---

## 1. What’s Included

| Layer | What changed |
|-------|------------------|
| **DB** | `discovery_rules` gets `service_style`, `service_type`; unique constraint updated to include them; partial indexes added. |
| **Rule engine** | `getDiscoveryRules(roleId, flow?, serviceStyle?, serviceType?)` with resolution: defaults → role 'all' → role + style (+ type). |
| **Admin API** | GET/POST/PUT discovery-rules support filter and body fields `service_style`, `service_type`; keys API returns `unit` per key. |
| **Rule Book UI** | Attribute column (from keys); Service style & Service type filters, table columns, and Add/Edit form fields. |
| **Discovery** | `/customer/services/by-style` passes `serviceStyle` and `category` into `getDiscoveryRules`. |

---

## 2. Running the DB Migration (091)

**Prerequisite:** Migration 090 (discovery_rules table) must already be applied.

### Option A – AWS RDS (Secrets Manager)

```bash
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 091_discovery_rules_service_style_type.sql
```

Or:

```bash
ENVIRONMENT=dev ./scripts/run-migration-091-discovery-rules-service-style-type.sh
```

### Option B – Direct connection (DATABASE_URL)

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/run-migration-091-discovery-rules-service-style-type.sh
```

### Option C – psql

```bash
psql "$DATABASE_URL" -f db/migrations/091_discovery_rules_service_style_type.sql
```

### Verify

```sql
-- New columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'discovery_rules' AND column_name IN ('service_style', 'service_type');

-- New unique constraint
SELECT conname FROM pg_constraint
WHERE conrelid = 'discovery_rules'::regclass AND contype = 'u';
-- Expect: discovery_rules_role_key_flow_city_style_type_key
```

---

## 3. Files Touched

- **Migration:** `db/migrations/091_discovery_rules_service_style_type.sql`
- **Run script:** `scripts/run-migration-091-discovery-rules-service-style-type.sh`
- **Rule engine:** `backend/lambda/src/lib/rule-engine.ts`
- **Admin API:** `backend/lambda/src/endpoints/discovery-rules-admin.ts`
- **Rule Book UI:** `apps/admin-web/.../ruleBook/DiscoveryRulesManager.tsx`
- **Discovery:** `backend/lambda/src/endpoints/service-discovery.ts` (by-style only)

---

## 4. Resolution Order (Rule Engine)

When `getDiscoveryRules(roleId, flow, serviceStyle?, serviceType?)` is called:

1. Start from platform defaults.
2. Apply rules with `role_id = 'all'`, no style, no type.
3. Apply rules with `role_id = 'all'` + matching `service_style` (+ optional `service_type`).
4. Apply rules with the given `role_id`, no style, no type.
5. Apply rules with the given `role_id` + matching `service_style` (+ optional `service_type`).

Later rows override earlier (more specific overrides less specific).

---

## 5. Forensic Verification

Strict code-level checks:

```bash
node scripts/forensic-verification-rule-engine.js
```

See: `docs/FORENSIC_VERIFICATION_RULE_ENGINE.md`.
