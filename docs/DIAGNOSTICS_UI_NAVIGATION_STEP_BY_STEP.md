# Diagnostics Flow – Step-by-Step UI Navigation (Code Analysis)

Based on actual code tracing; no assumptions.

---

## PART 1: VENDOR SIDE – After Order Is Received

### Entry point
- **Route:** Vendor app root `/`
- **Component:** `VendorLandingPage` → `VendorDashboard` (when diagnostics vendor)
- **Trigger:** Click **"Lab / Tests"** (purple tile) in quick actions
- **Code:** `VendorDashboard.tsx` line 898–909, `VendorLandingPage.tsx` line 1563–1567

### Navigation to Lab Orders
- **For role `diagnostics_center` / `diagnostic_center`:** `setShowDiagnosticsOrders(true)` → shows `DiagnosticsOrderDashboard`
- **For other diagnostic roles:** `setShowDiagnostics(true)` → shows `DiagnosticResults` (test catalog)
- **Code:** `VendorLandingPage.tsx` line 1564–1566

---

### Screen 1: Diagnostics Order Dashboard
**Component:** `DiagnosticsOrderDashboard.tsx`  
**API:** `GET /vendor/:vendorId/diagnostics/bookings`

#### Tabs
| Tab | Statuses included |
|-----|-------------------|
| **Scheduled** | `scheduled`, `pending`, `confirmed` |
| **In Progress** | `sample_collected`, `sample_received_at_lab`, `processing`, `in_progress` |
| **Reports Ready** | `reports_ready` |
| **Completed** | `completed` |

#### Per booking card
- Booking number, status badge, home/center badge  
- Date, time, customer name, phone, pet name, address (if home)  
- Tests list, total amount  
- Assigned staff (if any)  
- OTP (if any)

#### Actions (by status)

| Status | Visible actions |
|--------|-----------------|
| `scheduled` + home + no assignment | **Assign Collection Agent** (opens modal) |
| `scheduled` | **Mark Collected** |
| `sample_collected` | **Start Processing** |
| `processing` | **Upload Reports** (opens upload modal) |
| `reports_ready` | **Mark Completed** |
| Any | **View Details** |
| Any | **Call** (opens `tel:` link) |

**Code:** `DiagnosticsOrderDashboard.tsx` lines 431–651

---

### Screen 2: Assign Collection Agent modal
**Condition:** `status === 'scheduled'` and `collectionType === 'home'` and `!assignedStaff`

#### Modes
1. **Adhoc Agent** – no login
   - Agent Name  
   - Agent Phone  
   - Date  
   - Time  
   - **Assign & Notify Customer** → `POST /diagnostics/sample-collection/assign-adhoc`

2. **Staff**
   - List of staff with `role=phlebotomist`
   - Click staff → `POST /diagnostics/sample-collection/assign`

**Code:** `DiagnosticsOrderDashboard.tsx` lines 512–532, 533–556, 680–728

---

### Screen 3: Upload Reports modal
**Condition:** `status === 'processing'` → click **Upload Reports**

**Component:** `DiagnosticsReportUpload`  
**API (upload):** `POST /storage/upload` (FormData: file, vendorId, bookingId, documentType=diagnostic_report)  
**API (submit):** `POST /diagnostics/reports` or equivalent (creates report record, notifies customer)

#### Form fields
- Report type (Lab Test, X-Ray/Imaging, Pathology, Other)  
- Test name  
- Summary  
- Findings  
- File (PDF, JPEG, PNG, WebP; max 10MB)

#### On success
- `loadBookings()`  
- `handleUpdateStatus(bookingId, 'reports_ready')`  
- Modal closes  

**Code:** `DiagnosticsOrderDashboard.tsx` lines 455–465, 784–829; `DiagnosticsReportUpload.tsx`

---

### View Details button
- **Action:** `onSelectBooking?.(booking.id)` → opens `AppointmentDetailModal`
- **Implementation:** `VendorLandingPage` sets `selectedDiagnosticsBookingId`, renders `AppointmentDetailModal` with booking details from `GET /vendor/bookings/:bookingId/details`
- **Result:** Full booking detail modal (customer, pet, tests, status, prescriptions, chat)

