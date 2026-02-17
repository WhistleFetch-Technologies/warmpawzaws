# Admin ↔ Customer App: North/South Bound Integration Map

**360° reference**: What admin configures (southbound) flows to storage and is read by the customer app (northbound). Use **customer** endpoints in the customer app; use **admin** endpoints in the admin app. Avoid duplicate or legacy paths.

---

## 1. Banners (Home carousel)

| Direction   | App     | Endpoint(s) | Storage        |
|------------|--------|-------------|----------------|
| Southbound | Admin  | `GET/POST/PUT/DELETE /admin/banners` | `banners` table |
| Northbound | Customer | `GET /customer/banners?position=home_top&limit=5` | same `banners` |
| Track      | Customer | `POST /banners/:id/click` | `banner_clicks` + `banners.click_count` |

**Canonical**: Admin → `/admin/banners`; Customer → `/customer/banners`. Click → `/banners/:id/click`.

---

## 2. Announcements (What’s New)

| Direction   | App     | Endpoint(s) | Storage             |
|------------|--------|-------------|---------------------|
| Southbound | Admin  | `PUT /admin/platform-settings` body `{ settingKey: "home_announcements", settingValue: [...] }` | `platform_settings` (key `home_announcements`) |
| Northbound | Customer | `GET /customer/announcements?limit=3` | same `platform_settings` |

**Canonical**: Admin loads via `GET /admin/platform-settings?key=home_announcements`; Customer uses only `GET /customer/announcements`.

---

## 3. Promotions (Active promos, checkout)

| Direction   | App     | Endpoint(s) | Storage          |
|------------|--------|-------------|------------------|
| Southbound | Admin  | `GET/POST/PUT/DELETE /marketing/promotions` (or `/admin/promotions` where wired) | `promotions` table |
| Northbound | Customer | `GET /promotions/active` | same `promotions` |
| Apply      | Customer | `POST /promotions/apply`, `POST /coupons/apply` | - |
| Track      | Customer | `POST /promotions/:id/click` | promotion analytics |

**Canonical**: Customer home/payment uses `GET /promotions/active` and `POST /promotions/apply`; admin uses `/marketing/promotions` for CRUD.

---

## 4. Spotlights / Featured vendors (Home “Featured”)

| Direction   | App     | Endpoint(s) | Storage             |
|------------|--------|-------------|---------------------|
| Southbound | Admin  | `GET/POST/DELETE /marketing/spotlights` | `spotlight_offers` table |
| Northbound | Customer | `GET /customer/featured-vendors?limit=6` | same `spotlight_offers` |

**Canonical**: Admin → `/marketing/spotlights`; Customer → `/customer/featured-vendors` only.

---

## 5. Content / Articles (Home “Tips” / articles)

| Direction   | App     | Endpoint(s) | Storage          |
|------------|--------|-------------|------------------|
| Southbound | Admin  | `GET/POST/PUT/DELETE /admin/content/pages` | `content_pages` table |
| Northbound | Customer | `GET /customer/articles?limit=3&featured=true` | same `content_pages` |

**Canonical**: Admin → `/admin/content/pages`; Customer → `/customer/articles`. Categories supported in DB: `legal`, `help`, `marketing`, `other`. Customer API includes `other` so admin-created “other” articles appear on customer home.

---

## 6. Config (Service launch, UI dashboard)

| Direction   | App     | Endpoint(s) | Storage / source   |
|------------|--------|-------------|---------------------|
| Southbound | Admin  | `GET/PUT /config/service-launch`, `GET/PUT /config/ui/dashboard` | service_launch + UI config |
| Northbound | Customer | `GET /config/service-launch/customer?...`, `GET /config/ui/dashboard?roleId=...` | same config |

**Canonical**: Admin configures; customer reads via `/config/service-launch/customer` and `/config/ui/dashboard`.

---

## 7. Discovery / Catalog (Services, vendors)

| Direction   | App     | Endpoint(s) | Storage / source   |
|------------|--------|-------------|---------------------|
| Southbound | Admin  | `GET/POST/PUT/DELETE /admin/service-catalog`, `/admin/catalog/categories` | `service_catalog`, `service_categories` |
| Northbound | Customer | `GET /customer/discover-services?category=...`, `GET /customer/vendor/:id`, `GET /customer/vendor/:id/services` | same catalog + vendor_services |

**Canonical**: Admin manages catalog; customer uses only `/customer/discover-services`, `/customer/vendor/:id`, `/customer/vendor/:id/services` (and related discovery endpoints).

---

## 8. Coupons

| Direction   | App     | Endpoint(s) | Storage     |
|------------|--------|-------------|-------------|
| Southbound | Admin  | `GET/POST/PUT/DELETE /admin/coupons`, `POST /admin/coupons/bulk-generate` | `coupons` table |
| Northbound | Customer | `POST /coupons/apply`, `GET /coupons/validate/:code` | same `coupons` |

**Canonical**: Admin → `/admin/coupons`; Customer apply/validate only.

---

## Duplicate / legacy endpoints to avoid in new code

- Prefer **customer** routes for the customer app: `/customer/banners`, `/customer/articles`, `/customer/announcements`, `/customer/featured-vendors`, `/customer/discover-services`, etc.
- Marketing aliases exist for backward compatibility: `/marketing/banners` → `/customer/banners`, `/marketing/articles` → `/customer/articles`, `/marketing/announcements` → `/customer/announcements`. New customer code should call the `/customer/*` routes directly.

---

## Summary

- **Southbound**: Admin UI → Admin API → DB (banners, platform_settings, promotions, spotlight_offers, content_pages, config, service_catalog, coupons).
- **Northbound**: DB → Customer API → Customer app; customer app must use the **customer** endpoints above so it sees exactly what admin configured.
- One source of truth per entity; no parallel or conflicting implementations for the same data.
