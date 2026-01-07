# Complete Testing Plan - Specialized Services Integration

## 🧪 **Testing Overview**

This document outlines comprehensive testing scenarios for all specialized services (Pet Cafe, Pet Resort, Meal Plans) across web and mobile platforms.

---

## 📋 **Test Categories**

### **1. Payment Integration Tests**
### **2. Booking/Order Flow Tests**
### **3. Order Tracking Tests**
### **4. Status Transition Tests**
### **5. Error Handling Tests**
### **6. Navigation Flow Tests**

---

## 🎯 **Test Scenarios**

### **PET CAFE - Web App**

#### **Test 1: Complete Booking Flow**
1. Navigate to Pet Cafe service
2. Select cafe
3. Select table package
4. Enter date and time
5. Enter guest count and pet count
6. Add special requests
7. Click "Confirm Reservation"
8. **Expected**: Booking created, payment flow opens
9. Complete Razorpay payment
10. **Expected**: Payment verified, booking confirmed

#### **Test 2: Payment Success**
- Create booking
- Complete payment successfully
- **Expected**: 
  - Booking status: confirmed
  - Payment status: paid
  - Confirmation message shown
  - Redirect to booking detail

#### **Test 3: Payment Failure**
- Create booking
- Fail payment (use test card)
- **Expected**: 
  - Booking created (pending payment)
  - Error message shown
  - Option to retry payment

#### **Test 4: Payment Cancellation**
- Create booking
- Cancel payment
- **Expected**: 
  - Booking created (pending payment)
  - Message about pending payment
  - Option to complete payment later

---

### **PET CAFE - Mobile App**

#### **Test 1: Complete Booking Flow**
1. Open Pet Cafe Services screen
2. Browse cafes
3. Select cafe
4. Select table package
5. Enter reservation details
6. Confirm reservation
7. **Expected**: Payment flow opens
8. Complete Razorpay payment
9. **Expected**: Success alert with options (View Order / Track Order)

#### **Test 2: Navigation After Success**
- Complete booking with payment
- Select "View Order"
- **Expected**: Navigate to OrderDetail screen
- Select "Track Order"
- **Expected**: Navigate to OrderTracking screen

---

### **PET RESORT - Web App**

#### **Test 1: Complete Booking Flow**
1. Navigate to Pet Resort service
2. Select resort
3. Select room
4. Select check-in/check-out dates
5. Enter guest and pet count
6. Complete pre-check form
7. Confirm booking
8. **Expected**: Payment flow opens
9. Complete payment
10. **Expected**: Booking confirmed

#### **Test 2: Pre-Check Form Validation**
- Try to submit without required fields
- **Expected**: Validation errors shown
- Fill all required fields
- **Expected**: Form submits successfully

---

### **PET RESORT - Mobile App**

#### **Test 1: Complete Booking Flow**
1. Open Resort Services screen
2. Browse resorts
3. Select resort
4. Select room
5. Select dates
6. Complete pre-check form
7. Confirm booking
8. **Expected**: Payment flow opens
9. Complete payment
10. **Expected**: Success with navigation options

---

### **MEAL PLANS - Web App**

#### **Test 1: Complete Order Flow**
1. Navigate to Meal Plan service
2. Select meal plan
3. Select pet (filtered by pet type)
4. Select delivery address
5. Select delivery date & time
6. Select quantity
7. Place order
8. **Expected**: Payment flow opens
9. Complete payment
10. **Expected**: Order confirmed

#### **Test 2: Order Tracking**
1. Navigate to `/orders/meal-plans`
2. View order list
3. Click on order
4. **Expected**: Order details shown
5. Check delivery status
6. **Expected**: Status and timeline visible

---

### **MEAL PLANS - Mobile App**

#### **Test 1: Complete Order Flow**
1. Open Nutritionist Service screen
2. Select "Meal Plans"
3. Select meal plan
4. Select pet
5. Select delivery address
6. Select delivery date & time
7. Select quantity
8. Place order
9. **Expected**: Payment flow opens
10. Complete payment
11. **Expected**: Success with navigation options

#### **Test 2: Order List**
1. Navigate to Meal Plan Orders
2. **Expected**: Order list loads
3. Test filters: All, Active, Delivered, Cancelled
4. **Expected**: Orders filtered correctly
5. Pull to refresh
6. **Expected**: Orders refreshed

#### **Test 3: Order Tracking**
1. Open order from list
2. Click "Track Order"
3. **Expected**: Tracking screen opens
4. Check timeline
5. **Expected**: Meal plan specific timeline shown
6. Check delivery date/time
7. **Expected**: Correct delivery info displayed

#### **Test 4: Auto-Refresh**
1. Open Meal Plan Orders
2. Filter to "Active"
3. Wait 30 seconds
4. **Expected**: Orders auto-refresh
5. Check status updates
6. **Expected**: Status changes reflected

---

## 🔄 **Status Transition Tests**

### **Meal Plan Order Status Flow**

#### **Test 1: Pending → Confirmed**
- Create order
- Complete payment
- **Expected**: Status changes to "confirmed"

#### **Test 2: Confirmed → Preparing**
- Order in confirmed status
- Vendor updates to preparing
- **Expected**: Status updates in app

#### **Test 3: Preparing → Out for Delivery**
- Order in preparing status
- Vendor updates to out_for_delivery
- **Expected**: Status updates, delivery agent info shown

#### **Test 4: Out for Delivery → Delivered**
- Order out for delivery
- Vendor marks as delivered
- **Expected**: Status updates, timeline complete

