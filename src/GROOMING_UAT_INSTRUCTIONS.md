# 🧪 Grooming Flow - UAT Testing Instructions

## Prerequisites

### 1. **Customer Setup**
- Ensure you have a customer account with phone number
- Customer should have at least one pet registered
- Customer should have an address saved

### 2. **Vendor Setup (Groomer)**
- At least one vendor with `roleId: "pet_groomer"` must be onboarded
- Vendor should have:
  - Services published (with `serviceStyle: "at_center"` or `serviceStyle: "at_home"`)
  - Availability V2 configured with time windows
  - Status: `active`
  - `isVerified: true`
  - `isOnline: true`

### 3. **Wallet Balance (Optional)**
To test wallet functionality, you can add wallet balance for a customer using this API call:

```bash
curl -X POST https://<PROJECT_ID>.supabase.co/functions/v1/make-server-3dd53475/customer/wallet/credit \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "amount": 500,
    "description": "Test wallet topup for UAT"
  }'
```

---

## 🧭 **Test Flow 1: Grooming Center Booking**

### Step 1: Dashboard
1. Navigate to Grooming Service from Customer App
2. ✅ Verify you see:
   - Two main cards: "Grooming at Home" and "Grooming Centre"
   - Spotlight offers carousel (3 offers)
   - Popular packages section (Basic, Full, Spa)
   - Pet-specific recommendations (if pets exist)
   - Featured groomers list

### Step 2: Select Grooming Center
1. Click "Grooming Centre" card
2. ✅ Verify centers listing shows with:
   - Real grooming vendors from database
   - Vendor ratings and distance
   - Starting prices
   - "View Details" buttons

### Step 3: View Center Profile
1. Click on any grooming center
2. ✅ Verify profile shows:
   - Vendor name and details
   - Services offered
   - "Book Now" or "Select Service" button

### Step 4: Select Service/Package
1. Click "Select Service"
2. ✅ Verify:
   - List of services from vendor appears
   - Each service shows price, duration, description
   - "What's included" expandable section works
   - Can select add-ons if available
   - Total price updates dynamically
3. Click "Continue"

### Step 5: Select Pet
1. ✅ Verify:
   - All registered pets appear
   - Pet details show (name, breed, age, weight)
   - Can select a pet
   - "Add New Pet" option exists
2. Select a pet and click "Continue"

### Step 6: Select Time Slot
1. ✅ Verify:
   - 7-day calendar appears
   - Can navigate weeks
   - Slots load from vendor availability API
   - Slots are grouped by Morning/Afternoon/Evening
   - Available vs unavailable slots are clearly marked
   - Slot capacity shows ("X left")
2. Select date and time, click "Continue"

### Step 7: Payment
1. ✅ Verify payment page shows:
   - Booking summary (service, vendor, pet, date/time)
   - Price breakdown (Service + Add-ons + GST 18%)
   - Wallet section with real balance (if topup done)
   - Wallet toggle works
   - Coupon input field
   - Suggested coupons (FIRST20, SAVE10, GROOM50)
   - Payment method selection (UPI, Card, Net Banking)
   - Dynamic total calculation
2. Test wallet:
   - Toggle wallet ON
   - ✅ Verify amount deducts from total
3. Test coupon:
   - Enter "FIRST20"
   - Click "Apply"
   - ✅ Verify 20% discount applied (max ₹500)
4. Click "Pay Securely"
5. ✅ Verify payment processes (2-second mock delay)

### Step 8: Booking Confirmation
1. ✅ Verify confirmation screen shows:
   - Green checkmark success icon
   - Booking ID
   - **OTP displayed prominently** (4-digit)
   - Complete booking details
   - Payment summary
   - "View Booking" button
   - "Add to Calendar" button
   - "Share" button
   - Help section

### Step 9: OTP Verification
1. ✅ Note down the 4-digit OTP shown
2. This OTP is for **groomer to enter** on completion
3. OTP is stored in:
   - `booking:otp:{bookingId}`
   - `booking.serviceCompletionOtp`

---

## 🏠 **Test Flow 2: At-Home Grooming Booking**

### Step 1: Dashboard
1. Navigate to Grooming Service
2. Click "Grooming at Home" card

