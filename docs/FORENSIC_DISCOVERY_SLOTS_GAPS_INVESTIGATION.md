# Forensic Investigation: Discovery & Slots Gaps (New Vendor Visibility)

**Date:** 2026-02-06  
**Focus:** New vendors, discovery, and slots in service booking — validate reported gaps and impact.

---

## Summary: What’s True vs Needs Nuance

| # | Claim | Verdict | Evidence (file:line) |
|---|--------|--------|------------------------|
| 1 | **discover-services vs vendors/search** — search doesn’t enforce publish_status or rulebook | **TRUE** | service-discovery.ts:2156–2210 |
| 2 | **at_home/tele** — when roleId/category present, “exists service” is not style-strict | **TRUE** | service-discovery.ts:567–582 |
| 3 | **GET /customer/services** — uses services as base, catalog vendor_services can be missing | **TRUE** | service-discovery.ts:239–251, 276–286 |
| 4 | **discover-staff** requires roleId; BookingFlow doesn’t send it | **TRUE** | staff.ts:60–62; BookingFlow.tsx:404–418 |
| 5 | **discover-staff** doesn’t resolve vendor identity (vendorId used as-is) | **TRUE** | staff.ts:105–108 |
| 6 | **GET /vendor/available-slots** (reschedule) uses only service_style, not service_styles[] | **TRUE** | followup-reschedule.ts:306–313 |
| 7 | **Vendor photo** — profile writes profile_photo_url, discovery uses profile_image | **TRUE** | vendor-profile.ts:460,492; service-discovery.ts:1224–1225, etc. |
| 8 | **Brand frame UI** (BookingFlow vs ServiceDashboardHeader) | Not investigated (UI only) | — |

---

## 1. Discovery Paths Inconsistent (New Vendor Impact: HIGH)

### 1.1 GET /customer/discover-services

- Enforces **publish_status = 'published'** (and role/radius/rulebook where applicable).
- Uses rulebook distance for at_center; at_home uses vendor radius / rulebook.
- **New vendors:** Show only if they have at least one **published** vendor_service and pass role/distance.

### 1.2 GET /customer/vendors/search

- **No publish_status** in the main filter or in the EXISTS for serviceStyle:
  - `EXISTS (SELECT 1 FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.service_style = $n AND vs.is_enabled = true)` (lines 2177, 2182).
- **No rulebook radius** — no distance/radius filter; ordering is `ORDER BY v.created_at DESC`.
- **Effect:** Fallback or search can return vendors with only draft/unpublished or disabled services, or outside the rule radius. New vendors can “show up” in search but not in discover-services, or the reverse, and search can show vendors with no bookable services.

**Recommendation:** Add `AND vs.publish_status = 'published'` to the EXISTS in `/customer/vendors/search` when filtering by serviceStyle. Optionally apply the same rulebook/radius logic as discover-services if this path is used for the same discovery use case.

---

## 2. At-Home/Tele Discovery Not Style-Strict (Impact: MEDIUM)

In **discover-services** for at_home/tele, when **roleId/category** is set (targetRolesLower.length > 0), the EXISTS clause is:

- “At least one **published** vendor_service” — **no** `vs.service_style = requestedStyle`.

So a vendor with only **at_center** published services can still satisfy the EXISTS and appear in **at_home/tele** lists. They will then have no at_home/tele slots and look “broken” (show but no services/slots).

**Location:** service-discovery.ts:567–582 (existsServiceClause when targetRolesLower.length > 0).

**Recommendation:** When category/roleId is present and serviceStyle is at_home or tele, add `AND vs.service_style = $style` (or equivalent) to the EXISTS so only vendors with that style appear.

---

## 3. GET /customer/services and Catalog (Impact: HIGH for Catalog-Only Vendors)

**GET /customer/services** (service-discovery.ts:222–310):

- Builds vendor list with `EXISTS (vendor_services … publish_status = 'published')` ✅
- For each vendor, services are loaded with:
  - `FROM services s LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1`
- So the **base table is `services`**; only vendor_services rows whose **service_id = services.id** are joined.

**Consequence:** If a vendor only has vendor_services rows whose **service_id** points to **service_catalog.id** (catalog-origin services), there is no matching **services.id**, so the join returns no rows and the vendor gets an **empty service list** in this endpoint.

**Note:** **GET /customer/vendor/:vendorId/services** (used for booking) uses **vendor_services** as the base and LEFT JOINs both **services** and **service_catalog** (lines 1976–1984), so catalog-origin services **do** show there. The gap is specific to **GET /customer/services** (the flat list).

