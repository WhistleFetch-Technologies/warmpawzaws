# Wireframe Compliance & AWS Serverless Checklist
**Date:** January 2026  
**Scope:** Agent 2 - Phases 14-17 (25 Components)

---

## AWS Serverless Compliance Requirements

### ✅ CloudFront Compatibility
- [x] Next.js static export (`output: 'export'`)
- [x] No server-side APIs (getServerSideProps, API routes)
- [x] All components use `'use client'` directive
- [x] No browser-only APIs that break SSG
- [x] Runtime config via `/runtime-config.js` (deploy-time injection)

### ✅ Lambda Backend
- [x] All API calls use `apiClient` (no direct fetch to Supabase)
- [x] API endpoints follow pattern: `/vendor/:vendorId/*`
- [x] Error handling via `apiClient` error responses
- [x] No hardcoded API URLs

### ✅ Cognito Authentication
- [x] All components use `apiClient.getAuthToken()` which uses Cognito
- [x] Token stored in localStorage (client-side only)
- [x] No client-side secrets or API keys
- [x] Auth context propagated via Authorization header

### ✅ RDS Backend
- [x] All data persistence via Lambda → RDS
- [x] No direct database connections from frontend
- [x] All queries go through Lambda handlers

---

## Wireframe Compliance Checklist

### Phase 14: Booking Management (8 components)

#### 14.1 VendorBookingManagement.tsx
- [ ] Header with back button and vendor name
- [ ] Date selector (today/week/month filters)
- [ ] Time slot grid (10 AM - 6 PM)
- [ ] Booking cards with status indicators
- [ ] Action buttons (Complete, Chat, Video, Prescription)
- [ ] OTP modal for completion
- [ ] Stats display (calls, online, phone)

#### 14.2 VendorBookingCard.tsx
- [ ] Booking time and customer name
- [ ] Pet name and type
- [ ] Service name and location
- [ ] Status badge
- [ ] Action buttons row
- [ ] Unread message badge
- [ ] Prescription indicator

#### 14.3 VendorBookingDetailModal.tsx
- [ ] Full booking details
- [ ] Customer and pet information
- [ ] Service details
- [ ] Timeline/activity log
- [ ] Action buttons
- [ ] OTP input for completion

#### 14.4 BookingLifecycleManager.tsx
- [ ] Booking list with filters
- [ ] Status transitions
- [ ] Accept/Reject actions
- [ ] OTP verification
- [ ] Status badges

#### 14.5 IncomingBookingsPanel.tsx
- [ ] Pending bookings list
- [ ] Accept/Decline buttons
- [ ] Booking details preview
- [ ] Auto-refresh capability

#### 14.6 AcceptBookingModal.tsx
- [ ] Booking summary
- [ ] Staff assignment (if applicable)
- [ ] Notes field
- [ ] Confirm button

#### 14.7 DeclineBookingModal.tsx
- [ ] Decline reason selection
- [ ] Alternative suggestion
- [ ] Notes field
- [ ] Confirm decline button

#### 14.8 AppointmentDetailModal.tsx
- [ ] Complete appointment details
- [ ] Customer contact info
- [ ] Service timeline
- [ ] Prescription section
- [ ] Chat integration
- [ ] GPS tracking (if applicable)

---

### Phase 15: Service Management (7 components)

#### 15.1 VendorServiceManagementComplete.tsx
- [ ] Service type selection (Home/Center/Tele)
- [ ] Custom services section
- [ ] Package management section
- [ ] Service catalog section
- [ ] Distance pricing section (if home service)
- [ ] Help/info section

#### 15.2 VendorServiceCatalogView.tsx
- [ ] Search bar
- [ ] Service style filters
- [ ] Category grouping
- [ ] Service cards with pricing
- [ ] Multi-select mode
- [ ] Enable/disable toggle

#### 15.3 VendorCustomServiceCreation.tsx
- [ ] Service name input
- [ ] Category selection
- [ ] Description textarea
- [ ] Price and duration inputs
- [ ] Package option checkbox
- [ ] Submit button

#### 15.4 ServicePublishForm.tsx
- [ ] Service details form
- [ ] Category dropdown
- [ ] Service style selection
- [ ] Pricing inputs
- [ ] Duration input
- [ ] GPS tracking toggle (if home service)

