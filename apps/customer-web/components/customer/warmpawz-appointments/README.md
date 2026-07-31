# Warmpawz Appointments — shared customer UI

**Canonical documentation:** [`docs/WAPPT_REUSABLE_UI.md`](../../../../docs/WAPPT_REUSABLE_UI.md)

## Reusable components (map any new WAPPT category here)

| UI | Component | Config |
|----|-----------|--------|
| **Paginated vendor list** (develop frame + `WarmpawzPayVendorCard`) | `WarmpawzAppointmentsVendorList.tsx` | `lib/warmpawz-appointments/wappt-vendor-list-config.ts` |
| **Vendor profile** (priceless services, slot-only CTA) | `WarmpawzAppointmentsVendorProfile.tsx` | `lib/warmpawz-appointments/wappt-vendor-profile-config.ts` |
| **Discovery shell** | `WarmpawzAppointmentsDiscovery.tsx` | — |

Shell routes in `CustomerHomeWrapper`: `wappt-discovery`, `wappt-vendor-profile`.

Nav helpers: `lib/warmpawz-appointments-customer.ts`.

## New category in 3 steps

1. Add entries to **both** config files + `wappt-hub-registry.ts`.
2. Hub tile → `onNavigate('wappt-discovery', { category: '…' })`.
3. Backend: WAPPT discovery + fee APIs for that `category`; booking router with `appointmentsMode`.

**Tests:** see [`docs/WAPPT_REUSABLE_UI.md`](../../../../docs/WAPPT_REUSABLE_UI.md) §8.

Do not build new list/profile pages per category.
