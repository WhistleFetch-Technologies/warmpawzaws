# UI/UX Sprint D — Admin Policy Center Implementation

**Date:** 2026-07-03  
**Scope:** Configuration UI for Discount Engine V2 runtime policy  
**Status:** Implemented locally — not committed  
**Route:** `/policy-center` (Marketing → Policy Center)

---

## Executive Summary

Sprint D adds a **thin administrative layer** over existing Discount Engine configuration contracts (`PriorityConfiguration`, `StackPolicyConfiguration`, `FundingConfiguration`, `LimitConfiguration`). The UI reads and writes policy bundles; it **never** implements priority selection, stacking, settlement math, or validation rules client-side.

Backend policy HTTP APIs (Phase 8) are **not yet available**. Until they ship:

- Drafts persist in **localStorage** (`warmpawz.discount-policy.draft.v1`)
- Validate, publish, rollback, history, simulator, and audit tabs show **Coming Soon** when APIs return errors
- Runtime diagnostics partially load from existing mode endpoints (analytics, campaigns)

---

## Architecture

```
Admin Sidebar → Marketing → Policy Center (/policy-center)
  └── PolicyCenter.tsx
        ├── useDiscountPolicyDraft (state + localStorage)
        ├── discount-policy-api.ts (Phase 8 endpoint stubs)
        └── Sections (10 tabs)
              ├── Priority / Stack / Funding / Limits (editable draft)
              ├── Runtime (read-only diagnostics)
              ├── Validation / Publish / History (API-gated)
              └── Simulator / Audit (Coming Soon until API)
```

**Configuration contracts:** `apps/admin-web/lib/discount-policy/types.ts` mirrors `backend/lambda/src/discount-engine/config/types.ts`.

**Default published policy:** `default-config.ts` aligns with backend config loaders (`DEFAULT_*_CONFIGURATION`).

---

## Components Reused

| Component | Source |
|-----------|--------|
| `AdminLayout` | `components/admin/layout/AdminLayout.tsx` |
| `@warmpawz/ui` Tabs, Card, Select, Switch, Input, Button, Badge | `packages/ui` |
| `PolicyHelpButton` | `components/PolicyHelpButton.tsx` |
| `UnifiedAdminSidebar` marketing accordion | existing pattern |
| Finance/settings tab layout | `platform-settings/page.tsx` pattern |

---

## Components Extended / New

| Path | Purpose |
|------|---------|
| `app/policy-center/page.tsx` | Route shell |
| `components/admin/marketing/policyCenter/PolicyCenter.tsx` | Main hub + tabs |
| `components/admin/marketing/policyCenter/sections/*` | 10 configuration sections |
| `components/admin/marketing/policyCenter/shared/*` | Save bar, domain scope, API banners |
| `lib/discount-policy/*` | Types, defaults, API client, hook, option registry |
| `packages/shared-types/src/admin-portal-nav.ts` | Nav entry |
| `lib/policy-docs-content.ts` | Help docs for priority/stack/funding/limits |

---

## Files Modified

- `packages/shared-types/src/admin-portal-nav.ts` — Policy Center nav item
- `apps/admin-web/components/admin/layout/UnifiedAdminSidebar.tsx` — icon, routing, accordion expand
- `apps/admin-web/lib/policy-docs-content.ts` — discount policy help entries

---

## Configuration Flow

1. On load: probe `/admin/discount-policy/*` capabilities
2. Load published bundle from `/admin/discount-policy/runtime` or **contract defaults**
3. Merge remote/local draft if present
4. Admin edits Priority / Stack / Funding / Limits (global or domain override scope)
5. **Save draft** → `PUT /admin/discount-policy/draft` or localStorage fallback
6. **Publish** → blocked until Phase 8 API succeeds (no engine change until then)

---

## Validation Flow

1. Admin clicks **Validate draft** on Validation tab
2. UI calls `POST /admin/discount-policy/validate`
3. Backend `PolicyValidationEngine` returns `ValidationResult` (errors, warnings, suggestions, fingerprint)
4. If API unavailable → Coming Soon panel; no client-side validator duplication

---

## Publish Flow

1. Validate (recommended)
2. Publish → `POST /admin/discount-policy/publish`
3. Rollback → `POST /admin/discount-policy/rollback`
4. History → `GET /admin/discount-policy/history`

All lifecycle steps are API-gated; UI shows explicit pending state when endpoints 404.

---

## Section Coverage

| # | Section | Status |
|---|---------|--------|
| 1 | Priority Configuration | Editable (strategy, phase caps, domain override) |
| 2 | Stack Configuration | Editable (boolean flags, application mode, order display) |
| 3 | Funding Configuration | Editable (presets, split %, veto flags) |
| 4 | Discount Limits | Editable (numeric caps, overflow strategy) |
| 5 | Runtime Policy | Read-only versions, fingerprint placeholder, feature flags |
| 6 | Validation | API invoke or Coming Soon |
| 7 | Publish / Rollback | API invoke or Coming Soon |
| 8 | Policy History | API list or Coming Soon |
| 9 | Simulator | Form + Coming Soon (no UI-side simulation) |
| 10 | Audit Viewer | API or Coming Soon |

---

## Known Limitations

1. No Phase 8 policy HTTP APIs — drafts are local-only
2. Fingerprint not computed in UI (by design)
3. Tie-breaker reorder and stack rule editor deferred to full API writes
4. Per-customer / per-vendor / per-campaign limit scopes shown as placeholders
5. Compare-versions UI deferred until history API exists
6. Feature flags partially exposed (analytics + campaign mode only)

---

## Future Sprint Items

- Phase 8 backend: `/admin/discount-policy/*` CRUD, validate, publish, rollback, history
- Wire save/publish to SSM/runtime storage
- Policy simulator dry-run resolver endpoint
- Audit viewer from persisted resolver audits (RDS / CloudWatch export)
- Campaign funding override panel linked to Commercial Campaign Engine
- Compare versions + diff view

---

## Validation Checklist

- [x] Priority configuration (global + domain override)
- [x] Stack configuration
- [x] Funding configuration (presets, no settlement math)
- [x] Limits configuration
- [x] Validation tab (API or Coming Soon)
- [x] Publish / rollback (API or Coming Soon)
- [x] History (API or Coming Soon)
- [x] Fingerprint visible (read-only / placeholder)
- [x] Feature flags partial read
- [x] Simulator placeholder (no client simulation)
- [x] Audit viewer placeholder
- [x] Sticky save bar + unsaved changes + reset + export
- [x] Responsive tab layout
- [x] PolicyHelpButton + a11y labels on inputs
- [x] No discount engine modifications
- [x] `npm run build` (admin-web) succeeds

---

## Rollback Strategy

- UI-only change: remove `/policy-center` route and nav entry to disable
- localStorage drafts: clear `warmpawz.discount-policy.draft.v1`
- No production engine impact until publish API writes remote policy

---

## Architectural Rule (Sprint D)

> The Policy Center is configuration-driven. The UI never contains hardcoded business rules or calculations. Every screen reads/writes `PriorityConfiguration`, `StackPolicyConfiguration`, `FundingConfiguration`, `LimitConfiguration`, and runtime policy contracts. Missing backend capabilities render **Coming Soon** — never client-side engine logic.
