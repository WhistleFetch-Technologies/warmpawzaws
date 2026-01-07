# Mobile App Payment Integration Plan

## 📋 Current Status

### ✅ **Payment Infrastructure Ready**
- ✅ Razorpay SDK installed (`react-native-razorpay: ^2.3.1`)
- ✅ Payment API methods exist (`PaymentApi` in `api.ts`)
- ✅ Payment failure recovery screen exists
- ✅ Android build configured for Razorpay

### ⚠️ **Missing Payment Integration**
- ❌ Pet Cafe booking flow - No payment step
- ❌ Pet Resort booking flow - No payment step  
- ❌ Meal Plan ordering - Needs verification
- ⚠️ Other services (Vet, Training, Grooming) - Have payment step but need Razorpay integration verification

---

## 🎯 Implementation Plan

### **Phase 1: Add Payment to Pet Cafe & Resort** (Priority 1)

#### **Pet Cafe Services Screen**
**File**: `apps/WarmpawzCustomer/src/screens/services/PetCafeServicesScreen.tsx`

**Changes Needed**:
1. Add payment step after reservation details
2. Integrate Razorpay payment before booking confirmation
3. Update `handleCreateReservation` to:
   - Create booking first
   - Create Razorpay order
   - Open Razorpay checkout
   - Verify payment
   - Show confirmation

**Pattern to Follow**:
```typescript
// After booking creation
const orderRes = await PaymentApi.createRazorpayOrder({
  amount: selectedTable.price,
  currency: 'INR',
  receipt: bookingId,
  bookingId: bookingId,
  customerId: customerId,
});

// Open Razorpay
const RazorpayCheckout = require('react-native-razorpay').default;
const options = {
  description: 'Pet Cafe Table Reservation',
  image: 'https://your-logo-url.com/logo.png',
  currency: 'INR',
  key: 'YOUR_RAZORPAY_KEY',
  amount: selectedTable.price * 100,
  name: 'Warmpawz',
  order_id: orderRes.order_id,
  prefill: {
    contact: phone,
  },
  theme: { color: '#FF8C42' },
};

RazorpayCheckout.open(options)
  .then((data) => {
    // Verify payment
    return PaymentApi.verifyRazorpayPayment({
      razorpayOrderId: data.razorpay_order_id,
      razorpayPaymentId: data.razorpay_payment_id,
      razorpaySignature: data.razorpay_signature,
      bookingId: bookingId,
    });
  })
  .then(() => {
    // Show success
    setCurrentView('confirmation');
  })
  .catch((error) => {
    // Handle error
    Alert.alert('Payment Failed', error.description || 'Payment was cancelled');
  });
```

#### **Resort Services Screen**
**File**: `apps/WarmpawzCustomer/src/screens/services/ResortServicesScreen.tsx`

**Changes Needed**:
1. Add payment step after pre-check form
2. Integrate Razorpay payment before booking confirmation
3. Update `handleCreateBooking` similar to Pet Cafe

---

### **Phase 2: Verify Other Services** (Priority 2)

#### **Services to Check**:
- Vet Service Router
- Training Service Router
- Grooming Service Router
- Boarding Service Router

**Action**: Verify if they use Razorpay or just pass payment data to backend

---

### **Phase 3: Meal Plan Ordering** (Priority 3)

#### **Nutritionist Service Screen**
**File**: `apps/WarmpawzCustomer/src/screens/services/NutritionistServiceScreen.tsx`

**Current**: Handles consultation booking
**Needed**: Add meal plan ordering flow similar to web app

**New Flow**:
1. Select meal plan
2. Select pet
3. Select delivery address
4. Select delivery date & time
5. **Payment** (Razorpay)
6. Order confirmation

---

## 📝 Implementation Steps

### **Step 1: Update Pet Cafe Screen**
1. Import Razorpay and PaymentApi
2. Add payment step to view flow
3. Update `handleCreateReservation` to include payment
4. Add payment UI step
5. Test payment flow

### **Step 2: Update Resort Screen**
1. Import Razorpay and PaymentApi
2. Add payment step after pre-check
3. Update `handleCreateBooking` to include payment
4. Add payment UI step
5. Test payment flow

### **Step 3: Create Meal Plan Ordering Screen**
1. Create new component or extend NutritionistServiceScreen
2. Add meal plan selection
3. Add delivery address selection
4. Add payment integration
5. Test order flow

### **Step 4: Verify Other Services**
1. Check each service router
2. Add Razorpay if missing
3. Test payment flows

---

## 🔧 Technical Details

### **Razorpay Integration Pattern**

```typescript
import RazorpayCheckout from 'react-native-razorpay';
import { PaymentApi } from '../../services/api';

// 1. Create booking/order first
const booking = await CustomerApi.createBooking(bookingData);
const bookingId = booking.bookingId || booking.id;

// 2. Create Razorpay order
const orderRes = await PaymentApi.createRazorpayOrder({
  amount: totalAmount,
  currency: 'INR',
  receipt: bookingId,
  bookingId: bookingId,
  customerId: customerId,
});

// 3. Open Razorpay checkout
const options = {
  description: 'Service Description',
  currency: 'INR',
  key: 'YOUR_RAZORPAY_KEY', // From env or config
  amount: totalAmount * 100, // Convert to paise
  name: 'Warmpawz',
  order_id: orderRes.order_id,
  prefill: {
    contact: phone,
    email: email || '',
  },
  theme: { color: '#FF8C42' },
};

RazorpayCheckout.open(options)
  .then(async (data) => {
    // 4. Verify payment
    await PaymentApi.verifyRazorpayPayment({
      razorpayOrderId: data.razorpay_order_id,
      razorpayPaymentId: data.razorpay_payment_id,
      razorpaySignature: data.razorpay_signature,
      bookingId: bookingId,
    });
    
    // 5. Show success
    Alert.alert('Success', 'Payment successful!');
    // Navigate to confirmation
  })
  .catch((error) => {
    if (error.error) {
      // Payment failed
      Alert.alert('Payment Failed', error.error.description);
    } else {
      // User cancelled
      console.log('Payment cancelled');
    }
  });
```

### **Environment Variables Needed**
```typescript
// In config or env file
RAZORPAY_KEY_ID: string; // Your Razorpay key ID
```

---

## ✅ Success Criteria

- [ ] Pet Cafe booking includes payment step
- [ ] Pet Resort booking includes payment step
- [ ] Meal Plan ordering includes payment step
- [ ] All payments use Razorpay SDK
- [ ] Payment verification works correctly
- [ ] Error handling is robust
- [ ] User can retry failed payments
- [ ] All flows tested end-to-end

---

## 🚀 Ready to Implement

**Next Action**: Start with Pet Cafe payment integration as it's the simplest flow.

Would you like me to:
1. Implement payment integration for Pet Cafe?
2. Implement payment integration for Pet Resort?
3. Create meal plan ordering flow?
4. All of the above?

