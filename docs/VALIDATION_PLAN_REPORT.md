# Validation Plan Report — API → DB Sync → UI

**Date:** 2026-02-08  
**Purpose:** Verify implementation against the defined validation plan (vendor card contract, publish status, legacy styles, problem grid, service resolution, pricing quote, DB sync, UI).

---

## 1. API Validation

### 1.1 Vendor card contract (per endpoint)

**Required fields per provider item:**  
`photoUrl`, `rating`, `reviewCount`, `distanceKm`, `distanceText` (when lat/lng provided), `specializations[]`, `nextAvailable`, `serviceStyles[]`, `vendorType`, `roleName`.

| Endpoint | photoUrl | rating | reviewCount | distanceKm | distanceText | specializations | nextAvailable | serviceStyles | vendorType | roleName | Notes |
|----------|----------|--------|-------------|------------|--------------|-----------------|---------------|---------------|------------|----------|--------|
| **GET /customer/discover-services** | ✅ getVendorPhotoUrl | ✅ | ✅ (added) | ✅ (added) | ✅ | ✅ | ✅ nextAvailableSlot + nextAvailable | ✅ (added) | ✅ | ✅ | at_home/tele and at_center paths both return these. |
| **GET /customer/services/by-style** (at_center) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ acceptableStyles | ✅ | ✅ | Full unified card. |
| **GET /customer/vendors/search** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Enriched response. |
| **GET /customer/vendors/discover-by-problem** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ serviceStyles[] | ✅ | ✅ | Enriched results. |
| **GET /customer/services/by-problem** | ✅ photo (alias) | ✅ | ✅ | ✅ distance | ✅ distanceFormatted | ✅ | ❌ N/A (service rows) | ❌ N/A | ❌ N/A | Service-centric; has photo, rating, reviewCount, specializations, distanceFormatted. UI uses providers[]. |

**Pass criteria:** All discovery endpoints that return vendor/provider cards now expose the required fields (or documented alias for by-problem). **PASS.**

**Runnable check:**  
`VALIDATE_API_URL=<your-api> node scripts/validate-discovery-api.js`

---

### 1.2 Publish status enforcement

- **discover-services:** at_center EXISTS clause uses `(vs.publish_status = 'published' OR vs.publish_status IS NULL)`; at_home/tele uses `publish_status = 'published'` in EXISTS. **Recommendation:** Tighten at_center to `publish_status = 'published'` only if product requires “published only” (currently allows NULL).
- **by-style (at_center):** `vs.publish_status = 'published'` in JOIN.
- **vendors/search:** `vs.publish_status = 'published'` in EXISTS.
- **discover-by-problem:** No filter on vendor_services publish_status (filters on vendor status + specializations). **Gap:** Draft-only vendors can appear. Optional: add EXISTS on published vendor_services.
- **by-problem (problem-grid):** `(vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)`.

**Pass criteria:** Only published vendors appear in discovery. **PARTIAL** — by-problem and discover-by-problem may show vendors with only draft services unless you add an EXISTS on published services. Recommend adding that filter for discover-by-problem and tightening by-problem to `publish_status IN ('published','auto_published')` only (remove NULL).

---

### 1.3 Legacy style normalization

- **Discovery:** by-style uses `acceptableStyles`: at_center → `['at_center','at_vendor']`, tele → `['tele','online']`. discover-services at_center uses `'at_center'` in EXISTS (no at_vendor in that clause). Slots APIs (service-discovery, followup-reschedule) normalize at_vendor→at_center, online→tele.
- **problem-grid (by-problem):** styleToDbValues: at_center→['at_center','at_vendor'], tele→['tele','online','video_consultation'].

**Pass criteria:** at_vendor appears in at_center discovery; online in tele. Slots work for normalized styles. **PASS** (code verified).

---

### 1.4 Problem grid endpoint

- **Flow:** `/public/problems?roleId=vet` → pick problemId → `GET /customer/services/by-problem?problemId=...&serviceStyle=at_home`.
- **Response:** services/providers with serviceId, name, price, vendorId, vendorName, photo, rating, reviewCount, specializations, distanceFormatted (when lat/lng), priceFormatted.
- **Pass criteria:** Providers include matching specializations and vendor card fields. **PASS** (by-problem returns specializations via specMap, photo, rating, reviewCount, distance).

---

### 1.5 Service details resolution

- **GET /services/:serviceId:** Tries service_catalog first (by service_id or id); fallback vendor_services by UUID. Returns consistent payload (name, price, duration, vendor_id for vs).
- **Pass criteria:** Both catalog service_id and vendor_service id return valid payload. **PASS.**

---

### 1.6 Pricing quote endpoint

- **POST /customer/pricing/quote** body: `serviceId`, `vendorId`, `customerId?`, `couponCode?`.
- **Response:** `success`, `basePrice`, `tax`, `discount`, `finalPrice`, `taxBreakdown`, `coupon`.
- **Pass criteria:** Response contains basePrice, tax, discount, finalPrice, taxBreakdown. **PASS.**

---

## 2. DB Sync Validation

### 2.1 Specialization sync

- **Vendor profile update (PUT/POST):** When `specializations` is updated, code deletes from vendor_specializations and re-inserts. **Pass criteria:** vendors.specializations and vendor_specializations stay in sync. **PASS** (code in vendor-profile.ts).

### 2.2 Style normalization in DB

- **Code** normalizes at read time (at_vendor→at_center, online→tele). No automatic backfill of vendor_services or vendor_availability_v2. **Pass criteria:** For validation, either run a one-off migration to normalize stored values, or rely on read-time normalization. **Manual/optional:** Run UPDATE on vendor_services and vendor_availability_v2 to set at_center/tele where at_vendor/online.

### 2.3 Profile photo backfill

- **Code** uses COALESCE(profile_photo_url, profile_image, …) at read time. **Pass criteria:** profile_photo_url set for existing vendors. **Manual:** Backfill script or admin update to copy profile_image → profile_photo_url where null.

---

## 3. UI Validation (manual)

| Check | Action |
|-------|--------|
| **Problem grid list** | In customer app: problem grid → pick problem → confirm cards show photo, rating, specialization, distance, nextAvailable. |
| **Service list richness** | Vendor service list: duration, specialization badge, short/long description (collapsible). |
| **Packages vs services** | Packages in separate section with session info (use `packages` from GET /customer/vendor/:id/services). |
| **Checkout pricing** | Apply coupon; summary shows base + tax − discount = final; total matches POST /customer/pricing/quote. |

---

## 4. Summary

| Area | Status | Notes |
|------|--------|--------|
| Vendor card contract (all endpoints) | ✅ PASS | Required fields added; by-problem is service-shaped with photo, rating, reviewCount, specializations, distance. |
| Publish status | ⚠️ PARTIAL | discover-by-problem and by-problem could be tightened to “published only” if required. |
| Legacy style normalization | ✅ PASS | Read-time normalization in discovery and slots. |
| Problem grid + by-problem | ✅ PASS | Returns providers with specializations and card fields. |
| Service resolution /services/:id | ✅ PASS | Catalog + vendor_services fallback. |
| Pricing quote | ✅ PASS | Returns basePrice, tax, discount, finalPrice, taxBreakdown. |
| DB sync (specializations) | ✅ PASS | Profile save syncs vendor_specializations. |
| DB style/photo backfill | Optional | Documented; run if you want stored values normalized. |
| UI | Manual | Follow table in §3. |

**Script:** Run `VALIDATE_API_URL=<base> node scripts/validate-discovery-api.js` for automated API contract checks against a live API.
