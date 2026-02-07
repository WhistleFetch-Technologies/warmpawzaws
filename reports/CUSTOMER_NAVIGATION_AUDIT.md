# Customer App – Navigation Audit (Every Arrow, Button, Clickable)

**Date:** 2026-01-30  
**Scope:** Every `onNavigate`, `setCurrentScreen`, and clickable target in customer-web; fix wrong or unhandled destinations.

---

## 1. Bug fixed: Add Address → Pet Marketplace

**Cause:** "Add Address" calls `onNavigate('add-address')`. When the parent used a generic handler `(screen) => setCurrentScreen(screen)`, `currentScreen` became `'add-address'`. There was no `if (currentScreen === 'add-address')` in CustomerHomeWrapper, so rendering fell through to the default `return <ComingSoon serviceName="pet-marketplace" />`.

**Fix:**
- Added `'add-address'` to `ScreenType`.
- Added explicit block: `if (currentScreen === 'add-address') return <AddressBookPage ... />` (same as `address_book`).
- Add Address now opens Address Book instead of Pet Marketplace.

**Where "Add Address" exists:** UniversalProviderProfile (onNavigate('add-address')), UniversalPaymentPage (modal "Add New Address" – closes modal only), WalkerBookingRouter, NutritionistBookingRouter, BookingFlow, GroomingBookingRouter, HomeServiceRouter, etc. (most use modal; UniversalProviderProfile was the one that could navigate and hit the bug.)

---

## 2. Bug fixed: Profile → wrong / unhandled

**Cause:** VetBookingRouter (and others) call `onNavigate('profile')`. handleVetNavigate’s fallback did `setCurrentScreen(screen as any)`, so `currentScreen` became `'profile'`. There was no `if (currentScreen === 'profile')`; only `'customer-profile'` was used, so unhandled `'profile'` fell through to pet-marketplace.

**Fix:**
- In `handleVetNavigate`: `else if (screen === 'profile') setCurrentScreen('customer-profile')`.
- Added `'profile'` to `ScreenType` and explicit block: `if (currentScreen === 'profile') return <CustomerScreenWrapper><CustomerProfile ... /></CustomerScreenWrapper>`.
- Profile tab / profile navigation now shows Customer Profile.

---

## 3. Bug fixed: Purchase Package → Pet Marketplace

**Cause:** VetBookingRouter, GroomingBookingRouter, TrainingBookingRouter, etc. call `onNavigate('purchase-package', { vendorId, packageType })`. In handlers that use a fallback `setCurrentScreen(screen as any)`, `currentScreen` became `'purchase-package'` with no matching render block, so it fell through to pet-marketplace.

**Fix:**
- In `handleVetNavigate`: `else if (screen === 'purchase-package') { setPreviousScreen(currentScreen); setVetServiceData(...); setCurrentScreen('package-booking'); }` (vet flow goes to package-booking).
- In Grooming and Training handlers: `else if (screen === 'purchase-package') { setPreviousScreen(currentScreen); setVetServiceData(...); setCurrentScreen('purchase-package'); }`.
- Added `'purchase-package'` to `ScreenType` and block: `if (currentScreen === 'purchase-package') return <PackageBookingPage ... onBack={() => setCurrentScreen(previousScreen || 'home')} />`.
- Purchase Package now opens Package Booking page; Back returns to previous screen (e.g. grooming/training) or home.

---

## 4. ScreenType and default fallback

**Default fallback:** At the end of the render chain, `return <ComingSoon serviceName="pet-marketplace" onBack={handleBack} />`. Any `currentScreen` that does not match an earlier `if (currentScreen === '...')` hits this. So every possible value passed to `setCurrentScreen(...)` must either be handled by a dedicated block or normalized in the handler (e.g. 'add-address' → address_book, 'profile' → customer-profile).

**ScreenType updated with:** `'add-address'`, `'profile'`, `'purchase-package'`.

---

## 5. Handlers updated

| Handler | Additions |
|--------|-----------|
| handleVetNavigate | add-address → address_book (existing); profile → customer-profile; purchase-package → package-booking with previousScreen + vetServiceData |
| GroomingServiceRouter onNavigate | add-address → address_book (existing); profile → customer-profile; purchase-package → purchase-package with previousScreen + vetServiceData |
| TrainingServiceRouter onNavigate | add-address → address_book (existing); profile → customer-profile; purchase-package → purchase-package with previousScreen + vetServiceData |
| Boarding / Adoption / Sunset | else → coming-soon (no direct setCurrentScreen(screen)); no change. |

---

## 6. Render blocks added

| currentScreen | Renders |
|---------------|--------|
| add-address | AddressBookPage (same as address_book) |
| profile | CustomerScreenWrapper + CustomerProfile |
| purchase-package | PackageBookingPage with onBack → previousScreen or home |

---

## 7. Recommendation for future audits

- Grep for every `onNavigate('...')` and `setCurrentScreen('...')` and list the string literals.
- For each string, ensure either:
  - (a) A handler maps it to a known screen (e.g. add-address → address_book), or
  - (b) There is an `if (currentScreen === '...')` that renders the correct UI.
- Never leave a user-facing navigation target to hit the default ComingSoon unless it is intentional (e.g. “coming soon” feature).