---

## 🐛 **Error Handling Tests**

### **Test 1: Network Error**
- Disconnect network
- Try to create booking/order
- **Expected**: Error message, retry option

### **Test 2: Payment Error**
- Use invalid payment method
- **Expected**: Error message, booking/order still created (pending)

### **Test 3: API Error**
- Backend returns error
- **Expected**: User-friendly error message

### **Test 4: Missing Data**
- Try to submit without required fields
- **Expected**: Validation errors

---

## 🔗 **Navigation Flow Tests**

### **Test 1: Meal Plan Navigation**
1. NutritionistServiceScreen → Meal Plans
2. **Expected**: Navigate to MealPlanOrderScreen
3. Complete order → Success
4. Select "View Order"
5. **Expected**: Navigate to OrderDetail
6. Click "Track Order"
7. **Expected**: Navigate to OrderTracking

### **Test 2: Order List Navigation**
1. MealPlanOrdersScreen → Select order
2. **Expected**: Navigate to OrderDetail
3. Click "Track Order"
4. **Expected**: Navigate to OrderTracking
5. Click back
6. **Expected**: Return to OrderDetail

### **Test 3: Back Navigation**
- Test all back buttons
- **Expected**: Navigate to correct previous screen

---

## 📱 **Mobile App Specific Tests**

### **Test 1: Pull to Refresh**
- Open order list
- Pull down to refresh
- **Expected**: Orders refresh

### **Test 2: Auto-Refresh**
- Open active orders
- Wait 30 seconds
- **Expected**: Orders auto-refresh

### **Test 3: Status Badge Colors**
- Check all status badges
- **Expected**: Correct colors for each status

### **Test 4: Empty States**
- No orders scenario
- **Expected**: Empty state with message and action

---

## 🌐 **Web App Specific Tests**

### **Test 1: Responsive Design**
- Test on different screen sizes
- **Expected**: Layout adapts correctly

### **Test 2: Browser Compatibility**
- Test on Chrome, Firefox, Safari
- **Expected**: All features work

### **Test 3: Payment Modal**
- Razorpay checkout opens
- **Expected**: Modal displays correctly

---

## ✅ **Test Checklist**

### **Pet Cafe**
- [ ] Web: Complete booking flow
- [ ] Web: Payment success
- [ ] Web: Payment failure
- [ ] Mobile: Complete booking flow
- [ ] Mobile: Payment success
- [ ] Mobile: Navigation after success

### **Pet Resort**
- [ ] Web: Complete booking flow
- [ ] Web: Pre-check form validation
- [ ] Web: Payment success
- [ ] Mobile: Complete booking flow
- [ ] Mobile: Payment success
- [ ] Mobile: Navigation after success

### **Meal Plans**
- [ ] Web: Complete order flow
- [ ] Web: Order tracking
- [ ] Mobile: Complete order flow
- [ ] Mobile: Order list
- [ ] Mobile: Order tracking
- [ ] Mobile: Auto-refresh
- [ ] Mobile: Filters
- [ ] Mobile: Navigation flows

### **Common**
- [ ] Payment verification
- [ ] Status transitions
- [ ] Error handling
- [ ] Navigation flows
- [ ] Empty states
- [ ] Loading states

---

## 🚀 **Quick Test Commands**

### **Backend API Tests**
```bash
# Test meal plan order creation
curl -X POST https://api.warmpawz.com/nutrition/delivery-orders \
  -H "Content-Type: application/json" \
  -d '{
    "vendorId": "vendor_123",
    "customerId": "customer_123",
    "mealPlanId": "plan_123",
    "petId": "pet_123",
    "addressId": "addr_123",
    "deliveryDate": "2024-01-15",
    "deliveryTime": "14:00",
    "quantity": 1,
    "totalAmount": 1000
  }'

# Test payment order creation
curl -X POST https://api.warmpawz.com/payments/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "INR",
    "receipt": "order_123",
    "bookingId": "booking_123"
  }'
```

---

## 📊 **Test Results Template**

### **Test Execution Log**

| Test ID | Test Case | Platform | Status | Notes |
|---------|-----------|----------|--------|-------|
| TC-001 | Pet Cafe Booking (Web) | Web | ⏳ | |
| TC-002 | Pet Cafe Payment (Web) | Web | ⏳ | |
| TC-003 | Pet Cafe Booking (Mobile) | Mobile | ⏳ | |
| TC-004 | Meal Plan Order (Web) | Web | ⏳ | |
| TC-005 | Meal Plan Order (Mobile) | Mobile | ⏳ | |
| TC-006 | Order Tracking (Mobile) | Mobile | ⏳ | |
| TC-007 | Status Transitions | Both | ⏳ | |
| TC-008 | Error Handling | Both | ⏳ | |

---

## 🎯 **Priority Tests**

### **Critical (Must Pass)**
1. ✅ Payment integration works
2. ✅ Order/booking creation works
3. ✅ Payment verification works
4. ✅ Navigation flows work
5. ✅ Status updates work

### **Important (Should Pass)**
6. ✅ Order tracking works
7. ✅ Auto-refresh works
8. ✅ Filters work
9. ✅ Error handling works

### **Nice to Have**
10. ✅ Empty states display
11. ✅ Loading states display
12. ✅ Pull to refresh works

---

## ✅ **Ready for Testing**

All implementation is complete. Use this testing plan to verify:
- Payment flows
- Order/booking creation
- Order tracking
- Status updates
- Navigation
- Error handling

**Start testing!** 🧪

