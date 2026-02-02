# Pharmacy Flow — Forensic Validation Report

**Date:** 2026-01-31  
**Scope:** End-to-end validation of pharmacy flows (online delivery + OTC catalog). Parameter handoff, UI/Model wiring, endpoint existence and response shape.

---

## 1. Online Medicine Delivery (Broadcast) — Customer

### 1.1 Entry Points

| Entry | Component | Navigation | Validated |
|-------|-----------|------------|----------|
| Home → Pharmacy tile | CustomerHomeWrapper | `pharmacy` → PharmacyServicesLanding | ✅ |
| Pharmacy landing → "Order Medicine" | PharmacyServicesLanding | `onNavigate('pharmacy_order_flow')` | ✅ |
| My Bookings → vet → prescription → Order medicine | BookingDetailModal / wrapper | `prescriptionOrderData` + `pharmacy_order_flow` | ✅ |

### 1.2 PharmacyOrderFlow — Steps & APIs

| Step | State / UI | API / Action | Backend Endpoint | Validated |
|------|------------|--------------|------------------|----------|
| Prescription | `step === 'prescription'`; upload or use `prescriptionId`/`prescriptionUrl` | Upload → `apiClient.upload('/storage/upload', formData)` | File upload (separate) | ✅ |
| Address | `step === 'address'`; `selectedAddress` from list | `GET /customer/addresses?phone=...` | `addresses.ts`: GET /customer/addresses | ✅ |
| Create order & broadcast | `createOrder()` | `POST /pharmacy/orders/create` with `customerId`, `customerPhone`, `prescriptionId`/`prescriptionUrl`, `deliveryAddress` (lat/lng), `notes` | pharmacy-orders.ts | ✅ |
| Broadcasting | `step === 'broadcasting'`; poll + WebSocket | `GET /pharmacy/orders/:orderId/broadcast-status`; WebSocket `subscribeToOrder(orderId)` | pharmacy-orders.ts GET broadcast-status | ✅ |
| Accepted | `step === 'accepted'`; poll for invoice | `GET /customer/orders/:orderId/pharmacy-status` (poll when step accepted) | customer-enhanced.ts GET /customer/orders/:orderId/pharmacy-status | ✅ |
| Invoice | `step === 'invoice'`; show breakdown | Same status endpoint; frontend maps `medicines`, `subtotal`, `deliveryFee`, `platformFee`, `convenienceFee`, `totalAmount` | Same | ✅ |
| Payment | `approveInvoiceAndPay()` | `POST /razorpay/create-order` { orderId, amount, customerId, type: 'pharmacy_order' } → Razorpay; then `POST /razorpay/verify-payment` | razorpay.ts: create-order stores pharmacy_order_id; verify-payment updates pharmacy_orders to payment_confirmed, creates delivery_tracking with OTP | ✅ |
| Tracking | `step === 'tracking'` | `GET /delivery/:orderId/status`; DeliveryOTPVerification uses `POST /delivery/:orderId/verify-otp` | delivery-otp.ts: GET status (pharmacy_orders + delivery_tracking); POST verify-otp | ✅ |

### 1.3 Parameter Handoff — Create Order

- **Frontend payload** (PharmacyOrderFlow): `customerId`, `customerPhone`, `prescriptionId`, `prescriptionUrl`, `deliveryAddress` (addressLine1, city, state, pincode, lat, lng, latitude, longitude), `notes`.
- **Backend** (pharmacy-orders.ts POST /pharmacy/orders/create): Expects `customerId`, `customerPhone`, `deliveryAddress` with `lat`/`lng` or `latitude`/`longitude`. Uses delivery address for broadcast; no hardcoded address. Pharmacy locations from `vendors` (latitude, longitude). ✅

### 1.4 Payment → Order Confirmation

- **create-order**: Frontend sends `orderId` (pharmacy order id), `amount`, `customerId`, `type: 'pharmacy_order'`. Backend inserts into `payments` with `pharmacy_order_id`; checks order status === `invoice_generated`. ✅
- **verify-payment**: Backend looks up payment by `razorpay_order_id`; if `pharmacy_order_id` present, updates `pharmacy_orders` to `payment_confirmed` and creates/updates `delivery_tracking` with OTP. ✅

### 1.5 Delivery Status & OTP

- **GET /delivery/:orderId/status**: Handler checks `orders` first, then `pharmacy_orders` joined with `delivery_tracking`. Returns status, delivery_otp, otp_verified, partner name/phone. `orderId` = pharmacy order id. ✅
- **POST /delivery/:orderId/verify-otp**: Verifies OTP for pharmacy_orders; updates `delivery_tracking.otp_verified` and `pharmacy_orders.status` to `delivered`. ✅

---

## 2. Online Medicine Delivery — Vendor

### 2.1 Routes & Components

| Route | Component | Purpose |
|-------|-----------|---------|
| /pharmacy/orders | PharmacyOrderDashboard | Incoming / Active / Completed tabs |

### 2.2 APIs Used (Vendor)

