# Admin User Access Management & Audit Log — Implementation Plan (Enterprise)

**Purpose:** Plan for (1) **admin user access management** with permission-based visibility and actions, (2) **admin user lifecycle**: create users, assign password via OTP, password reset via OTP (mobile), (3) **audit log** with user/modified info and search on each page, (4) **Support agents** as a single source of truth mapped to Support & CRM, and (5) **no duplication** of agents or permissions. **Database Seeding** is removed from the admin sidebar (not required). Vendor roles (Catalog & Services) remain distinct from admin permissions (Role & User Management).

---

## 1. Admin App — Sections & Tabs (Reference)

### 1.1 Sidebar sections (by area)

| Section | Route / ID | Functionality |
|--------|------------|----------------|
| **Analytics & Insights** | `/analytics` | Dashboards, reports, metrics |
| **Enterprise & Revenue** | `/enterprise` | Pricing rules, inventory, logic tab |
| **Vendor Administration** | `/vendors` | Applications, active vendors, pending, reject/approve |
| **E-Commerce** | `/ecommerce` | Orders, products, policies, category, product approval, custom service approval |
| **Region Manager** | `/regions` | Regions, geo config |
| **Marketing & Promotions** | `/marketing` | Coupons, promotions |
| **Loyalty & Rewards** | `/loyalty` | Loyalty program config |
| **Support & CRM** | `/support` | Ticketing, **agent list** (from Support agents), support settings |
| **Catalog & Services** | `/catalog` | **Categories**, **Roles (vendor)**, Onboarding, Service Catalog |
| **Event Management** | `/events` | Events |
| **Content Management** | `/content` | Content pages |
| **Pet Info Management** | `/pet-info` | Pet-related config |
| **Finance & Logistics** | `/finance` | Payments, settlements, tiers, cancellation, ecommerce policies, payment gateway |
| **Role & User Management** | `/roles` | **Admin RBAC** — admin roles/permissions, **create admin users**, **assign password via OTP**, **password reset via OTP** |
| **Reports** | (navigate `reports`) | Saved/generated reports |
| **Platform Settings** | `/platform-settings` | Cloud/Maps, Payment Gateway, Logistics, Loyalty, Rule Book, Legal |

**Note:** **Database Seeding** has been removed from the sidebar and is not part of this plan.

### 1.2 Catalog & Services vs Role & User Management (critical distinction)

| Location | What it is | Who it affects |
|----------|------------|----------------|
| **Catalog & Services** → **Roles** tab | **Vendor roles** (vet_solo, vet_clinic, groomer_solo, etc.). Used to assign which **vendor types** can use which services and for onboarding. | **Vendors** (service providers on the platform). |
| **Role & User Management** (`/roles`) | **Admin RBAC** — admin roles and permissions (who can see what). **Admin user lifecycle only:** create users, send OTP to set/reset password (mobile), assign role. Standard login = **email + password**. | **Admin users** (back-office staff). |

So: **Vendor roles** = catalog/services and vendor onboarding. **Admin permissions** = what each admin user can see and do. **Admin user management** (create, password via OTP, reset via OTP) is scoped to Role & User Management only.

### 1.3 Support & CRM — Support agents (single source, no duplication)

- **Single source of truth for support agents:** Table **support_agents** (joined with **staff** for name, email, phone). Agents are **created and managed only** in **Support & CRM → Settings → Agents** (route: `/support/settings`, tab: Agents).
- **Support & CRM main page** (`/support`): The **list of agents** used for ticket assignment, agent metrics, and assign-modal dropdown **must** come from the **same** source (support_agents + staff). Backend: **unify** `GET /crm/agents` to return only agents that exist in **support_agents** (joined to staff), so there is **no duplication** between “staff with can_handle_support” and “support_agents”. Today `/crm/agents` reads from `staff` only; it should read from `support_agents` JOIN `staff` so the list in Support & CRM is exactly the list configured in Support Settings → Agents.
- **Support agent roles:** Agent, Supervisor, Manager (as in Support Settings UI). These are **support workflow roles**, not admin permissions.

