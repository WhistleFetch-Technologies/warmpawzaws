# Package: Payment, Snapshot, and Chat

## 1. DB migration 553 (package_snapshot)

**Run for both Dev and Prod:**

```bash
# Both environments
node scripts/apply-migration-553-package-snapshot.js

# Dev only
node scripts/apply-migration-553-package-snapshot.js --dev-only

# Prod only
node scripts/apply-migration-553-package-snapshot.js --prod-only
```

Uses `scripts/run-migration-rds-node.js` under the hood. Requires AWS CLI configured and access to RDS (VPN/bastion if needed). Migration adds:

- `package_purchases.package_snapshot` (JSONB) for “what’s included” at purchase
- Index `idx_package_purchases_customer_vendor_active` for active-package lookups

---

## 2. Payment when service is included in package

**Two supported flows:**

### A. Dedicated package flow (existing)

- Customer chooses “Use package session” in the booking UI.
- Frontend calls **POST /bookings/create-from-package** with `packagePurchaseId`, `customerId`, `vendorId`, date, time, etc.
- Backend creates a booking with `total_amount = 0`, `payment_status = 'completed'`, `package_purchase_id`, `is_package_session = true`, deducts one session, and logs in `package_usage_log`.
- **No payment step**; booking is confirmed immediately.

### B. Single booking create with package (new)

- Customer selects a service that is “In your package” (`inActivePackage`) and the app sends **packagePurchaseId** in the normal create-booking request.
- **POST /bookings** (CreateBooking) accepts optional **`packagePurchaseId`** (API contract in `packages/api-contracts`).
- If `packagePurchaseId` is present and valid (active package for that customer and vendor):
  - Backend sets `total_amount = 0`, `payment_status = 'completed'`, `status = 'confirmed'`.
  - Sets `package_purchase_id`, `is_package_session`, `package_session_number`.
  - Deducts one session and inserts into `package_usage_log` in the same transaction.
- So the **same** create-booking endpoint can do “pay” or “use package”; no separate payment step when using a package.

**Frontend:** When the selected service has `inActivePackage` and the user has an active package, the client can send `packagePurchaseId` (e.g. `activePackagePurchaseId` from the vendor services response) in the booking payload so the backend applies the package and skips payment.

---

## 3. Customer sees active packages and “Message vendor” (chat)

- **Active packages:** **GET /customer/:phone/packages** returns list with `includedServices` (from `package_snapshot` or package definition). My Packages / PackageTrackingDashboard uses this.
- **Chat is booking-scoped:** Chat is tied to a `bookingId` (e.g. **GET/POST /chat/booking/:bookingId/...**). So to “message vendor” for a package, we need a booking with that vendor.
- **Latest booking by vendor:** **GET /customer/:phone/latest-booking-by-vendor?vendorId=...** returns the latest non-cancelled booking for that customer and vendor (`bookingId`, `vendorName`, `vendorPhoto`). If none, the customer has no booking yet with that vendor.
- **Package dashboard “Message” button:** In `packages/PackageTrackingDashboard.tsx`, each active package card has a “Message” button. On click it:
  1. Calls **GET /customer/:phone/latest-booking-by-vendor?vendorId=**`pkg.vendorId`.
  2. If a booking exists: calls **onOpenChat(bookingId, vendorName, vendorPhoto)** if provided, otherwise **onNavigate('open-chat', { bookingId, vendorName, vendorPhoto })**.
  3. If no booking: shows toast “Book a session with this vendor first to unlock chat.”
- **Parent responsibility:** Any screen that renders `PackageTrackingDashboard` should either:
  - Pass **onOpenChat** that opens the app’s chat UI (e.g. set chat state with `bookingId` / vendor info), or
  - Handle **onNavigate('open-chat', data)** and open the same chat UI (e.g. set global chat state or route to chat with `data.bookingId`).

This works for **all vendor types** (vet, grooming, training, etc.) as long as the customer has at least one booking with that vendor; chat is always per-booking.

---

## 4. Summary

| Item | Detail |
|------|--------|
| Migration 553 | Run via `node scripts/apply-migration-553-package-snapshot.js` (dev and/or prod). |
| Payment for package-included service | Use **create-from-package** (0 payment) or send **packagePurchaseId** in **create booking** (same endpoint, 0 payment, no payment step). |
| Mark service as ₹0 at selection | Backend marks 0 when `packagePurchaseId` is valid; frontend should pass it when user selects an “In your package” service. |
| Active packages | **GET /customer/:phone/packages** with `includedServices`. |
| Message vendor from package | **GET /customer/:phone/latest-booking-by-vendor?vendorId=**; then open chat with returned `bookingId`; “Message” in PackageTrackingDashboard does this. |
