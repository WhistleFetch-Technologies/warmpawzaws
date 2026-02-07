# Rule Engine – Steps 1–5 Summary

## Completed

- **Step 2 – Deploy:** Backend Lambda and Admin/Customer/Vendor web apps built and deployed to dev via `./scripts/deploy-all.sh dev`. API: `https://rrg9107m3d.execute-api.ap-south-1.amazonaws.com/` (or `api.dev.warmpawz.com`).
- **Step 3 & 4 – Scripts:** `./scripts/verify-rule-engine.sh` (run with `API_URL=...`) and `./scripts/run-migration-090-discovery-rules.sh` for migration.
- **Step 5 – Docs:** Runbook added to `docs/RULE_ENGINE_DISCOVERY_AND_SERVICES_PROPOSAL.md` (§8).

## You Must Do

### Step 1: Run the migration

The `discovery_rules` table and seed data must exist or the rule engine and endpoints (e.g. meal-plans/search) can return 500.

**Option A – Direct DB (e.g. DATABASE_URL):**
```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME" ./scripts/run-migration-090-discovery-rules.sh
```

**Option B – AWS RDS (Secrets Manager):**
```bash
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 090_discovery_rules.sql
```

Then verify:
```sql
SELECT COUNT(*) FROM discovery_rules;
```
You should see multiple rows (seeded rules).

### Step 3: Smoke-test Rule Book (manual)

1. Log in to **Admin** → **Platform Settings** → **Rule Book** tab.
2. Confirm the list shows rules (after Step 1).
3. Add a rule (e.g. role `walker`, key `discovery_radius_km`, value `15`).
4. Edit a rule and save.
5. Deactivate a rule (Delete).

### Step 4: Verify flows

- **Discovery / meal search:** Use customer app or `GET /meal-plans/search?lat=...&lng=...`; change a rule in Rule Book and confirm behaviour (radius/limit) changes.
- **Pharmacy:** Create a pharmacy order; confirm broadcast uses rule (e.g. 5 → 10 → 20 km).
- **Booking:** Confirm min-notice validation uses `booking_min_notice_hours` from rules.

## Verification script

```bash
API_URL=https://rrg9107m3d.execute-api.ap-south-1.amazonaws.com ./scripts/verify-rule-engine.sh
```

- **401** on `/admin/discovery-rules` and `/admin/discovery-rules/keys`: expected without admin token.
- **500** on `/meal-plans/search` or `/health`: often fixed by running **Step 1** (migration) and ensuring DB/env are correct.

## Quick reference

| Item | Location |
|------|----------|
| Migration SQL | `db/migrations/090_discovery_rules.sql` |
| Run migration | `./scripts/run-migration-090-discovery-rules.sh` or `ENVIRONMENT=dev node scripts/run-migration-rds-node.js 090_discovery_rules.sql` |
| Rule Book UI | Admin → Platform Settings → **Rule Book** |
| Verify API | `API_URL=... ./scripts/verify-rule-engine.sh` |
| Proposal & runbook | `docs/RULE_ENGINE_DISCOVERY_AND_SERVICES_PROPOSAL.md` |
