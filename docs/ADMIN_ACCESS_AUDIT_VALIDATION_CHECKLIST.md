# Admin User Access & Audit – Systematic Validation Checklist

Use this after deploy to verify UI, handlers, routes, wireframe flow, navigation, and API contracts.

---

## 1. Deployments

| Target | Command | Status |
|--------|---------|--------|
| Backend (dev) | `./scripts/deploy-lambda-direct.sh` | ✅ |
| Backend (prod) | `LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler ./scripts/deploy-lambda-direct.sh` | ✅ |
| Admin Web (dev) | `./scripts/deploy-admin-web.sh` | ✅ |
| Admin Web (prod) | `./scripts/deploy-admin-web.sh --prod --yes` | ✅ |

---

## 2. API Contracts (automated)

Run:

```bash
API_URL=<dev-or-prod-api> npx playwright test tests/playwright/specs/contract-tests/admin-users-and-audit-api.spec.ts --config=tests/playwright/playwright.config.ts
# Or:
./scripts/validate-admin-access-and-audit.sh dev   # or prod
```

| Endpoint | Method | Auth | Expected | Response shape |
|----------|--------|------|----------|----------------|
| `/admin/me` | GET | None | 401 | — |
| `/admin/me` | GET | UAT/JWT | 200 | `{ success, admin: { id, email, name, phone?, role? }, permissions: string[] }` |
| `/admin/users` | GET | None | 401 | — |
| `/admin/users` | GET | UAT + admin:users:view | 200 or 403/500 | `{ success, users: [{ id, email, name?, phone?, role_name?, role_display_name? }] }` |
| `/admin/audit-log` | GET | None | 401 | — |
| `/admin/audit-log` | GET | UAT + admin:audit:view | 200 | `{ success, logs: [], count? }` |
| `/admin/roles` | GET | UAT | 200 | `{ success, roles: [{ id, name, display_name, role_type? }] }` |
| `/admin/users/verify-otp-set-password` | POST | Public | 400/401 on bad body | Body: `{ email, phone, otp, newPassword }` |
| `/admin/users` | POST | UAT + admin:users:create | 401 without auth, 400 invalid body | Body: `{ email, name?, phone, admin_role_id? }` |

---

## 3. Frontend Routes & Handlers

| Route | Handler / Page | Guard | Notes |
|-------|-----------------|-------|------|
| `/` | `app/page.tsx` (login) | None | After login → refetchAdmin(), redirect `/analytics` |
| `/analytics` | `app/analytics/page.tsx` | Section permission `admin:analytics:view` | AdminLayout, AuditLogPanel at bottom |
| `/roles` | `app/roles/page.tsx` → RBACManagement | Section permission `admin:roles:view` | Tabs: Vendor roles, Admin users; AuditLogPanel |
| `/set-password` | `app/set-password/page.tsx` | None (public) | Form: email, phone, OTP, new password, confirm; POST verify-otp-set-password |
| `/no-access` | `app/no-access/page.tsx` | Skip guard | AdminLayout; "Access denied", button "Go to Analytics" |
| `/vendors`, `/catalog`, etc. | Respective pages | Section permission from path segment | AdminLayout route guard redirects to `/no-access` if no permission |

---

## 4. UI Components & Wireframe Flow

| Component | Location | Behavior |
|-----------|----------|----------|
| **UnifiedAdminSidebar** | `components/admin/layout/UnifiedAdminSidebar.tsx` | Nav items filtered by `getPermissionForSection(id)` + `hasPermission(perm)`. Reports / Platform Settings shown only if permission. |
| **AdminLayout** | `components/admin/layout/AdminLayout.tsx` | Route guard: pathname → section → permission; if no permission redirect `/no-access`. Skip for `/`, `/no-access`, `/set-password`. |
| **RBACManagement** | `components/admin/rbac/RBACManagement.tsx` | Tabs "Vendor roles" | "Admin users" (Admin users only if `admin:users:view`). Create Role button only on Vendor roles tab. |
| **AdminUsersTab** | `components/admin/rbac/AdminUsersTab.tsx` | List from GET /admin/users; Create user (POST /admin/users); Reset password (POST reset-password-request); Resend set-password OTP. Buttons gated by permissions. |
| **AuditLogPanel** | `components/admin/audit/AuditLogPanel.tsx` | Collapsible; filters (user, action, resource, date range); GET /admin/audit-log; only if `admin:audit:view`. |
| **Login page** | `app/page.tsx` | On success: set token, `refetchAdmin()`, redirect `/analytics`. |
| **Set-password page** | `app/set-password/page.tsx` | Submit → POST verify-otp-set-password; success → message, redirect `/`. |

---

## 5. Onclick & Back Navigation

| Action | Expected |
|--------|----------|
| Login submit | Token stored, refetchAdmin(), navigate to `/analytics` |
| Sidebar nav item click | Navigate to `/{section}` (e.g. `/analytics`, `/roles`); route guard may redirect to `/no-access` |
| "Create user" (Admin users tab) | Open modal; submit → POST /admin/users; success toast with /set-password link; close modal, refresh list |
| "Reset password" (row) | POST /admin/users/reset-password-request with adminId; toast "OTP sent… /set-password" |
| "Resend set-password OTP" (row) | POST /admin/users/:id/send-set-password-otp; toast |
| Set-password "Set password" | POST verify-otp-set-password; success → "Password set", redirect `/` |
| Set-password "Back to login" | Link to `/` |
| No-access "Go to Analytics" | Navigate to `/analytics` |
| Audit log "Apply filters" | Refetch GET /admin/audit-log with query params |
| Audit log "Load more" | Append next page of logs |
| 403 from any admin API | api-client: show error message, do NOT clear token |

---

## 6. Backend Handlers (file reference)

| Route | File | Notes |
|-------|------|-------|
| GET /admin/me | `backend/lambda/src/endpoints/admin-users.ts` | requireAdminAuth, returns admin + permissions |
| POST /admin/users | `admin-users.ts` | requirePermission admin:users:create; OTP to phone |
| POST /admin/users/verify-otp-set-password | `admin-users.ts` | Public; verify OTP, update password_hash |
| POST /admin/users/reset-password-request | `admin-users.ts` | Self or admin:users:reset_password |
| POST /admin/users/:id/send-set-password-otp | `admin-users.ts` | admin:users:create or edit |
| GET /admin/users | `admin-users.ts` | admin:users:view |
| GET /admin/audit-log | `admin-users.ts` | admin:audit:view; query: section, performed_by, resource_type, resource_id, action, from_date, to_date, limit, offset |
| GET /admin/roles | `backend/lambda/src/endpoints/roles.ts` | Returns role_type for admin-role dropdown filter |

---

## 7. Database

- Migration **563_admin_rbac_and_otp.sql** must be applied for:
  - `roles.role_type`, `admins.admin_role_id`
  - Admin roles (super_admin, admin, support_admin) and role_permissions seed
  - GET /admin/users and role assignment to work (no 500).

---

## 8. Run Full Validation

```bash
# Dev
./scripts/validate-admin-access-and-audit.sh dev

# Prod (after deploying to prod)
./scripts/validate-admin-access-and-audit.sh prod
```

This runs API contract tests and curl smoke checks, then prints the component checklist.
