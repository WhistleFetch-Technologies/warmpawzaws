# Warmpawz Pay — Dashboard Admin (Phase A)

Backend-only dashboard metrics for Warmpawz Pay admin.

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/admin/warmpawz-pay/dashboard` | `admin.warmpawz_pay.dashboard.view` or `admin.warmpawz_pay` or `admin.full_access` |

## Feature flags

Both must be enabled (same as catalogue admin):

- `WARMPAWZ_PAY_ENABLED`
- `WARMPAWZ_PAY_ADMIN_ENABLED`

## Phase A metrics

| Metric | Source |
|--------|--------|
| `publishedMerchants` | `COUNT(*)` on `warmpawz_pay_vendor_catalog` where `publish_status = 'published'` |
| `averageDiscountPercent` | Active merchant pricing average from `warmpawz_pay_merchant_pricing` |

## Architecture

```
routes/dashboard-admin.routes.ts
  → handlers/dashboard-get.handler.ts
  → WarmpawzPayDashboardService
  → DashboardMetricsRepository
```

Registered from `handler/index.ts` via `registerWarmpawzPayDashboardAdminRoutes(app)`.
