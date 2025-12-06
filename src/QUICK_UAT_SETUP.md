# 🚀 Quick UAT Setup Guide

## ✅ **CRITICAL FIX APPLIED**

**Issue**: "Book Appointment" button was not working  
**Fix**: Updated to call `onNavigate('select_service')` instead of `onNavigate('appointment')`  
**Status**: ✅ **FIXED - Ready for UAT**

---

## 📋 **Pre-UAT Checklist**

### 1. **Add Wallet Balance** (Optional - for testing wallet feature)
Run this API call to add ₹500 to test customer's wallet:

```bash
curl -X POST https://<PROJECT_ID>.supabase.co/functions/v1/make-server-3dd53475/customer/wallet/credit \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "YOUR_CUSTOMER_PHONE",
    "amount": 500,
    "description": "UAT Test Balance"
  }'
```

**Replace**:
- `<PROJECT_ID>` with your Supabase project ID
- `<ANON_KEY>` with your Supabase anon key
- `YOUR_CUSTOMER_PHONE` with the customer's phone number

---

### 2. **Verify Groomer Vendor Setup**

Check that at least one groomer exists with:

```javascript
// Query to check groomers
const groomers = await kv.getByPrefix('vendor:');
const activeGroomers = groomers.filter(v => 
  v.roleId === 'pet_groomer' && 
  v.status === 'active' && 
  v.isVerified === true &&
  v.isOnline === true
);

console.log('Active Groomers:', activeGroomers.length);
```

**Required Vendor Fields**:
- `roleId: "pet_groomer"`
- `status: "active"`
- `isVerified: true`
- `isOnline: true`
- Has published services
- Has availability V2 configured

---

### 3. **Verify Groomer Has Services**

Check services exist for the groomer:

```javascript
// Check services for a vendor
const vendorServices = await kv.get('vendor:VENDOR_ID:services');
console.log('Vendor Services:', vendorServices);
```

**Required Service Fields**:
- `serviceName` or `name`
- `price`
- `duration`
- `serviceStyle: "at_center"` or `"at_home"`
- `isPublished: true`

---

### 4. **Verify Availability V2 Configured**

```javascript
// Check vendor availability
const availability = await kv.get('vendor:VENDOR_ID:availability:v2');
console.log('Availability:', availability);
```

**Required Availability Format**:
```javascript
[
  {
    dayOfWeek: "monday",
    isAvailable: true,
    timeWindows: [
      {
        startTime: "09:00",
        endTime: "18:00",
        isEnabled: true,
        maxBookings: 3
      }
    ]
  },
  // ... other days
]
```

---

## 🧪 **Quick UAT Test Flow**

### **Test 1: Basic Center Booking (5 minutes)**

1. **Dashboard**
   - ✅ Navigate to Grooming Services
   - ✅ See enhanced dashboard
   - ✅ See pet recommendations (if pets exist)
   - ✅ See popular packages
   - ✅ See featured groomers

2. **Center List**
   - ✅ Click "Grooming Centre" card
   - ✅ See list of real grooming centers
   - ✅ Click on any center

3. **Center Profile**
   - ✅ See vendor details
   - ✅ See services in "Services" tab
   - ✅ Click "Book Appointment" button

4. **Service Selection**
   - ✅ See list of services
   - ✅ Select a service
   - ✅ Click "Continue"

5. **Pet Selection**
   - ✅ See registered pets
   - ✅ Select a pet
   - ✅ Click "Continue"

6. **Time Slot**
   - ✅ See 7-day calendar
   - ✅ Select date
   - ✅ See available slots
   - ✅ Select time
   - ✅ Click "Continue"

7. **Payment**
   - ✅ See booking summary
   - ✅ See price breakdown
   - ✅ Toggle wallet (if balance added)
   - ✅ Apply coupon "FIRST20"
   - ✅ See discount applied
   - ✅ Click "Pay Securely"
   - ✅ Wait 2 seconds (mock payment)

8. **Confirmation**
   - ✅ See success message
   - ✅ See booking ID
   - ✅ **See 4-digit OTP prominently displayed**
   - ✅ Copy OTP button works
   - ✅ See complete booking details

**Expected Time**: ~5 minutes  
**Success**: Booking created with OTP

---

### **Test 2: Wallet & Coupon (2 minutes)**

1. Add wallet balance (see curl command above)
2. Start booking flow
3. At payment page:
   - ✅ See wallet balance (₹500)
   - ✅ Toggle wallet ON
   - ✅ See amount deduct from total
   - ✅ Enter "SAVE10" coupon
   - ✅ Click Apply
   - ✅ See 10% discount
   - ✅ See final amount calculation correct

**Success**: Both wallet and coupon work correctly

---

### **Test 3: At-Home Booking (Optional)**

1. Dashboard → "At Home Grooming"
2. Select groomer
3. Select service
4. Select pet
5. Select time
6. **Select/Add address**
7. Payment
8. Confirmation with OTP

