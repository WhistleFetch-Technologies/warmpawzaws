# Gap Audit Implementation: Vendor Cards, Services/Packages, Pricing

**Date:** 2026-02-08  
**Scope:** Product-level gaps from forensic audit — vendor card enrichment, service list + package separation, payment tax/coupon pipeline.

---

## 1. Vendor Card Enrichment (API)

### Unified photo field
- **Helper:** `getVendorPhotoUrl(v)` in `service-discovery.ts`:  
  `COALESCE(profile_photo_url, profile_image, logo_url, metadata.facility_photos[0])`
- **Applied in:** discover-services, by-style (at_center), vendors/search, discover-by-problem, and provider list in service-discovery (center path).
- **problem-grid.ts:** by-problem photo now also uses `facility_photos[0]` from vendor_metadata.

### Unified card shape (target schema)
All discovery endpoints now return or enrich with:
- `photoUrl`, `rating`, `reviewCount`, `distanceKm`, `distanceText`, `specializations[]`, `nextAvailable`, `serviceStyles[]`, `vendorType`, `roleName`, `minPrice` where applicable.

### Endpoints updated

| Endpoint | Changes |
|----------|--------|
| **GET /customer/discover-services** | `photoUrl` = getVendorPhotoUrl(vendor); already had nextAvailableSlot, specializations, distance, rating. |
| **GET /customer/services/by-style** (at_center) | SELECT extended with profile_photo_url, profile_image, logo_url, vendor_type. Response: photoUrl, distanceText, nextAvailable (from vendor_availability_v2), specializations (vendor_specializations), serviceStyles, id, vendorId, vendorType, roleName, minPrice. |
| **GET /customer/vendors/search** | Enriched with photoUrl, distanceText, specializations, nextAvailable (va2), serviceStyles, minPrice, vendorType, roleName. publish_status already enforced via EXISTS on vendor_services. |
| **GET /customer/vendors/discover-by-problem** | Results enriched with photoUrl, rating, reviewCount, specializations, nextAvailable, distanceText, vendorType, roleName. |
| **GET /customer/services/by-problem** | Already had publish_status, legacy styles, specializations, photo coalesce; photo now includes facility_photos[0]. |

### nextAvailable for at_center
- **discover-services:** Already computed nextAvailableSlot for all styles (va2 query not filtered by style in that block).
- **by-style (at_center):** nextAvailable now computed from vendor_availability_v2 with acceptableStyles (at_center/at_vendor).
- **vendors/search:** nextAvailable computed when serviceStyle is provided (styleArray for va2).
- **discover-by-problem:** nextAvailable computed per vendor from va2.

---

## 2. Service List + Package Separation (API)

### GET /customer/vendor/:vendorId/services
- **Extended fields:** shortDescription, longDescription, durationMinutes, isPackage, packageDetails (totalSessions, validityDays, sessionDuration), taxCategoryId, couponEligible, publishStatus, serviceId.
- **Split response:** `services` (non-package items), `packages` (items with isPackage true from metadata). Also returns full list count.
- **Metadata source:** vendor_services.metadata (vs_metadata) for isPackage, packageDetails, taxCategoryId, couponEligible.

### GET /services/:serviceId
- **Already supports:** service_catalog first, then fallback to vendor_services by UUID (by-problem / BookingFlow).

---

## 3. Payment Tax + Coupon Pipeline (API)

### POST /customer/pricing/quote
- **Body:** `{ serviceId, vendorId, customerId?, couponCode? }` (and optional customerState/customerCity for tax).
- **Response:**  
  `basePrice`, `tax`, `discount`, `finalPrice`, `taxBreakdown` (name, rate, amount), `coupon` (code, type, value, applied).
- **Flow:** Resolve base price from vendor_services (by vs.id or service_id+vendor_id) or service_catalog → apply discounts (vendor + platform + coupon) via DiscountCalculationService → calculate tax on amount after discount via TaxCalculationService → return totals.
- **Use in:** Booking summary / checkout should call this before payment submit so UI shows server-calculated totals.

---

## 4. DB Sync (Already in place / notes)

- **Vendor specializations:** Profile save (vendor-profile.ts) already syncs `vendor_specializations` when `specializations` is updated (PUT/POST vendor profile).
- **Optional backfills (run separately if needed):**  
  - Backfill profile photo: copy profile_image → profile_photo_url where profile_photo_url is null.  
  - Normalize service_style: UPDATE vendor_services SET service_style = 'at_center' WHERE service_style = 'at_vendor'; similar for online → tele.  
  - Ensure vendor_services have specialization_ids where service_catalog has them (copy or join).

---

## 5. UI Checklist (Do last)

- **ProblemGridFlowRouter:** Uses by-problem response; cards should show provider.photo, provider.rating, provider.reviewCount, provider.specializations, provider.distanceFormatted (by-problem returns these).
- **Service cards:** Use new fields from /customer/vendor/:id/services: longDescription, packageDetails, show Packages vs Services sections when packages.length > 0.
- **Listing cards (discover-services, by-style, vendors/search):** Prefer photoUrl, distanceText, nextAvailableSlot.display or nextAvailable.display so distance and next slot show on all cards.
- **Checkout:** Call POST /customer/pricing/quote with serviceId, vendorId, customerId, couponCode; display basePrice, tax, discount, finalPrice and use finalPrice for payment.

---

## Files touched

- `backend/lambda/src/endpoints/service-discovery.ts`: getVendorPhotoUrl, discover-services/by-style/vendors/search/discover-by-problem enrichment, /customer/vendor/:id/services extended + packages split, POST /customer/pricing/quote.
- `backend/lambda/src/endpoints/problem-grid.ts`: photo coalesce includes facility_photos[0].
