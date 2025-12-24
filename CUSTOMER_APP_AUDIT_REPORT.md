# CUSTOMER APP AUDIT REPORT
## Principal Platform Auditor + Senior Full-Stack Engineer Review

**Date:** 2025-01-27  
**Scope:** Customer App Only (Web + Mobile)  
**Goal:** Prove correctness or identify exact failures

---

## 🚨 CRITICAL FINDINGS

### ❌ **STOP RULE TRIGGERED: KV STORE USAGE DETECTED**

**CRITICAL VIOLATION:** Multiple endpoints still using KV store instead of SQL.

---

## ❌ FAILED MODULES

### 1️⃣ CUSTOMER SIGNUP & AUTH

**Status:** ⚠️ **PARTIALLY PASSED** (with gaps)

**What Exists:**
- ✅ OTP generation endpoint: `POST /make-server-3dd53475/otp/generate` (SQL-based)
- ✅ OTP verification endpoint: `POST /make-server-3dd53475/otp/verify` (SQL-based)
- ✅ SQL tables: `users`, `customers`, `sessions`, `otp_tokens`
- ✅ Session creation with `users` table linkage
- ✅ Customer auto-creation on first login

**What is Missing:**
- ❌ **Account deletion/deactivation endpoint** - No `DELETE /customer/:customerId` endpoint found
- ❌ **Password reset flow** - Only OTP-based auth exists (acceptable for phone-based auth)

**Invariant Violations:**
- ✅ User exists with profile (verified: `customers.user_id` → `users.id`)
- ✅ UI login maps to SQL record (verified: session creation uses SQL)

**Files Involved:**
- `supabase/functions/make-server-3dd53475/customer-routes-refactored.tsx` (lines 52-193)

**Minimal Fix:**
1. Add `DELETE /make-server-3dd53475/customer/:customerId` endpoint (soft delete: set `is_active = false`)

---

### 2️⃣ PROFILE MANAGEMENT (FULL CRUD)

**Status:** ⚠️ **PARTIALLY PASSED** (missing delete)

**What Exists:**
- ✅ View profile: `GET /make-server-3dd53475/customer/profile/:identifier` (SQL-based)
- ✅ Update profile: `POST /make-server-3dd53475/customer/profile` (SQL-based)
- ✅ SQL persistence: `customers` table with `preferences` JSONB for photo URL
- ✅ Profile photo URL stored in SQL (`preferences.profile_photo_url`)

**What is Missing:**
- ❌ **Profile photo upload endpoint** - No dedicated upload handler found in customer routes
- ❌ **Account deletion endpoint** - Missing
- ❌ **S3 upload integration** - Photo URL expected but no upload endpoint exposed to customers

**Invariant Violations:**
- ⚠️ Image URL stored in SQL but no upload path exists for customers
- ❌ No delete/update path for profile photos

**Files Involved:**
- `supabase/functions/make-server-3dd53475/customer-routes-refactored.tsx` (lines 253-441)
- `supabase/functions/make-server-3dd53475/s3-auto-uploader.tsx` (exists but may not be customer-facing)

**Minimal Fix:**
1. Add `POST /make-server-3dd53475/customer/profile/photo` endpoint using `s3-auto-uploader.tsx`
2. Add `DELETE /make-server-3dd53475/customer/:customerId` endpoint

---

### 3️⃣ ADDRESS MANAGEMENT

**Status:** ❌ **FAILED** (KV store usage detected)

**What Exists:**
- ✅ SQL table: `customer_addresses` (verified in schema)
- ✅ Repository: `supabase/lib/repositories/addresses.ts` (SQL-based)
- ✅ E-commerce endpoints use addresses: `customer-ecommerce-endpoints-sql.tsx`

**What is Missing:**
- ❌ **Customer-facing address CRUD endpoints** - No endpoints in `customer-routes-refactored.tsx`
- ❌ **Address management in customer routes** - Only exists in e-commerce endpoints

