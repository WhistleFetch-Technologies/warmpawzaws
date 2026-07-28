# Warmpawz Pay — Vendor Catalogue Admin

Admin-only module for managing the Warmpawz Pay vendor visibility catalogue (`warmpawz_appointments_vendor_catalog`).

## Scope

- List, create, publish, unpublish, and delete catalogue entries
- Vendor candidate search for onboarding new entries
- Bulk publish / unpublish / delete
- RBAC + feature-flag gating
- Audit persistence to `entity_audit_log`

**Out of scope on this branch:** payment flow, audit history APIs, audit UI, customer read APIs.

## Architecture

```
handler/index.ts
  └── registerWarmpawzAppointmentsCatalogueAdminRoutes(app)

routes/catalogue-admin.routes.ts
  ├── requireFeatureFlag(WARMPAWZ_APPOINTMENTS_ENABLED)
  ├── requireFeatureFlag(WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED)
  ├── requireAdminPermission(...)
  └── handlers/*.handler.ts
        └── VendorCatalogAdminService
              ├── VendorCatalogRepository
              ├── VendorEligibilityRepository / Service
              └── CatalogueAuditService → CatalogueAuditRepository
```

Global middleware: `app.use('/admin/*', requireAdmin())` (JWT authentication).

## API base path

`/admin/warmpawz-appointments/catalogue`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | view |
| GET | `/vendor-candidates` | view |
| GET | `/:catalogueId` | view |
| POST | `/` | create |
| DELETE | `/:catalogueId` | delete |
| POST | `/:catalogueId/publish` | publish |
| POST | `/:catalogueId/unpublish` | unpublish |
| POST | `/bulk/publish` | bulk |
| POST | `/bulk/unpublish` | bulk |
| POST | `/bulk/delete` | bulk |

Response envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "...", "message": "..." } }
```

## Authorization

Permissions resolved via `resolveAdminPermissionsFromRequest` (DB + JWT).

| Permission | Purpose |
|------------|---------|
| `admin.WARMPAWZ_APPOINTMENTS` | Legacy full access |
| `admin.WARMPAWZ_APPOINTMENTS.catalogue.view` | Read |
| `admin.WARMPAWZ_APPOINTMENTS.catalogue.create` | Create |
| `admin.WARMPAWZ_APPOINTMENTS.catalogue.delete` | Delete |
| `admin.WARMPAWZ_APPOINTMENTS.catalogue.publish` | Publish |
| `admin.WARMPAWZ_APPOINTMENTS.catalogue.unpublish` | Unpublish |
| `admin.WARMPAWZ_APPOINTMENTS.catalogue.bulk` | Bulk operations |
| `admin.full_access` | Superuser bypass |

UAT admin (`uat-admin-user`) receives `admin.full_access` automatically.

## Feature flags

Both must be truthy (`true`, `1`, `yes`, `on`) or routes return **503 FEATURE_DISABLED**:

| Variable | Purpose |
|----------|---------|
| `WARMPAWZ_APPOINTMENTS_ENABLED` | Warmpawz Pay module |
| `WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED` | Admin catalogue routes |

Unset / unknown values default to **disabled** (safe).

## Audit

Mutations write to `entity_audit_log`:

- `entity_type`: `warmpawz_appointments_vendor_catalog`
- `entity_id`: catalogue UUID
- `action`: `create`, `publish`, `unpublish`, `delete`, `bulk_publish`, `bulk_unpublish`, `bulk_delete`

Catalogue mutation + audit insert run in a single DB transaction. Audit failure rolls back the mutation.

Non-UUID admin actors (UAT) store `NULL` in UUID columns (`actor_id`, `created_by`).

## Admin UI

- Route: `/warmpawz-appointments/catalogue`
- App: `apps/admin-web`
- Nav permission: `admin.WARMPAWZ_APPOINTMENTS`

## Deployment

### Prerequisites

1. Migration `1080_WARMPAWZ_APPOINTMENTS_phase1_schema.sql` applied on target RDS
2. `entity_audit_log` table present (migration 043+)

### Order

1. Apply migrations (if not already on environment)
2. Deploy Lambda (`scripts/deploy-lambda-direct.sh`)
3. Set Lambda env vars:
   - `WARMPAWZ_APPOINTMENTS_ENABLED=true`
   - `WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED=true`
4. Deploy admin web (`scripts/deploy-admin-web.sh`)
5. Assign `admin.WARMPAWZ_APPOINTMENTS` (or granular permissions) to admin roles

### Rollback

- Set feature flags to `false` — routes return 503 immediately (no code rollback required)
- Revert Lambda deploy to previous bundle if needed
- Catalogue data in `warmpawz_appointments_vendor_catalog` is retained

## Production test checklist

- [ ] Unauthenticated request → 401
- [ ] Authenticated admin without permission → 403
- [ ] Feature flags off → 503 FEATURE_DISABLED
- [ ] GET list with pagination/filters
- [ ] POST create draft → 201
- [ ] Duplicate vendor → 409
- [ ] Publish / unpublish idempotency (already in target state → 200)
- [ ] DELETE → `{ deleted: true }`
- [ ] Bulk partial failure returns per-item results
- [ ] Audit row created in `entity_audit_log` for each mutation
- [ ] UAT admin can mutate without UUID column errors
- [ ] Admin UI list/create/detail/bulk flows against dev API

## Local validation

```bash
cd backend/lambda
npx tsc --noEmit
```