### 1.4 Platform Settings (external integrations)

- **Cloud & Maps** — AWS S3, SQS, Google Maps  
- **Payment Gateway** — Razorpay, Stripe, Paytm  
- **Logistics Integration** — Shiprocket, Delhivery, BlueDart  
- **Loyalty & Rewards** — Points, rewards, redemption  
- **Rule Book** — Discovery & service rules  
- **Legal** — Legal policies, versions  

---

## 2. Admin User Lifecycle (Role & User Management scope)

### How new admin users get access (no self onboarding)

- **New admin users cannot self-register.** There is no public “Sign up as admin” or self-onboarding.
- **An existing admin** (with permission `admin:users:create`) **must create the user manually** in Role & User Management: they enter the new user’s **email**, **name**, **phone**, and **admin role**, then submit. The backend creates the admin record and **sends an OTP to the new user’s phone** (phone is required for OTP).
- **The admin does not set or send a password.** The admin only creates the account and triggers the OTP. The **new user** receives an SMS with the OTP, goes to the **set-password page** (e.g. link from admin or same admin app URL), enters **email + phone + OTP + new password**, and submits. Only then can they log in with **email (username) + password**.
- **Summary:** Manual creation by an admin → OTP to user’s phone → user sets their own password → user can log in. No admin-set password; no self-registration.

**Later (forgot password):** An admin with `admin:users:reset_password` (or the user themselves, if self-service is enabled) triggers “Reset password” → OTP is sent to the user’s phone → user enters OTP and sets a new password → they log in again with email + password.

---

Admins with **admin user management** permission can **only**:

1. **Create admin users** — Create a new admin (email, name, **phone** — required for OTP). **Username = email.** No password set at creation; instead trigger **OTP to set new password** (sent to the user’s phone).
2. **Send OTP for new password (on create)** — When an admin is created, the system sends an **OTP to the user’s mobile** (phone number required for OTP). The new user completes authentication with OTP and then **sets their password** (first-time set). No plaintext or admin-set password; password is set only by the user after OTP verification.
3. **Password reset via OTP (mobile)** — For existing admins: “Reset password” triggers sending an **OTP to the user’s mobile**. The user enters OTP and then sets a new password. Standard **email + password** login continues to apply after that.
4. **Assign admin role** — When creating or editing an admin user, assign one **admin role** (from Role & User Management) so the user gets the correct permissions.

**Standard authentication:** **Email** (username) + **password**. Password is set or changed only through the **OTP flow** (mobile) so that only the account holder can set/reset it (enterprise-grade, no shared or admin-set passwords).

**Permissions for this scope:**

- `admin:users:view` — View list of admin users and their roles.
- `admin:users:create` — Create admin user (and trigger OTP to set password).
- `admin:users:edit` — Edit user profile (name, phone) and assign role; **cannot** set password.
- `admin:users:reset_password` — Trigger “Reset password” (sends OTP to user’s mobile).
- `admin:roles:view` — View admin roles and their permissions (read-only).
- `admin:roles:edit` — Edit admin roles and permissions (e.g. restricted to Super Admin only, optional).

**Enterprise-grade requirements:**

- **OTP:** Rate limit OTP send (e.g. per user/phone per 5 min); expiry (e.g. 10 min); single-use; audit log on send/use.
- **Audit:** Log every admin user create, role assign, and password-reset trigger (who, when, target user); no logging of passwords or OTPs.
- **No duplication:** One place to create/edit admin users (Role & User Management); one place to manage support agents (Support Settings → Agents); one list of agents used everywhere (Support & CRM).

---

## 3. Current State

### 3.1 Admin authentication (today)

- **Backend:** `requireAdminAuth()` checks JWT and that user is in admin group or has admin user_type. No per-admin permissions.
- **Frontend:** No permission-based hiding; all admins see full sidebar and all pages.
- **Admin creation:** `/admin/setup/create-admin` accepts email + password in body (admin sets password). No OTP flow for new users or reset.

### 3.2 Support agents (today)

