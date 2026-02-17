# Package Visibility, Utilization & Vendor Chat – Forensic Analysis

**Date:** 2026-02-14  
**Scope:** (1) Package contents visibility at/after purchase, (2) Package utilization tracking (session/combo/unlimited), (3) Vendor dashboard chat widget and package context in chat.

---

## 1. Package contents visibility (what’s included)

### Current state

- **Customer purchase flow:** Package is often chosen from vendor service list; price and high-level package details (e.g. total sessions, validity) come from `vendor_services.metadata.packageDetails` (totalSessions, validityDays, sessionDuration). **No structured “included services” list is shown at checkout or on the order confirmation.**
- **Package definition (vendor):**
  - **VendorCustomServiceCreationEnhanced / CreatePackageFlow / EnhancedPackageCreationModal:** Support `includedServices` (and `includedServicesDetails`) for **combo** packages. Stored in `vendor_services.metadata` (e.g. `packageDetails.includedServices`).
  - **Session packages:** Usually defined as “X sessions” + validity; no per-service breakdown in a standard shape.
- **Backend:**
  - **package_purchases:** Has `package_name`, `package_type`, `total_sessions`, `remaining_sessions`, `unlimited_usage`, `expires_at`. **No column for “included services” or full package snapshot.** Optional `utilization_details` / `next_session_info` (migration 201) exist but are not populated with “what’s included”.
  - **service_packages:** Has `sessions_included`, `service_type`; later migrations / code may add `service_ids` or similar; **not consistently used for “included services” in customer APIs.**
  - **GET /customer/:phone/packages:** Returns basic package fields (packageName, vendorName, totalSessions, remainingSessions, sessionsUsed, expiresAt, isUnlimited, packageType, status). **Does not return `includedServices` or any “what’s in this package” list.**
- **PackageTrackingDashboard (customer):** Calls `/customer/${phone}/packages/all` (endpoint may not exist or may alias to `/customer/:phone/packages`). Expects `includedServices: PackageService[]` and usage fields. **Today the API does not provide `includedServices`, so the UI cannot show “what’s included” reliably.**

### Gaps

1. **At purchase:** No single place that shows “This package includes: Service A, Service B, …” (and for session packages, “X sessions of [service name]”) before payment.
2. **After purchase:** Customer “My packages” / package tracking does not get “included services” from the API, so “what’s in this package” is not shown.
3. **Single source of truth:** Package “contents” live in vendor_services metadata (and possibly service_packages); they are **not** copied into `package_purchases` at purchase time, so post-purchase we cannot show a snapshot of what was bought without joining back to vendor/package definition (which may change).

### Recommended approach

1. **Snapshot at purchase**
   - When creating a `package_purchases` row (or equivalent booking with package), persist a **package snapshot** (e.g. JSONB `package_snapshot` or extend existing `package_details` in booking):
     - For **session packages:** `{ totalSessions, sessionDuration, validityDays, serviceName, serviceId }`.
     - For **combo packages:** `{ includedServices: [{ id, name, quantity? }], totalSessions?, validityDays? }`.
     - For **unlimited:** `{ unlimited: true, validityDays?, serviceName? }`.
   - Source this from the vendor_services (or service_packages) definition at the moment of purchase so the customer always sees “what was included when I bought it”.

2. **API response**
   - **GET /customer/:phone/packages** (and any alias like `/packages/all`): For each package, include:
     - `includedServices` (or equivalent) from:
       - Preferred: from the snapshot stored at purchase (`package_purchases.package_snapshot` or booking `package_details`), **or**
       - Fallback: resolve from `package_id` → service_packages / vendor_services and return current definition (with a flag like `fromSnapshot: true/false`).
   - Same structure should be used in booking confirmation and in “package details” in customer app (e.g. PackageTrackingDashboard, booking detail).

3. **UI**
   - **Checkout / confirmation:** Show a clear “What’s included” section from the snapshot (or from package definition if no snapshot yet).
   - **My packages / tracking:** Show the same “included” list and usage (see section 2).

---

## 2. Package utilization tracking (what’s used, what’s left)

### Current state

- **DB:**
  - **package_purchases:** `total_sessions`, `remaining_sessions`, `unlimited_usage`, `expires_at`, `status`; optional `utilization_details` (JSONB), `next_session_info` (JSONB).
  - **bookings:** `package_purchase_id`, `is_package_session`, `package_session_number` (migration 070).
  - **package_scheduled_sessions:** Per-purchase, per-session rows (session_number, scheduled_date/time, booking_id, status).
  - **package_usage_log:** Audit (session_used, session_refunded, etc.) (migration 070).
