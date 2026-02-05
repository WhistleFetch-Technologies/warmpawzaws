# RBAC Rebuild Outline — Admin Sections & Permissions

## 1. Current State (Summary)

| Area | Current behavior | Gap |
|------|------------------|-----|
| **Auth** | `requireAdmin()` checks Cognito group `admin` or `super-admin`. | All admins get full access; no per-section or view/edit distinction. |
| **Admin roles** | GET `/admin/roles?scope=admin` returns admin-only roles. Stored in `roles` + `role_permissions`. | Roles exist but are not enforced on API or UI. |
| **Capabilities** | GET `/admin/capabilities` returns a **hardcoded** list of ~60 vendor-oriented capabilities (dashboard, bookings, prescriptions, etc.). | Not aligned with admin sections (Analytics, Vendors, E-Commerce, etc.); no view vs edit. |
| **User assignment** | Table `user_roles` (user_id, role_id). GET `/admin/rbac/users` returns all `users` rows. | No clear link from Cognito identity to `user_id`; no enforcement of “this admin has role R”. |
| **Sidebar** | `UnifiedAdminSidebar` shows all items to everyone. | No permission-based hide/disable. |
| **API routes** | Admin routes use `requireAdmin()` only. | No check like “requires permission analytics:view” or “vendors:edit”. |

So: we have roles and role_permissions, but they are not wired to **admin sections**, **view vs edit**, or **enforcement** on backend and frontend.

---

## 2. Target Model (No Hardcoding)

### 2.1 Admin section = resource + actions

- **Section** = one admin area (e.g. Analytics, Vendors, E-Commerce, Catalog, Finance, Support, RBAC, etc.).
- **Actions** = what can be done in that section: `view`, `create`, `update`, `delete`, `manage` (manage = full control, e.g. settings or role assign).
- **Permission** = `section:action`, e.g. `analytics:view`, `vendors:edit` (edit = create+update+delete), `rbac:manage`.

New sections or actions = new rows in DB (or seed), **no app code change**.

### 2.2 Single source of truth: Admin permissions catalog

- **Store** all admin permissions in DB (e.g. `admin_permissions` or reuse/extend `rbac_permissions_catalog`).
- Each row: `permission_key` (e.g. `analytics:view`), `section`, `action`, `description`, `category` (optional).
- **Sections** can be derived from distinct `section` values or a separate `admin_sections` table (id, key, label, route, icon, order).
- Backend and frontend both consume this list (API: e.g. GET `/admin/permissions/catalog` or GET `/admin/sections`).

### 2.3 Role → permissions

- **Admin roles** (already filtered by `scope=admin`) have permissions stored in `role_permissions`.
- For admin RBAC, we use **permission_key** = section:action (e.g. `analytics:view`, `vendors:edit`).
- So: role R has rows in `role_permissions` with `permission_name` = `analytics:view`, `vendors:edit`, etc.
- **No hardcoding** of section list in app: sidebar and API both use catalog + role’s permissions.

### 2.4 User → role(s)

- **Admin user** = identity (Cognito sub or internal user_id linked to Cognito).
- **user_roles** table: (user_id, role_id). We need a stable `user_id` for admins (Cognito sub or synced `admin_users` table).
- At request time: resolve user → list of role_ids → aggregate permissions from all roles → check required permission.

### 2.5 View vs edit

- **view**: can open section and read data; API allows GET for that section.
- **edit** (or create/update/delete): can change data; API allows POST/PUT/DELETE where applicable.
- **manage**: section-level settings or sensitive actions (e.g. assign roles in RBAC).
- Implemented as separate permissions: e.g. `analytics:view`, `analytics:export`; `vendors:view`, `vendors:edit`, `vendors:manage` (e.g. approve/reject).

---

## 3. Section–Route–Permission Map (Proposed)

