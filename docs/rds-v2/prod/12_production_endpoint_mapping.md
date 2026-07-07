# 12 — Production Endpoint Mapping

Static analysis of `backend/lambda/src` route registrations (`app.get/post/...`).

Full dev-era map reused for application layer (code is shared across environments): `docs/rds-v2/_endpoint-table-map.json`

## Route volume

~2,557 route registrations across ~601 TypeScript files.

## Top route prefixes

| Prefix | Typical tables |
|--------|----------------|
| /admin/vendors | vendors, vendor_*, roles |
| /customer | customers, bookings, pets |
| /vendor | vendors, vendor_services, vendor_schedule |
| /bookings | bookings, booking_services, payments |
| /discover | service_catalog, vendor_services, search_index |

**Note:** File-level co-occurrence heuristic — see Phase 0 application dependency map for limitations.