### Step 2: Select Home Groomer
1. ✅ Verify:
   - List of groomers with `serviceStyle: "at_home"`
   - Search functionality works
   - Groomer cards show rating, distance, starting price
2. Click on a groomer

### Step 3: Select Services
1. ✅ Verify:
   - Service list appears
   - Can select multiple services
   - Selected services highlight
   - Bottom bar shows count
2. Select service(s) and click "Continue"

### Step 4: Select Pet
Same as Center flow

### Step 5: Select Time Slot
Same as Center flow

### Step 6: Select Address
1. ✅ Verify:
   - Saved addresses appear
   - Can add new address
   - Address form has all fields (label, full address, landmark, city, pincode)
   - "Set as default" checkbox works
2. Select address and click "Continue"

### Step 7: Payment
Same as Center flow (with home service indicated)

### Step 8: Confirmation
Same as Center flow

---

## 🔐 **Test Flow 3: OTP Verification (Vendor App)**

### Prerequisites
- Groomer must have Vendor App access
- Booking must be created and have OTP generated

### Steps
1. Groomer opens booking in Vendor App
2. Completes service
3. Groomer taps "Complete Service"
4. Groomer asks customer for 4-digit OTP
5. Groomer enters OTP in Vendor App
6. ✅ Verify:
   - OTP validates correctly
   - Booking status changes to "completed"
   - `completedAt` timestamp updated
   - Revenue recognition triggered
   - Vendor payout ledger updated

---

## 🧪 **Test Cases Checklist**

### Dashboard Tests
- [ ] Dashboard loads without errors
- [ ] Pet recommendations show for customers with pets
- [ ] Pet recommendations don't show for customers without pets
- [ ] Popular packages display correctly
- [ ] Spotlight offers carousel scrolls
- [ ] "Book at Center" and "Book at Home" buttons work for pet recommendations

### Vendor Data Tests
- [ ] Only `pet_groomer` role vendors appear
- [ ] Only vendors with `isVerified: true` appear
- [ ] Only vendors with `status: 'active'` appear
- [ ] Vendor services filter by `serviceStyle`
- [ ] Vendor availability loads from V2 system

### Slot Tests
- [ ] Slots load for selected date
- [ ] Past dates are disabled
- [ ] Unavailable slots are disabled
- [ ] Slot capacity shows correctly
- [ ] Booked slots reduce available count
- [ ] Weekend/weekday availability respected

### Pet Tests
- [ ] All pets for customer load
- [ ] Pet details show correctly (name, breed, type, age, weight)
- [ ] Pre-selection works (if petId passed)
- [ ] "Add New Pet" navigates correctly

### Address Tests (Home Service)
- [ ] Saved addresses load
- [ ] Default address auto-selects
- [ ] Add new address saves correctly
- [ ] Address validation works
- [ ] Can delete address (if implemented)

### Wallet Tests
- [ ] Wallet balance loads from API
- [ ] Wallet toggle enables/disables correctly
- [ ] Wallet deduction calculates correctly
- [ ] Cannot deduct more than balance
- [ ] Wallet deduction shows in payment summary
- [ ] Wallet transaction recorded after payment

### Coupon Tests
- [ ] Coupon input accepts text
- [ ] Suggested coupons are clickable
- [ ] FIRST20 applies 20% discount (max ₹500)
- [ ] SAVE10 applies 10% discount (max ₹200)
- [ ] GROOM50 applies 15% discount (max ₹300)
- [ ] Invalid coupon shows error
- [ ] Coupon removal works
- [ ] Discount reflects in total
- [ ] Cannot apply multiple coupons

### Payment Tests
- [ ] Service price shows correctly
- [ ] Add-ons price adds correctly
- [ ] GST calculates as 18%
- [ ] Total = Subtotal + GST - Discount - Wallet
- [ ] Payment method selection works
- [ ] Mock payment succeeds after 2 seconds
- [ ] Loading state shows during payment

### Booking Creation Tests
- [ ] Booking creates with all data
- [ ] Booking ID generated
- [ ] Booking appears in customer history
- [ ] Booking appears in pet history
- [ ] Booking appears in vendor dashboard
- [ ] Booking has correct status: "pending"