| Section key | Label | Route | Permissions (examples) |
|-------------|--------|-------|------------------------|
| analytics | Analytics & Insights | /analytics | analytics:view, analytics:export |
| enterprise | Enterprise & Revenue | /enterprise | enterprise:view, enterprise:edit |
| vendors | Vendor Administration | /vendors | vendors:view, vendors:edit, vendors:manage |
| ecommerce | E-Commerce | /ecommerce | ecommerce:view, ecommerce:edit |
| regions | Region Manager | /regions | regions:view, regions:edit |
| marketing | Marketing & Promotions | /marketing | marketing:view, marketing:edit |
| banners | Banner Management | /banners | banners:view, banners:edit |
| loyalty | Loyalty & Rewards | /loyalty | loyalty:view, loyalty:edit |
| support | Support & CRM | /support | support:view, support:edit, support:manage |
| catalog | Catalog & Services | /catalog | catalog:view, catalog:edit |
| events | Event Management | /events | events:view, events:edit |
| content | Content Management | /content | content:view, content:edit |
| pet-info | Pet Info Management | /pet-info | pet_info:view, pet_info:edit |
| finance | Finance & Logistics | /finance | finance:view, finance:edit |
| roles | Role & User Management (RBAC) | /roles | rbac:view, rbac:edit, rbac:manage |
| platform_settings | Platform Settings | /platform-settings | settings:view, settings:manage |

- New section = new row in catalog + optional new route; sidebar can be built from catalog (route + label + icon).

---

## 4. Backend Implementation (High Level)

### 4.1 Admin permissions catalog (DB + API)

- **Option A**: New table `admin_sections` (id, key, label, route, icon, sort_order) + `admin_permissions` (id, section_key, action, permission_key, description).  
- **Option B**: Use `rbac_permissions_catalog` with category = "admin" and permission_key = "section:action".  
- **API**: GET `/admin/permissions/catalog` or GET `/admin/sections` returning sections and their permissions (and optionally which permission is required for “view” vs “edit” for that section).
- Seed/migration: insert all section:action permissions so they can be assigned to roles.

### 4.2 Resolving admin user and permissions

- From request: JWT (Cognito) → sub (and optionally email/phone).
- Map **Cognito sub → user_id**: either `admin_users` table (user_id, cognito_sub, email, …) or use sub as user_id in `user_roles`.
- Load **user_roles** for that user_id → list of role_ids.
- Load **role_permissions** for those role_ids where permission_name matches admin permission_key pattern (e.g. `section:action`).
- Result: set of permission_keys the admin has (e.g. Set of "analytics:view", "vendors:edit").

### 4.3 Enforcement middleware

- **requireAdminPermission(permissionKey)** (or requireAdminPermission(section, action)):
  - After requireAdmin() (user is admin),
  - Resolve admin user → permissions as above,
  - If required permission not in set → 403.
- Apply per route or per route group:
  - e.g. `/admin/analytics/*` → require `analytics:view` for GET, `analytics:export` for export,
  - `/admin/vendors/*` → require `vendors:view` or `vendors:edit` or `vendors:manage` depending on method and path.
- Optional: **requireAdminSectionView(section)** and **requireAdminSectionEdit(section)** that map to section:view and section:edit.

### 4.4 API that frontend needs

- **GET /admin/me/permissions** (or /admin/auth/me with permissions): returns current admin’s permission set (and optionally role names). Frontend uses this to show/hide sidebar and enable/disable buttons.
- **GET /admin/sections** (or /admin/permissions/catalog): returns list of sections and their permissions (for role-assignment UI and for building sidebar without hardcoding).

---

## 5. Frontend Implementation (High Level)

### 5.1 Loading current admin permissions

- On admin app load (after auth): call GET `/admin/me/permissions` (or equivalent). Store in context (e.g. React context or store).
- Permissions: array or set of strings, e.g. `['analytics:view', 'vendors:edit', 'rbac:manage']`.

### 5.2 Sidebar (UnifiedAdminSidebar)

- **Data**: Sections from GET `/admin/sections` (or static list derived from same source as backend). Each section: key, label, route, icon, requiredPermission (e.g. `analytics:view`).
- **Filter**: For each nav item, show only if current user has the section’s “view” permission (e.g. `analytics:view`). If no permission, hide item (or show disabled with tooltip “No access”).
- **No hardcoding**: Section list can be driven by API; new section added in DB + one route in app (or dynamic route) and it appears for users who have that permission.

