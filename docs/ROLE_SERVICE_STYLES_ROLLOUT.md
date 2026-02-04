# Role & Service Styles Rollout (Phased)

This doc describes the phased fix for canonical role config, service styles, and strict enforcement. **Tonight’s minimal safe patch** is Phase 0–2 below.

## Canonical sources

- **Backend:** `roles.config.serviceStyles` and `role_permissions` are the single truth.
- **API:** `GET /config/roles/:id` returns `serviceStyles` as canonical codes only: `at_home`, `at_center`, `tele`. Labels are in `serviceStylesLabels` when needed for display.

## Phase 0 — Guardrails (done)

- **Strict role enforcement toggle (frontend):**  
  `NEXT_PUBLIC_STRICT_ROLE_ENFORCEMENT=true` or `1`  
  - When set: no permissive fallbacks; on config load failure the UI shows “config unavailable” (no static fallback).
  - When unset: existing behavior (static fallback when API fails).
- **Conservative behavior:** When config is missing or has no `serviceStyles`, `hasCapability` / `isStyleAllowed` return false; `allowedStyles` is empty.

## Phase 1 — Canonical service styles (done)

- **Backend `roles.ts`:**
  - `serviceStyles` in API response = canonical codes only (`at_home`, `at_center`, `tele`).
  - `serviceStylesLabels` returned separately for display.
  - Response includes `updated_at` for cache invalidation.
- **Frontend `api-normalizers.ts`:**
  - `normalizeRoleConfig` uses `normalizeServiceStyleForRoleConfig`: unknown values are dropped (no default to `at_center`).
  - Walker role stays `['at_home']` only.
- **Frontend `useRoleConfig.ts`:**
  - Cache stores `updatedAt`; conservative fallback when no config / empty `serviceStyles` (no “allow all”).

## Phase 2 — Enforce allowed styles (done)

- **Backend `service-catalog.ts`:**
  - `GET /service-catalog/role/:roleId` without `serviceStyle` query still filters by role’s allowed styles (e.g. Walker never sees at_center in catalog).
- **Backend `vendor-services.ts`:**
  - Main list (`services` / `allServices`) = only services in allowed styles.
  - `disallowedLegacy` = services in other styles (e.g. legacy at_center for a Walker).
- **Frontend `VendorServiceCatalogView.tsx`:**
  - Tabs and list respect `allowedServiceStyles` / `roleAllowedStyles`; styles not allowed are not shown.
  - Adding a service defaults to first allowed style (not `at_center`).

## Env / config reference

| Env | Where | Effect |
|-----|--------|--------|
| `NEXT_PUBLIC_STRICT_ROLE_ENFORCEMENT` | Vendor web (Next.js) | `true`/`1` = no permissive fallback on config failure; show “config unavailable”. |

## Expected behaviour after tonight

- **Walker:** Only Home Services in service management; no at_center or tele in catalog or main vendor services list.
- **Groomer (center):** at_center + at_home visible; tele hidden if not in role config.
- **Vet (non-solo):** at_center + at_home + tele visible when in role config.
- Role config cache: switching role and reloading does not reuse previous role’s config (cache keyed by roleId; refresh clears cache).

## Staged later (not tonight)

- Phase 3: Remove “first role in DB” and `FULL_DEFAULT_CAPABILITIES` fallbacks in `useVendorCapabilities`; single “Capabilities unavailable” state.
- Phase 4: Unify booking UX (one entry flow, one appointment detail modal).
- Phase 5: Centralize appointment history (single payload for vendor + customer + pet medical records).
- Phase 6: Align `CAPABILITY_ROUTES` to real Next routes; remove dead routes.
