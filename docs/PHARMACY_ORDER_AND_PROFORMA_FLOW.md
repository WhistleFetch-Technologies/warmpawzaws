# Pharmacy: Where Orders Are Received & Proforma Invoice Flow

**Date:** 2026-01-30  
**Scope:** Pharmacy vendor app — order reception, proforma invoice, and UI wiring.

---

## 1. Where pharmacy orders are received

- **Screen:** Pharmacy **Orders** (PharmacyOrderDashboard).
- **Route:** Vendor app → **Orders** button (dashboard) → `/pharmacy/orders`.
- **API:** `GET /pharmacy/orders/incoming/:vendorId` returns orders that are **broadcasting** and have a **pending** broadcast for this pharmacy (5km → 10km → 20km radius).
- **UI:** **Incoming** tab lists these orders with:
  - Order number, customer, distance, delivery fee, expiry countdown
  - Prescription context (if any)
  - Item list (medicine name, quantity)
  - **Accept** / **Reject**

So: **orders are received on the Pharmacy Orders page, Incoming tab**, driven by the incoming API above. No separate “Service Management” or “Inventory & Store” for pharmacy — only **Orders** and **Profile** (per flow).

---

## 2. Proforma invoice flow (frontend/UI)

1. **Pharmacy accepts order**  
   - Clicks **Accept** on an incoming order.  
   - Backend: `POST /pharmacy/orders/:orderId/accept` with `{ pharmacyId }` (resolves broadcast for this pharmacy and assigns order to them).  
   - Order status → `accepted`.

2. **Invoice modal opens**  
   - Same screen shows a **Generate Invoice** modal.  
   - Pharmacy sees order lines (name, quantity) and can **edit unit price (₹)** per line.  
   - UI shows Subtotal, Tax (5%), Delivery Fee, and **Total**.

3. **Pharmacy sends proforma**  
   - Clicks **Send Invoice**.  
   - Frontend calls `POST /pharmacy/orders/:orderId/invoice` with:
     - `invoiceItems`: `[{ name, quantity, unit_price }]`  
   - Backend:
     - Normalizes items (accepts `items` or `invoiceItems`, `price` or `unit_price`).
     - Computes **subtotal + delivery_fee + platform_fee + convenience_fee** = `total_amount`.
     - Saves items and total; sets status to **`invoice_generated`**.
     - Notifies customer (WebSocket + event).

4. **Customer sees invoice**  
   - Customer app shows invoice (subtotal, delivery, platform fee, convenience fee, total).  
   - Customer approves and pays online → order confirmed, OTP generated, then delivery/tracking.

So: **proforma is built and sent from the same Pharmacy Orders screen**, in the modal that opens after **Accept**, and the backend persists it and moves the order to `invoice_generated` so the customer can approve and pay.

---

## 3. Backend touchpoints (orders + proforma)

| Purpose | Endpoint / note |
|--------|----------------------------------|
| Incoming orders for pharmacy | `GET /pharmacy/orders/incoming/:vendorId` |
| Pharmacy accept (by orderId) | `POST /pharmacy/orders/:orderId/accept` body: `{ pharmacyId }` |
| Pharmacy reject | `POST /pharmacy/orders/:orderId/reject` body: `{ pharmacyId, reason }` |
| Proforma invoice | `POST /pharmacy/orders/:orderId/invoice` body: `{ invoiceItems: [{ name, quantity, unit_price }] }` |
| Active/Completed list | `GET /pharmacy/:vendorId/orders?status=...` |

---

## 4. Pharmacy vendor UI (only flow-required items)

- **VendorDashboard / SoloProviderDashboard** for pharmacy:
  - **Orders** (primary) → `/pharmacy/orders`.
  - **Profile** (optional).
- **Hidden for pharmacy:** Service Management, Inventory & Store, Vet Center Services, Additional Features (Rx, Substances, Expiry, etc.), so the flow is only: receive orders → accept → proforma → (customer pay & delivery).

---

## 5. DB / API alignment

- **pharmacy_orders:** `order_number`, `subtotal`, `delivery_fee`, `platform_fee`, `convenience_fee`, `total_amount`, `status` (e.g. `broadcasting` → `accepted` → `invoice_generated` → …).
- **Incoming API** returns `order_id`, `order_number`, `broadcast_id`, `expiresIn`, `items` (with `product_name` / `medicine_name`), `delivery_fee`, etc.
- **Invoice API** accepts `invoiceItems` or `items`; each item: `name`, `quantity`, `unit_price` (or `price`); backend includes convenience_fee in total and sets `status = 'invoice_generated'`.

This keeps **where orders are received** (Orders → Incoming) and **how proforma works** (Accept → modal → Send Invoice → backend) clear and wired end-to-end.
