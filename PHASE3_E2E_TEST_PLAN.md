# Phase 3: End-to-End Test Plan

## Test Environment Setup

### Prerequisites
- [ ] Backend server running
- [ ] Test vendor accounts created
- [ ] Test customer accounts created
- [ ] Test data seeded (events, campaigns, sessions, charts, etc.)
- [ ] Browser dev tools open for network monitoring

### Test Accounts
- **Vendor 1**: Clinic with events
- **Vendor 2**: Shelter with donation campaigns
- **Vendor 3**: Nutritionist with meal products
- **Vendor 4**: Behavioral specialist with counseling sessions
- **Vendor 5**: Memorial service provider
- **Customer**: Test customer with pets

## Test Scenarios

### 1. Events Integration

#### Test 1.1: View Events List
**Steps:**
1. Navigate to a clinic/vendor profile
2. Click "View Events" button
3. Verify events list screen loads
4. Verify events are displayed
5. Verify search bar works
6. Verify "Upcoming Only" filter works

**Expected Results:**
- ✅ Events list loads without errors
- ✅ Events display with correct information (name, date, time, venue)
- ✅ Search filters events correctly
- ✅ Filter toggles correctly
- ✅ Loading state shows during fetch
- ✅ Empty state shows if no events

**Test Data:**
- Vendor ID: `test-vendor-1`
- Expected events: 3-5 test events

#### Test 1.2: View Event Details
**Steps:**
1. From events list, click on an event
2. Verify event detail screen loads
3. Verify all event information displays correctly
4. Verify registration button appears (if event is available)

**Expected Results:**
- ✅ Event detail loads without errors
- ✅ All event information displays correctly
- ✅ Registration button shows if event is available
- ✅ "Event Full" message shows if event is full

**Test Data:**
- Event ID: `test-event-1`
- Event status: `published`

#### Test 1.3: Register for Event
**Steps:**
1. From event detail, click "Register for Event"
2. Fill registration form:
   - Name: "Test User"
   - Email: "test@example.com"
   - Phone: "9999999999"
   - Number of People: 2
   - Special Requirements: "Vegetarian meal"
3. Click "Register" button
4. Verify success message
5. Verify navigation back to events list

**Expected Results:**
- ✅ Form validation works
- ✅ Registration submits successfully
- ✅ Success toast appears
- ✅ Navigates back to events list
- ✅ Event attendee count updates

**API Verification:**
- ✅ POST request to `/vendor/event-management/:vendorId/:eventId/register`
- ✅ Request body contains correct data
- ✅ Response indicates success

### 2. Memorial Services Integration

#### Test 2.1: View Memorial Services
**Steps:**
1. Navigate to memorial service provider profile
2. Click "View Services" button
3. Verify memorial services screen loads
4. Verify Services tab is active by default
5. Click on Products tab
6. Verify products load

**Expected Results:**
- ✅ Services screen loads without errors
- ✅ Services tab shows services
- ✅ Products tab shows products
- ✅ Tab switching works smoothly
- ✅ Search functionality works

**Test Data:**
- Vendor ID: `test-vendor-5`
- Expected services: 2-3 test services
- Expected products: 5-10 test products

### 3. Meal Products Integration

#### Test 3.1: Browse Meal Products
**Steps:**
1. Navigate to nutritionist profile
2. Click "Browse Products" button
3. Verify meal products screen loads
4. Test diet type filter (Non-Veg, Veg, Egg)
5. Test suitable for filter (Puppy, Adult, Senior)
6. Test search functionality

**Expected Results:**
- ✅ Products load without errors
- ✅ Filters work correctly
- ✅ Search filters products
- ✅ Product information displays correctly
- ✅ Images load (if available)

**Test Data:**
- Vendor ID: `test-vendor-3`
- Expected products: 10-15 test products

### 4. Donation Campaigns Integration

#### Test 4.1: View Campaigns
**Steps:**
1. Navigate to shelter/rescue profile
2. Click "View Campaigns" button
3. Verify campaigns list loads
4. Verify campaign progress bars display correctly
5. Click "Donate Now" on a campaign

**Expected Results:**
- ✅ Campaigns load without errors
- ✅ Progress bars show correct percentages
- ✅ Campaign information displays correctly
- ✅ Donation form appears when clicking "Donate Now"

**Test Data:**
- Vendor ID: `test-vendor-2`
- Expected campaigns: 2-3 active campaigns

#### Test 4.2: Make Donation
**Steps:**
1. From campaign detail, fill donation form:
   - Amount: 500
   - Message: "Thank you for your work!"
2. Click "Donate" button
3. Verify success message
4. Verify campaign progress updates

**Expected Results:**
- ✅ Form validation works
- ✅ Donation submits successfully
- ✅ Success toast appears
- ✅ Campaign raised amount updates
- ✅ Progress bar updates

**API Verification:**
- ✅ POST request to `/customer/donations/:vendorId/contribute`
- ✅ Request body contains correct data
- ✅ Response indicates success