- **Flows:**
  - **package-booking.ts:** Create booking from package → decrement `remaining_sessions` (if not unlimited) and write usage log. Session-based logic is in place.
  - **customer-phone-convenience.ts GET /customer/:phone/packages:** Returns `sessionsUsed` (derived as total_sessions - remaining_sessions), `remainingSessions`, `isUnlimited`, `expiresAt`. No breakdown by “which service” or “which session #” in the response.
  - **PackageTrackingDashboard:** Expects `usedSessions`, `remainingSessions`, `totalSessions`, `sessionsHistory`, `includedServices`, `status`, `daysRemaining`, etc. API currently does not return `sessionsHistory` or `includedServices`; endpoint path may be wrong (`/packages/all`).
- **Package types in code:**
  - **Session packages:** Fixed number of sessions (e.g. 5 training sessions). Tracked by `remaining_sessions` and bookings linked via `package_purchase_id`.
  - **Combo packages:** Multiple services in one “bundle”; sometimes one booking consumes multiple items. No single standard for “how many units of each service” are consumed across the platform.
  - **Unlimited:** `unlimited_usage = true`; no session count to decrement; often time-bound (validity).

### Gaps

1. **Session packages:** Utilization is stored (remaining_sessions, package_usage_log) but:
   - Customer APIs do not consistently return **sessionsHistory** (list of completed sessions with date, service, provider).
   - Vendor does not see “X of Y used” and “what’s left” in a single, prominent place (e.g. in chat or booking list).
2. **Combo packages:** No standard “per-service usage” (e.g. “2/3 grooming, 1/1 nail trim”). If stored in metadata, it’s not exposed in a unified way for customer and vendor.
3. **Unlimited packages:** Only validity matters; “utilization” is N/A. Need to show “Valid until &lt;date&gt;” and possibly “unlimited” label.
4. **Trainer continuity:** Request to “keep chat window open until package is exhausted” and notify vendor – this is a **product/UX** choice (e.g. keep conversation visible in “Messages” list with package badge and remaining sessions). Technically we have package_purchase_id and remaining_sessions; we need to surface them in chat and possibly trigger notifications when sessions are low or exhausted.

### Recommended approach

1. **Single utilization model**
   - **Session-based:** Use existing `remaining_sessions` and `package_usage_log`; add or reuse `package_scheduled_sessions` for “next session” and history.
   - **Combo:** Either (a) treat as “N sessions” where each booking consumes 1 session and all included services are delivered in that visit, or (b) add a small JSONB “usage_breakdown” per purchase (e.g. `{ serviceId1: used, serviceId2: used }`) and update on each booking. Prefer (a) for simplicity unless business requires per-service counts.
   - **Unlimited:** Only show validity and “Unlimited” badge; no session count.

2. **APIs**
   - **GET /customer/:phone/packages** (and vendor-facing package-by-customer APIs):
     - Include for each package: `totalSessions`, `usedSessions`, `remainingSessions`, `isUnlimited`, `expiresAt`, `daysRemaining`, `status`.
     - Optionally: `sessionsHistory` (from bookings + package_scheduled_sessions) with last 10–20 completed sessions (date, service name, booking id).
   - **Vendor:** When returning a booking or conversation that is linked to a package (`package_purchase_id`), include `packageUtilization: { totalSessions, remainingSessions, usedSessions, isUnlimited, expiresAt }` so the vendor dashboard and chat can show “3 of 5 sessions left”.

3. **Vendor notifications**
   - When `remaining_sessions` reaches 0 (or 1), or when package expires soon: trigger notification to vendor (and optionally customer). Reuse existing notification pipeline (e.g. vendor_notifications table) with type like `package_almost_exhausted` / `package_exhausted`.

4. **Media upload**
   - If “all sorts media upload” means attachments in chat: chat already supports file upload (fileId, fileName in chat_messages). Ensure vendor can attach and view in VendorChatModal; no change to utilization model.

---

## 3. Vendor dashboard chat widget & package context

### Current state

- **Dashboard header (VendorDashboard.tsx, SoloProviderDashboard.tsx):**
  - **Bell icon:** Opens `VendorNotificationModal` (notifications). Wired and working.
  - **Message icon (MessageSquare):** Rendered when `capabilities.chat` is true but **has no `onClick`**. It is not wired to any chat or messages view. **This is the “message button does not work” bug.**
- **Chat from Booking Management:**
  - In **VendorBookingManagement**, each booking card has a “Chat” button that calls `handleOpenChat(booking)` → `setChatBooking(booking)` and `setShowChatModal(true)` → **VendorChatModal** opens with that booking’s conversation. So chat **from the booking list** works.
- **Chat backend:**
  - **GET /chat/booking/:bookingId/conversation:** Returns messages and booking summary (status, service_type, customer name/phone, etc.). Used by VendorChatModal. **Does not include package utilization.**
  - **GET /chat/conversations:** Exists but is **customer-centric** (filters by customer_id / customer_phone). There is **no vendor-side endpoint** that returns “all conversations (bookings with messages) for this vendor” with last message, unread count, booking ID, service name, status, time.

