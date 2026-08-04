# WarmpawzPayVendorCard architecture

Reusable, **service-agnostic** vendor card for Warmpawz Pay (WPay) surfaces — not Marketplace.

## Layer overview

```
Parent (screen)          Mapper (pure fn)              Card (presentational)
─────────────────        ─────────────────────         ─────────────────────
fetch / list state   →   map*ToVendorCardProps()   →   WarmpawzPayVendorCard
owns labels              normalizes DTO fields          renders props only
owns navigation          builds meta / badges           invokes callbacks
owns callbacks           wires action objects             no side effects
```

## 1. WarmpawzPayVendorCard responsibilities

**Location:** `components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard.tsx`

The card is a **presentational** component. It:

- Renders vendor identity: name, avatar, optional verified badge, subtitle
- Renders optional rating, address, meta rows, discount/status badges
- Renders optional footer hint and primary/secondary action buttons
- Applies consistent WPay visual styling (Tailwind + shared UI primitives)
- Invokes `onClick` handlers passed via `primaryAction` / `secondaryAction` props

Props are defined in `types.ts`. All data and behavior arrive via props; the card does not derive business rules from service type.

## 2. What the card must never own

Do **not** add to the card:

| Concern | Why it stays in the parent |
|--------|----------------------------|
| Routing (`useRouter`, `router.push`, shell `onNavigate`) | Each consumer has different destinations (discovery profile vs Pay Hub detail) |
| API calls / fetching | Parents already own list/detail state |
| Payment / Razorpay logic | Lives in WPay detail and checkout modules |
| Commerce Switch decisions | Resolved before navigation |
| Action labels that vary by service | Parent passes `primaryLabel` / `secondaryLabel` into mappers |
| Service-specific meta rules | Mappers + `discovery-provider-meta-items` build meta rows |

If a new field is needed, extend props/types and map it in the appropriate mapper — do not branch on `serviceKey` inside the card.

## 3. Mapper responsibilities

Two mappers, two data domains. **Do not duplicate** mapping logic — use shared utilities in `lib/warmpawz-pay/wpay-vendor-card-map-utils.ts` and `discovery-provider-meta-items.ts`.

### Discovery appointments (`mapDiscoveryProviderToVendorCardProps`)

**File:** `lib/warmpawz-pay/map-discovery-provider-to-vendor-card-props.ts`

- Input: `DiscoveryProviderCardSource` + parent-supplied subtitle, address, labels, callbacks
- Output: `WarmpawzPayVendorCardProps`
- Builds: rating (via `resolveWpayVendorCardRating`), address (via `normalizeWpayVendorCardAddress`), meta rows (via `buildDiscoveryProviderMetaItems`), dual CTAs (via `buildWpayVendorCardActions`)
- Pure function — no I/O, no navigation

### Pay Hub list (`mapWpayVendorCardToProps`)

**File:** `lib/warmpawz-pay/map-wpay-vendor-card-to-props.ts`

- Input: `WpayVendorCard` list DTO from WPay API types
- Output: `WarmpawzPayVendorCardProps` (name, photo, phone subtitle, address, discount badges)
- Pure function — actions and navigation are owned by the Pay Hub page wrapper

### Shared utilities

| Module | Role |
|--------|------|
| `wpay-vendor-card-map-utils.ts` | Rating normalization, address trim, discount badges, action object builder |
| `discovery-provider-meta-items.ts` | Distance, city, next slot, experience meta rows |
| `discovery-provider-card-source.ts` | Minimal discovery row type for mappers |

## 4. Parent responsibilities

Each consumer screen must:

1. **Fetch or receive** vendor list data (existing hooks/APIs — no new fetches for the card)
2. **Choose the mapper** — discovery vs Pay Hub
3. **Supply labels** — e.g. `"Book Appointment"`, `"Pay with Warmpawz"`
4. **Supply callbacks** — booking profile navigation, `launchWarmpawzPayServiceBooking`, or Pay Hub `router.push`
5. **Gate rendering** — e.g. only when `appointmentsMode === true`; Marketplace inline cards stay separate

