# Diagnostics Flow – Navigation Guide

## Customer Web – How to Check Lab Tests & Book

### Entry points
1. **Home → Lab Test** (quick service tile)
2. **Vet dashboard → Lab Tests** (when viewing vet services)

### Flow
1. Click **Lab Test** on home (teal tile).
2. **Lab list** – search, filters (All / Home / Center), distance, sort.
3. **Select lab** – expand card → “View All Tests & Book” or “Book” on a test.
4. **Diagnostics booking** – choose tests, date, home/center, patient details.
5. **Payment** – total with home collection fee (if charged).
6. **Success** → My Bookings.

### After booking
- **My Bookings** → open booking → **Track Sample Collection** (home) or **View Reports** (when ready).

---

## Vendor Web – How to Manage Lab Orders & Tests

### Entry
- Log in as diagnostics vendor → **/** (root).

### Where to click
1. **“Lab / Tests”** (purple tile in quick actions).
2. **Diagnostics center**: opens **Lab Orders** first, then “Manage Test Catalog →”.
3. **Other diagnostic roles**: opens **Test catalog** directly.

### Flow (Diagnostics Center)
1. **Lab Orders** – list of bookings, tabs: Scheduled, In Progress, Ready, Completed.
2. **Assign Collection Agent** – on a booking card → choose Adhoc (name, phone, date, time) or Staff.
3. **Upload Reports** – on booking → Upload Report.
4. **Update status** – e.g. sample_collected, reports_ready, completed.
5. **Manage Test Catalog** – “Manage Test Catalog →” at bottom.

### Direct URLs
- **Test catalog (add/edit tests)**: `/medical/diagnostics`
- **Dashboard**: `/dashboard`

### Capability / role
- **Capability**: `diagnostic_results`, `diagnostics`, or `test_catalog`.
- **Role**: `diagnostics_center` or `diagnostic_center` (button shown even without capability).

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| No “Lab Test” on customer home | Confirm `lab-diagnostics` in quick services (default). |
| “diagnostic_results Not Available” | Vendor role should contain “diagnostic”; role bypass is enabled. |
| No Lab Orders | Vendor role `diagnostics_center` or `diagnostic_center`. |
| Hard refresh needed | CloudFront cache; try Ctrl+Shift+R or wait 5–15 minutes. |