- **GET /crm/agents** — Reads from **staff** (role = 'support' OR can_handle_support). Does **not** use **support_agents**.
- **GET /support/settings/agents** — Reads from **support_agents** JOIN **staff**.
- **Risk of duplication:** Staff can have can_handle_support without a support_agents row; CRM list can differ from Settings list. Plan: **unify** so `/crm/agents` returns only agents from support_agents (+ staff), and Support & CRM UI uses that single list.

### 3.3 Audit today

- **audit_logs** and **entity_audit_log** exist but admin actions are not consistently logged; no per-page audit panel with search.

---

## 4. Admin User Access Management — Plan

### 4.1 Permission model (admin only)

- **Section permissions (examples):**  
  `admin:analytics:view`, `admin:vendors:view`, `admin:vendors:approve`, `admin:ecommerce:view`, `admin:marketing:view`, `admin:support:view`, `admin:support:edit`, `admin:catalog:view`, `admin:catalog:edit`, `admin:finance:view`, `admin:finance:edit`, `admin:roles:view`, `admin:roles:edit`, `admin:users:view`, `admin:users:create`, `admin:users:edit`, `admin:users:reset_password`, `admin:platform_settings:view`, `admin:platform_settings:edit`, `admin:reports:view`, `admin:audit:view`.
- **Admin role:** Each admin role has a set of these permissions (stored as capabilities; admin-only roles clearly separated from vendor roles, e.g. `role_type = 'admin'` or `admin:` prefix).
- **Admin user:** Stored in `admins` (or equivalent) with `admin_role_id`; permissions resolved from role.

### 4.2 Backend

1. **Admin user → role:** DB table linking admin user to one admin role; resolve permissions after JWT validation and attach to request.
2. **requirePermission(c, code):** Use on all sensitive admin routes (including user create, password-reset trigger, role assign).
3. **Admin user lifecycle APIs (enterprise):**
   - **POST /admin/users** — Create admin (email, name, phone). Backend creates record, does **not** set password; triggers **send OTP to mobile** for “set new password” flow. Requires `admin:users:create`.
   - **POST /admin/users/:id/send-set-password-otp** — (Or part of create response.) Send OTP to user’s phone for first-time password set. Rate limited.
   - **POST /admin/users/reset-password-request** — Request password reset (sends OTP to user’s mobile). Requires `admin:users:reset_password` or self-service for own account. Rate limited.
   - **POST /admin/users/verify-otp-set-password** — Public (or minimal auth): verify OTP + set new password (no admin in loop). Audit log: “password set by user via OTP”.
   - **GET /admin/me** — Return current admin + `permissions: string[]`.
4. **Support agents — no duplication:**
   - Change **GET /crm/agents** to query **support_agents** JOIN **staff** (only active support_agents); return same shape. So Support & CRM ticket assignment and agent list always show the same agents as Support Settings → Agents.

### 4.3 Frontend

1. **Sidebar:** Filter nav items by permission; **Database Seeding** removed (already done in code).
2. **Role & User Management page:** Tabs/sections: (1) Admin roles & permissions (view/edit if allowed), (2) **Admin users** — list, create user, assign role, **Reset password** (triggers OTP to mobile). Create user flow: form (email, name, phone, role) → submit → backend creates user and sends OTP → show “Ask user to check phone and set password via link”.
3. **Support & CRM:** Agent dropdown and agent list use only the unified agents API (same as Support Settings); no second list.

### 4.4 Catalog & Services — clarity

- **Catalog & Services** permissions control whether an admin can see/edit categories, service catalog, and **Vendor Roles** tab. Vendor roles are for vendors only; they are **not** admin permissions.

---

## 5. Audit Log — Plan

### 5.1 Goals

- **Per page:** “Audit log” / “Recent changes” section on each admin page with **search** (user, date range, resource type, resource id, action).
- **Content:** Who (user), what (action), which record (resource type + id), when (timestamp), details (no passwords/OTPs).

### 5.2 Backend

