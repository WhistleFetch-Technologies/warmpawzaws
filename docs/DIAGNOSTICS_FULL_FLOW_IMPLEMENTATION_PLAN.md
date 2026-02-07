# Diagnostics Full Flow – Implementation Plan

**Date:** 2026-01-30  
**Status:** In Progress  
**Scope:** End-to-end lab test flow with adhoc home collection agent, payment, and report delivery.

---

## 1. Flow Summary

| Step | Actor | Action |
|------|--------|--------|
| 1 | Customer | Vet dashboard → Lab Test |
| 2 | Customer | List labs (expandable reports/packages, home vs center, search, filter distance/rating/relevance) |
| 3 | Customer | Select package/report → **Payment** (include home collection fee if charged) |
| 4 | System | Notify vendor with booking details |
| 5 | Vendor | **Adhoc assign** home collection agent (name, phone, time) – no login for agent |
| 6 | System | Notify customer with agent name, number, schedule |
| 7 | Vendor | Update to "In progress" after sample collection/visit |
| 8 | Vendor | Upload reports in booking view → Mark completed |
| 9 | Customer | Notified → Download from medical records or booking details |
| 10 | Customer | Share to vet (popup list appointments) → Vet notified (chat + notification) |
| 11 | Vet | Update prescription/comment |
| 12 | Customer | Order medicine or book physio |

---

## 2. Gaps & Implementation Tasks

### 2.1 Overlapping UI Fix ✅
- [x] Published badge overlapping – fixed (moved to separate row)

### 2.2 Home Collection Fee in Booking/Payment
- [ ] DiagnosticsBookingFlow: Ensure home collection fee included in total
- [ ] Booking summary shows itemized: test prices + home collection fee
- [ ] Payment amount = sum(tests) + max(home_collection_fee) when preferredSampleType=home

### 2.3 Adhoc Home Collection Agent (No Login)
- [ ] Migration: Add `agent_name`, `agent_phone` to sample_collection_assignments (nullable when staff_id used)
- [ ] Backend: New endpoint `POST /diagnostics/sample-collection/assign-adhoc` – accepts agent_name, agent_phone, scheduled_date, scheduled_time (no staff_id)
- [ ] Vendor UI: In DiagnosticsOrderDashboard booking detail – "Assign home collection" with inputs: agent name, phone, date, time
- [ ] Customer: View agent name, phone, schedule in booking/notification (no agent login)

### 2.4 Customer Discovery Enhancements
- [ ] Search by report/test name in DiagnosticsServicesLanding
- [ ] Filters: Distance, Rating, Relevance

### 2.5 Vendor Order Management
- [ ] Status update (scheduled → in progress → completed) in booking view
- [ ] Report upload from booking view
- [ ] Mark completed after all reports uploaded

### 2.6 Report Visibility
- [ ] Medical records: diagnostic_report with download
- [ ] Booking details: report download
- [ ] Share to vet: popup list vet appointments

---

## 3. DB Schema Changes

### Migration: Adhoc agent support
```sql
ALTER TABLE sample_collection_assignments 
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_phone TEXT,
  ALTER COLUMN staff_id DROP NOT NULL; -- Allow NULL when using adhoc agent
```

---

## 4. API Endpoints

| Endpoint | Purpose |
|----------|---------|
| POST /diagnostics/sample-collection/assign | Existing – staff-based |
| POST /diagnostics/sample-collection/assign-adhoc | **NEW** – adhoc agent (name, phone, date, time) |
| GET /diagnostics/sample-collection/booking/:bookingId | Get assignment for customer view |
| PATCH /diagnostic-bookings/:id/status | Update booking status |
| POST /diagnostics/reports/upload | Existing |
| POST /diagnostics/reports/share | Existing |

---

## 5. Files to Modify/Create

- `db/migrations/505_sample_collection_adhoc_agent.sql` – NEW
- `backend/lambda/src/endpoints/diagnostics-reports.ts` – add assign-adhoc, relax staff_id
- `apps/vendor-web/components/vendor/diagnostics/` – assign adhoc UI
- `apps/customer-web/components/customer/specialized/DiagnosticsBookingFlow.tsx` – home fee in payment
- `apps/customer-web/` – booking detail agent info display