---

### Manage Test Catalog
- Link at bottom: **"Manage Test Catalog →"**
- Action: `setShowDiagnosticsOrders(false); setShowDiagnostics(true)`
- Shows: `DiagnosticResults` (test catalog – add/edit/publish tests)

---

## PART 2: CUSTOMER SIDE – Report Download and Share

### How to reach report / tracking

#### Path A: From My Bookings
1. **My Bookings** (`my-bookings`) – `MyBookings.tsx`
2. Select diagnostics booking → **BookingDetailModal**
3. **View Lab Reports** (if `status` in `['reports_ready','completed']`) → `onNavigate('diagnostics-reports', { bookingId })` → `onClose()`
4. **Diagnostics Report Viewer** (`diagnostics-reports`)

**OR**

3. **Track Sample Collection** (if home + `status` in `['scheduled','sample_collected']`) → `onNavigate('sample-collection-tracking', { bookingId })`
4. **Sample Collection Tracker** (`sample-collection-tracking`)

**Code:** `BookingDetailModal.tsx` lines 848–881; `MyBookings.tsx` lines 348–355; `CustomerHomeWrapper.tsx` (wrappers) lines 1356–1361

#### Path B: From Medical Records
- **Medical Records** (`medical-records`) – `MedicalRecordsPage.tsx`
- Records with `record_type === 'diagnostic_report'` or `document_url` have **Download report**
- Opens `rec.document_url` in new tab

**Code:** `MedicalRecordsPage.tsx` lines 225–243

#### Path C: From Booking Detail – Medical records section
- In `BookingDetailModal`, **Prescription History** opens `PrescriptionHistoryModal`
- Medical records shown there; if `record_type === 'diagnostic_report'` or `document_url`, **Download** opens URL

**Code:** `BookingDetailModal.tsx` lines 801–845

---

### Screen: Diagnostics Report Viewer
**Component:** `DiagnosticsReportViewer.tsx`  
**APIs:** `GET /bookings/:bookingId`, `GET /diagnostics/reports/booking/:bookingId`

#### Per report
- Test name, code, category  
- Result, normal range, findings  
- Status (Normal / Needs Attention / Processing)

#### Actions per report (when `status === 'completed'`)
| Button | Action |
|--------|--------|
| **Download** | `window.open(report.reportUrl, '_blank')` |
| **Print** | Opens report in new tab, calls `print()` |
| **Share** | Opens **Share Report with Vet** modal |

**Code:** `DiagnosticsReportViewer.tsx` lines 317–337, 196–220, 211–220

---

### Screen: Share Report with Vet modal
**Condition:** Click **Share** on a report

#### Behavior
- Fetches vet appointments: `GET /customer/bookings?phone=…&category=vet&status=completed,in_progress`
- Shows up to 5 vet appointments
- Each appointment: vendor name, date, time
- Click appointment → `POST /diagnostics/reports/share`  
  Body: `{ reportId, bookingId (vet appointment id), customerPhone }`
- Success: toast "Report shared with vet successfully!"

**Code:** `DiagnosticsReportViewer.tsx` lines 185–193, 221–244, 396–445

#### If no vet appointments
- Message: "No recent vet appointments found"  
- "Book a vet consultation to share this report"

---

### Screen: Sample Collection Tracker
**Component:** `SampleCollectionTracker.tsx`  
**API:** `GET /diagnostics/sample-collection/booking/:bookingId`

#### Status steps
1. Collector Assigned  
2. On The Way  
3. Arrived  
4. Collecting Sample  
5. Sample Collected  
6. Completed  

#### Data shown
- Collector name, phone  
- Scheduled date and time  
- OTP (if applicable)  
- Status progress

**Code:** `SampleCollectionTracker.tsx` lines 67–73, 87–110

---

### Next steps (DiagnosticsReportViewer)
Section **"Next steps"** (when `onNavigate` is passed):

| Button | Action |
|--------|--------|
| Order medicine online | `onNavigate('pharmacy_store')` |
| View vet appointment & prescription | `onNavigate('my-bookings')` |
| Book follow-up (e.g. Physiotherapy) | `onNavigate('vet')` |

