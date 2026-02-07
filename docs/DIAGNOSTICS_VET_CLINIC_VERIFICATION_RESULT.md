# Lab Test / Diagnostics – Vet Clinic Discovery Verification

**Date:** 2026-01-31  
**API tested:** `GET /customer/diagnostics/vendors-with-tests`

---

## Result: Vet clinic is discovered with published lab tests

### API: `GET /customer/diagnostics/vendors-with-tests?maxDistance=50`

**Response:** `200 OK`, `success: true`, **3 vendors** returned:

| # | Vendor | Type | City | Published tests |
|---|--------|------|------|-----------------|
| 1 | apporva_5638574758_diagnostics_center | Diagnostics center | Mumbai | 1 (Complete Blood Count) |
| 2 | Dia cent | Diagnostics center | Mysore | 3 (CBC, LFT, Urine Routine) |
| 3 | **Niranjan Veterinary Clinic** | **Vet clinic** | **Bangalore** | **3** (Complete Blood Workup, Thyroid Panel, Urinalysis) |

### Vet clinic in discovery

- **Niranjan Veterinary Clinic** (Bangalore) appears in the lab test discovery response.
- It has **3 published tests** in the `tests` array:
  - Complete Blood Workup (₹2500)
  - Thyroid Panel (₹650)
  - Urinalysis (₹800)
- So the implementation is working: a **vet clinic** with **diagnostic lab** capability and **published** tests is included in `vendors-with-tests`, and only **published** tests are listed (each vendor’s `tests` are filtered by `is_available = true`).

### Notes

- **API base:** Verification was done against the API that returns data without auth (`z0b3obweb6.execute-api.ap-south-1.amazonaws.com`). Your CDK dev stack (`rrg9107m3d`) may require authorization (401 without auth).
- **GET /vendor/:id/diagnostics/tests:** If the customer app uses the same Lambda we deployed (`warmpawz-api-dev`), then for a vet clinic vendor, `GET /vendor/:vendorId/diagnostics/tests?publishedOnly=true` will return only published tests (and the handler allows `diagnostic_lab` / `diagnostic lab` capability). If you still see 403 for a vet clinic on some environment, that environment may be running an older Lambda; redeploy so it uses the latest code.

---

## Summary

- Vet clinic **is** discovered in the lab test flow when it has diagnostic lab capability and at least one **published** test.
- Only **published** tests (`is_available = true`) are returned per vendor in discovery and, with `publishedOnly=true`, in the booking flow.
