# Pharmacy End-to-End Flow Verification

**Date:** 2026-01-29  
**Scope:** Customer & Vendor App → Pharmacy (Order medicine, broadcast, accept, invoice, pay, OTP, track, deliver).

---

## 1. Entry Points (Customer)

| Entry | Screen | Action |
|-------|--------|--------|
| **Service dashboard** | Home → Pharmacy tile | Opens Pharmacy landing |
| **Order medicine** | Pharmacy landing → "Order Medicine" card | Navigates to `pharmacy_order_flow` (prescription → address → broadcast) |
| **My Bookings** | My Bookings → vet appointment → open → select prescription → Order medicine | `handleReorderMedicine` → sets `prescriptionOrderData`, navigates to `pharmacy_order_flow` |

- **Pharmacy landing** (`PharmacyServicesLanding`): "Order Medicine" now routes to `pharmacy_order_flow` (full flow). "Shop Now" still goes to `pharmacy_store`.
- **CustomerHomeWrapper**: Handles `pharmacy_order_flow` with `PharmacyOrderFlow` (specialized), `prescriptionId` / `prescriptionUrl` from `prescriptionOrderData`, and on complete → `pharmacy_order_status`.

---

## 2. Customer Flow (specialized/PharmacyOrderFlow)

1. **Prescription** – Upload or use from vet appointment (`prescriptionId`).
2. **Address** – Select delivery address (required for broadcast).
3. **Broadcasting** – `POST /pharmacy/orders/create` with address; backend starts 5km → 10km → 20km broadcast; UI polls `GET /pharmacy/orders/:orderId/broadcast-status`; radius expands every 2 min (backend job `pharmacy-broadcast-expansion-processor`).
4. **Accepted** – Pharmacy accepts; customer sees “Pharmacy confirmed”.
5. **Invoice** – Pharmacy submits proforma; customer sees invoice (subtotal, delivery, platform fee, convenience fee) and approves.
6. **Payment** – Pay online (Razorpay); order confirmed, OTP generated.
7. **Tracking** – Status polling; Zomato-like track; delivery OTP verification (`DeliveryOTPVerification`).
8. **Completed** – OTP confirmed; vendor and logistics updated.

---

## 3. Pharmacy Vendor (No Service Management, No Inventory)

- **VendorDashboard** (and **SoloProviderDashboard**):
  - **Pharmacy:** Shows **Orders** (primary) → `/pharmacy/orders` (PharmacyOrderDashboard). **No** Service Management, **no** Inventory & Store.
  - **Others:** Service Management and (where applicable) Inventory & Store unchanged.

- **PharmacyOrderDashboard** (`/pharmacy/orders`):
  - **Incoming** – `GET /pharmacy/orders/incoming/:vendorId`; Accept / Reject.
  - **Accept** → Open invoice modal; submit proforma `POST /pharmacy/orders/:orderId/invoice`.
  - **Active** – Confirmed, invoice sent, payment done, preparing, dispatched.
  - **Completed** – Delivered.
  - Back button → dashboard.

---

## 4. Backend Touchpoints

| Purpose | Endpoint / Job |
|---------|-----------------|
| Create order & start broadcast | `POST /pharmacy/orders/create` |
| Broadcast status (radius, counts) | `GET /pharmacy/orders/:orderId/broadcast-status` |
| Radius expansion (5→10→20 km, every 2 min) | Job: `pharmacy-broadcast-expansion-processor`; API: `POST /pharmacy/orders/:orderId/expand-broadcast` |
| Incoming orders for pharmacy | `GET /pharmacy/orders/incoming/:vendorId` |
| Pharmacy accept | `POST /pharmacy/broadcasts/:broadcastId/accept` or `POST /pharmacy/orders/:orderId/accept` |
| Pharmacy reject | `POST /pharmacy/orders/:orderId/reject` |
| Proforma invoice | `POST /pharmacy/orders/:orderId/invoice` |
| Customer order status | `GET /customer/orders/:orderId/pharmacy-status` |
| Delivery tracking / OTP | Delivery tracking endpoints + OTP verification |

---

## 5. Files Changed (This Pass)

- **Vendor:** `VendorDashboard.tsx` – No Inventory for pharmacy; Orders for pharmacy.
- **Customer:** `CustomerHomeWrapper.tsx` – Handle `pharmacy_order_flow` from pharmacy landing.
- **Customer:** `PharmacyServicesLanding.tsx` – “Order Medicine” card → `pharmacy_order_flow`.
- **Vendor:** `PharmacyOrderDashboard.tsx` – Back button, incoming orders `orders`/`incomingOrders` fix (already done earlier).

---

## 6. Flow Checklist

- [x] Customer: Service dashboard → Order medicine (Pharmacy landing → Order Medicine → full flow).
- [x] Customer: My Bookings → vet appointment → prescription → Order medicine → full flow.
- [x] Customer: Select address before broadcast.
- [x] Broadcast: 5km → 10km → 20km; expand every 2 min (backend job + API).
- [x] Pharmacy: Receives prescription; review; confirm availability (Accept); update proforma invoice.
- [x] Customer: Invoice + delivery + platform + convenience; approve and pay online.
- [x] Order confirm with OTP; listed in orders; pharmacy and logistics notified.
- [x] Delivery ETA/status; partner pickup → deliver; OTP confirmation; vendor and logistics updated.
- [x] Pharmacy vendor: No Service Management, no Inventory; Orders only.
