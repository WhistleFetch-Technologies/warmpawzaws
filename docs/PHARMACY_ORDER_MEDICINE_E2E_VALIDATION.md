# Pharmacy Order Medicine – UI, Modal, Endpoint & Parameter Handoff Validation

**Date:** 2026-01-31  
**Scope:** Customer order-from-prescription flow, Vendor pharmacy dashboard, End-to-end parameter tracing

---

## 1. CUSTOMER UI → MODAL WIRING

| Component | Location | Receives | Passes / Renders | Status |
|-----------|----------|----------|------------------|--------|
| **CustomerHomeWrapper** | wrappers/CustomerHomeWrapper.tsx | phone, onNavigate | handleReorderMedicine, prescriptionOrderData | OK |
| **MyBookings** | MyBookings.tsx L349-359 | phone, onReorderMedicine, onNavigate | BookingDetailModal | OK |
| **BookingDetailModal** | BookingDetailModal.tsx L351-358 | bookingId, petId, phone, onReorderMedicine, onNavigate | PrescriptionHistoryModal, PrescriptionModal | OK |
| **PrescriptionHistoryModal** | PrescriptionHistoryModal.tsx L44-51 | bookingId, petId, customerPhone, onOrderMedicine | Order button → onOrderMedicine(id, bookingId, meds) | OK |
| **PrescriptionModal** | PrescriptionModal.tsx L60-67 | prescriptionId, bookingId, prescription, customerPhone, onReorderMedicine | handleOrderMedicine → onReorderMedicine or navigate | OK |
| **PharmacyOrderFlow** | specialized/PharmacyOrderFlow.tsx | customerPhone, customerId, prescriptionId?, prescriptionUrl?, onBack, onComplete | Steps: prescription → address → broadcasting → accepted → invoice → payment → tracking | OK |
| **AddAddressModal** | shared/AddAddressModal.tsx | phone, isOpen, onClose, onSuccess | POST /customer/addresses | OK |

---

## 2. PARAMETER HANDOFF TRACE

### Path A: My Bookings → Prescription History → Order

```
PrescriptionHistoryModal [Order button click]
  → onOrderMedicine(selectedPrescription.id, bookingId, medications)
  → BookingDetailModal receives: onOrderMedicine(prescriptionId, bookingId, medications)
  → calls onReorderMedicine(medications || [], prescriptionId, bookingId)
  → CustomerHomeWrapper.handleReorderMedicine(medications, prescriptionId, bookingId)
  → if prescriptionId: setPrescriptionOrderData({ prescriptionId }), setCurrentScreen('pharmacy_order_flow')
  → PharmacyOrderFlow receives: prescriptionId from prescriptionOrderData, customerPhone=phone, customerId=phone
```

**Parameter mapping:**
| Source | Target | Value |
|--------|--------|-------|
| selectedPrescription.id | prescriptionId | ✓ |
| medications | handleReorderMedicine arg 1 | ✓ |
| prescriptionId | handleReorderMedicine arg 2 | ✓ |
| bookingId | handleReorderMedicine arg 3 | ✓ |
| prescriptionOrderData.prescriptionId | PharmacyOrderFlow.prop | ✓ |
| phone (from wrapper) | PharmacyOrderFlow.customerPhone, customerId | ✓ |

### Path B: Prescription Modal (single prescription view) → Order

```
PrescriptionModal [Order Medicine click]
  → if onReorderMedicine && prescriptionIdToUse: onReorderMedicine(medications, prescriptionIdToUse, bookingId)
  → BookingDetailModal bridge: onReorderMedicine(medications, prescriptionId, bid)
  → same as Path A
  OR
  → window.location.href = /prescriptions/${id}/order?phone=${customerPhone}
  → PrescriptionOrderPageClient: customerPhone from URL or localStorage
  → PharmacyOrderFlow(prescriptionId, customerPhone, customerId)
```

### Path C: Pharmacy Landing → Order Medicine (no prescription yet)

```
PharmacyServicesLanding [Order Medicine button]
  → onNavigate('pharmacy_order_flow')  // no data.prescriptionId
  → setCurrentScreen('pharmacy_order_flow')
  → prescriptionOrderData = null (not set)
  → PharmacyOrderFlow: prescriptionId=undefined, starts at step 'prescription'
```

---

## 3. ENDPOINT REQUEST/RESPONSE VALIDATION

### GET /customer/addresses?phone=xxx

| Item | Expected | Actual | Status |
|------|----------|--------|--------|
| **Request** | Query param `phone` | `?phone=${encodeURIComponent(customerPhone)}` | OK |
| **Response** | `{ addresses: [...] }` | Backend returns `{ success, addresses }` | OK |
| **Address shape** | addressLine1, city, pincode, coordinates | Backend maps address_line1 → addressLine1 | OK |
| **Route** | Registered before /customer/:id | registerAddressEndpoints L407 | OK |

### POST /pharmacy/orders/create

| Item | Expected | Actual | Status |
|------|----------|--------|--------|
| **Request body** | customerId, customerPhone, prescriptionId?, prescriptionUrl?, deliveryAddress{lat,lng,...} | PharmacyOrderFlow L316-332 | OK |
| **deliveryAddress** | lat, lng, latitude, longitude required | getAddressLatLng ensures coords | OK |
| **Response** | success, orderId, broadcast | Backend L276-295 | OK |
| **Vendor location** | From vendors.latitude, vendors.longitude | broadcastToPharmacies uses vendors table | OK |