### 5. Counseling Sessions Integration

#### Test 5.1: Browse Sessions
**Steps:**
1. Navigate to behavioral specialist profile
2. Click "Book Session" button
3. Verify counseling sessions screen loads
4. Verify sessions display correctly
5. Test search functionality

**Expected Results:**
- ✅ Sessions load without errors
- ✅ Session information displays correctly
- ✅ Search filters sessions
- ✅ "Book Session" button shows for available sessions

**Test Data:**
- Vendor ID: `test-vendor-4`
- Expected sessions: 3-5 available sessions

#### Test 5.2: Book Session
**Steps:**
1. Click "Book Session" on an available session
2. Fill booking form:
   - Pet Name: "Buddy"
   - Concerns: "Aggressive behavior"
   - Preferred Date: (future date)
   - Preferred Time: "10:00"
3. Click "Book Session" button
4. Verify success message

**Expected Results:**
- ✅ Form validation works
- ✅ Booking submits successfully
- ✅ Success toast appears
- ✅ Session status updates to "booked"

**API Verification:**
- ✅ POST request to `/customer/counseling/:vendorId/book`
- ✅ Request body contains correct data
- ✅ Response indicates success

### 6. Diet Charts Integration

#### Test 6.1: View Diet Charts
**Steps:**
1. Navigate from pet profile or customer account
2. Click "View Diet Charts" button
3. Verify diet charts screen loads
4. Verify charts list displays correctly
5. Test search functionality

**Expected Results:**
- ✅ Charts load without errors
- ✅ Chart information displays correctly
- ✅ Search filters charts
- ✅ Status badges show correctly

**Test Data:**
- Customer ID: `test-customer-1`
- Expected charts: 2-3 diet charts

#### Test 6.2: View Chart Details
**Steps:**
1. Click on a diet chart
2. Verify chart detail screen loads
3. Verify meal schedule displays
4. Verify supplements/restrictions display
5. Verify notes display

**Expected Results:**
- ✅ Chart detail loads without errors
- ✅ All meal information displays correctly
- ✅ Nutritional information shows
- ✅ Supplements list shows
- ✅ Restrictions list shows

**API Verification:**
- ✅ GET request to `/customer/diet-charts/:customerId/:chartId`
- ✅ Response contains chart data
- ✅ Data displays correctly

## Error Scenarios

### Network Errors
**Test:**
1. Disable network connection
2. Try to load any component
3. Verify error message displays
4. Re-enable network
5. Verify retry works

**Expected:**
- ✅ User-friendly error message
- ✅ Retry option available
- ✅ No app crash

### Empty States
**Test:**
1. Use vendor with no data
2. Load each component
3. Verify empty state displays

**Expected:**
- ✅ Empty state message shows
- ✅ No errors in console
- ✅ UI remains functional

### Invalid Data
**Test:**
1. Use invalid vendor ID
2. Try to load components
3. Verify error handling

**Expected:**
- ✅ Error message displays
- ✅ No app crash
- ✅ User can navigate back

## Performance Tests

### Load Time
**Test:**
1. Measure time to load each component
2. Verify loading states show
3. Verify data loads within 3 seconds

**Expected:**
- ✅ Loading states appear immediately
- ✅ Data loads within 3 seconds
- ✅ No blocking UI

### Large Data Sets
**Test:**
1. Load components with 50+ items
2. Verify pagination or lazy loading
3. Verify performance remains good

**Expected:**
- ✅ Components handle large datasets
- ✅ No performance degradation
- ✅ Smooth scrolling

## Cross-Browser Testing

### Browsers to Test
- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)

### Mobile Testing
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Responsive design verification

## Accessibility Tests

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Enter/Space activates buttons
- [ ] Focus indicators visible

### Screen Reader
- [ ] All images have alt text
- [ ] Buttons have descriptive labels
- [ ] Form fields have labels

## Regression Tests

### Existing Features
- [ ] Verify existing navigation still works
- [ ] Verify existing components unaffected
- [ ] Verify no console errors

## Test Results Template

```
Test ID: [e.g., 1.1]
Test Name: [e.g., View Events List]
Status: [PASS/FAIL]
Browser: [e.g., Chrome 120]
Date: [e.g., 2024-01-15]
Tester: [Name]

Steps Taken:
1. [Step]
2. [Step]
...

Results:
- [Result]
- [Result]

Issues Found:
- [Issue description]

Screenshots:
- [Link to screenshot]
```

## Sign-Off Criteria

All tests must pass before sign-off:
- [ ] All functional tests pass
- [ ] All error scenarios handled
- [ ] Performance acceptable
- [ ] Cross-browser compatibility verified
- [ ] Mobile responsive verified
- [ ] Accessibility requirements met
- [ ] No regression issues

## Post-Test Actions

1. Document all issues found
2. Create bug reports for failures
3. Update test results document
4. Schedule retest for fixed issues
5. Update integration guide if needed