| Action | API | Backend | Validated |
|--------|-----|---------|----------|
| Incoming orders | GET /pharmacy/orders/incoming/:vendorId | pharmacy-orders.ts | ✅ |
| Active orders | GET /pharmacy/:vendorId/orders?status=confirmed,invoice_generated,... | pharmacy-orders.ts | ✅ |
| Completed | GET /pharmacy/:vendorId/orders?status=delivered | pharmacy-orders.ts | ✅ |
| Accept | POST /pharmacy/orders/:orderId/accept | pharmacy-orders.ts | ✅ |
| Reject | POST /pharmacy/orders/:orderId/reject | pharmacy-orders.ts | ✅ |
| Invoice (line items) | POST /pharmacy/orders/:orderId/invoice (invoiceItems) | pharmacy-orders.ts (main register) | ✅ |
| Invoice (file upload) | PerforaInvoiceUpload → POST /pharmacy/orders/:orderId/invoice (invoiceUrl) | registerAdditionalPharmacyEndpoints | ✅ |
| Dispatch | POST /pharmacy/orders/:orderId/dispatch | pharmacy-orders.ts | ✅ |
| Complete | POST /pharmacy/orders/:orderId/complete | pharmacy-orders.ts | ✅ |
| View prescription | GET /prescriptions/:id?includeDetails=true | prescriptions endpoint | ✅ |
| Logistics | GET/POST /pharmacy/orders/:orderId/logistics-partner, assign-logistics | pharmacy-orders.ts (additional) | ✅ |

### 2.3 Invoice Modal vs PerforaInvoiceUpload

- **Invoice modal** (Accept → modal): Sends line items + prices via POST /pharmacy/orders/:orderId/invoice (body: invoiceItems). Backend (main register) expects invoiceItems. ✅
- **PerforaInvoiceUpload**: Uploads file to S3, then POST /pharmacy/orders/:orderId/invoice with invoiceUrl (in registerAdditionalPharmacyEndpoints). Backend updates perfora_invoice_url. Both paths exist; dashboard now shows PerforaInvoiceUpload in Active for status confirmed/invoice_generated. ✅

---

## 3. OTC / Catalog (Store) — Customer

### 3.1 Components & APIs

| Component | API | Backend | Validated |
|-----------|-----|---------|----------|
| PharmacyStore | GET /customer/pharmacy/medicines | pharmacy-orders.ts (GET /customer/pharmacy/medicines) | ✅ Added |
| PharmacyCheckout | POST /customer/pharmacy/orders | pharmacy-orders.ts | ✅ |

### 3.2 GET /customer/pharmacy/medicines (Gap Fixed)

- **Before:** PharmacyStore called GET /customer/pharmacy/medicines; endpoint did not exist (only GET /vendor/:vendorId/pharmacy/medicines existed).
- **After:** GET /customer/pharmacy/medicines added in pharmacy-orders.ts. Aggregates products from vendors with role pharmacy/pet_pharmacy, category medicine/pharmacy, returns medicines + products array. ✅

### 3.3 POST /customer/pharmacy/orders

- **Frontend** (PharmacyCheckout): Sends items, address, phone, subtotal, taxAmount, total, prescription_verified, orderType: 'pharmacy'. Backend resolves customer by phone, maps to deliveryAddress and pharmacy order format, calculates fees, inserts pharmacy_orders. ✅

---

## 4. OTC / Catalog — Vendor

| Route | Component | API | Validated |
|-------|-----------|-----|----------|
| /pharmacy | PharmacyPage (inventory) | GET/POST /vendor/:id/pharmacy/medicines | specialized-services.ts | ✅ |

---

## 5. Handler Registration (Backend)

| Handler | File | Registered in index.ts |
|---------|------|-------------------------|
| registerPharmacyOrderEndpoints | pharmacy-orders.ts | ✅ |
| registerAdditionalPharmacyEndpoints | pharmacy-orders.ts | ✅ |
| registerDeliveryOtpEndpoints | delivery-otp.ts | ✅ |
| GET /customer/orders/:orderId/pharmacy-status | customer-enhanced.ts | ✅ (registerCustomerEndpointsEnhanced) |
| GET /customer/addresses | addresses.ts | ✅ |

---

## 6. Gaps Found & Fixes

| Gap | Fix |
|-----|-----|
| GET /customer/pharmacy/medicines missing | Added in pharmacy-orders.ts: aggregates products from pharmacy/pet_pharmacy vendors, returns medicines + products. |
| PerforaInvoiceUpload not rendered in vendor dashboard | Rendered in PharmacyOrderDashboard Active tab for status confirmed/invoice_generated. |

---

## 7. Summary Checklist

- [x] Customer: Pharmacy landing → Order Medicine → PharmacyOrderFlow (prescription → address → create → broadcast → accepted → invoice → payment → tracking).
- [x] Address: From customer addresses API; no hardcoding; backend uses deliveryAddress and vendor lat/lng.
- [x] Broadcast: POST create, GET broadcast-status; backend expansion job; WebSocket subscribeToOrder.
- [x] Payment: create-order with pharmacy orderId → payments.pharmacy_order_id; verify-payment → pharmacy_orders payment_confirmed, delivery_tracking + OTP.
- [x] Delivery: GET /delivery/:orderId/status supports pharmacy_orders; verify-otp updates pharmacy_orders to delivered.
- [x] Vendor: Incoming/Accept/Reject, Invoice modal, PerforaInvoiceUpload in Active, Logistics, Dispatch, Complete.
- [x] OTC store: GET /customer/pharmacy/medicines implemented; POST /customer/pharmacy/orders; PharmacyStore and PharmacyCheckout wired.

---

**Files Touched (This Validation)**

- Backend: `backend/lambda/src/endpoints/pharmacy-orders.ts` — Added GET /customer/pharmacy/medicines.
- Doc: `docs/PHARMACY_FLOW_FORENSIC_VALIDATION.md` (this file).
