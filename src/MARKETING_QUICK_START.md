# 🚀 MARKETING INTEGRATION - QUICK START GUIDE

## ⚡ Get Started in 5 Minutes

---

## 📦 **1. COMPONENTS AVAILABLE**

```
/components/customer/
  ├── PromotionsDeals.tsx       (Browse promotions)
  ├── CouponCodeInput.tsx        (Apply coupons)
  └── BookingWithCoupon.tsx      (Complete booking flow)
```

---

## 🎯 **2. ADD TO YOUR APP**

### **Option A: Add Promotions Page**

```tsx
// /App.tsx or /pages/PromotionsPage.tsx
import { PromotionsDeals } from './components/customer/PromotionsDeals';

export function PromotionsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl mb-6">🎁 Deals & Offers</h1>
        
        <PromotionsDeals
          category="all"
          applicableTo="services"
        />
      </div>
    </div>
  );
}
```

---

### **Option B: Add to Home Screen Widget**

```tsx
// /App.tsx
import { PromotionsDeals } from './components/customer/PromotionsDeals';

export default function App() {
  return (
    <div>
      {/* Existing content */}
      
      {/* Add this widget */}
      <section className="mt-8 px-4">
        <h2 className="text-xl mb-4 flex items-center gap-2">
          <span>🔥</span>
          Today's Hot Deals
        </h2>
        
        <PromotionsDeals 
          compact={true}
          applicableTo="all"
        />
      </section>
    </div>
  );
}
```

---

### **Option C: Add Coupon to Existing Booking**

```tsx
// /components/BookingFlow.tsx
import { CouponCodeInput } from './components/customer/CouponCodeInput';
import { useState } from 'react';

export function BookingFlow({ servicePrice }) {
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  return (
    <div className="booking-container">
      {/* Existing booking form */}
      
      {/* Add coupon section */}
      <div className="mt-6">
        <CouponCodeInput
          orderAmount={servicePrice}
          customerId="customer_123"
          onCouponApplied={(discountAmount, coupon) => {
            setDiscount(discountAmount);
            setAppliedCoupon(coupon);
          }}
          onCouponRemoved={() => {
            setDiscount(0);
            setAppliedCoupon(null);
          }}
        />
      </div>

      {/* Update total */}
      <div className="mt-4 text-xl">
        Final Price: ₹{servicePrice - discount}
      </div>
    </div>
  );
}
```

---

### **Option D: Complete Booking with Coupon**

```tsx
// /pages/BookingPage.tsx
import { BookingWithCoupon } from './components/customer/BookingWithCoupon';

export function BookingPage() {
  const service = {
    id: 'service_123',
    name: 'Dog Grooming',
    price: 1200,
    duration: 60
  };

  const vendor = {
    id: 'vendor_456',
    name: 'Happy Paws Grooming',
    location: 'Koramangala, Bangalore'
  };

  return (
    <BookingWithCoupon
      service={service}
      vendor={vendor}
      customerId="customer_789"
      onBookingComplete={(bookingId) => {
        // Redirect to success page
        window.location.href = `/booking-success/${bookingId}`;
      }}
    />
  );
}
```

---

## 🧪 **3. TEST IT OUT**

### **Test Coupons (Pre-configured):**
- `FIRST20` - 20% off, max ₹500 discount
- `SAVE10` - 10% off, max ₹200 discount
- `GROOM50` - 15% off on orders above ₹500, max ₹300 discount

### **Quick Test:**
```bash
# 1. Start your app
npm run dev

# 2. Navigate to booking page

# 3. Enter coupon code: FIRST20

# 4. See discount applied!
```

---

## 🎨 **4. CUSTOMIZATION**

### **Change Colors:**

```tsx
<CouponCodeInput
  orderAmount={1500}
  customerId="customer_123"
  className="my-custom-class" // Add custom styling
/>
```

### **Filter Promotions:**

```tsx
<PromotionsDeals
  category="groomer"          // Show grooming promotions only
  applicableTo="services"     // Services only (not products)
/>
```

### **Compact Mode:**

```tsx
<PromotionsDeals
  compact={true}             // Shows 3 compact cards
/>
```

---

## 📡 **5. BACKEND ENDPOINTS**

### **Already Working:**
```
GET  /promotions/active          → Browse promotions
POST /coupons/validate           → Validate coupon
POST /coupons/apply              → Apply coupon to booking
```

### **Base URL:**
```
https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/
```

---

## 💡 **6. COMMON USE CASES**

### **Use Case 1: Show Deals on Home Screen**
```tsx
<PromotionsDeals compact={true} />
```

### **Use Case 2: Dedicated Promotions Page**
```tsx
<PromotionsDeals applicableTo="services" />
```

### **Use Case 3: Add Coupon to Checkout**
```tsx
<CouponCodeInput
  orderAmount={totalAmount}
  onCouponApplied={(discount) => setFinalPrice(total - discount)}
/>
```

### **Use Case 4: Complete Booking Flow**
```tsx
<BookingWithCoupon
  service={selectedService}
  vendor={selectedVendor}
  customerId={currentUser.id}
/>
```

---

## 🐛 **7. TROUBLESHOOTING**

### **Issue: "Invalid coupon code"**
**Solution:** Check if coupon is:
- Active (`isActive: true`)
- Not expired
- Meets minimum order amount

### **Issue: "Coupon usage limit reached"**
**Solution:** 
- Customer may have already used this coupon
- Check `userUsageLimit` in coupon settings

### **Issue: Promotions not loading**
**Solution:**
- Check network tab for API errors
- Verify `projectId` and `publicAnonKey` are set
- Check if promotions exist in database

---

## 📝 **8. ADMIN: CREATE TEST COUPON**

```tsx
// Run this in admin panel or console
const createTestCoupon = async () => {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/coupons/create`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: "TEST50",
        type: "percentage",
        value: 50,
        maxDiscountAmount: 1000,
        minOrderAmount: 0,
        usageLimit: 100,
        validUntil: "2025-12-31T23:59:59Z",
        isActive: true
      })
    }
  );

  const data = await response.json();
  console.log('Created coupon:', data);
};
```

---

## 🎉 **9. YOU'RE DONE!**

### **What You Get:**
- ✅ Browse promotions
- ✅ Apply coupon codes
- ✅ See discount calculations
- ✅ Complete booking with discount
- ✅ Track coupon usage

### **Next Steps:**
1. Add promotions page to your app
2. Integrate coupon input in booking flow
3. Test with sample coupons
4. Create custom promotions for your business
5. Track performance and optimize

---

## 📚 **10. NEED HELP?**

**Check Documentation:**
- Full docs: `/MARKETING_INTEGRATION_COMPLETE.md`
- Components: `/components/customer/`
- Backend: `/supabase/functions/server/marketing-routes-v2.tsx`

**Common Patterns:**
- Browse deals → `PromotionsDeals`
- Apply coupon → `CouponCodeInput`
- Complete flow → `BookingWithCoupon`

---

**You're all set! 🚀**

Start driving conversions with promotions and coupons!