- Use **audit_logs** (or extend) for all admin actions: `action`, `performed_by`, `actor_type`, `resource_type`, `resource_id`, `details` (JSONB), `status`, `performed_at`, `section`.
- **logAdminAction(...)** on every admin mutation (including admin user create, password-reset trigger, role assign, support agent create/update, etc.).
- **GET /admin/audit-log** with query params: `section`, `resource_type`, `resource_id`, `performed_by`, `action`, `from_date`, `to_date`, `limit`, `offset`. Protected by `admin:audit:view`.

### 5.3 Frontend

- **AuditLogPanel** component with filters; embed on each major admin page (Vendors, Catalog, Finance, E-Commerce, Marketing, Support, Platform Settings, Role & User Management). Optional global “Audit log” page.

---

## 6. Support Agents — Single Source & Mapping

| Item | Implementation |
|------|----------------|
| **Where agents are created/edited** | **Support & CRM → Settings** (`/support/settings`) → **Agents** tab. Uses **support_agents** + **staff**. |
| **Where agents are used** | **Support & CRM** main (`/support`): ticket list, assign ticket to agent, agent metrics. |
| **Single list** | **GET /crm/agents** must return the **same** set as Support Settings: query **support_agents** JOIN **staff** (active only). Remove reliance on “staff with can_handle_support” alone so the list is not duplicated. |
| **Roles** | Support agent roles (Agent, Supervisor, Manager) are stored in **support_agents** and used for workflow; they are **not** admin permissions. |

---

## 7. Implementation Phases

### Phase 1 — Foundation (backend)

1. **Admin user → role** and permission resolution; `requirePermission(c, code)` on pilot routes.
2. **Admin user lifecycle APIs:** Create user (no password), send OTP for set-password, reset-password request (OTP), verify-OTP-set-password. Rate limit OTP; audit log for create/reset.
3. **Unify support agents:** Change GET /crm/agents to use support_agents JOIN staff; ensure Support Settings remains the only place to add/remove agents.
4. **logAdminAction** and **GET /admin/audit-log** with filters; protect with `admin:audit:view`.

### Phase 2 — Frontend access control

1. **GET /admin/me** with `permissions: string[]`; sidebar filter by permission (Database Seeding already removed).
2. **Role & User Management:** Admin users section — create user (email, name, phone, role), trigger set-password OTP; “Reset password” button triggers OTP to mobile; no UI to set password by admin.
3. **Route guard** and button visibility by permission.

### Phase 3 — Audit UI & Support agents

1. **AuditLogPanel** on each major page with search.
2. **Support & CRM:** Confirm agent list and assign dropdown use only unified `/crm/agents` (no duplicate source).

### Phase 4 — Rollout & enterprise hardening

1. Apply `requirePermission` and `logAdminAction` to all admin endpoints.
2. Super Admin role with full permissions; restrict `admin:roles:edit` and `admin:users:reset_password` as needed.
3. OTP rate limits, expiry, and audit in production; no passwords or OTPs in logs.

---

## 8. Required Components (Checklist)

### 8.1 Backend

| Component | Purpose | Notes |
|-----------|---------|--------|
| **admins** table | Store admin users (email, name, phone, password_hash, role, admin_role_id, is_active) | Add column `admin_role_id` (FK to roles) and ensure `phone` for OTP. |
| **admin_role_id** (or admin_user_roles) | Link admin user → one admin role | Resolve permissions from role (role_permissions or role.capabilities). |
| **otp_tokens** table | Store OTP (phone, code, purpose, expires_at, is_used, email) | Reuse for `purpose` = `admin_set_password`, `admin_reset_password`; use `email` to tie to admin. |
| **admin_password_tokens** (new, optional) | One-time token after OTP verify for set-password API | token, admin_id, expires_at, used_at; prevents replay. |
| **audit_logs** (or entity_audit_log) | Log all admin actions | Include admin user create, OTP send, password-reset request, role assign (no passwords/OTPs). |
| **requireAdminAuth()** | Verify JWT and load admin identity | Extend to resolve admin_role_id → permissions; attach to context. |
| **requirePermission(c, code)** | Enforce permission on route | Return 403 if current admin lacks permission. |
| **logAdminAction(...)** | Write to audit_logs | Call on every admin mutation. |
| **POST /admin/users** | Create admin (email, name, phone, role); send OTP | Requires admin:users:create; phone required for OTP. |
| **POST /admin/users/:id/send-set-password-otp** | Resend OTP for first-time set password | Rate limited (e.g. 1 per 5 min per admin). |
| **POST /admin/users/reset-password-request** | Request reset → send OTP to user phone | Requires admin:users:reset_password (or self for own); rate limited. |
| **POST /admin/users/verify-otp-set-password** | Verify OTP + set new password | No admin auth; one-time use; optionally issue short-lived token then POST set-password with token. |
| **GET /admin/me** | Return current admin + permissions[] | Called after login; frontend stores permissions. |
| **GET /admin/audit-log** | List audit with filters | Protected by admin:audit:view. |
| **SMS service** | Send OTP via SNS | Reuse existing `sendSMS()` (utils/sms-service.ts or auth sendSmsViaSns); DLT/template if required. |
| **GET /crm/agents** (unify) | Return agents from support_agents JOIN staff only | Single source for Support & CRM. |