**Expected Time**: ~6 minutes

---

## 🐛 **Common Issues & Solutions**

### Issue: "No groomers appearing"
**Check**:
- Vendor exists with `roleId: "pet_groomer"`
- `status: "active"`
- `isVerified: true`
- `isOnline: true`

**Solution**: Create/update vendor in admin panel

---

### Issue: "Book Appointment button does nothing"
**Status**: ✅ **FIXED**  
**Solution**: Already fixed in latest code update

---

### Issue: "No services showing"
**Check**:
- Vendor has published services
- Services have `serviceStyle: "at_center"` or `"at_home"`
- Services are `isPublished: true`

**Solution**: Publish services in vendor app

---

### Issue: "No time slots available"
**Check**:
- Vendor has availability V2 configured
- Selected day is enabled
- Time windows are configured

**Solution**: Configure availability in vendor app

---

### Issue: "Wallet shows ₹0"
**Check**: Wallet balance exists in database

**Solution**: Use curl command above to add test balance

---

### Issue: "Coupon not working"
**Check**: Console logs for validation response

**Available Coupons**:
- `FIRST20` - 20% off (max ₹500)
- `SAVE10` - 10% off (max ₹200)
- `GROOM50` - 15% off (max ₹300, min order ₹500)

**Solution**: Use exact coupon codes (case-insensitive)

---

## 📊 **Test Scenarios**

### Scenario 1: New Customer, No Wallet, No Coupon
- **Expected**: Full price + GST
- **Payment**: UPI/Card/NetBanking (mock)
- **Result**: Booking created with OTP

### Scenario 2: Customer with Wallet Balance
- **Expected**: Wallet deduction from total
- **Payment**: Remaining amount via payment method
- **Result**: Wallet balance reduced, booking created

### Scenario 3: Customer with Coupon
- **Expected**: Discount applied, total reduced
- **Payment**: Discounted amount
- **Result**: Coupon saved in booking record

### Scenario 4: Customer with Wallet + Coupon
- **Expected**: Coupon discount first, then wallet deduction
- **Payment**: Minimum amount
- **Result**: Both benefits applied

---

## ✅ **UAT Sign-Off Checklist**

After completing all tests:

- [ ] Dashboard loads with all sections
- [ ] Can view grooming centers
- [ ] Can view center profile
- [ ] **Book Appointment button works** ✅ FIXED
- [ ] Can select service
- [ ] Can select pet
- [ ] Can select time slot
- [ ] Real slots load from vendor availability
- [ ] Payment page shows correct calculations
- [ ] Wallet integration works (if tested)
- [ ] Coupon system works
- [ ] Mock payment succeeds
- [ ] Booking creates successfully
- [ ] OTP generates and displays
- [ ] Can navigate back at any step
- [ ] No console errors
- [ ] Mobile responsive (430px)

---

## 🎯 **Success Criteria**

### ✅ **MUST PASS**:
- [x] Book Appointment button works (FIXED)
- [ ] Complete booking end-to-end
- [ ] OTP displays on confirmation
- [ ] Booking appears in database
- [ ] No critical errors

### ✅ **SHOULD PASS**:
- [ ] Wallet deduction works
- [ ] Coupon validation works
- [ ] Slot availability real-time
- [ ] All navigation works

### ✅ **NICE TO HAVE**:
- [ ] Address management (home services)
- [ ] Smooth animations
- [ ] Fast loading times

---

## 📝 **Report Template**

After UAT, fill this out:

```
UAT Test Report - Grooming Flow
Date: ___________
Tester: ___________

CRITICAL FIXES:
✅ Book Appointment button - FIXED

TEST RESULTS:
[ ] Dashboard - PASS/FAIL
[ ] Center Booking Flow - PASS/FAIL
[ ] Service Selection - PASS/FAIL
[ ] Pet Selection - PASS/FAIL
[ ] Time Slots - PASS/FAIL
[ ] Payment - PASS/FAIL
[ ] OTP Display - PASS/FAIL
[ ] Wallet Integration - PASS/FAIL/NOT_TESTED
[ ] Coupon System - PASS/FAIL

BUGS FOUND:
1. [Description] - [Severity: Critical/High/Medium/Low]
2. ...

FEEDBACK:
[Your observations]

SIGN-OFF: [ ] Approved / [ ] Needs Fixes
```

---

## 🚀 **Ready to Start!**

**Status**: ✅ **SHOW-STOPPER FIXED - READY FOR UAT**

1. Add wallet balance (optional)
2. Verify vendor setup
3. Start test flow from dashboard
4. Complete booking
5. Verify OTP displays
6. Report results

**Need Help?** Check console logs for detailed debugging information.

---

**Last Updated**: Just now  
**Critical Fix**: Book Appointment button navigation ✅  
**UAT Status**: 🟢 READY