**Code:** `DiagnosticsReportViewer.tsx` lines 365–390

---

## PART 3: VET SIDE – Report Review (Reverification / Follow-up)

### Pending reports
**Component:** `PendingReportsPanel.tsx`  
**API:** `GET /diagnostics/reports/vet/:vetId/pending`

- Lists reports shared with the vet
- Click report → `VetReportReview` modal

**Code:** `PendingReportsPanel.tsx` lines 61–64, 76–79

### Vet Report Review
**Component:** `VetReportReview.tsx`  
**API:** `POST /diagnostics/reports/:reportId/review`

#### Form
- Review notes  
- Status: `reviewed` or `requires_action`  
- Update prescription (yes/no)  
- Diagnosis, symptoms, prescription notes  
- Follow-up date  
- Medications (name, dosage, frequency, duration)

#### On submit
- Creates/updates prescription  
- Notifies customer  
- Report marked as reviewed

---

## PART 4: Summary Table

### Vendor flow (order received)
| Step | Screen | Action |
|------|--------|--------|
| 1 | Dashboard | Click **Lab / Tests** |
| 2 | Diagnostics Order Dashboard | Open **Scheduled** tab |
| 3 | Booking card | (Home) Click **Assign Collection Agent** or **Mark Collected** |
| 4 | Assign modal | Adhoc: name, phone, date, time → Assign |
| 5 | Booking card | (After collection) **Start Processing** |
| 6 | Booking card | **Upload Reports** |
| 7 | Upload modal | Select file, fill form → Submit |
| 8 | Booking card | **Mark Completed** |

### Customer flow (report)
| Step | Screen | Action |
|------|--------|--------|
| 1 | My Bookings | Open diagnostics booking |
| 2 | Booking Detail | Click **View Lab Reports** |
| 3 | Lab Reports | Per report: **Download**, **Print**, **Share** |
| 4 | Share modal | Select vet appointment → share |
| 5 | Lab Reports | Optional: **Order medicine**, **View vet appointment**, **Book follow-up** |

### Customer flow (track collection)
| Step | Screen | Action |
|------|--------|--------|
| 1 | My Bookings | Open diagnostics booking (home, scheduled) |
| 2 | Booking Detail | Click **Track Sample Collection** |
| 3 | Sample Collection Tracker | See collector, schedule, status, OTP |

---

## Gaps Fixed (2026-01-30)

| Gap | Fix |
|-----|-----|
| View Details no-op | `VendorLandingPage` now passes `onSelectBooking` that sets `selectedDiagnosticsBookingId` and renders `AppointmentDetailModal` |
| PendingReportsPanel not shown | `VendorDashboard` now renders `PendingReportsPanel` for vet vendors (`isVet`); vets see shared reports on dashboard |
| Back from Report Viewer → wrong screen | `previousScreen` set when navigating from My Bookings or Lab Diagnostics; `onBack` returns to `previousScreen` |

---

## Code references

| Component | File |
|-----------|------|
| Diagnostics Order Dashboard | `apps/vendor-web/components/vendor/diagnostics/DiagnosticsOrderDashboard.tsx` |
| Diagnostics Report Upload | `apps/vendor-web/components/vendor/diagnostics/DiagnosticsReportUpload.tsx` |
| Diagnostics Report Viewer | `apps/customer-web/components/customer/diagnostics/DiagnosticsReportViewer.tsx` |
| Sample Collection Tracker | `apps/customer-web/components/customer/diagnostics/SampleCollectionTracker.tsx` |
| Booking Detail Modal | `apps/customer-web/components/customer/BookingDetailModal.tsx` |
| My Bookings | `apps/customer-web/components/customer/MyBookings.tsx` |
| Pending Reports Panel (Vet) | `apps/vendor-web/components/vendor/appointments/PendingReportsPanel.tsx` |
| Vet Report Review | `apps/vendor-web/components/vendor/diagnostics/VetReportReview.tsx` |
| Customer routing | `apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx` |