### 8.2 Frontend

| Component | Purpose | Notes |
|-----------|---------|--------|
| **Login page** (`/`) | Email + password; store token | After success, call GET /admin/me and store permissions (context or store). |
| **Auth context / store** | Hold token + permissions[] | Used by sidebar, route guard, and API layer. |
| **UnifiedAdminSidebar** | Render nav items only if user has section permission | Map route/section → permission (e.g. analytics → admin:analytics:view). |
| **Route guard (layout or per page)** | Redirect to “No access” or dashboard if no permission for current route | Run on every admin route. |
| **Role & User Management** | Tabs: Admin roles (view/edit), Admin users (list, create, edit, reset password) | Create user: form → POST /admin/users → show “OTP sent to user’s phone; ask them to set password”. |
| **Set-password page** (e.g. `/set-password`) | User enters email + phone + OTP → verify → form to set password | No admin login required; or link with one-time token after verify. |
| **Reset-password entry** | Admin clicks “Reset password” → backend sends OTP; user goes to same set-password flow with “reset” mode | Or self-service link “Forgot password” → enter email → OTP to phone → set password. |
| **AuditLogPanel** | Table + filters (user, date, resource, action); fetch GET /admin/audit-log | Embed on each major admin page. |
| **Button visibility** | Hide/disable Create, Edit, Approve, Reset password based on permissions | Backend still enforces. |
| **api-client** | Attach Bearer token to every request | Already uses adminAuthToken; add optional 403 handling to clear session or show “No access”. |

### 8.3 External / Config

| Component | Purpose |
|-----------|---------|
| **Platform Settings → AWS** | SNS credentials and DLT (sender, entity, template) for SMS. |
| **OTP template (DLT)** | If India DLT required, register template for “admin OTP” and use in sendSMS. |

---

## 9. Full Lifecycle and Edge Cases

### 9.1 Admin user lifecycle (happy path)

1. **Create:** Admin with `admin:users:create` fills form (email, name, phone, role) → POST /admin/users → backend creates row in `admins` (no password_hash), assigns role, sends OTP to phone via existing SMS service, returns success.
2. **First-time set password:** New user receives SMS with OTP. User opens admin app (or dedicated set-password URL). Enters email + phone + OTP → POST verify-otp-set-password (or step 1: verify OTP, step 2: POST set-password with one-time token). Backend verifies OTP (otp_tokens: purpose=admin_set_password, mark used), updates admins.password_hash, audit log “password set by user”.
3. **Login:** User goes to admin login, enters email + password → POST /admin/auth/login → backend validates password_hash, returns token. Frontend stores token, calls GET /admin/me → receives permissions, stores in context. Sidebar and routes show only allowed sections.
4. **Reset password:** Admin with `admin:users:reset_password` clicks “Reset password” for a user → POST reset-password-request (target admin_id) → backend sends OTP to that user’s phone. User enters OTP and new password (same set-password flow as first-time). Audit: “password reset requested by {actor} for {target}”.

### 9.2 Edge cases and handling