### 5.3 Route protection

- **Guard**: For each protected route (e.g. /analytics, /vendors), check required permission (e.g. analytics:view) before rendering page. If user doesn’t have it → redirect to “no access” page or first section they can access.
- **Optional**: Central route config: route → required permission; one component checks and redirects.

### 5.4 View vs edit inside a section

- **Read-only**: If user has `section:view` but not `section:edit`, hide or disable create/edit/delete buttons and show only lists/detail view.
- **Edit**: If user has `section:edit` or `section:manage`, show full UI. Optionally, API will return 403 on POST/PUT/DELETE if they don’t have edit permission, so UI should reflect that.

### 5.5 RBAC Management page (/roles)

- **Permissions list** for role create/edit: load from GET `/admin/sections` or GET `/admin/permissions/catalog` (admin only). Display by section; each row = permission (e.g. analytics:view, analytics:export). Checkboxes per permission for the role.
- **No hardcoding**: New permissions added in DB appear in this list automatically.

---

## 6. Futuristic / Extensibility

- **New section**: Add row(s) in admin_sections + admin_permissions (or rbac_permissions_catalog). Optionally add one route in app. Sidebar can be built from API so new section appears for roles that get the new permission.
- **New action**: Add new permission_key (e.g. analytics:export). Assign to roles. Backend route checks that permission; frontend shows button only if user has it.
- **Custom roles**: Admin creates role, picks from full list of section:action permissions (from catalog). No code change.
- **Audit**: Keep using `rbac_audit_logs` for role assign/remove and permission changes; optionally log “admin X accessed section Y” for sensitive sections.

---

## 7. Implementation Phases (Suggested)

| Phase | What | Delivered |
|-------|------|-----------|
| **1. Catalog & seed** | DB table(s) for admin sections and permissions; seed all section:action; API GET /admin/sections and GET /admin/permissions/catalog (admin-only). | Single source of truth for sections and permissions; no hardcoding in app. |
| **2. User–role resolution** | Define admin user identity (admin_users or use Cognito sub); resolve user → roles → permissions; API GET /admin/me/permissions. | Backend can answer “what can this admin do?”. |
| **3. Backend enforcement** | requireAdminPermission(section, action) middleware; apply to admin routes by section/action. | APIs return 403 when permission missing. |
| **4. Frontend sidebar** | Sidebar items driven by sections + permission check; hide items user cannot view. | Users see only sections they have access to. |
| **5. Frontend route guard** | Per-route permission check; redirect if no access. | No direct URL access without permission. |
| **6. View vs edit in UI** | Per-section buttons (create/edit/delete) shown only if user has edit/manage. | Clear read-only vs edit experience. |
| **7. RBAC UI** | Role create/edit uses catalog permissions (section:action); save to role_permissions. | New roles and permissions manageable without code change. |

---

## 8. Clarifications Before Full Implementation

1. **Admin user identity**: Prefer **Cognito sub as user_id** in `user_roles`, or a separate **admin_users** table (id, cognito_sub, email, display_name) and user_roles.user_id points to that?
2. **Default super-admin**: Should one built-in role (e.g. “Super Admin”) get all section:action permissions by default (e.g. seed), and one user/group in Cognito mapped to that role?
3. **Section list**: Confirm the exact list of sections (and routes) to support in v1 from the sidebar today (Analytics, Enterprise, Vendors, E-Commerce, Regions, Marketing, Banners, Loyalty, Support, Catalog, Events, Content, Pet Info, Finance, Roles, Platform Settings). Any add/remove?
4. **Actions**: Is **view** + **edit** enough for all sections in v1, or do we need **manage** (and possibly **create**/ **delete**) explicitly for some (e.g. vendors:approve, rbac:manage)?

Once these are confirmed, implementation can follow the phases above with no hardcoding: sections and permissions stay in DB and drive both backend checks and frontend behavior.
