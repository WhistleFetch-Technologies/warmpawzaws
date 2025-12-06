# 🔍 Vendor End-to-End Verification Checklist

## ✅ DATA RESET COMPLETED

All existing vendor data has been cleared from the system. The comprehensive deletion included:

- ✅ Vendor Profiles
- ✅ Phone Indexes  
- ✅ User Indexes
- ✅ Vendor User Accounts
- ✅ Vendor Services
- ✅ Availability Records
- ✅ Bookings
- ✅ Reviews
- ✅ Payouts
- ✅ Status Lists (pending, approved, rejected)
- ✅ Orphaned Indexes

---

## 📋 Complete Vendor Lifecycle Test Flow

### **Step 1: Vendor Onboarding (Vendor App)**

#### 1.1 Initial Access
- [ ] Navigate to Vendor App
- [ ] Verify landing page displays correctly with orange brand color (#FF8C42)
- [ ] Click "Get Started" or "Become a Vendor"

#### 1.2 Role Selection
- [ ] Verify all role options display correctly (loaded from admin configuration)
- [ ] Select a role (e.g., "Veterinarian")
- [ ] Verify role-specific onboarding fields appear

#### 1.3 Vendor Details Form
**Personal Information:**
- [ ] Full Name - required
- [ ] Business Name (if applicable) - optional
- [ ] Phone Number - required (will be used for login)
- [ ] Email Address - required

**Service Details:**
- [ ] Service Style Selection (At Home / At Center / Both) - based on role configuration
- [ ] Experience - required
- [ ] Address with Location - required

**Documents (Dynamic based on role config):**
- [ ] Aadhaar Card (Front & Back) - required
- [ ] PAN Card - required
- [ ] GST Certificate (if business) - optional
- [ ] Police Verification (if home service) - required for at_home service style
- [ ] Additional certificates (role-specific)

**Bank Details:**
- [ ] Account Number - required
- [ ] Bank Name - required
- [ ] IFSC Code - required
- [ ] Cancelled Cheque Upload - required

**Terms & Conditions:**
- [ ] Review terms checkbox - required
- [ ] Submit Application button enabled only when all required fields filled

#### 1.4 Application Submission
- [ ] Form validates all required fields
- [ ] Success message displays
- [ ] Vendor redirected to "Application Submitted" status page
- [ ] Status page shows:
  - Application ID
  - Submission timestamp
  - Expected review timeline
  - Contact information

---

### **Step 2: Admin Review & Approval (Admin App)**

#### 2.1 Admin Access
- [ ] Login to Admin App
- [ ] Navigate to "Vendor Management" section
- [ ] Click on "Pending Applications" tab

#### 2.2 Application Review
- [ ] Newly submitted vendor appears in pending list
- [ ] Click on application to open detail modal
- [ ] Verify all submitted information displays correctly:
  - Personal details
  - Contact information
  - Role and service style
  - All uploaded documents (with preview/download)
  - Bank details
  - Experience & address

#### 2.3 Document Verification
- [ ] Review each document
- [ ] Check for completeness and validity
- [ ] Verify role-specific requirements are met
- [ ] Check service style requirements (police verification for home service)

#### 2.4 Admin Decision Actions

**Option A: Approve Application**
- [ ] Click "Approve" button
- [ ] Add optional approval notes
- [ ] Confirm approval
- [ ] Verify vendor moves to "Approved" list
- [ ] Verify vendor receives notification (if implemented)

**Option B: Request Clarification**
- [ ] Click "Request Clarification"
- [ ] Add specific clarification requirements
- [ ] Submit request
- [ ] Verify vendor status changes to "Clarification Requested"
- [ ] Vendor should see clarification request in their app

**Option C: Reject Application**
- [ ] Click "Reject" button
- [ ] Enter detailed rejection reason
- [ ] Confirm rejection
- [ ] Verify vendor moves to "Rejected" list
- [ ] Verify vendor receives rejection notification

---

### **Step 3: Vendor Setup (After Approval)**

#### 3.1 Setup Notification
- [ ] Vendor logs back into Vendor App
- [ ] Verify "Approval Success" screen displays
- [ ] Screen shows:
  - Approval message
  - Next steps guidance
  - "Complete Setup" button

#### 3.2 Service Configuration
- [ ] Click "Complete Setup" or "Add Services"
- [ ] Verify service configuration screen displays
- [ ] See list of catalog services matching vendor's role

**Service Selection & Configuration:**
- [ ] Browse available catalog services for the role
- [ ] Select services to offer
- [ ] For each selected service:
  - [ ] View admin-defined base price (from payment rules)
  - [ ] Option to customize pricing (within admin-defined limits if configured)
  - [ ] Add service description/details
  - [ ] Upload service photos (optional)
  - [ ] Configure service-specific settings

**Service Publishing:**
- [ ] Review configured services
- [ ] Toggle "Publish to Customer App" for each service
- [ ] Only published services visible to customers
- [ ] Save service configuration

#### 3.3 Availability Setup
- [ ] Navigate to "Availability" setup
- [ ] Configure working hours:
  - [ ] Set days of operation (Mon-Sun)
  - [ ] Set time slots for each day
  - [ ] Mark holidays/unavailable dates
- [ ] Configure booking settings:
  - [ ] Advance booking window
  - [ ] Same-day booking availability
  - [ ] Buffer time between bookings
- [ ] Save availability settings

#### 3.4 Setup Completion
- [ ] Verify "Setup Complete" confirmation
- [ ] Vendor dashboard becomes accessible
- [ ] Services appear in Customer App (for published services)

---

### **Step 4: Service Discovery (Customer App)**

#### 4.1 Customer Service Search
- [ ] Login to Customer App (create test customer if needed)
- [ ] Navigate to service category
- [ ] Verify newly approved vendor's published services appear in listings

#### 4.2 Service Details
- [ ] Click on vendor service
- [ ] Verify service details page shows:
  - Vendor name and business name
  - Service description
  - Pricing (from vendor configuration or admin rules)
  - Availability
  - Reviews/ratings (if any)
  - Service style (at home/center)

#### 4.3 Vendor Profile
- [ ] Click on vendor profile
- [ ] Verify vendor information displays:
  - Name and photo
  - Experience
  - Ratings and reviews
  - Completed bookings
  - All published services

---

### **Step 5: Booking Lifecycle**

#### 5.1 Customer Creates Booking
- [ ] Select service and vendor
- [ ] Choose date and time slot
- [ ] Select pet (if required)
- [ ] Add special instructions
- [ ] Review booking details
- [ ] Proceed to payment
- [ ] Complete payment
- [ ] Verify booking confirmation

#### 5.2 Vendor Receives Booking
- [ ] Vendor dashboard shows new booking notification
- [ ] Booking appears in "Pending" bookings list
- [ ] Booking details show:
  - Customer name and contact
  - Pet details
  - Service requested
  - Date/time
  - Location (if at-home service)
  - Payment amount
  - Special instructions

#### 5.3 Vendor Actions on Booking

**Accept Booking:**
- [ ] Click "Accept" button
- [ ] Booking status changes to "Confirmed"
- [ ] Customer receives confirmation notification
- [ ] Booking appears in "Upcoming" list

**Reject Booking:**
- [ ] Click "Reject" button
- [ ] Provide rejection reason
- [ ] Customer receives cancellation notification
- [ ] Refund initiated (based on payment rules)

#### 5.4 Service Completion
- [ ] Vendor marks booking as "In Progress" (optional)
- [ ] Vendor completes service
- [ ] Click "Mark as Completed"
- [ ] Add service notes/summary
- [ ] Upload photos (optional)
- [ ] Submit completion

#### 5.5 Post-Service
- [ ] Customer can review service
- [ ] Customer can rate vendor
- [ ] Review appears on vendor profile
- [ ] Booking marked as "Completed"

---

### **Step 6: Payment & Commission Flow**

#### 6.1 Payment Rules (Admin Configuration)
- [ ] Admin has configured payment rules:
  - Commission rate (default 15%)
  - Payout schedule
  - Minimum payout threshold
  - Payment methods

#### 6.2 Revenue Calculation (Vendor Dashboard)
- [ ] View total revenue from completed bookings
- [ ] See platform commission deduction (15%)
- [ ] View net earnings
- [ ] Track pending payout amount
- [ ] View payout history

#### 6.3 Payout Request & Processing
**Vendor Payout Request:**
- [ ] Vendor clicks "Request Payout"
- [ ] Verify minimum threshold is met
- [ ] Review payout details:
  - Total earnings period
  - Commission deducted
  - Net payout amount
- [ ] Submit payout request

**Admin Payout Approval:**
- [ ] Admin receives payout request notification
- [ ] Navigate to "Payouts" section in Admin App
- [ ] Review payout request details:
  - Vendor name and bank details
  - Payout amount
  - Booking details contributing to payout
  - Commission breakdown
- [ ] Verify bank details
- [ ] Approve or reject payout request
- [ ] If approved, process payment
- [ ] Mark payout as "Completed"

**Vendor Payout Confirmation:**
- [ ] Vendor receives payout confirmation
- [ ] Payout appears in "Completed Payouts" list
- [ ] Transaction details viewable

---

### **Step 7: Ongoing Vendor Management (Admin)**

#### 7.1 Active Vendors Monitoring
- [ ] View all active vendors list
- [ ] Sort/filter by:
  - Role/vendor type
  - Status
  - Rating
  - Revenue
  - Booking count

#### 7.2 Vendor Performance
- [ ] View vendor analytics:
  - Total bookings
  - Completed vs cancelled
  - Average rating
  - Revenue generated
  - Customer reviews

#### 7.3 Admin Actions on Active Vendors

**Update Vendor Status:**
- [ ] Suspend vendor (temporarily)
- [ ] Deactivate vendor (permanently)
- [ ] Reactivate suspended vendor

**Modify Vendor Details:**
- [ ] Update contact information
- [ ] Update service offerings
- [ ] Update pricing (if admin-controlled)

**Add Admin Notes:**
- [ ] Add internal notes about vendor
- [ ] Track communication history

---

## 🎯 Critical Configuration Verifications

### Payment Rules Configuration
- [ ] Navigate to Admin > Settings > Payment Rules
- [ ] Verify commission rate is set (default 15%)
- [ ] Check payout settings:
  - Payout frequency (weekly/monthly)
  - Minimum payout amount
  - Payment processing time

### Role Configuration
- [ ] Navigate to Admin > Role Management
- [ ] Verify all vendor roles are configured:
  - Role name and ID
  - Service style options (at_home, at_center, both)
  - Required documents list
  - Onboarding field requirements

### Catalog Services
- [ ] Navigate to Admin > Catalog Management
- [ ] Verify services exist for each vendor role
- [ ] Check service details:
  - Service name and description
  - Base pricing (if admin-defined)
  - Category mapping
  - Vendor type assignment

### Booking Rules
- [ ] Navigate to Admin > Settings > Booking Rules
- [ ] Verify booking policies:
  - Cancellation policy
  - Reschedule policy
  - No-show policy
  - Advance booking windows

### Refund Policies
- [ ] Navigate to Admin > Settings > Refund Policies
- [ ] Verify refund rules:
  - Refund eligibility conditions
  - Refund percentages based on timing
  - Processing timeframes

---

## 🔧 Technical Verification Points

### Database Keys Check
After each major step, verify proper key creation:

**After Vendor Registration:**
```
vendor:vendor_{id}               - Vendor profile
vendor:phone:{phone}            - Phone index
vendor:user:{userId}            - User index
user:{userId}                   - User account
user:phone:{phone}             - User phone index
vendor:pending_approvals        - Contains vendorId in array
```

**After Admin Approval:**
```
vendor:approved_list            - Contains vendorId in array
vendor:pending_approvals        - VendorId removed
```

**After Service Setup:**
```
vendor:{vendorId}:service:{serviceId}    - Each configured service
vendor:{vendorId}:availability:{id}      - Availability records
vendor:{vendorId} (updated)              - setupCompleted: true, isActive: true
```

**After Booking:**
```
booking:{bookingId}                              - Main booking record
booking:vendor:{vendorId}:{bookingId}           - Vendor's booking index
booking:customer:{customerId}:{bookingId}       - Customer's booking index
pet:{petId}:booking:{bookingId}                 - Pet's booking index (if applicable)
```

**After Payout:**
```
payout:{payoutId}                        - Payout record
payout:vendor:{vendorId}:{payoutId}     - Vendor's payout index
```

### API Endpoints Check
Verify all endpoints respond correctly:

**Vendor Onboarding:**
- `POST /make-server-3dd53475/vendor/register` - Submit application
- `GET /make-server-3dd53475/vendor/application-status/:userId` - Check status

**Admin Approval:**
- `GET /make-server-3dd53475/admin/vendors/pending` - List pending
- `POST /make-server-3dd53475/admin/vendors/:vendorId/approve` - Approve
- `POST /make-server-3dd53475/admin/vendors/:vendorId/reject` - Reject

**Vendor Setup:**
- `GET /make-server-3dd53475/vendor/services` - Get available catalog services
- `POST /make-server-3dd53475/vendor/services` - Configure vendor services
- `PUT /make-server-3dd53475/vendor/availability` - Set availability

**Customer Discovery:**
- `GET /make-server-3dd53475/customer/services` - List services
- `GET /make-server-3dd53475/customer/vendors/:vendorId` - Vendor profile

**Booking:**
- `POST /make-server-3dd53475/bookings` - Create booking
- `GET /make-server-3dd53475/vendor/bookings` - Vendor's bookings
- `PUT /make-server-3dd53475/vendor/bookings/:id/status` - Update status

**Payouts:**
- `POST /make-server-3dd53475/vendor/payouts/request` - Request payout
- `GET /make-server-3dd53475/admin/payouts/pending` - Admin view pending
- `POST /make-server-3dd53475/admin/payouts/:id/approve` - Approve payout

---

## 🚨 Common Issues to Watch For

### During Onboarding:
- ❌ Required fields not validating properly
- ❌ File uploads failing
- ❌ Role-specific fields not showing/hiding correctly
- ❌ Service style options not matching role configuration
- ❌ Phone number not cleaned/stored correctly

### During Admin Review:
- ❌ Documents not displaying in preview
- ❌ Vendor details incomplete or missing
- ❌ Status change not reflecting immediately
- ❌ Multiple approvals causing duplicate entries

### During Service Setup:
- ❌ Catalog services not loading for vendor's role
- ❌ Pricing not respecting admin-defined rules
- ❌ Service publishing toggle not working
- ❌ Availability configuration not saving

### During Booking Flow:
- ❌ Vendor not receiving booking notifications
- ❌ Customer not seeing newly approved vendor
- ❌ Booking status updates not syncing
- ❌ Payment amounts incorrect

### During Payout:
- ❌ Commission calculation incorrect (should be 15%)
- ❌ Net amount not matching expectations
- ❌ Bank details not displaying
- ❌ Payout status not updating

---

## ✅ Success Criteria

The complete vendor lifecycle is working correctly when:

1. ✅ A new vendor can complete onboarding without errors
2. ✅ Admin can review and approve applications with all information visible
3. ✅ Approved vendor can configure services based on catalog
4. ✅ Vendor services appear in customer app immediately after publishing
5. ✅ Customers can discover and book vendor services
6. ✅ Vendor receives booking and can manage it through completion
7. ✅ Revenue calculation respects 15% commission rule
8. ✅ Payout workflow works end-to-end with admin approval
9. ✅ All database keys are created correctly at each step
10. ✅ All API endpoints respond with correct data structure

---

## 🧪 Execute Test Now

To test the complete flow:

1. **Clear Data**: Already completed ✅
2. **Start Fresh**: Create new vendor through UI
3. **Follow Checklist**: Go through each step above
4. **Document Issues**: Note any problems encountered
5. **Verify Database**: Check keys after each major step
6. **Test Edge Cases**: Try error scenarios

---

## 📞 Testing Contact Information

**Test Vendor Details to Use:**
- Full Name: John Smith
- Phone: 9876543210
- Email: john.smith@test.com
- Role: Veterinarian
- Service Style: Both
- Experience: 10 years
- Address: 123 Test Street, Bangalore, Karnataka 560001

**Test Customer Details:**
- Name: Sarah Johnson  
- Phone: 9876543211
- Email: sarah@test.com

**Test Pet Details:**
- Name: Max
- Type: Dog
- Breed: Golden Retriever
- Age: 3 years

---

## 🎉 Final Verification Completed When:

- [ ] All checkboxes above are checked ✅
- [ ] No errors encountered in any flow
- [ ] Database keys verified at each step
- [ ] All API endpoints responding correctly
- [ ] Payment calculations accurate
- [ ] UI rendering correctly with brand colors
- [ ] Mobile responsiveness verified (430px constraint)
- [ ] Admin can control entire ecosystem
- [ ] Vendor can operate independently after setup
- [ ] Customer has seamless booking experience

---

**Last Updated**: Ready for testing after data reset
**Status**: ✅ All vendors cleared - System ready for fresh E2E test