| Edge case | Handling |
|-----------|----------|
| **Create admin without phone** | Require phone for create (OTP must go to mobile). If product allows “invite by email only”, add optional “send set-password link by email” later; for this plan, phone required. |
| **OTP expired** | User sees “OTP expired”. Admin can trigger “Resend OTP” (rate limited). Backend returns 400 “OTP expired” on verify. |
| **Wrong OTP** | Do not reveal “wrong OTP” vs “no OTP”; return generic “Invalid or expired OTP”. Optionally track failed attempts and lock after N attempts (e.g. 5) for 15 min. |
| **Rate limit OTP** | Per phone (and per admin_id for reset): max 1 send per 5 min. Return 429 with Retry-After. |
| **First login before password set** | If admin has no password_hash and tries email+password login, return 401 “Please set your password first” with link/code to set-password flow. |
| **User deactivated (is_active=false)** | Login returns 403 “Account deactivated”. requireAdminAuth resolves admin; if !is_active, return 403. |
| **Admin role removed or changed** | Permissions resolved at request time from current admin_role_id. No cache; next request gets new permissions. If admin_role_id is null, treat as “no permissions” (or default role). |
| **Token expired** | Frontend detects 401 on API; clear session, redirect to login. |
| **403 on API (no permission)** | Frontend shows “You don’t have permission”; do not clear token (user is valid but not allowed for that action). |
| **SMS failure** | Backend logs; return 500 “Failed to send OTP. Try again.” Admin can retry “Resend OTP”. |
| **Duplicate email on create** | Return 409 “Admin with this email already exists”. |
| **Set password with already-used OTP** | OTP marked is_used after first successful verify; second use returns “Invalid or expired OTP”. |
| **Support agents: no agents** | GET /crm/agents returns []; Support UI shows “No agents configured” and link to Settings. |

### 9.3 Audit and security edge cases

| Case | Handling |
|------|----------|
| **Password or OTP in logs** | Never log password, OTP code, or password_hash. Log only “password set”, “OTP sent”, “OTP verified”. |
| **Replay of set-password** | Use one-time token after OTP verify, or bind set-password request to verified OTP record (mark used and allow single password update). |
| **Permission escalation** | Backend only: resolve permissions from DB by admin_role_id; never trust client. |

---

## 10. OTP Integration (360°)

### 10.1 Where OTP is used in this plan

- **Admin first-time set password:** After create, send OTP to new admin’s phone; user verifies OTP then sets password.
- **Admin password reset:** Admin (or user) triggers “Reset password”; send OTP to user’s phone; user verifies OTP then sets new password.

### 10.2 Reuse existing OTP/SMS stack

- **Storage:** Use existing **otp_tokens** table. Columns: phone, email, code, purpose, expires_at, is_used, used_at. For admin flows use `purpose = 'admin_set_password'` or `'admin_reset_password'`; set `email` to admin email so after verify we know which admin to update.
- **Sending:** Reuse **sendSMS()** from `backend/lambda/src/utils/sms-service.ts` (or auth’s sendSmsViaSns). Same SNS/DLT config as vendor/customer OTP (Platform Settings → AWS). Message text: e.g. “Your Warmpawz admin verification code is {otp}. Valid for 10 minutes. Do not share.”
- **Rate limiting:** Apply same pattern as existing OTP (e.g. auth-enhanced or booking OTP): before creating OTP, check last sent for this phone (and purpose) in otp_tokens; if &lt; 5 min ago return 429. Use existing rate-limit middleware key for `admin_otp` if available.
- **Expiry:** Store expires_at = now + 10 minutes; on verify, reject if expired. Mark is_used = true and used_at = now after successful verify.
- **Single use:** One OTP record per send; after verify that record is marked used; no reuse.

### 10.3 Flow (backend) — create admin and set password

1. **POST /admin/users** (body: email, name, phone, admin_role_id)  
   - requireAdminAuth + requirePermission('admin:users:create').  
   - Validate email unique, phone format.  
   - Insert into admins (email, name, phone, admin_role_id, password_hash = null, is_active = true).  
   - Generate 6-digit OTP; insert otp_tokens (phone, code, purpose='admin_set_password', email=email, expires_at = now+10min).  
   - sendSMS(phone, "Your Warmpawz admin verification code is {otp}. Valid for 10 minutes.").  
   - logAdminAction('admin_user.created', ...).  
   - Return 201 { message: 'User created. OTP sent to phone for setting password.', adminId }.

