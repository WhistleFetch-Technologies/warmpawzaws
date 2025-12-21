# Phase 3: Manual Testing Guide

## Quick Start

This guide provides step-by-step instructions for manually testing all Phase 3 customer integration components.

## Prerequisites

1. **Backend Running**: Ensure the Supabase Edge Functions server is running
2. **Test Data**: Create test vendors with:
   - Events (for clinics/shelters)
   - Memorial services/products (for memorial service providers)
   - Meal products (for nutritionists)
   - Donation campaigns (for shelters/rescues)
   - Counseling sessions (for behavioral specialists)
   - Diet charts (for customers with pets)

3. **Test Accounts**:
   - Customer account with phone number
   - Vendor accounts with various capabilities enabled

## Test Entry Points

### 1. Events Testing

#### Entry Point: Clinic Profile View
1. Navigate to: Vet Services → Select a Clinic
2. In the clinic profile, look for **"Quick Actions"** section
3. Click **"Events"** button
4. You should see `EventListView` component

#### Test Steps:
- [ ] **Load Events List**
  - Verify events load without errors
  - Verify loading spinner appears
  - Verify events display with correct information

- [ ] **Search Functionality**
  - Type in search box
  - Verify events filter in real-time
  - Clear search and verify all events show

- [ ] **Filter Functionality**
  - Toggle "Upcoming Only" filter
  - Verify only upcoming events show
  - Toggle off and verify all events show

- [ ] **Navigate to Event Detail**
  - Click on an event card
  - Verify `EventDetailView` loads
  - Verify all event information displays correctly

- [ ] **Event Registration**
  - Click "Register for Event" button
  - Fill registration form:
    - Name: "Test User"
    - Email: "test@example.com"
    - Phone: "9999999999"
    - Number of People: 2
    - Special Requirements: "Test requirements"
  - Click "Register"
  - Verify success toast appears
  - Verify navigation back to events list
  - Verify event attendee count updates

- [ ] **Error Scenarios**
  - Try registering for a full event
  - Verify "Event Full" message shows
  - Try with invalid form data
  - Verify validation errors show

### 2. Memorial Services Testing

#### Entry Point: Clinic Profile View
1. Navigate to: Vet Services → Select a Clinic
2. In the clinic profile, look for **"Quick Actions"** section
3. Click **"Memorial"** button
4. You should see `MemorialServicesView` component

#### Test Steps:
- [ ] **Load Services/Products**
  - Verify Services tab is active by default
  - Verify services load correctly
  - Click Products tab
  - Verify products load correctly

- [ ] **Tab Switching**
  - Switch between Services and Products tabs
  - Verify smooth transition
  - Verify data persists

- [ ] **Search Functionality**
  - Type in search box
  - Verify services/products filter
  - Test with different search terms

- [ ] **Display Information**
  - Verify service/product names display
  - Verify prices display
  - Verify descriptions display
  - Verify status indicators show correctly

### 3. Meal Products Testing

#### Entry Point: Nutritionist Services Landing
1. Navigate to: Nutritionist Services
2. Click **"Book"** on any nutritionist card
3. You should see `MealProductCatalog` component

#### Test Steps:
- [ ] **Load Products**
  - Verify products load without errors
  - Verify loading state shows
  - Verify products display correctly

- [ ] **Diet Type Filter**
  - Click "Non-Veg" filter
  - Verify only non-veg products show
  - Click "Veg" filter
  - Verify only veg products show
  - Click "All Diets"
  - Verify all products show

- [ ] **Suitable For Filter**
  - Click "Puppy" filter
  - Verify only puppy products show
  - Click "Adult" filter
  - Verify only adult products show
  - Click "All Ages"
  - Verify all products show

- [ ] **Search Functionality**
  - Type product name in search
  - Verify products filter
  - Type ingredient name
  - Verify products with that ingredient show

- [ ] **Product Information**
  - Verify product images display (if available)
  - Verify prices display
  - Verify ingredients list shows
  - Verify nutritional information displays

### 4. Donation Campaigns Testing

#### Entry Point: Shelter/Rescue Profile
1. Navigate to: Adoption Services → Select a Shelter
2. Look for donation campaign link/button
3. Navigate to donation campaigns
4. You should see `DonationCampaignView` component

**Note**: Navigation link needs to be added to shelter profile views.

#### Test Steps:
- [ ] **Load Campaigns**
  - Verify campaigns load without errors
  - Verify loading state shows
  - Verify campaigns display correctly

