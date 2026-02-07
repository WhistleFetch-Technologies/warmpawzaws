# Vendor onboarding application detail changes – validation

This document validates the changes made for:
1. Application header: Business + Full Name for business vendors, Full Name only for solo
2. State and PIN no longer showing N/A when filled in the form
3. New third tab "Vendor-specific details" after Documents & Certificates

## Files changed

| File | Change |
|------|--------|
| `backend/lambda/src/endpoints/vendor-onboarding-fixes.ts` | `GET /admin/vendors/pending-applications-fixed` now returns `state`, `pincode`, `ownerName` from `application_payload` on each application object |
| `apps/admin-web/components/admin/ApplicationDetailModal.tsx` | Header subtitle, state/pincode fallback, third tab "Vendor-specific details", solo vs business display logic |

## Validation performed

### 1. Lint
- **admin-web** `ApplicationDetailModal.tsx`: no linter errors
- **backend** `vendor-onboarding-fixes.ts`: no linter errors

### 2. Build
- **admin-web** `npm run build`: **passed** (Next.js build completed successfully)

### 3. TypeScript (backend)
- Backend has pre-existing TS errors in other modules; **vendor-onboarding-fixes.ts** was not in the error list (no new errors from this change)

### 4. Logic review

**Header (applicant label)**
- `applicantHeaderLabel = vendorType === 'solo' ? fullName : (businessName ? \`${businessName} · ${fullName}\` : fullName)`
- Solo: shows only full name
- Business: shows "Business Name · Full Name" when business name exists; otherwise full name only

**State / Pincode**
- API: each application from pending-applications-fixed includes `state: payload.state || 'N/A'`, `pincode: payload.pincode || payload.pinCode || payload.pin || 'N/A'`
- Modal: `state = application.state ?? customFields.state ?? ''`, `pincode = application.pincode ?? customFields.pincode ?? customFields.pinCode ?? customFields.pin ?? ''`, then display with `state || 'N/A'` and `pincode || 'N/A'` so missing values show N/A

**Vendor-specific tab**
- New tab type: `'details' | 'documents' | 'vendor_specific'`
- `getVendorSpecificFields(customFields)` returns all keys from payload **except** those in `STANDARD_DETAIL_KEYS` (fullName, ownerName, businessName, phone, email, address, city, state, pincode, etc.)
- Each entry shown as humanized label + value; empty/null/'' skipped; objects/arrays serialized with length limits

## Data flow

1. Admin opens Vendors → New Applications (or similar) and list is loaded via `GET /admin/vendors/pending-applications-fixed`.
2. Response includes per application: `fullName`, `businessName`, `ownerName`, `state`, `pincode`, `customFields` (full payload).
3. On "View" / opening Application Detail modal, the same application object is passed.
4. Modal derives: `fullName`, `businessName`, `state`, `pincode` from `application` with fallback to `customFields`; computes `applicantHeaderLabel`; renders Vendor Details (with state/pincode), Documents & Certificates, and Vendor-specific details (extra keys from `customFields`).

## How to manually verify

1. Deploy backend (Lambda) so pending-applications-fixed returns `state` and `pincode`.
2. In admin, go to Vendors → open a pending application that had state and PIN filled.
3. Check: modal subtitle shows "Business Name · Full Name" for business type and "Full Name" for solo; Address section shows State and Pincode (not N/A when provided).
4. Open "Vendor-specific details" tab: any extra form fields (e.g. aadhaarNumber, experience, bankDetails, role-specific fields) appear as label + value; if none, "No vendor-specific details" is shown.

---
*Generated for validation of vendor onboarding application detail fixes.*