**Invariant Violations:**
- ❌ Address CRUD not exposed in main customer routes
- ⚠️ Addresses only accessible via e-commerce endpoints, not standalone

**Files Involved:**
- `supabase/functions/make-server-3dd53475/customer-routes-refactored.tsx` (missing address endpoints)
- `supabase/functions/make-server-3dd53475/customer-ecommerce-endpoints-sql.tsx` (has address methods but not exposed as customer routes)

**KV Store Usage:**
- ⚠️ Found in `supabase/functions/make-server-3dd53475/user-account-routes.tsx` (lines 265-334) - **USES KV STORE**

**Minimal Fix:**
1. Add address CRUD endpoints to `customer-routes-refactored.tsx`:
   - `GET /make-server-3dd53475/customer/:customerId/addresses`
   - `POST /make-server-3dd53475/customer/:customerId/addresses`
   - `PUT /make-server-3dd53475/address/:addressId`
   - `DELETE /make-server-3dd53475/address/:addressId`
   - `PUT /make-server-3dd53475/address/:addressId/default`
2. Migrate `user-account-routes.tsx` address endpoints from KV to SQL

---

### 4️⃣ WALLET MANAGEMENT

**Status:** ✅ **PASSED**

**What Exists:**
- ✅ Wallet balance endpoint: `GET /make-server-3dd53475/wallet/:customerId` (SQL-based)
- ✅ Credit endpoint: `POST /make-server-3dd53475/wallet/:customerId/credit` (SQL-based)
- ✅ Debit endpoint: `POST /make-server-3dd53475/wallet/:customerId/debit` (SQL-based)
- ✅ SQL tables: `customer_wallets`, `wallet_transactions`
- ✅ Ledger history: Transactions stored in SQL
- ✅ Source reference: `reference_id` links to booking/payment

**What is Missing:**
- None (fully implemented)

**Invariant Violations:**
- None

**Files Involved:**
- `supabase/functions/make-server-3dd53475/wallet-endpoints.tsx` (SQL-only)
- `supabase/lib/repositories/wallets.ts` (SQL repository)

**Status:** ✅ **PASSED**

---

### 5️⃣ REFERRAL & LOYALTY SYSTEM

**Status:** ✅ **PASSED**

**What Exists:**
- ✅ Referral code generation: `POST /make-server-3dd53475/referrals/:customerId/create-code` (SQL-based)
- ✅ Referral application: `POST /make-server-3dd53475/referrals/apply` (SQL-based)
- ✅ Loyalty points earning: `POST /make-server-3dd53475/loyalty/process-action` (SQL-based)
- ✅ Loyalty redemption: `POST /make-server-3dd53475/loyalty/redeem` (SQL-based)
- ✅ SQL tables: `referrals`, `loyalty_rules`, `customer_loyalty_points`, `loyalty_transactions`
- ✅ Wallet integration: Redemption credits wallet via SQL

**What is Missing:**
- None (fully implemented)

**Invariant Violations:**
- None

**Files Involved:**
- `supabase/functions/make-server-3dd53475/referral-system-sql.tsx` (SQL-only)
- `supabase/functions/make-server-3dd53475/rewards-loyalty-system-sql.tsx` (SQL-only)

**Status:** ✅ **PASSED**

---

### 6️⃣ BOOKING MANAGEMENT (CRITICAL)

**Status:** ✅ **PASSED**

**What Exists:**
- ✅ Booking creation: `POST /make-server-3dd53475/booking/create` (SQL-based)
- ✅ Booking retrieval: `GET /make-server-3dd53475/bookings/:identifier` (SQL-based)
- ✅ Booking status update: `PUT /make-server-3dd53475/booking/:bookingId/status` (SQL-based)
- ✅ Booking cancellation: `POST /make-server-3dd53475/booking/:bookingId/cancel` (SQL-based)
- ✅ SQL table: `bookings` with all required fields
- ✅ Status transitions: `pending` → `confirmed` → `in_progress` → `completed`
- ✅ Payment linkage: `payment_status`, `transaction_id` fields exist