- [ ] **Campaign Information**
  - Verify campaign name displays
  - Verify description displays
  - Verify progress bar shows correct percentage
  - Verify raised amount vs goal displays
  - Verify donation count displays

- [ ] **Donation Flow**
  - Click "Donate Now" on a campaign
  - Verify donation form appears
  - Fill form:
    - Amount: 500
    - Message: "Thank you for your work!"
  - Click "Donate"
  - Verify success toast appears
  - Verify campaign progress updates
  - Verify raised amount increases

- [ ] **Form Validation**
  - Try submitting with empty amount
  - Verify validation error shows
  - Try with negative amount
  - Verify validation error shows

### 5. Counseling Sessions Testing

#### Entry Point: Behavioral Specialist Profile
1. Navigate to: Behavioral Services → Select a Specialist
2. Look for counseling sessions link/button
3. Navigate to counseling sessions
4. You should see `CounselingBookingView` component

**Note**: Navigation link needs to be added to behavioral specialist profile views.

#### Test Steps:
- [ ] **Load Sessions**
  - Verify sessions load without errors
  - Verify loading state shows
  - Verify sessions display correctly

- [ ] **Session Information**
  - Verify session titles display
  - Verify descriptions display
  - Verify duration displays
  - Verify prices display (if applicable)
  - Verify topics display (if available)

- [ ] **Search Functionality**
  - Type in search box
  - Verify sessions filter
  - Test with different search terms

- [ ] **Booking Flow**
  - Click "Book Session" on an available session
  - Verify booking form appears
  - Fill form:
    - Pet Name: "Buddy"
    - Concerns: "Aggressive behavior"
    - Preferred Date: (future date)
    - Preferred Time: "10:00"
  - Click "Book Session"
  - Verify success toast appears
  - Verify session status updates

- [ ] **Form Validation**
  - Try submitting with empty pet name
  - Verify validation error shows
  - Try with empty concerns
  - Verify validation error shows

### 6. Diet Charts Testing

#### Entry Point: Customer Profile
1. Navigate to: Customer Profile (from sidebar or home)
2. In "Quick Links" section, click **"Diet Charts"**
3. You should see `DietChartsView` component

#### Test Steps:
- [ ] **Load Charts**
  - Verify charts load without errors
  - Verify loading state shows
  - Verify charts display correctly

- [ ] **Chart Information**
  - Verify chart names display
  - Verify pet names display
  - Verify diet types display
  - Verify status badges show correctly
  - Verify start dates display

- [ ] **Search Functionality**
  - Type in search box
  - Verify charts filter
  - Test with chart name
  - Test with pet name

- [ ] **View Chart Details**
  - Click on a diet chart
  - Verify chart detail view loads
  - Verify meal schedule displays
  - Verify meal times show
  - Verify meal names show
  - Verify portions show
  - Verify nutritional info displays (calories, protein, fat, carbs)
  - Verify supplements list shows (if available)
  - Verify restrictions list shows (if available)
  - Verify notes display (if available)

- [ ] **Navigation**
  - Click back button
  - Verify returns to charts list
  - Verify chart list still shows

## Direct Navigation Testing

### Using Browser Console

You can test components directly by navigating to them in the browser console:

```javascript
// Test Events List
window.location.hash = '#events-list';
// Then set vendorId in component state

// Test Diet Charts
window.location.hash = '#diet-charts';
```

### Using URL Parameters

If your routing supports URL parameters, you can test with:
- `/customer/events-list?vendorId=test-vendor-1`
- `/customer/meal-products?vendorId=test-vendor-3`
- `/customer/diet-charts?customerId=test-customer-1`

## Common Test Scenarios

### Network Error Testing
1. Open browser DevTools → Network tab
2. Set network to "Offline"
3. Try to load any component
4. Verify error message displays
5. Set network back to "Online"
6. Verify retry works

### Empty State Testing
1. Use a vendor with no data
2. Load each component
3. Verify empty state message displays
4. Verify no errors in console

### Loading State Testing
1. Open browser DevTools → Network tab
2. Set throttling to "Slow 3G"
3. Load components
4. Verify loading spinners appear
5. Verify smooth transition when data loads

### Form Validation Testing
1. Try submitting forms with empty required fields
2. Try submitting with invalid data (negative numbers, etc.)
3. Verify validation errors display
4. Verify forms don't submit with invalid data

## Test Data Requirements