### Gaps

1. **Message button:** Does nothing; users cannot open “my messages” from the dashboard header.
2. **Vendor conversation list:** No API to list “all bookings that have chat messages” for the vendor with:
   - booking ID, service name, booking date/time, status (follow-up vs new, etc.)
   - customer name/phone
   - last message preview and unread count
3. **Package context in chat:** When the booking is a package booking, the chat modal (and any conversation list) does not show “Package: X of Y sessions left” or “Valid until …”, so the vendor cannot see utilization when replying.

### Recommended approach

1. **Vendor conversations API**
   - Add **GET /vendor/:vendorId/chat/conversations** (or **GET /chat/vendor/:vendorId/conversations**):
     - Query: bookings where `vendor_id = :vendorId` and `EXISTS (SELECT 1 FROM chat_messages WHERE booking_id = bookings.id)`.
     - For each booking: last message (text + time), unread count (messages from customer not read by vendor), booking_id, service_name, booking_date, booking_time, status, customer_name, customer_phone.
     - For package bookings: join `package_purchases` on `bookings.package_purchase_id` and include `packageUtilization: { totalSessions, remainingSessions, usedSessions, isUnlimited, expiresAt, packageName }`.
     - Sort by last_message_time DESC (or booking date).
   - Optional: query param `unreadOnly=true` to show only conversations with unread messages.

2. **Wire the message button**
   - On click: open a **VendorChatConversationsModal** (or slide-over) that:
     - Calls GET /vendor/:vendorId/chat/conversations.
     - Renders a list: each row = customer name, service name, booking ID, booking date/time, status, last message preview, unread badge.
     - Optional: “Package: 3/5 left” or “Unlimited · Valid until …” for package bookings.
     - On row click: close list and open **VendorChatModal** for that booking (same as current flow). Optionally navigate to Booking Management with that booking selected and chat open.

3. **VendorChatModal**
   - When opening with a booking that has `package_purchase_id` (or when conversation API returns `packageUtilization`), pass it into the modal and show a small **package summary** at the top: “Package: &lt;name&gt; · 3 of 5 sessions left” or “Unlimited · Valid until &lt;date&gt;”. This allows the vendor to respond with context (e.g. “You have 2 sessions left; we can schedule the next one.”).

4. **Notifications**
   - When a customer sends a chat message, ensure a **vendor notification** is created (or existing logic is used) so the Bell dropdown can show “New message from &lt;customer&gt;” and the message icon can show an unread count (from the same conversations API). That ties “notification” and “messages” together.

---

## Implementation order (suggested)

| # | Item | Effort | Dependencies |
|---|------|--------|--------------|
| 1 | Add GET /vendor/:vendorId/chat/conversations with last message, unread, booking details, optional package utilization | Backend | chat_messages, bookings |
| 2 | Wire dashboard Message button to open VendorChatConversationsModal; modal fetches and lists conversations, opens VendorChatModal on row click | Frontend | #1 |
| 3 | In VendorChatModal (and conversation API), include package utilization for package bookings and show “X of Y sessions left” (or unlimited) in modal header | Backend + Frontend | package_purchases, bookings.package_purchase_id |
| 4 | Add package_snapshot (or use package_details) at package purchase; include in GET /customer/:phone/packages as includedServices / what’s included | Backend + purchase flow | package_purchases or booking |
| 5 | Extend GET /customer/:phone/packages to return sessionsHistory (and align path /packages/all if needed) for PackageTrackingDashboard | Backend | bookings, package_scheduled_sessions |
| 6 | Show “What’s included” in customer checkout and in My Packages / tracking using snapshot or package definition | Frontend | #4 |
| 7 | Vendor notification when package almost exhausted / exhausted; optional “keep chat visible” UX for package customers | Backend + optional frontend | package_purchases, vendor_notifications |

---

## Summary

- **Package contents:** Not visible at purchase or in “My packages” because the API doesn’t return `includedServices` and purchase record doesn’t store a snapshot. Fix: snapshot at purchase + return in customer packages API + show in UI.
- **Utilization:** Session counts and logs exist; customer and vendor UIs don’t get full utilization and history. Fix: extend packages API with used/remaining/history and optional packageUtilization in booking/chat responses; show in dashboard and chat.
- **Vendor chat widget:** Message icon is not wired; there is no vendor conversation list API. Fix: add GET /vendor/:vendorId/chat/conversations, wire message button to a conversations modal, and show package utilization in chat modal and list.

This document is the forensic baseline; implementation can follow the order above with minimal risk to existing flows.