2. **POST /admin/users/verify-otp-set-password** (body: email, phone, otp, newPassword)  
   - No admin auth (user is not logged in). Optional: rate limit by phone.  
   - Find otp_tokens: phone, code=otp, purpose in ('admin_set_password','admin_reset_password'), is_used=false, expires_at &gt; now. If not found return 400 “Invalid or expired OTP”.  
   - Find admin by email (and optionally phone). If not found return 404.  
   - Mark otp_tokens is_used=true, used_at=now.  
   - Hash newPassword; update admins set password_hash=..., updated_at=now where id=admin.id.  
   - logAdminAction('admin_password.set_via_otp', resource_type='admin', resource_id=admin.id) — no password/OTP in details.  
   - Return 200 { message: 'Password set successfully. You can log in with email and password.' }.

3. **POST /admin/users/reset-password-request** (body: adminId or email; or for self: no body)  
   - requireAdminAuth. If adminId provided requirePermission('admin:users:reset_password'); else allow only for self (current admin id).  
   - Load target admin; get phone. If no phone return 400 “User has no phone; cannot send OTP.”  
   - Rate limit: 1 per phone per 5 min.  
   - Generate OTP; insert otp_tokens (phone, code, purpose='admin_reset_password', email=admin.email, ...).  
   - sendSMS(phone, "Your Warmpawz admin password reset code is {otp}. Valid for 10 minutes.").  
   - logAdminAction('admin_password.reset_requested', ...).  
   - Return 200 { message: 'OTP sent to user’s phone.' }.

### 10.4 Frontend — set-password UX

- **Option A (same app):** In admin app, route `/set-password`. User opens it, enters email, phone, OTP, new password, confirm password. Submit → POST verify-otp-set-password. On success redirect to login.
- **Option B (link in SMS):** Optional: SMS can include link `https://admin.../set-password?email=...&token=...` where token is a one-time token issued by a separate step (e.g. after verify OTP, return token in response and redirect to set-password with token; then POST set-password with token + newPassword). For minimal scope, Option A is enough.

### 10.5 DLT / compliance (India)

- Use same sender ID, entity ID, and template ID as other OTP SMS if already registered. If not, register an “admin verification OTP” template and pass templateId/entityId to sendSMS (see sms-service.ts and auth-enhanced DLT usage).

---

## 11. Seamless Permission Flow (360°)

### 11.1 How permissions get to the user

1. **Login:** User submits email + password → **POST /admin/auth/login** → backend validates against admins.password_hash, loads admin row (id, email, admin_role_id), generates JWT (or Cognito tokens). JWT payload includes at least: sub = admin.id, email, role = 'admin'. Optionally include admin_role_id in token to avoid DB hit on every request; or resolve on every request for freshness.
2. **Token storage:** Frontend stores access_token in localStorage (e.g. adminAuthToken) and treats it as session. Every subsequent API call sends **Authorization: Bearer &lt;token&gt;**.
3. **Resolving permissions on the backend:** On each admin API request, **requireAdminAuth()** runs: verify JWT → extract admin id (sub) → load admin from DB (id, admin_role_id, is_active). If is_active false → 403. Load role by admin_role_id; get list of permission codes (from role_permissions or roles.capabilities). Attach to request context: e.g. `c.set('adminId', id)`, `c.set('adminPermissions', permissionCodes[])`. Then route handler calls **requirePermission(c, 'admin:vendors:approve')** which checks 'admin:vendors:approve' ∈ c.get('adminPermissions'); if not → 403.
4. **GET /admin/me:** Called once after login (or on app load if token exists). Backend uses same requireAdminAuth + permission resolution; returns { id, email, name, role, permissions: string[] }. No sensitive data. Frontend stores permissions in React context (e.g. AdminAuthContext) or global store so sidebar and route guard can read it without calling /admin/me again on every navigation.
5. **Sidebar:** For each nav item (e.g. “Vendor Administration”), map to a permission (e.g. admin:vendors:view). If `permissions.includes('admin:vendors:view')` show item; else hide. Same for Reports, Platform Settings.
6. **Route guard:** On layout or per-page, read current path (e.g. /vendors → admin:vendors:view). If user does not have that permission, redirect to /no-access or /analytics (default).
7. **Buttons:** e.g. “Approve” on vendor row → permission admin:vendors:approve. If not in permissions, hide or disable button. On click, API POST /admin/vendors/:id/approve runs requirePermission(c, 'admin:vendors:approve'); if missing → 403.
8. **403 handling:** If any API returns 403, frontend can show “You don’t have permission for this action” and do not clear the token (user is still logged in).

