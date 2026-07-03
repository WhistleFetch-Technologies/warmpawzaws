# UI Sprint F — Commercial Campaign Management

## Principle

Campaign Management is an **orchestration layer** over existing systems (Promotion Hub, Coupon Management, Notification Engine, Analytics, Settlement). It does **not** duplicate CRUD screens for promotions, coupons, or notifications.

Compare every screen against:
- `/promotions` — Promotion Management
- `/marketing/analytics` — Analytics Dashboard
- `/notification-engine` — Notification Campaigns
- `/policy-center` — Funding presets (Sprint D)

---

## Architecture

```
Marketing → Campaigns (/marketing/campaigns)
  CommercialCampaignHub
    ├── CampaignDashboard (StatCards, status buckets)
    ├── CampaignList (table, search, filter, bulk archive, CSV)
    ├── CampaignTemplateGrid (registry templates)
    ├── CampaignBuilderDialog (8-step wizard)
    └── CampaignDetailsDrawer (tabs: overview, funding, promotions, notifications, analytics, settlement, audit)
```

**Lib:** `apps/admin-web/lib/commercial-campaign/`  
**Hook:** `apps/admin-web/hooks/marketing/useCommercialCampaigns.ts`  
**Components:** `apps/admin-web/components/admin/marketing/campaigns/`

---

## Campaign Flow

1. Admin opens **Marketing → Campaigns**.
2. **Mode gate:** `GET /admin/commercial-campaigns/mode` — if `enabled=false`, show Coming Soon panel.
3. **Create:** Builder wizard → `POST /admin/commercial-campaigns` or `POST .../from-template/:id`.
4. **Orchestrate (publish):** Queue promotions/coupons via Promotion Wizard payloads → `POST .../:id/orchestrate`.
5. **Lifecycle:** `POST .../:id/lifecycle/:status` (draft → review → approved → running, etc.).
6. **Details:** Drawer loads analytics + settlement read-only from Phase 9/7 bridges.

---

## APIs Consumed

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/commercial-campaigns/mode` | Feature flag gate |
| GET | `/admin/commercial-campaigns/registry` | Types + templates |
| GET | `/admin/commercial-campaigns` | List (optional `?status=`) |
| GET | `/admin/commercial-campaigns/:id` | Detail |
| POST | `/admin/commercial-campaigns` | Create draft |
| POST | `/admin/commercial-campaigns/from-template/:templateId` | Template create |
| POST | `/admin/commercial-campaigns/:id/orchestrate` | Link/create promotions & coupons |
| POST | `/admin/commercial-campaigns/:id/lifecycle/:status` | Lifecycle transitions |
| GET | `/admin/commercial-campaigns/:id/analytics` | Phase 9 filtered report |
| GET | `/admin/commercial-campaigns/:id/settlement-attribution` | Phase 7 read-only |
| GET | `/admin/notifications/campaigns` | Link existing notification |
| GET | `/admin/promotions`, `/admin/coupons` | Reference cards only |

No campaign engine, analytics, settlement, or notification logic in UI.

---

## Components Reused

| Component | Source |
|-----------|--------|
| `StatCard` | `components/admin/shared/StatCard.tsx` |
| `MetricTable`, `downloadCsv` | Sprint E analytics |
| `SavingsByMonthChart` | Sprint E Recharts |
| `PromotionWizard`, `PromotionCard`, `CouponCard` | `@warmpawz/promotion-management-ui` |
| `FUNDING_PRESET_SPLITS` | Sprint D `lib/discount-policy/option-registry.ts` |
| `ComingSoonPanel` | Policy Center shared |
| Table / Dialog / Sheet / Tabs | `@warmpawz/ui` |

---

## Files Modified / Added

### New
- `apps/admin-web/app/marketing/campaigns/page.tsx`
- `apps/admin-web/lib/commercial-campaign/types.ts`
- `apps/admin-web/lib/commercial-campaign/commercial-campaign-api.ts`
- `apps/admin-web/hooks/marketing/useCommercialCampaigns.ts`
- `apps/admin-web/components/admin/marketing/campaigns/*` (hub, dashboard, list, builder, drawer, editors)

### Modified
- `packages/shared-types/src/admin-portal-nav.ts` — Campaigns nav item
- `apps/admin-web/components/admin/layout/UnifiedAdminSidebar.tsx` — route + accordion

---

## Campaign Lifecycle

Supported UI transitions (server validates):

`draft` → `review` → `approved` → `scheduled` / `running` → `paused` / `completed` / `cancelled` → `archived`

Status chips: `CampaignStatusBadge` (mirrors Promotion lifecycle styling).

---

## Analytics Integration

- Per-campaign: `GET .../:id/analytics` returns Phase 9 report filtered by linked promotion/coupon IDs.
- If `available: false` (analytics OFF or 403): **Coming Soon** panel.
- Dashboard aggregate revenue/savings: placeholder until list-level aggregate API exists; per-campaign tab shows usage rows.

Requires: `DISCOUNT_ENGINE_V2_ANALYTICS_MODE=AUTHORITATIVE` on Lambda.

---

## Settlement Integration

- `GET .../:id/settlement-attribution` — JSON display only.
- Funding editor reuses Sprint D presets; **never calculates settlement in UI**.

---

## Notification Integration

- Modes: `skip`, `link` (select from `/admin/notifications/campaigns`).
- `create` mode: disabled with Coming Soon (orchestration bridge pending).

---

## Known Limitations

1. **No PUT campaign** — edits after create require clone + new record or lifecycle-only changes.
2. **Attach existing promotion/coupon by ID** — no link-only API; orchestrate creates from wizard payloads.
3. **Campaign audit timeline** — dedicated audit endpoint not exposed; tab shows Coming Soon.
4. **Dashboard revenue/savings totals** — not in list API; use Analytics tab per campaign.
5. **Notification create from campaign** — backend bridge not exposed in orchestrate UI.

---

## Validation Checklist

- [ ] `/marketing/campaigns` loads with engine OFF → Coming Soon
- [ ] Engine SHADOW/AUTHORITATIVE → list + registry load
- [ ] Create from template (flash_sale, weekend, etc.)
- [ ] Builder: audience, funding presets, schedule, notification link
- [ ] Queue promotion/coupon via Promotion Wizard → orchestrate on publish
- [ ] Lifecycle buttons in details drawer
- [ ] Analytics tab with AUTHORITATIVE analytics mode
- [ ] Settlement tab JSON from attribution endpoint
- [ ] Clone campaign pre-fills builder
- [ ] Bulk archive + CSV export
- [ ] Sidebar: Marketing → Campaigns active state
- [ ] Responsive drawer + builder on mobile width

---

## Rollback Strategy

1. Remove nav item from `admin-portal-nav.ts` and sidebar handlers.
2. Delete `app/marketing/campaigns` and `components/.../campaigns/`.
3. No DB or Lambda changes — UI-only sprint.

---

## Dev Testing

```bash
cd apps/admin-web && npm run build
npm run dev:admin   # or npm run dev:admin from root
# Navigate to http://localhost:3000/marketing/campaigns
```

Lambda flags (dev):
- `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE=SHADOW` or `AUTHORITATIVE`
- `DISCOUNT_ENGINE_V2_ANALYTICS_MODE=AUTHORITATIVE` for analytics tab