**Recommendation:** Either:
- Deprecate or narrow use of **GET /customer/services** in booking flows, and use discover-services + **GET /customer/vendor/:id/services** for “vendor + services”, or
- Refactor **GET /customer/services** to base services on **vendor_services** (and optionally join services/service_catalog for names/details) so catalog-origin services are included.

---

## 4. Staff Discovery: roleId Required + No Vendor Resolution (Impact: HIGH for Home Services)

### 4.1 roleId required

- **GET /customer/discover-staff** returns **400** if `roleId` is missing (staff.ts:60–62).
- **BookingFlow.tsx** calls it with: serviceId, serviceStyle: 'at_home', date, time, customerId, latitude, longitude — **no roleId** (lines 404–418).
- So the request gets **400**, staff list is empty, and home-service staff selection and commute info fail silently in that flow.

**Recommendation:** Make roleId optional when **vendorId** (or serviceId) is present: derive role from vendor or service, or accept a minimal response without role filter. Alternatively, ensure BookingFlow (and any caller) sends roleId when calling discover-staff.

### 4.2 Vendor identity not resolved

- **discover-staff** filters with `s.vendor_id = $vendorId` (staff.ts:105–108); **vendorId** is used as given.
- If the UI passes **vendor_identity.id** and staff rows have **vendor_id = vendors.id**, the filter returns no rows.
- **Recommendation:** Resolve **vendorId** with **resolveVendorById** (or equivalent) and use the resolved **vendors.id** (and optionally include vendor_identity ids in the lookup) so that both vendor id and vendor_identity id work.

---

## 5. Reschedule Slots: service_style Only (Impact: MEDIUM)

**GET /vendor/available-slots** (followup-reschedule.ts:306–313):

- Filters **vendor_availability_v2** with `service_style = $3` only.
- It does **not** use **service_styles[]** (array column used in advanced availability).

So if availability is stored only in **service_styles[]** (or a different style convention), this endpoint returns no slots even when the customer-facing **GET /customer/vendor/:id/available-slots** returns slots (that one already supports service_styles + availabilityIds).

**Recommendation:** Align with customer slots: use the same availability resolution (e.g. **getVendorIdsForAvailabilityLookup**, and match either **service_style** or **service_styles[]**), or delegate to the same logic as **GET /customer/vendor/:id/available-slots** so reschedule sees the same slots as the customer.

---

## 6. Vendor Photo in Discovery (Impact: LOW – Data Richness)

- **Vendor profile upload** (vendor-profile.ts) writes **profile_photo_url** (e.g. 460, 492).
- **Discovery** (service-discovery.ts) exposes vendor photo as **profile_image** and **logo_url** (e.g. 1224–1225: `vendor.profile_image || vendor.logo_url`), and does not read **profile_photo_url**.

If **vendors** has both columns and only **profile_photo_url** is updated, discovery will show no photo until **profile_image** (or **logo_url**) is set.

**Recommendation:** In discovery (and any customer-facing vendor payload), use  
`COALESCE(v.profile_photo_url, v.profile_image, v.logo_url)` (and equivalent in JS) so the latest upload is shown.

---

## 7. What Matters Most for “New Vendors, Discovery, Slots”

For **new vendors** to be discoverable and bookable with slots:

1. **Use one primary discovery path** (e.g. **discover-services**) and ensure any fallback (**vendors/search**) applies the same **publish_status** (and ideally rulebook/radius) so vendors don’t appear in one place and vanish in another.
2. **Enforce style in at_home/tele** so only vendors with that service style appear, avoiding “shows but no services/slots”.
3. **Avoid empty service lists:** Prefer **GET /customer/vendor/:id/services** (and discover-services) over **GET /customer/services** for booking; or fix **/customer/services** to include catalog-origin vendor_services.
4. **Staff discovery:** Make **roleId** optional when vendor/service context is present, and **resolve vendorId** so vendor_identity.id works; this fixes home-service staff and commute.
5. **Reschedule:** Align **GET /vendor/available-slots** with customer slots (service_styles[] + same vendor resolution) so reschedule sees the same slots.
6. **Photos:** Use **profile_photo_url** in discovery (e.g. COALESCE with profile_image/logo_url) so new uploads show on cards.

Implementing 1–5 directly addresses “vendors show in some flows and vanish in others” and “show but have no services/slots”; 6 improves consistency of vendor data on cards.