Example (discovery appointments):

```tsx
<WarmpawzPayVendorCard
  {...mapDiscoveryProviderToVendorCardProps({
    provider: { /* DiscoveryProviderCardSource fields */ },
    subtitle: getProviderTypeLabel(provider),
    address: getProviderAddress(provider),
    primaryLabel: 'Book Appointment',
    onPrimary: (e) => openProviderProfile(e, provider),
    secondaryLabel: 'Pay with Warmpawz',
    onSecondary: (e) => {
      e.stopPropagation();
      launchWarmpawzPayServiceBooking({ router, serviceKey: 'vet', category: 'vet', vendorId });
    },
  })}
/>
```

## 5. Current consumers

| Consumer | File | Mapper | When |
|----------|------|--------|------|
| Vet style discovery | `components/customer/vet/VetServicesByStyle.tsx` | `buildWapptDiscoveryVendorCardProps` | All provider list rows |
| Grooming style discovery | `components/customer/grooming/GroomingServicesByStyle.tsx` | `buildWapptDiscoveryVendorCardProps` | All provider list rows |
| Universal style discovery | `components/customer/shared/UniversalServicesByStyle.tsx` | `buildWapptDiscoveryVendorCardProps` | All provider list rows |
| Vet clinic list | `components/customer/vet/ClinicListView.tsx` | `buildWapptDiscoveryVendorCardProps` / `mapDiscoveryProviderToVendorCardProps` | Clinic discovery rows |
| Home service providers | `components/customer/home-services/HomeServiceProviderListView.tsx` | `mapDiscoveryProviderToVendorCardProps` | Provider list rows |
| Warmpawz Appointments list | `components/customer/warmpawz-appointments/WarmpawzAppointmentsVendorList.tsx` | `mapDiscoveryProviderToVendorCardProps` | Category vendor list |
| Service hubs + list views | `ServiceHubVendorCard`, `WalkerHubVendorCard` | `map-boarding-list-vendor-to-vendor-card-props` | Featured vets/groomers/trainers/walkers/stays/sitters |
| Search vendor cards | `SearchHubVendorCard` via `app/search/page.tsx` | `map-boarding-list-vendor-to-vendor-card-props` | GET /search + WAPPT merge rows |
| Warmpawz Pay Hub | `app/warmpawz-pay/page.tsx` | `mapWpayVendorCardToProps` | Vendor list rows |

**Intentionally separate UX:** `NutritionVendorDetailsCard` (meal plans / nutrition flows), `EnhancedSearchBar` autocomplete dropdown rows.

## 6. How future services should integrate

1. **Confirm scope** — reuse `WarmpawzPayVendorCard` for vendor list rows; wire navigation in the parent screen.
2. **Reuse discovery mapper** — pass `DiscoveryProviderCardSource` fields from the existing list row; do not copy rating/address/meta logic.
3. **Keep booking flow** — wire `onPrimary` to the service’s existing profile/book handler (`buildWarmpawzAppointmentsBookingNav` + shell screen).
4. **Keep Pay CTA** — wire `onSecondary` to `launchWarmpawzPayServiceBooking({ serviceKey, category, vendorId })` with the correct service key.
5. **List map** — return `<WarmpawzPayVendorCard />` via `buildWapptDiscoveryVendorCardProps` or `ServiceHubVendorCard`; do not add inline expandable vendor cards.
6. **Add tests** — extend `vendor-card/__tests__` and `lib/warmpawz-pay/__tests__` if new meta or mapper options are introduced.
7. **No card changes** unless the new surface needs a genuinely new visual element — prefer new optional props over service-specific forks.

## Tests

- Component: `components/warmpawz-pay/vendor-card/__tests__/WarmpawzPayVendorCard.test.ts`
- Mappers / utils: `lib/warmpawz-pay/__tests__/`
- Architecture guard: `lib/warmpawz-pay/__tests__/warmpawz-pay-vendor-card-architecture.test.ts`

Run:

```bash
cd apps/customer-web && npm test -- --testPathPattern="warmpawz-pay|WarmpawzPayVendorCard"
```