### OTP Tests
- [ ] OTP generates on booking creation
- [ ] OTP is 4-digit number
- [ ] OTP displays in confirmation screen
- [ ] OTP stored in booking object
- [ ] OTP stored in separate OTP record
- [ ] OTP verification works
- [ ] Invalid OTP rejected
- [ ] Expired OTP rejected (1 hour expiry)
- [ ] Booking status changes to "completed" after OTP
- [ ] Completed timestamp recorded

### Navigation Tests
- [ ] Back buttons work at each step
- [ ] Can navigate back without losing data
- [ ] "Back to Dashboard" works
- [ ] Router state management works
- [ ] No navigation loops

### UI/UX Tests
- [ ] Mobile-first design (max-width: 430px)
- [ ] Orange color scheme (#FF8C42) consistent
- [ ] Loading states show spinners
- [ ] Error messages are clear
- [ ] Success confirmations are clear
- [ ] Buttons disabled when needed
- [ ] Form validation works
- [ ] Responsive on different screen sizes

---

## 🐛 **Known Issues / Limitations**

1. **Mock Payment**: Currently using 2-second delay instead of real Razorpay
2. **SMS for OTP**: OTP only shown in app, not sent via SMS
3. **Push Notifications**: Not implemented
4. **Calendar Integration**: "Add to Calendar" shows alert
5. **Share Function**: Native share API may not work on all devices
6. **Real-time Slot Availability**: Slots don't refresh automatically

---

## 📊 **Success Criteria**

### Minimum Viable Product (MVP)
- ✅ Customer can see real groomers from database
- ✅ Customer can select service and pet
- ✅ Customer can choose time slot based on vendor availability
- ✅ Customer can complete payment (mock)
- ✅ Booking creates successfully with OTP
- ✅ OTP displays for customer to share with groomer

### Full Feature Complete
- ✅ Wallet integration works
- ✅ Coupon system works
- ✅ Address management works (home service)
- ✅ End-to-end booking flow without errors
- ✅ OTP verification completes booking
- ✅ Revenue and payout ledgers update

---

## 🔧 **Troubleshooting**

### Issue: No groomers appearing
**Solution**: Ensure vendors with `roleId: "pet_groomer"` exist and are `active`, `verified`, `online`

### Issue: No slots available
**Solution**: Check vendor has availability V2 configured for the selected date

### Issue: Wallet balance shows ₹0
**Solution**: Use the credit API endpoint to add test balance

### Issue: Service selection empty
**Solution**: Ensure vendor has services with matching `serviceStyle`

### Issue: OTP not generating
**Solution**: Check booking creation succeeded and OTP generation API is called

### Issue: Payment fails
**Solution**: Check browser console for errors, verify API endpoints

---

## 📝 **Test Data Examples**

### Test Customer
```json
{
  "phone": "9876543210",
  "name": "Test Customer",
  "address": "123 Test Street, Bangalore",
  "coordinates": { "lat": 12.9716, "lng": 77.5946 }
}
```

### Test Pet
```json
{
  "name": "Bruno",
  "type": "dog",
  "breed": "Golden Retriever",
  "age": 3,
  "weight": 28
}
```

### Test Groomer (Vendor)
```json
{
  "roleId": "pet_groomer",
  "businessName": "Pawfect Grooming",
  "status": "active",
  "isVerified": true,
  "isOnline": true,
  "serviceStyles": ["at_center", "at_home"]
}
```

### Test Service
```json
{
  "serviceName": "Full Grooming Package",
  "price": 1499,
  "duration": 90,
  "serviceStyle": "at_center",
  "includedItems": ["Bath", "Haircut", "Nail Trim", "Ear Cleaning"]
}
```

---

## ✅ **Post-UAT Actions**

After successful UAT:
1. Document any bugs found
2. Fix critical issues
3. Optimize performance
4. Add real Razorpay integration (if needed)
5. Add SMS gateway for OTP (if needed)
6. Deploy to production
7. Monitor error logs
8. Collect user feedback

---

**UAT Status**: 🟡 Ready for Testing
**Last Updated**: [Current Date]
**Tested By**: [Your Name]
**Sign-off**: [ ] Approved / [ ] Needs Fixes