**What is Missing:**
- None (fully implemented)

**Invariant Violations:**
- None

**Files Involved:**
- `supabase/functions/make-server-3dd53475/customer-routes-refactored.tsx` (lines 786-994)
- `supabase/lib/repositories/bookings.ts` (SQL repository)

**Status:** ✅ **PASSED**

---

### 7️⃣ PAYMENT MANAGEMENT

**Status:** ⚠️ **PARTIALLY PASSED** (missing payment table)

**What Exists:**
- ✅ Payment processing: `POST /make-server-3dd53475/ecommerce/payments/process` (SQL-based)
- ✅ Razorpay verification: `POST /make-server-3dd53475/ecommerce/payments/verify` (SQL-based)
- ✅ Payment endpoints: `payment-razorpay-endpoints.tsx` (SQL-based, no KV)

**What is Missing:**
- ❌ **Dedicated `payments` SQL table** - Payment data may be stored in `bookings.payment_status` only
- ⚠️ **Payment reconciliation logic** - Need to verify payment records are stored separately

**Invariant Violations:**
- ⚠️ Payment status may be inferred from booking table only (need to verify `payments` table exists)

**Files Involved:**
- `supabase/functions/make-server-3dd53475/payment-endpoints-refactored.tsx`
- `supabase/functions/make-server-3dd53475/payment-razorpay-endpoints.tsx`

**Minimal Fix:**
1. Verify `payments` table exists in schema
2. Ensure all payment operations create records in `payments` table

---

### 8️⃣ PAYMENT CARD MANAGEMENT

**Status:** ❌ **FAILED** (not implemented)

**What Exists:**
- ❌ **No payment card endpoints found** in customer routes
- ❌ **No `payment_cards` table found** in schema query

**What is Missing:**
- ❌ Add card endpoint
- ❌ Remove card endpoint
- ❌ Tokenization logic
- ❌ Default card selection
- ❌ SQL table for card storage (tokenized only)

**Invariant Violations:**
- ❌ Cards cannot be stored (no table/endpoints)
- ❌ Payment method selection limited to wallet/cash/UPI

**Files Involved:**
- None (missing entirely)

**Minimal Fix:**
1. Create `payment_cards` table (store gateway tokens only, no plaintext)
2. Add endpoints:
   - `POST /make-server-3dd53475/customer/:customerId/cards`
   - `GET /make-server-3dd53475/customer/:customerId/cards`
   - `DELETE /make-server-3dd53475/card/:cardId`
   - `PUT /make-server-3dd53475/card/:cardId/default`

---

### 9️⃣ NOTIFICATION MANAGEMENT

**Status:** ✅ **PASSED**

**What Exists:**
- ✅ Get notifications: `GET /make-server-3dd53475/notifications/:userId` (SQL-based)
- ✅ Mark as read: `PUT /make-server-3dd53475/notification/:notificationId/read` (SQL-based)
- ✅ SQL table: `notifications` with `user_id`, `notification_type`, `is_read`
- ✅ Notification creation: Integrated in booking, payment flows
- ✅ SQL persistence: All notifications stored in SQL

**What is Missing:**
- ⚠️ **Push/email/SMS integration** - Backend creates notifications but delivery channels may not be implemented

**Invariant Violations:**
- None (SQL persistence verified)

**Files Involved:**
- `supabase/functions/make-server-3dd53475/customer-routes-refactored.tsx` (lines 1051-1121)
- `supabase/lib/repositories/notifications.ts` (SQL repository)

**Status:** ✅ **PASSED** (with note: delivery channels may need implementation)

---

### 🔟 SUPPORT MANAGEMENT

**Status:** ✅ **PASSED**

**What Exists:**
- ✅ Create ticket: `POST /make-server-3dd53475/support/tickets` (SQL-based)
- ✅ Get tickets: `GET /make-server-3dd53475/support/tickets` (SQL-based)
- ✅ Update ticket: `PUT /make-server-3dd53475/support/tickets/:ticketId` (SQL-based)
- ✅ SQL table: `support_tickets` with full lifecycle states
- ✅ Role-based visibility: `customer_id`, `vendor_id`, `staff_id` fields

