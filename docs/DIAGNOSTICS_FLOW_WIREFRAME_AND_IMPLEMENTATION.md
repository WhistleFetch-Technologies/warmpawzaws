# Diagnostics Center Flow – Wireframe & Implementation

**Date:** 2026-01-29  
**Scope:** Customer web + Vendor web; end-to-end lab test flow from discovery to report share-to-vet and follow-on (medicine, physio).

---

## 1. Desired Flow (Summary)

| Step | Actor | Action |
|------|--------|--------|
| 1 | Customer | Vet service dashboard → click **Lab Test** |
| 2 | Customer | **List labs** with expandable report/packages; home collection vs sample at center (e.g. X-ray); search report name; filter by distance, rating, relevance |
| 3 | Customer | Select package/report → **Payment** |
| 4 | System | **Notify vendor** with booking details (home collection or center appointment) |
| 5 | Vendor | After home sample collection or center visit → **Update booking to “In progress”** |
| 6 | Vendor | **Upload reports** in appointment/booking view → **Mark completed** |
| 7 | Customer | **Notified**; **download report** from Medical Records or Booking details (both) |
| 8 | Customer | **Share to vet**: popup list appointments → select → share; vet notified by **chat + notification** |
| 9 | Vet | Update prescription/comment |
| 10 | Customer | Order medicine online or book more services (e.g. physio – vet solo with physio specialization) |

---

## 2. Current Implementation vs Gaps

### 2.1 Customer Web

| Item | Current | Gap / Action |
|------|---------|--------------|
| Entry | VetServiceRouter → “Lab Tests” → `handleNavigate('lab-diagnostics')` | ✅ Wired |
| Lab list screen | `DiagnosticsServicesLanding`: centers, packages, expandable, home/center | ✅ Exists; add **search by report name**, **filters: distance, rating, relevance** |
| Lab booking | `lab-booking` → DiagnosticsBookingFlow (select tests, date, home/center, address) | ✅ Exists; ensure **payment** and **notify vendor** after create |
| Report view | DiagnosticsReportViewer (bookingId, customerPhone); download | ✅ Exists |
| Medical records | Report visible in medical records | Ensure **record_type diagnostic_report** and booking_id linked |
| Booking details | Report visible in booking details | Ensure booking detail API returns report URLs; UI shows download |
| Share to vet | DiagnosticsReportViewer `onShareWithVet`; API `POST /diagnostics/reports/share` | Wire **popup: list customer’s vet appointments** → select → share; **chat + notification** to vet |

### 2.2 Vendor Web (Diagnostics Center)

| Item | Current | Gap / Action |
|------|---------|--------------|
| Dashboard | VendorDashboard: many sections (Vet, Pharmacy, Diagnostics, etc.) | **Diagnostics center**: show only **Today’s schedule**, **Lab Test orders**, **Test catalog**, **Notifications**; hide irrelevant (Vet-specific, Inventory, etc.) |
| Lab Test entry | `onNavigateToDiagnostics` → `DiagnosticResults` (test catalog) | For **diagnostics center** role: open **DiagnosticsOrderDashboard** (bookings) as main; Test catalog as secondary |
| Orders dashboard | DiagnosticsOrderDashboard: tabs Scheduled / In progress / Reports ready / Completed | ✅ Exists; ensure **status update** (e.g. to “in progress” after sample/visit) and **upload report** in same booking view |
| Report upload | DiagnosticsReportUpload; API `POST /diagnostics/reports/upload` | Ensure used from **appointment/booking view** and **mark completed** after upload |
| Notify vendor on new booking | Backend: create booking → notification to vendor | Ensure diagnostic/lab bookings create **notification** to vendor (vendor_id) |

### 2.3 Backend

| Item | Current | Gap / Action |
|------|---------|--------------|
| Diagnostic bookings | `diagnostic_bookings` (008); statuses scheduled → … → completed | Optional: align with unified `bookings` for lab type if needed |
| Reports | `diagnostic_reports` (007 vs 008 schema); diagnostics-reports.ts uses `booking_id` | Align handler with one schema; ensure **diagnostic_reports** has booking_id and vendor_id |
| List vendor’s diagnostic bookings | DiagnosticsOrderDashboard calls `GET /vendor/:vendorId/diagnostics/bookings` | Implement or confirm endpoint returns diagnostic_bookings (or bookings with service_type=diagnostics) |
| Update status | diagnostic_bookings status transition | Endpoint e.g. `PATCH /diagnostic-bookings/:id/status` or via existing booking update |
| Upload report | `POST /diagnostics/reports/upload` | ✅ Exists; ensure creates medical record and notifies customer |
| Share to vet | `POST /diagnostics/reports/share` (reportId, bookingId) → notify vet | ✅ Exists; customer UI: list appointments → select vet booking → share |

### 2.4 DB Schema (Existing)

- **diagnostic_bookings** (008): customer_id, pet_id, vendor_id, booking_type (home_collection | center_visit), status, reports JSONB, total_amount, payment_status, etc.
- **diagnostic_reports** (007 & 008): 007 = booking_id + sample_id; 008 = diagnostic_booking_id. Handler uses booking_id → ensure one canonical table or adapter.
- **medical_records**: record_type, document_url, booking_id.
- **notifications**: user_id, user_type, type (e.g. diagnostic_report_ready, diagnostic_report_shared).

---

## 3. Implementation Plan (Phases)

### Phase 1 – Critical path (this pass)

