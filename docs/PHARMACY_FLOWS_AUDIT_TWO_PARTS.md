# Pharmacy Flows Audit: Two Parts (Online Delivery + OTC/Catalog)

**Date:** 2026-01-31  
**Scope:** Pharmacy has two parts: (1) **Online medicine delivery** (broadcasting with pharmacies, prescription → pay → OTP → track), and (2) **OTC and medical-grade products** catalog buying experience (like pet product seller in pharmacy-type products) in the same pharmacy service dashboard.

---

## Part 1 — Online Medicine Delivery (Broadcasting)

### Customer side
- **Entry:** Home → Pharmacy tile → Pharmacy landing (`PharmacyServicesLanding`).
- **Order Medicine** card → `pharmacy_order_flow` (specialized `PharmacyOrderFlow`).
- **Flow:** Prescription (upload or from booking) → **Address** (required; from customer addresses, no hardcoding) → **Broadcast** (`POST /pharmacy/orders/create` with `deliveryAddress`) → Backend 5km → 10km → 20km expansion (job `pharmacy-broadcast-expansion-processor`) → Pharmacy accepts → **Invoice** (proforma) → **Payment** (Razorpay) → OTP generated → **Tracking** (LiveOrderTracking, DeliveryOTPVerification).
- **My Bookings:** Vet appointment → prescription → Order medicine → `pharmacy_order_flow` with `prescriptionOrderData`; on complete → `pharmacy_order_status`.

### Vendor side (pharmacy service dashboard – online delivery part)
- **Route:** `/pharmacy/orders` → `PharmacyOrderDashboard`.
- **Tabs:** Incoming | Active | Completed.
- **Incoming:** `GET /pharmacy/orders/incoming/:vendorId`; each order shows prescription (view link via `prescription_url` or `prescription_id`), items, distance, ETA; **Accept** (opens invoice modal) / **Reject**.
- **Accept** → Invoice modal: line items + prices → **Send Invoice** (`POST /pharmacy/orders/:orderId/invoice`).
- **Active:** Orders in confirmed, invoice_generated, payment_confirmed, preparing, dispatched. For each order:
  - **Prescription** view link.
  - **Upload window:** `PerforaInvoiceUpload` is shown for status `confirmed` or `invoice_generated` so pharmacy can upload perfora invoice file (image/PDF) in addition to the line-item invoice.
  - **LogisticsPartnerAssignment** for payment_confirmed / preparing / dispatched.
  - Dispatch → Mark Delivered.
- **Completed:** Delivered orders.

### Backend (addresses, no hardcoding)
- Order create: `deliveryAddress` from request (customer address; `lat`/`lng` or `latitude`/`longitude` required).
- Pharmacies selected by distance from vendor profile (`v.latitude`, `v.longitude`). No hardcoded addresses.

---

## Part 2 — OTC & Medical-Grade Products (Catalog Buying)

### Customer side
- **Entry:** Pharmacy landing → **Shop Now** → `pharmacy_store` (`PharmacyStore`).
- **Catalog:** Loads from `GET /customer/pharmacy/medicines` (or products); categories (e.g. antibiotics, vaccines, supplements); prescription-required banner with **Upload Prescription** when needed.
- **Cart:** Add to cart (CartContext); optional prescription upload for Rx items.
- **Checkout:** `pharmacy_checkout` → `PharmacyCheckout`; address selection, payment; `POST /customer/pharmacy/orders` for catalog order type.
- **Experience:** Same pattern as pet product seller (browse → cart → checkout → order success / tracking).

### Vendor side (pharmacy service dashboard – OTC/catalog part)
- **Route:** `/pharmacy` → Pharmacy **Inventory** page (`PharmacyPage`).
- **Purpose:** Manage medicine stock (add medicine, list, price, stock, category). This is the catalog that feeds the customer-facing pharmacy store (OTC and medical-grade products).
- **APIs:** `GET /vendor/:id/pharmacy/medicines`, `POST /vendor/:id/pharmacy/medicines`.
- **Capability routes:** `pharmacy` → `/pharmacy`, `inventory` → `/pharmacy/inventory`, `orders` → `/pharmacy/orders`. Dashboard links to both Orders and (where shown) Inventory.

### Data flow
- Customer **PharmacyStore** uses `/customer/pharmacy/medicines` for catalog.
- Vendor **PharmacyPage** uses `/vendor/:id/pharmacy/medicines` for inventory.
- Backend can aggregate pharmacy vendors’ medicines for customer catalog; OTC/catalog orders may use a different order type/path than broadcast prescription orders.

---

## Upload Window (Pharmacy Service Dashboard)

- **Requirement:** An upload window in the pharmacy service dashboard for the **online medicine (broadcast)** flow.
- **Implementation:** In `PharmacyOrderDashboard`, for **Active** tab orders with status `confirmed` or `invoice_generated`, the **PerforaInvoiceUpload** component is rendered so the pharmacy can upload a perfora invoice file (image/PDF). It was previously imported but not rendered; it is now visible in the Active order card.
- **Prescription:** Incoming and Active orders already show “View Prescription” (prescription_url or prescription_id). No separate prescription upload on vendor side for viewing (customer uploads prescription in Order Medicine flow).

---

## Summary Table

| Part | Customer | Vendor (same pharmacy dashboard) | Notes |
|------|----------|----------------------------------|--------|
| **1. Online delivery** | Pharmacy landing → Order Medicine → PharmacyOrderFlow (prescription → address → broadcast → accept → invoice → pay → OTP → track) | `/pharmacy/orders` — Incoming / Active / Completed; Accept, invoice modal, **PerforaInvoiceUpload** in Active; prescription view; logistics | Address from customer; pharmacy location from vendor profile |
| **2. OTC/catalog** | Pharmacy landing → Shop Now → PharmacyStore (catalog → cart → PharmacyCheckout) | `/pharmacy` — Inventory (medicines list, add medicine); catalog for store | Same dashboard: Orders = delivery, Pharmacy page = catalog/inventory |

---

## Files Touched (This Pass)

- **Vendor:** `apps/vendor-web/components/vendor/pharmacy/PharmacyOrderDashboard.tsx` — Rendered `PerforaInvoiceUpload` in Active orders for status `confirmed` or `invoice_generated` (upload window).
- **Doc:** `docs/PHARMACY_FLOWS_AUDIT_TWO_PARTS.md` (this file).