**What is Missing:**
- None (fully implemented)

**Invariant Violations:**
- None

**Files Involved:**
- `supabase/functions/make-server-3dd53475/support-tickets-endpoints.tsx` (SQL-only)
- `supabase/lib/repositories/support-tickets.ts` (SQL repository)

**Status:** ✅ **PASSED**

---

### 1️⃣1️⃣ AI CHATBOT (SYMPTOM CHECKER)

**Status:** ❌ **FAILED** (KV store usage detected)

**What Exists:**
- ✅ AI chat endpoint: `POST /make-server-3dd53475/ai/chat` (exists)
- ✅ AI chatbot endpoint: `POST /make-server-3dd53475/ai-chatbot/chat` (exists)
- ⚠️ RAG pipeline: Uses Bedrock/AWS

**What is Missing:**
- ❌ **SQL logging of chat history** - No `ai_chat_history` table found
- ❌ **Audit trail** - Conversations not persisted to SQL
- ⚠️ **Medical disclaimer enforcement** - Need to verify AI output includes disclaimers

**Invariant Violations:**
- ❌ No SQL log of AI interactions
- ⚠️ No verification that AI avoids medical diagnosis

**KV Store Usage:**
- ❌ **CRITICAL:** `supabase/functions/make-server-3dd53475/ai-crm-routes.tsx` (lines 18, 23, 586-596) - **USES KV STORE**
- ❌ **CRITICAL:** `supabase/functions/make-server-3dd53475/ai-chatbot-routes.tsx` (lines 22, 29) - **USES KV STORE**

**Files Involved:**
- `supabase/functions/make-server-3dd53475/ai-crm-routes.tsx` (KV usage)
- `supabase/functions/make-server-3dd53475/ai-chatbot-routes.tsx` (KV usage)

**Minimal Fix:**
1. Create `ai_chat_history` table
2. Migrate AI endpoints to SQL:
   - Store conversation history in SQL
   - Store AI responses with disclaimers
   - Remove all KV calls from `ai-crm-routes.tsx` and `ai-chatbot-routes.tsx`

---

### 1️⃣2️⃣ MEDIA & FILE STORAGE (GLOBAL)

**Status:** ⚠️ **PARTIALLY PASSED** (S3 exists but customer access unclear)

**What Exists:**
- ✅ S3 upload endpoint: `POST /make-server-3dd53475/media/upload` (SQL-based config)
- ✅ SQL metadata storage: S3 URL stored in SQL (via `s3-auto-uploader.tsx`)
- ✅ Access control: User ID required for upload

**What is Missing:**
- ⚠️ **Customer-facing photo upload** - Endpoint exists but may not be exposed in customer routes
- ❌ **Profile photo upload endpoint** - No dedicated customer profile photo upload

**Invariant Violations:**
- ⚠️ S3 upload exists but customer access path unclear

**Files Involved:**
- `supabase/functions/make-server-3dd53475/s3-auto-uploader.tsx` (SQL-based, no KV)
- `supabase/functions/make-server-3dd53475/customer-routes-refactored.tsx` (missing photo upload endpoint)

**Minimal Fix:**
1. Add `POST /make-server-3dd53475/customer/profile/photo` endpoint that calls S3 uploader
2. Ensure customer can upload profile photos, pet photos, booking attachments

---

## 🧨 SYSTEMIC ISSUES

### 1. **KV STORE USAGE DETECTED** (CRITICAL)

**Files Still Using KV:**
1. ❌ `supabase/functions/make-server-3dd53475/customer-services.tsx` (lines 3, 23, 47) - **USES KV STORE**
2. ❌ `supabase/functions/make-server-3dd53475/user-account-routes.tsx` (lines 269, 298, 327) - **USES KV STORE** (address management)
3. ❌ `supabase/functions/make-server-3dd53475/ai-crm-routes.tsx` (lines 2, 18, 23, 586-596) - **USES KV STORE**
4. ❌ `supabase/functions/make-server-3dd53475/ai-chatbot-routes.tsx` (lines 2, 22, 29) - **USES KV STORE**