1. **Vendor (diagnostics center)**  
   - When role is diagnostics/diagnostic_center: **onNavigateToDiagnostics** → open **DiagnosticsOrderDashboard** (bookings), not only DiagnosticResults.  
   - Option: show both – “Lab orders” (DiagnosticsOrderDashboard) and “Test catalog” (DiagnosticResults or /services/tests).  
   - **Dashboard cleanup**: for role diagnostics_center / diagnostic_center, render a **reduced dashboard**: Today’s schedule (diagnostic bookings), **Lab Test** (orders dashboard), Test catalog link, Notifications; hide Vet-only, Pharmacy-only, etc.

2. **Customer**  
   - **DiagnosticsServicesLanding**: add **search by report/test name**; add **filter chips**: Distance, Rating, Relevance (sort).  
   - Ensure **lab-booking** flow calls **payment** and that **create booking** triggers **notification to vendor**.

3. **Vendor – status and report in booking view**  
   - In DiagnosticsOrderDashboard (or appointment/booking detail): **Update status** (e.g. “Sample collected” / “In progress”) and **Upload report** in same view; on “all reports uploaded” allow **Mark completed**.  
   - Ensure **DiagnosticsReportUpload** is reachable from booking detail and updates diagnostic_booking + notifies customer.

### Phase 2 – Share-to-vet and visibility ✅ IMPLEMENTED

4. **Share to vet (customer)** ✅  
   - DiagnosticsReportViewer: **Share** opens popup listing customer’s **vet appointments** (GET /customer/bookings?phone=…&category=vet&status=…).  
   - Customer selects one appointment → **POST /diagnostics/reports/share** with reportId, bookingId (vet’s), customerPhone.  
   - Backend: notification + second “chat_message” notification; **chat message** is now created in `chat_messages` for the vet’s booking so vet sees it in chat (message_type: 'text').

5. **Report in medical records and booking details** ✅  
   - **GET /customer/:phone/medical-records**: response includes `document_url` and `booking_id` for each record (diagnostic_report type).  
   - **GET /bookings/:bookingId/medical-records**: returns full rows (including document_url).  
   - **MedicalRecordsPage**: filter “Lab Reports” (diagnostic_report), icon/color for diagnostic_report, **Download report** button when document_url present.  
   - **BookingDetailModal**: medical records listed with **Download** for each record that has document_url or record_type diagnostic_report.  
   - **GET /customer/bookings**: supports `category` (alias for serviceType) and ILIKE for vet so share-to-vet popup loads vet appointments.

### Phase 3 – Follow-on (medicine, physio) ✅ IMPLEMENTED

6. **Vet updates prescription** after review ✅  
   - VetReportReview + POST /diagnostics/reports/:reportId/review with updatePrescription + newPrescription; backend creates prescription (linked to vet booking) and notifies customer (prescription_updated).  
   - **Customer** can **order medicine** or **book physio** ✅  
   - **DiagnosticsReportViewer**: "Next steps" section with **Order medicine online** (→ pharmacy_store), **View vet appointment & prescription** (→ my-bookings), **Book follow-up (e.g. Physiotherapy)** (→ vet dashboard).  
   - **VetServiceRouter**: added **Physiotherapy** tile (rehabilitation & follow-up); navigates to vet-services-by-style for physio/follow-up care.  
   - BookingDetailModal already has Prescription History and onReorderMedicine for ordering from vet booking; existing pharmacy and service discovery flows used.

---

## 4. Capabilities and Roles

- **diagnostics_center / diagnostic_center**: capabilities e.g. `bookings`, `diagnostics`, `test_catalog`; dashboard = reduced (schedule, lab orders, test catalog, notifications).  
- **Veterinarian / vet_clinic**: “Diagnostics” in Vet Center Services → SpecializedServices (or direct to DiagnosticsOrderDashboard if they also run lab).  
- **Customer**: no new capability; uses vet dashboard → Lab Test → DiagnosticsServicesLanding.

---

## 5. Endpoints Checklist

| Endpoint | Purpose | Status |
|----------|---------|--------|
| GET /customer/diagnostic-packages | Packages for discovery | Confirm or add |
| GET /customer/services?roleId=diagnostic_center | Labs list | Confirm |
| POST /bookings/create (serviceType diagnostics) | Create lab booking | Confirm body + vendor notification |
| GET /vendor/:vendorId/diagnostics/bookings | Vendor’s lab orders | Implement or confirm |
| PATCH /diagnostic-bookings/:id/status or booking update | Status → in progress / completed | Implement or confirm |
| POST /diagnostics/reports/upload | Upload report; notify customer | ✅ |
| GET /diagnostics/reports/booking/:bookingId | Reports for booking | ✅ |
| POST /diagnostics/reports/share | Share to vet; notify + chat | ✅ |
| GET /diagnostics/reports/vet/:vetId/pending | Vet’s pending reports | ✅ |
| POST /diagnostics/reports/:reportId/review | Vet review + prescription | ✅ |

---

## 6. UI Handshake Summary

- **Customer:** Vet dashboard → Lab Test → **DiagnosticsServicesLanding** (labs + packages, search, filter) → Select lab/package → **lab-booking** → DiagnosticsBookingFlow → Payment → Booking created → Vendor notified.  
- **Vendor (diagnostics center):** Dashboard (simplified) → **Lab Test** → **DiagnosticsOrderDashboard** (bookings) → Select booking → Update status (e.g. in progress) → Upload report(s) → Mark completed → Customer notified.  
- **Customer:** Notified → **Medical records** or **Booking details** → Download report → **Share to vet** (popup: select vet appointment) → Vet notified (notification + chat).  
- **Vet:** Review report → Update prescription/comment.  
- **Customer:** Order medicine or book physio (existing flows).

This document is the single source of truth for the diagnostics flow; implement Phase 1 first, then Phase 2 and 3.