### For Events Testing
Create test events with:
- Event name, description, date, time
- Venue information (at_center, external, or online)
- Registration requirements
- Max attendees
- Fees (some with fees, some free)

### For Memorial Services Testing
Create test services and products with:
- Service names, descriptions, prices
- Product names, descriptions, prices, images
- Stock status (in stock/out of stock)

### For Meal Products Testing
Create test products with:
- Product names, descriptions
- Diet types (Non-Veg, Veg, Egg)
- Suitable for (Puppy, Adult, Senior)
- Pet types (Dog, Cat, etc.)
- Ingredients lists
- Nutritional information
- Prices

### For Donation Campaigns Testing
Create test campaigns with:
- Campaign names, descriptions
- Goal amounts
- Start/end dates
- Active status

### For Counseling Sessions Testing
Create test sessions with:
- Session titles, descriptions
- Durations
- Prices
- Topics
- Scheduled dates/times
- Available status

### For Diet Charts Testing
Create test charts with:
- Chart names
- Pet information
- Diet types
- Meal schedules
- Supplements
- Restrictions
- Notes

## Browser Testing Checklist

### Chrome
- [ ] All components load
- [ ] All forms work
- [ ] All navigation works
- [ ] No console errors

### Safari
- [ ] All components load
- [ ] All forms work
- [ ] All navigation works
- [ ] No console errors

### Firefox
- [ ] All components load
- [ ] All forms work
- [ ] All navigation works
- [ ] No console errors

### Mobile Safari (iOS)
- [ ] Responsive design works
- [ ] Touch interactions work
- [ ] Forms are usable
- [ ] Navigation works

### Mobile Chrome (Android)
- [ ] Responsive design works
- [ ] Touch interactions work
- [ ] Forms are usable
- [ ] Navigation works

## Performance Testing

### Load Time
- [ ] Events list loads in < 2 seconds
- [ ] Event detail loads in < 1 second
- [ ] Memorial services load in < 2 seconds
- [ ] Meal products load in < 2 seconds
- [ ] Donation campaigns load in < 2 seconds
- [ ] Counseling sessions load in < 2 seconds
- [ ] Diet charts load in < 2 seconds

### Large Data Sets
- [ ] Test with 50+ events
- [ ] Test with 100+ products
- [ ] Verify pagination or lazy loading works
- [ ] Verify performance remains acceptable

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Enter/Space activates buttons
- [ ] Focus indicators are visible
- [ ] Forms are navigable with keyboard

### Screen Reader
- [ ] All images have alt text
- [ ] Buttons have descriptive labels
- [ ] Form fields have labels
- [ ] Error messages are announced

## Known Issues to Watch For

1. **Missing Navigation Links**: Some vendor profiles may not have navigation links yet
2. **State Management**: Verify state persists correctly when navigating
3. **Error Handling**: Verify all error scenarios are handled gracefully
4. **Loading States**: Verify loading states show during API calls

## Test Results Template

```
Component: [Component Name]
Test Date: [Date]
Tester: [Name]
Browser: [Browser/Version]

✅ Passed Tests:
- [Test description]

❌ Failed Tests:
- [Test description]
- [Error details]

⚠️ Issues Found:
- [Issue description]

📝 Notes:
- [Additional notes]
```

## Quick Test Commands

### Test Events
```javascript
// In browser console
// Navigate to clinic profile first, then:
// Click "Events" button in Quick Actions section
```

### Test Meal Products
```javascript
// Navigate to Nutritionist Services
// Click "Book" on any nutritionist
```

### Test Diet Charts
```javascript
// Navigate to Customer Profile
// Click "Diet Charts" in Quick Links
```

## Success Criteria

All tests pass if:
- ✅ All components load without errors
- ✅ All forms submit successfully
- ✅ All navigation works correctly
- ✅ All error scenarios are handled
- ✅ All loading states work
- ✅ All empty states display correctly
- ✅ Performance is acceptable
- ✅ Mobile responsive design works
- ✅ Accessibility requirements met

## Next Steps After Testing

1. **Document Issues**: Create bug reports for any issues found
2. **Fix Critical Issues**: Address blocking issues immediately
3. **Update Documentation**: Update integration guide with findings
4. **Add Missing Links**: Add navigation links to vendor profiles that need them
5. **Performance Optimization**: Address any performance issues found
6. **Accessibility Fixes**: Fix any accessibility issues found

---

**Ready to Test!** Follow the steps above to test each component systematically.

