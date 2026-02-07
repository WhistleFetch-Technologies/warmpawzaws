# Order Medicine from Prescription – End-to-End Validation Report

**Date:** 2026-01-31  
**Scope:** Customer ordering medicine directly from prescription (My Bookings → Prescription History → Order)

---

## 1. CUSTOMER FLOW – WIREFRAME

```
My Bookings
    │
    └─► Select booking (vet appointment with prescription)
            │
            └─► BookingDetailModal
                    │
                    └─► [Prescription History] button
                            │
                            └─► PrescriptionHistoryModal
                                    │
                                    ├─► List of prescriptions (uploaded + doctor-created)
                                    │
                                    └─► Select prescription → [Order] or [Broadcast] button
                                            │
                                            └─► onOrderMedicine(prescriptionId, bookingId, medications)
                                                    │
                                                    └─► handleReorderMedicine(medications, prescriptionId, bookingId)
                                                            │
                                                            └─► setPrescriptionOrderData({ prescriptionId })
                                                            setCurrentScreen('pharmacy_order_flow')
                                                                    │
                                                                    └─► PharmacyOrderFlow (specialized)
                                                                            prescriptionId passed ✓
                                                                            Starts at step 'address' ✓
                                                                            createOrder() → POST /pharmacy/orders/create
```

---

## 2. COMPONENT CHAIN – IMPORTS & HANDLERS

| Component | File | Receives | Passes / Calls | Status |
|-----------|------|----------|----------------|--------|
| **MyBookings** | MyBookings.tsx | onReorderMedicine | BookingDetailModal onReorderMedicine | OK |
| **BookingDetailModal** | BookingDetailModal.tsx | onReorderMedicine, onNavigate | PrescriptionHistoryModal onOrderMedicine | OK |
| **PrescriptionHistoryModal** | PrescriptionHistoryModal.tsx | onOrderMedicine | Order button → onOrderMedicine(id, bookingId, meds) | OK |
| **CustomerHomeWrapper** | CustomerHomeWrapper.tsx | — | handleReorderMedicine → setPrescriptionOrderData, pharmacy_order_flow | OK |
| **PharmacyOrderFlow** | specialized/PharmacyOrderFlow.tsx | prescriptionId, prescriptionUrl | createOrder → POST /pharmacy/orders/create | OK |

---

## 3. CALLBACK SIGNATURE ALIGNMENT

| Call | Signature | Notes |
|------|-----------|-------|
| **onOrderMedicine** | `(prescriptionId, bookingId, medications?) => void` | PrescriptionHistoryModal |
| **onReorderMedicine** | `(medications, prescriptionId?, bookingId?) => void` | CustomerHomeWrapper |
| **Bridge** | `onOrderMedicine(id, bid, meds) → onReorderMedicine(meds \|\| [], id, bid)` | BookingDetailModal L965-968 | OK |

---

## 4. PRESCRIPTION HISTORY MODAL – ORDER TRIGGERS

| Trigger | Location | Action | Status |
|---------|----------|--------|--------|
| **Order button** (green, ShoppingCart icon) | Prescription viewer toolbar L589-631 | onOrderMedicine(selectedPrescription.id, bookingId, medications) | OK |
| **Broadcast button** (blue, Radio icon) | L557-585 | Same onOrderMedicine – broadcasts prescription to pharmacies | OK |
| **PrescriptionDocument (A4 view) Order** | L822-828 | onOrderMedicine(id, bookingId, medications) | OK |

---

## 5. PHARMACY ORDER FLOW (specialized)

| Step | Behavior | Data | Status |
|------|----------|------|--------|
| **Initial** | If prescriptionId provided → step = 'address' | Skips prescription upload | OK |
| **Address** | Loads addresses via GET /customer/:phone/addresses | selectedAddress required | OK |
| **Create order** | POST /pharmacy/orders/create | customerId, customerPhone, prescriptionId, deliveryAddress (lat/lng) | OK |
| **Broadcast** | Order created, broadcast started | Polls /pharmacy/orders/:id/broadcast-status | OK |

---

## 6. BACKEND – POST /pharmacy/orders/create

| Field | Required | From PharmacyOrderFlow | Status |
|-------|----------|------------------------|--------|
| customerId | Yes (or customerPhone) | actualCustomerId \|\| customerId (phone) | OK |
| customerPhone | — | customerPhone (phone) | OK |
| prescriptionId | Yes* | prescriptionId from prescriptionOrderData | OK |
| prescriptionUrl | Yes* | Optional when prescriptionId present | OK |
| deliveryAddress | Yes | selectedAddress with lat/lng from addresses API | OK |
| * Either items or prescription | — | prescriptionId satisfies "prescription" | OK |

---

## 7. POTENTIAL GAPS

| Item | Risk | Notes |
|------|------|-------|
| **No addresses** | Medium | If customer has no saved addresses, address step shows empty list. User cannot proceed without adding an address. PharmacyOrderFlow does not show "Add address" – user may be stuck. |
| **PrescriptionModal direct link** | ✓ FIXED | PrescriptionModal now uses onReorderMedicine when available, or navigates with ?phone= for standalone page. |
| **/prescriptions/:id/order page** | ✓ FIXED | Now uses specialized `PharmacyOrderFlow` with customerPhone from URL or localStorage. Real address selection, no hardcoding. |
| **POST /prescriptions/:id/order-medicine** | Note | Backend has this endpoint (prescriptions.ts L950) but **frontend does not use it**. PharmacyOrderFlow and specialized PharmacyOrderFlow both use POST /pharmacy/orders/create. |

---

## 8. ALTERNATIVE FLOWS

| Flow | Component | Endpoint | Status |
|------|-----------|----------|--------|
| **My Bookings → Order** | specialized/PharmacyOrderFlow | POST /pharmacy/orders/create | OK – Wired |
| **PrescriptionModal → Order** | onReorderMedicine or /prescriptions/:id/order?phone= | PharmacyOrderFlow (specialized) | ✓ Fixed |
| **Direct /prescriptions/:id/order** | PharmacyOrderFlow (specialized) | customerPhone from URL/localStorage, real address | ✓ Fixed |

---

## 9. SUMMARY – WHAT WORKS

- **My Bookings → Booking Detail → Prescription History → Order** → PharmacyOrderFlow with prescriptionId → POST /pharmacy/orders/create → broadcast → invoice → pay → track. **End-to-end wired.**
- Callback chain: onOrderMedicine → onReorderMedicine → prescriptionOrderData → pharmacy_order_flow. **Correct.**
- Backend accepts prescriptionId and creates order with prescription_id. **OK.**

---

## 10. RECOMMENDED FIXES (if implementing)

~~1. PrescriptionOrderFlow (pharmacy) – hardcoded address~~ → **FIXED**: /prescriptions/:id/order now uses specialized PharmacyOrderFlow with real address selection.
~~2. /prescriptions/:id/order – customerId from localStorage~~ → **FIXED**: Uses customerPhone from URL ?phone= or localStorage.
~~3. Add address when empty~~ → **FIXED**: PharmacyOrderFlow has Add Address modal when no addresses.