**Impact:**
- Service discovery uses KV (should use SQL `vendor_services` table)
- Address management uses KV (should use SQL `customer_addresses` table)
- AI chat history uses KV (should use SQL `ai_chat_history` table)

---

### 2. **MISSING ENDPOINTS**

**Critical Missing:**
1. ❌ Account deletion/deactivation
2. ❌ Payment card management (add/remove/set default)
3. ❌ Customer-facing address CRUD (exists in e-commerce but not main routes)
4. ❌ Profile photo upload endpoint (S3 uploader exists but not exposed)

---

### 3. **UI-ONLY LOGIC RISK**

**Potential Issues:**
- ⚠️ Frontend components may call endpoints that don't exist
- ⚠️ Need to verify all UI actions map to backend handlers

---

## 🛠️ TASK LIST (ORDERED)

### P0 (Golden Path Blockers)

1. **CRITICAL:** Migrate `customer-services.tsx` from KV to SQL
   - File: `supabase/functions/make-server-3dd53475/customer-services.tsx`
   - Replace `kv.getByPrefix('vendor:')` with `VendorsRepository.findAllActive()`
   - Replace `kv.get('vendor_services:...')` with SQL queries to `vendor_services` table

2. **CRITICAL:** Migrate `user-account-routes.tsx` address endpoints from KV to SQL
   - File: `supabase/functions/make-server-3dd53475/user-account-routes.tsx`
   - Replace all `kv.get('addresses:...')` with `AddressesRepository` calls
   - Add address endpoints to `customer-routes-refactored.tsx` if not already present

3. **CRITICAL:** Migrate AI chatbot endpoints from KV to SQL
   - Files: `ai-crm-routes.tsx`, `ai-chatbot-routes.tsx`
   - Create `ai_chat_history` table
   - Replace all KV calls with SQL inserts

4. **CRITICAL:** Add payment card management
   - Create `payment_cards` table
   - Add CRUD endpoints for cards (tokenized storage only)

5. **CRITICAL:** Add account deletion endpoint
   - Add `DELETE /make-server-3dd53475/customer/:customerId` (soft delete)

### P1 (UX Integrity)

6. Add profile photo upload endpoint
   - Expose S3 uploader via customer routes

7. Add customer-facing address CRUD endpoints
   - Ensure addresses are accessible outside e-commerce flow

8. Verify payment table exists and is used
   - Ensure all payments create records in `payments` table

### P2 (Enhancements)

9. Implement push/email/SMS notification delivery
10. Add medical disclaimer enforcement in AI responses

---

## 📊 SUMMARY

**✅ PASSED MODULES (5/12):**
- Wallet Management
- Referral & Loyalty System
- Booking Management
- Notification Management
- Support Management

**⚠️ PARTIALLY PASSED (3/12):**
- Customer Signup & Auth (missing deletion)
- Profile Management (missing photo upload, deletion)
- Payment Management (need to verify payments table)

**❌ FAILED MODULES (4/12):**
- Address Management (KV usage)
- Payment Card Management (not implemented)
- AI Chatbot (KV usage, no SQL logging)
- Media & File Storage (missing customer-facing upload)

**CRITICAL ISSUES:** 4  
**HIGH PRIORITY ISSUES:** 3  
**MEDIUM PRIORITY ISSUES:** 2

---

## 🛑 ABSOLUTE STOP RULE TRIGGERED

**KV Store Usage Detected in:**
- Service discovery (`customer-services.tsx`)
- Address management (`user-account-routes.tsx`)
- AI chatbot (`ai-crm-routes.tsx`, `ai-chatbot-routes.tsx`)

**Action Required:** Migrate all KV usage to SQL before proceeding.

---

**Report Generated:** 2025-01-27  
**Auditor:** Principal Platform Auditor + Senior Full-Stack Engineer

