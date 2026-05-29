# Customer web — performance optimizations

## What changed

1. **Shell code splitting** (`components/customer/wrappers/CustomerHomeWrapper.tsx`)
   - Eager: `CustomerHomeComplete`, `UserAccountSidebar`, `NotAvailable`, `CustomerScreenWrapper`, `SERVICE_CONFIGS` (value-only import).
   - ~90 secondary screens use `next/dynamic` with the shared orange `LoadingSpinner` (same pattern as `components/customer/CustomerHomeWrapper.tsx`).
   - `amazon-chime-sdk-js` stays off the home path via dynamic `ChimeVideoCall`, `TrainingBookingRouter` (`ssr: false`), and `UniversalHomeServiceRouter` (`ssr: false`).

2. **Bundle hygiene**
   - Production `console.log` / debug `console.warn` removed or gated with `NODE_ENV === 'development'` in the shell wrapper.
   - `lib/chime-sdk.ts`: runtime SDK loaded via `import()`; only TypeScript types are static.

3. **Runtime / data**
   - `useHomePageData`: profile + pets load immediately; banners, discover-services, and articles defer until after first paint (`requestAnimationFrame` × 2).
   - `CustomerApp`: push notification bootstrap deferred with `requestIdleCallback` (or `setTimeout(0)`).
   - `app/providers.tsx`: React Query default `staleTime` 5m, `gcTime` 15m (devtools still dev-only).

4. **Images**
   - `PresignableImage`: `loading="lazy"` and `decoding="async"` (static export `unoptimized` unchanged).

## How to verify

```bash
cd apps/customer-web
npm run build
```

- Open `/` — home UI unchanged; Network tab shows smaller initial JS vs pre-change (many `_app-pages-browser_components_customer_*` chunks load only after navigation).
- Navigate: vet, grooming, shop, pharmacy, tele/video, bookings, wallet — first visit may show the orange spinner; flows should match before.
- Insurance: policy purchase → provider screen (restored `insurance_provider` route).

## Build size check

After `npm run build`, compare `.next/static/chunks` (or export output):

- Main app / layout chunks should not include large route modules (vet, shop, chime, jspdf, etc.).
- Chunk count increases; per-route first load decreases.

Optional analyzer (not wired by default):

```bash
ANALYZE=true npm run build
```

(requires `@next/bundle-analyzer` in `next.config.js` if you add it locally.)

## Expected impact

- **First paint / TTI**: smaller initial JS on `/` because the shell no longer statically imports the full service catalog.
- **Navigation**: one short spinner on first entry to a heavy screen; repeat visits use cached chunks.
- **Home API**: fewer competing requests on first paint; profile/pets still hydrate from localStorage immediately.
