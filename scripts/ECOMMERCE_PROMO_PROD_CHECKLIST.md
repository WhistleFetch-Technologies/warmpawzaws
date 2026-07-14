# Ecommerce / Discount Engine — Dev inventory & Prod readiness

**Do not treat this as a deploy checklist for apps.** App code was not promoted to prod from this workstream yet.

Region: `ap-south-1`

| | Dev | Prod |
|---|-----|------|
| API | `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com` | `https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com` |
| Lambda | `warmpawz-dev-api-handler` | `warmpawz-prod-api-handler` |
| Customer | `dev.customer.warmpawz.com` | `dg69gqp2frh39.cloudfront.net` / customer.warmpawz.com |
| Vendor | `dev.vendor.warmpawz.com` | `d1y5ywletev82x.cloudfront.net` |
| Admin | `dev.admin.warmpawz.com` | `dbr09zyoq9akb.cloudfront.net` / admin.warmpawz.com |

---

## 1. Migration files (Discount / promotions / settlement)

Apply via Data API when the machine cannot reach the cluster endpoint:

```bash
# Full promotion engine batch (includes commercial 1046)
node scripts/run-promotion-engine-migrations-prod.js

# Discount Engine V2 + domain columns (1067–1071)
ENVIRONMENT=prod node scripts/run-discount-engine-migrations-rds-data-api.js

# Schema presence check (read-only)
ENVIRONMENT=prod node scripts/check-ecommerce-promo-schema-data-api.js
```

| File | Purpose |
|------|---------|
| `db/migrations/204_create_vendor_promotions.sql` | Vendor promotions foundation |
| `db/migrations/1030_create_service_promotions.sql` | Service promos (related) |
| `db/migrations/1046_commercial_discount_campaigns.sql` | Commercial campaigns tables |
| `db/migrations/1050_*` … `1057_*` | Order/promo glue (as used on dev) |
| `db/migrations/1055_order_promotion_columns.sql` | `orders` promo columns |
| `db/migrations/1063_ecommerce_admin_promotions.sql` | Platform ecommerce promos |
| `db/migrations/1064_ecommerce_order_settlements.sql` | Settlement rows |
| `db/migrations/1067_vendor_earnings_settlement_metadata.sql` | earnings metadata |
| `db/migrations/1068_discount_policy_center_v2.sql` | Policy center |
| `db/migrations/1069_coupons_service_targeting.sql` | Coupon targeting |
| `db/migrations/1070_promotions_coupons_discount_domain.sql` | discount_domain |
| `db/migrations/1071_commercial_campaigns_discount_domain_budget.sql` | campaign budget_cap / domain |

**Prod status (Data API check):** all expected tables/columns were **already present**. No missing schema inferred. Re-running the idempotent scripts is safe but optional.

---

## 2. Terraform (Lambda env)

| Flag | Dev (`infra/envs/dev/main.tf`) | Prod (`infra/envs/prod/main.tf`) |
|------|--------------------------------|----------------------------------|
| `DISCOUNT_ENGINE_V2_RESOLVER_MODE` | AUTHORITATIVE | **OFF** |
| `DISCOUNT_ENGINE_V2_PRIORITY_MODE` | AUTHORITATIVE | AUTHORITATIVE |
| `DISCOUNT_ENGINE_V2_STACK_MODE` | AUTHORITATIVE | **OFF** |
| `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE` | AUTHORITATIVE | **OFF** |
| `DISCOUNT_ENGINE_V2_ANALYTICS_MODE` | AUTHORITATIVE | **OFF** |
| `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE` | AUTHORITATIVE | **OFF** |
| `FINANCE_FUNDING_AWARE_SETTLEMENT` | (dev may set SHADOW) | not forced ON in prod tf |
| `UAT_MODE` | true | **false** |
| `COMMERCIAL_AI_COPILOT_ENABLED` | (dev) | false |

**Do not** flip prod V2 flags to AUTHORITATIVE without an explicit product decision.

Surgical env sync (no code deploy, matches prod terraform OFF defaults):

```bash
node scripts/apply-prod-discount-engine-env.js --dry-run
node scripts/apply-prod-discount-engine-env.js
```

**Done (2026-07-14):** Lambda env flags set via the script above. Full `terraform apply` in `infra/envs/prod` was **not** run — plan showed unrelated drift including DynamoDB `analytics_events` destroy and Secrets Manager secret-version replaces. Do not apply a full prod plan for discount flags alone.

---

## 3. Deploy scripts (separate apps)

### Bash (canonical)

| App | Dev | Prod |
|-----|-----|------|
| Lambda | `./scripts/deploy-lambda-direct.sh` | `LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler ./scripts/deploy-lambda-direct.sh` |
| Admin | `./scripts/deploy-admin-web.sh` | `./scripts/deploy-admin-web.sh --prod` |
| Vendor | `./scripts/deploy-vendor-web.sh` | `./scripts/deploy-vendor-web.sh --prod` |
| Customer | `./scripts/deploy-customer-web.sh` | `./scripts/deploy-customer-web.sh --prod` |

### PowerShell wrappers (Windows)

| App | Dev | Prod |
|-----|-----|------|
| Lambda | `scripts/deploy-lambda-dev.ps1` | `scripts/deploy-lambda-prod.ps1` |
| Admin | `scripts/devWebDeploy/deploy-admin-web-dev.ps1` | `scripts/prodWebDeploy/deploy-admin-web-prod.ps1` |
| Vendor | `scripts/devWebDeploy/deploy-vendor-web-dev.ps1` | `scripts/prodWebDeploy/deploy-vendor-web-prod.ps1` |
| Customer | `scripts/devWebDeploy/deploy-customer-web-dev.ps1` | `scripts/prodWebDeploy/deploy-customer-web-prod.ps1` |

There is **no** single combined frontend prod script — use one wrapper per app (same as bash).

---

## 4. Related feature commits (app code — not deployed to prod yet)

Inspect on branch before any prod app deploy:

- Analytics Active + Policy Apply
- Best Offer on coupon select + platform coupon source + vendor commission on discounted taxable
- `max_discount_amount <= 0` = unlimited