#### 15.5 ServicePublishFormWithGPS.tsx
- [ ] Service info display
- [ ] GPS requirement indicator
- [ ] Publish level (vendor/centre)
- [ ] Centre selection (if applicable)
- [ ] Price override option
- [ ] Custom package option

#### 15.6 ServiceCatalogManager.tsx
- [ ] Service list
- [ ] Add service button
- [ ] Edit/Delete actions
- [ ] Status toggle
- [ ] Category filter

#### 15.7 VendorDistancePricing.tsx
- [ ] Pricing rules list
- [ ] Stats display (total, active, avg/km)
- [ ] Create rule button
- [ ] Price calculator
- [ ] Rule cards with details
- [ ] Edit/Delete actions

---

### Phase 16: Packages (3 components)

#### 16.1 PackageManagementContainer.tsx
- [ ] Screen routing (list/create)
- [ ] Navigation between views

#### 16.2 PackageList.tsx
- [ ] Header with create button
- [ ] Stats cards (live, sales, revenue)
- [ ] Status filters (all/approved/pending/rejected)
- [ ] Package cards with details
- [ ] Analytics button
- [ ] Edit/Delete actions

#### 16.3 CreatePackageFlow.tsx
- [ ] Package name input
- [ ] Package type selection
- [ ] Price inputs (package/original)
- [ ] Description textarea
- [ ] Submit button

---

### Phase 17: Facility & Center (7 components)

#### 17.1 FacilityManagement.tsx
- [ ] Description textarea
- [ ] Address input
- [ ] Operating hours input
- [ ] Photo upload grid
- [ ] Amenities checklist
- [ ] Custom amenities input
- [ ] Save button

#### 17.2 CenterProfileManager.tsx
- [ ] Tab navigation (basic/timing/amenities/specialization)
- [ ] Center name input
- [ ] Description textarea
- [ ] Address fields (city/state/pincode)
- [ ] Operating hours per day
- [ ] Amenities selection
- [ ] Specializations selector

#### 17.3 CenterAvailabilityManager.tsx
- [ ] Day-by-day availability
- [ ] Open/Close toggles
- [ ] Time inputs (open/close)
- [ ] Save button

#### 17.4 BoardingRoomManager.tsx
- [ ] Room list
- [ ] Add room button
- [ ] Room cards with details
- [ ] Edit/Delete actions
- [ ] Room form modal

#### 17.5 ResortManagementDashboard.tsx
- [ ] Tab navigation (rooms/bookings/amenities)
- [ ] Room list with status
- [ ] Booking calendar
- [ ] Add room button

#### 17.6 DoctorManagement.tsx
- [ ] Doctor list
- [ ] Add doctor button
- [ ] Doctor cards with stats
- [ ] Edit/Delete actions
- [ ] Specializations display

#### 17.7 VendorBusinessHub.tsx
- [ ] Tab navigation (services/inventory)
- [ ] Service cards (for vets)
- [ ] Inventory section
- [ ] Stats display

---

## Design System Compliance

### Colors
- Primary: `#FF8C42` (orange)
- Secondary: `#26C6DA` (cyan)
- Success: Green shades
- Error: Red shades
- Background: `gray-50` / `white`

### Typography
- Headings: `font-semibold` or `font-bold`
- Body: `text-sm` or `text-base`
- Labels: `text-sm font-medium`

### Spacing
- Container: `max-w-[430px] mx-auto` (mobile-first)
- Padding: `p-4` for sections
- Gaps: `gap-2`, `gap-3`, `gap-4` for flex/grid

### Components
- Cards: `rounded-xl` or `rounded-lg` with `border`
- Buttons: `rounded-lg` with proper padding
- Modals: `rounded-2xl` with backdrop
- Inputs: `rounded-lg` with focus rings

---

## Implementation Status

### ✅ Completed
- All 25 components created
- API integration (Lambda) complete
- Build passing
- No Supabase dependencies

### 🔄 In Progress
- Wireframe UI/UX alignment
- Design system compliance
- AWS Serverless verification

### ⏳ Pending
- Final visual polish
- Responsive design verification
- Accessibility audit

---

## Next Steps

1. Update each component to match wireframe exactly
2. Verify AWS Serverless compliance
3. Test CloudFront deployment
4. Final build and deployment test

