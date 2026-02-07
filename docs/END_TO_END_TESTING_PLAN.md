# End-to-End Testing Plan

## Phase 4: Comprehensive Testing & Error Handling

### 1. Package-Aware Booking Flow Testing

#### Test Case 1.1: Customer with Active Package
- **Setup**: Create customer with active vet package (5 sessions remaining)
- **Steps**:
  1. Navigate to Vet Services
  2. Select a clinic/doctor
  3. Choose service type (tele/at_home/at_center)
  4. Verify package modal appears
  5. Select "Use Package Session"
  6. Complete booking flow
  7. Verify session created in `package_sessions` table
  8. Verify package remaining_sessions decremented
- **Expected**: Booking created with `is_package_session: true`, no payment required

#### Test Case 1.2: Customer without Package
- **Setup**: Customer with no active packages
- **Steps**:
  1. Navigate to Vet Services
  2. Select a clinic/doctor
  3. Choose service type
  4. Verify no package modal appears
  5. Complete normal booking flow
  6. Verify payment required
- **Expected**: Normal booking created, payment processed

#### Test Case 1.3: Package Expired/Exhausted
- **Setup**: Customer with expired package or 0 sessions remaining
- **Steps**:
  1. Navigate to Vet Services
  2. Attempt booking
  3. Verify package not offered
- **Expected**: Normal booking flow, package not shown

### 2. GPS Tracking Flow Testing

#### Test Case 2.1: Active Walk Display
- **Setup**: Create active walk session in `walker_live_sessions`
- **Steps**:
  1. Navigate to Walker Service
  2. Verify "Walk in Progress" card appears
  3. Click "Track" button
  4. Verify GPS tracking view loads
  5. Verify real-time location updates
- **Expected**: Live tracking view shows walker location, route, distance

#### Test Case 2.2: No Active Walks
- **Setup**: Customer with no active walks
- **Steps**:
  1. Navigate to Walker Service
  2. Verify no "Walk in Progress" card
  3. Verify walker list displays normally
- **Expected**: Normal walker service view

#### Test Case 2.3: Multiple Active Walks
- **Setup**: Customer with multiple active walks
- **Steps**:
  1. Navigate to Walker Service
  2. Verify first active walk displayed
  3. Verify can navigate to each walk's tracking
- **Expected**: All active walks accessible

### 3. Training Progress Flow Testing

#### Test Case 3.1: Active Training Package
- **Setup**: Customer with active training package
- **Steps**:
  1. Navigate to Training Service
  2. Verify "Your Training" section appears
  3. Verify progress bar shows correct completion
  4. Verify skills learned displayed
  5. Click "View Progress"
  6. Verify full skill matrix loads
- **Expected**: Training progress displayed correctly

#### Test Case 3.2: Pet Skills Display
- **Setup**: Pet with skill progress data
- **Steps**:
  1. Navigate to Training Service
  2. Verify "Skill Progress" section appears
  3. Verify skills show correct status (not_started/in_progress/mastered)
  4. Verify progress bars accurate
- **Expected**: Skill progress accurately displayed

#### Test Case 3.3: No Training Data
- **Setup**: Customer with no training packages or skills
- **Steps**:
  1. Navigate to Training Service
  2. Verify no training sections appear
  3. Verify normal service view displays
- **Expected**: Clean service view without training sections

### 4. Error Handling Testing

#### Test Case 4.1: API Failures
- **Scenarios**:
  - Network timeout
  - 500 server error
  - 404 not found
  - Invalid response format
- **Expected**: Graceful error messages, retry options, fallback UI

#### Test Case 4.2: Missing Data
- **Scenarios**:
  - Customer not found
  - Package not found
  - Pet not found
  - Vendor not found
- **Expected**: Clear error messages, redirect to appropriate screens

#### Test Case 4.3: Invalid Input
- **Scenarios**:
  - Invalid phone number
  - Invalid date/time
  - Missing required fields
- **Expected**: Validation errors, form highlights, helpful messages

### 5. Integration Testing

#### Test Case 5.1: Complete Package Booking Flow
1. Customer purchases package
2. Customer books using package
3. Session scheduled
4. Session completed
5. Package session count updated
6. Revenue recorded

#### Test Case 5.2: Complete Walk Flow
1. Customer books walk
2. Walker starts session
3. GPS tracking active
4. Customer views live tracking
5. Walk completed
6. Route saved
7. Payment processed

#### Test Case 5.3: Complete Training Flow
1. Customer purchases training package
2. Sessions scheduled
3. Skills tracked
4. Progress updated
5. Package completed
6. Skills mastered recorded

### 6. Performance Testing

- API response times < 500ms
- UI renders < 100ms
- GPS updates < 1s
- No memory leaks
- Smooth scrolling/animations

### 7. Browser Compatibility

- Chrome/Edge (latest)
- Safari (latest)
- Firefox (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

### 8. Accessibility Testing

- Screen reader compatibility
- Keyboard navigation
- Color contrast
- Focus indicators
- ARIA labels

## Implementation Priority

1. **High Priority**: Test Cases 1.1, 1.2, 2.1, 3.1 (Core flows)
2. **Medium Priority**: Test Cases 1.3, 2.2, 3.2, 4.1 (Edge cases)
3. **Low Priority**: Test Cases 2.3, 3.3, 5.x, 6, 7, 8 (Polish)