### GET /pharmacy/orders/:orderId/broadcast-status

| Item | Expected | Actual | Status |
|------|----------|--------|--------|
| **Polling** | Every 5s during broadcast | PharmacyOrderFlow L390 | OK |
| **Response** | success, broadcastStatus, broadcasts | Backend L1766-1789 | OK |
| **broadcastStatus** | currentRadius, accepted, totalBroadcasts | Frontend maps L406-412 | OK |
| **Pharmacy accepted** | acceptedBroadcast from broadcasts | Frontend L416-424 | OK |

### GET /customer/orders/:orderId/pharmacy-status

| Item | Expected | Actual | Status |
|------|----------|--------|--------|
| **Polling** | When step=accepted, every 5s | PharmacyOrderFlow L186 | OK |
| **Response** | order with status, medicines, subtotal, fees | customer-enhanced.ts L1901-1918 | OK |
| **invoice_generated** | Triggers step → invoice | Frontend L189 | OK |

### POST /pharmacy/orders/:orderId/accept (Vendor)

| Item | Expected | Actual | Status |
|------|----------|--------|--------|
| **Request** | pharmacyId, availableItems, unavailableItems | PharmacyOrderDashboard L221-225 | OK |
| **Backend** | Resolves broadcast by orderId+pharmacyId | pharmacy-orders.ts L620-628 | OK |

### GET /pharmacy/orders/incoming/:vendorId (Vendor)

| Item | Expected | Actual | Status |
|------|----------|--------|--------|
| **Response** | orders (or incomingOrders) | Backend returns `{ orders }` | OK |
| **Frontend** | data.incomingOrders ?? data.orders | PharmacyOrderDashboard L166 | OK |
| **prescription_url** | In SELECT | Backend L987 added | OK |

---

## 4. MODAL IMPORTS & DEPENDENCIES

| Component | Imports | Used | Status |
|-----------|---------|------|--------|
| **CustomerHomeWrapper** | PharmacyOrderFlow, AddAddressModal (via PharmacyOrderFlow) | L1281 | OK |
| **PharmacyOrderFlow** | AddAddressModal, DeliveryOTPVerification, PharmacyBroadcastMap, useWebSocket | All used | OK |
| **PrescriptionHistoryModal** | PrescriptionDocument (dynamic), apiClient, toast | All used | OK |
| **PharmacyOrderDashboard** | apiClient, LogisticsPartnerAssignment, PerforaInvoiceUpload, toast | All used | OK |

---

## 5. GAPS & EDGE CASES

| Item | Risk | Notes |
|------|------|-------|
| **orderMedicineFromPrescription event** | ✓ FIXED | Listener added in CustomerHomeWrapper; sets prescriptionOrderData and navigates to pharmacy_order_flow. |
| **customer/addresses route** | — | Must be registered before /customer/:customerId. Handler index L407 confirms. |
| **Auth redirect** | ✓ FIXED | Auth page reads ?redirect= and navigates there after OTP verification. |
| **localStorage keys** | ✓ FIXED | Auth page sets customerPhone, customer_phone, phone on login. |
| **AddAddressModal customerId** | — | AddAddressModal uses phone; POST /customer/addresses resolves customer from phone. |

---

## 6. VENDOR DASHBOARD WIRING

| Action | Endpoint | Params | Status |
|--------|----------|--------|--------|
| **Fetch incoming** | GET /pharmacy/orders/incoming/:vendorId | vendorId from props | OK |
| **Fetch active** | GET /pharmacy/:vendorId/orders?status=... | vendorId | OK |
| **Accept** | POST /pharmacy/orders/:orderId/accept | pharmacyId, availableItems | OK |
| **Reject** | POST /pharmacy/orders/:orderId/reject | pharmacyId, reason | OK |
| **View Prescription** | prescription_url open in tab, or GET /prescriptions/:id for prescription_id | — | OK |
| **Generate Invoice** | POST /pharmacy/orders/:orderId/invoice | invoiceItems | OK |

---

## 7. SUMMARY – VALIDATION RESULT

| Area | Status |
|------|--------|
| UI → Modal wiring | ✓ All components correctly connected |
| Parameter handoff | ✓ prescriptionId, medications, bookingId flow correctly |
| Address loading | ✓ GET /customer/addresses?phone=, response shape matches |
| Order create | ✓ POST /pharmacy/orders/create with real address |
| Broadcast polling | ✓ GET broadcast-status, response parsed correctly |
| Invoice polling | ✓ GET pharmacy-status, invoice_generated → invoice step |
| Vendor incoming | ✓ GET incoming, accepts data.orders |
| Vendor accept/reject | ✓ Correct endpoints, param shape |
| Prescription view | ✓ prescription_url or fetch by prescription_id |

**Conclusion:** UI, modal wiring, endpoint responses, and parameter handoff are correctly traced and validated. All gaps fixed (2026-01-31): orderMedicineFromPrescription listener added, auth redirect supported, localStorage keys set on login.