### 11.2 Permission–section mapping (reference)

| Section / action | Permission(s) |
|------------------|----------------|
| Analytics | admin:analytics:view |
| Enterprise | admin:enterprise:view, admin:enterprise:edit |
| Vendors (list) | admin:vendors:view |
| Vendors (approve/reject) | admin:vendors:approve, admin:vendors:reject |
| E-Commerce | admin:ecommerce:view, admin:ecommerce:edit |
| Regions | admin:regions:view, admin:regions:edit |
| Marketing | admin:marketing:view, admin:marketing:edit |
| Loyalty | admin:loyalty:view, admin:loyalty:edit |
| Support & CRM | admin:support:view, admin:support:edit |
| Catalog & Services | admin:catalog:view, admin:catalog:edit |
| Events, Content, Pet Info, Finance | admin:&lt;section&gt;:view, admin:&lt;section&gt;:edit |
| Role & User Management (roles) | admin:roles:view, admin:roles:edit |
| Role & User Management (users) | admin:users:view, admin:users:create, admin:users:edit, admin:users:reset_password |
| Reports | admin:reports:view |
| Platform Settings | admin:platform_settings:view, admin:platform_settings:edit |
| Audit log | admin:audit:view |

### 11.3 Data flow summary

- **Single source of truth for “what can this admin do?”** = DB: admins.admin_role_id → roles → role_permissions (or capabilities). Backend resolves this on each request (or after login for GET /admin/me) and never trusts client-supplied permissions.
- **Frontend** only displays and enables UI based on permissions received from GET /admin/me; backend enforces on every mutation and sensitive read. This gives 360° visibility: one place to assign (Role & User Management), one place to enforce (backend), one place to show (sidebar + buttons).

---

## 12. Summary

| Item | Approach |
|------|----------|
| **Who sees what** | Admin user → admin role → permissions. Sidebar filtered by permission; **Database Seeding** removed. |
| **Who can do what** | Backend `requirePermission` per mutation; frontend hides/disables by permission. |
| **Role & User Management scope** | **Only** create users, assign role, trigger OTP to set/reset password. **Username = email**; password set **only** by user via **OTP (mobile)**. No admin-set passwords. |
| **Password reset** | **OTP to mobile** → user verifies OTP → sets new password. Standard login remains email + password. |
| **Support agents** | **Single source:** support_agents + staff. **Managed in** Support & CRM → Settings → Agents. **Used in** Support & CRM (tickets, assign, metrics). **Unify** GET /crm/agents to this source so **no duplication**. |
| **Vendor roles vs admin** | Catalog & Services → Roles = **vendor** roles. Role & User Management = **admin** roles/permissions and **admin user lifecycle** (create, OTP password set/reset, assign role). |
| **Audit log** | Single admin audit store; `logAdminAction` on every admin mutation; GET /admin/audit-log with search; AuditLogPanel on each page. |
| **Enterprise** | OTP rate limits, expiry, single-use; audit for user create/reset (no passwords/OTPs in logs); no duplication of agents or permission model. |

This plan is **enterprise-grade**, keeps **admin user control** limited to **creating users and password management via OTP**, uses **email + password** as standard login, **removes Database Seeding** from the sidebar, and ensures **support agents** are a **single list** mapped to **Support & CRM** with **no duplication**.
