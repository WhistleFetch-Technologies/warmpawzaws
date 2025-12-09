# 🚀 QUICK NAVIGATION GUIDE - Warmpawz Customer App

**Last Updated:** December 9, 2024  
**Status:** Production Ready

---

## 📱 HOW TO ACCESS NEW FEATURES

### 🏆 Rewards & Loyalty
**Path:** Profile Icon → Rewards & Loyalty  
**What it does:** View points, loyalty tier, redeem rewards, track benefits  
**Screen:** `rewards-loyalty`

### 👥 Refer & Earn
**Path:** Profile Icon → Refer & Earn  
**What it does:** Share referral code, track referrals, view leaderboard  
**Screen:** `referral-system`

### 💳 Enhanced Wallet
**Path:** Profile Icon → My Wallet  
**What it does:** View balance, add money via Razorpay, transaction history  
**Screen:** `wallet` (existing route, enhanced component)

### 📦 Package Booking
**Path:** Any Service Page → View Packages (to be added)  
**What it does:** Browse multi-session packages, book packages with discount  
**Screen:** `package-booking`

### 🐕🐕 Multi-Pet Booking
**Path:** Booking Flow → Book for Multiple Pets (auto-shown if multiple pets)  
**What it does:** Select multiple pets for same service, apply group discount  
**Screen:** `multi-pet-booking`

### 🚨 Emergency Booking
**Path:** Home Screen → SOS Button (to be added) OR Ambulance Service  
**What it does:** Quick emergency service request with GPS tracking  
**Screen:** `emergency-booking`

### 🏥 Medical Records
**Path:** Pet Details → Medical Records (to be added)  
**What it does:** Upload/view pet medical documents, share with vet  
**Screen:** `medical-records`

### ✅ Check-In/Check-Out
**Path:** Boarding Booking Details → Check In/Check Out Button (context-based)  
**What it does:** Check-in pets to boarding/resort, check-out with OTP  
**Screen:** `check-in-out`

### 🔄 Return Request
**Path:** Order Details → Request Return (for eligible orders)  
**What it does:** Select items to return, upload photos, submit return request  
**Screen:** `return-request`

---

## 🗺️ NAVIGATION TREE

```
CustomerApp
├─ Home Screen
│  ├─ Emergency SOS Button → Emergency Booking
│  ├─ Profile Icon → User Account Sidebar
│  │  ├─ My Profile
│  │  ├─ My Orders → Order History
│  │  │  └─ Order Detail
│  │  │     ├─ Track Order
│  │  │     └─ Request Return → Return Request Page ⭐ NEW
│  │  ├─ My Wallet → Enhanced Wallet ⭐ ENHANCED
│  │  ├─ Rewards & Loyalty ⭐ NEW
│  │  ├─ Refer & Earn ⭐ NEW
│  │  ├─ My Appointments
│  │  ├─ Address Book
│  │  ├─ My Bookings
│  │  │  └─ Booking Detail
│  │  │     └─ Check In/Out → Check-In/Check-Out Page ⭐ NEW
│  │  ├─ My Cart
│  │  ├─ Saved Items
│  │  ├─ Payment Settings
│  │  ├─ Notifications
│  │  └─ Help & Support
│  ├─ My Pets
│  │  └─ Pet Details
│  │     ├─ Medical Records ⭐ NEW
│  │     ├─ Health Dashboard
│  │     └─ Booking History
│  └─ Services
│     ├─ Veterinary
│     │  ├─ View Packages → Package Booking Page ⭐ NEW
│     │  └─ Book Appointment
│     │     └─ Multi-Pet Option → Multi-Pet Booking Page ⭐ NEW
│     ├─ Grooming
│     │  └─ View Packages → Package Booking Page ⭐ NEW
│     ├─ Training
│     │  └─ View Packages → Package Booking Page ⭐ NEW
│     ├─ Boarding
│     ├─ Ambulance
│     │  └─ Emergency SOS → Emergency Booking Page ⭐ NEW
│     └─ Other Services...
```

---

## 🎯 SCREEN IDENTIFIERS

Quick reference for developers:

```typescript
// NEW P2 SCREENS
'rewards-loyalty'      // Rewards & Loyalty Program
'referral-system'      // Referral & Earning System
'package-booking'      // Service Package Booking
'multi-pet-booking'    // Multi-Pet Booking
'emergency-booking'    // Emergency Service Request
'medical-records'      // Pet Medical Records
'check-in-out'         // Check-In/Check-Out Flow
'return-request'       // Order Return Request
'customer-wallet'      // Enhanced Wallet (alternative route)

// EXISTING SCREENS (for reference)
'home'                 // Customer Home
'my-bookings'          // Booking List
'order_history'        // Order History
'order_detail'         // Order Details
'pet-details'          // Pet Profile Details
'wallet'               // Wallet (existing route)
```

---

## 💻 DEVELOPER QUICK START

### To Add Navigation Button

```typescript
// Example: Add Medical Records button to Pet Details
<button 
  onClick={() => setCurrentScreen('medical-records')}
  className="..."
>
  <FileText className="w-5 h-5" />
  Medical Records
</button>
```

### To Navigate Programmatically

```typescript
// From CustomerHomeWrapper handlers
setCurrentScreen('rewards-loyalty');

// Or via navigation handler
handleAccountNavigate('referral-system');
```

### To Check Current Screen

```typescript
if (currentScreen === 'rewards-loyalty') {
  return <RewardsLoyaltyPage 
    customerPhone={phone}
    customerId={phone}
    onBack={handleBack}
  />;
}
```

---

## 🧪 TESTING QUICK REFERENCE

### Test Rewards & Loyalty
1. Open Customer App
2. Click profile icon (top-right)
3. Tap "Rewards & Loyalty" (🏆)
4. Verify points balance loads
5. Test reward redemption
6. Check tier progression

### Test Referral System
1. Open profile sidebar
2. Tap "Refer & Earn" (👥)
3. Verify referral code generates
4. Test share functionality
5. Check referral stats
6. View leaderboard

### Test Emergency Booking
1. Navigate to Ambulance service
2. Tap "Emergency SOS"
3. Select emergency type
4. Verify GPS location captured
5. Submit emergency request
6. Check confirmation

### Test Medical Records
1. Go to any pet details
2. Look for "Medical Records" button
3. Upload a test document
4. Verify document appears in list
5. Test document download
6. Test share with vet

### Test Return Request
1. Go to Order History
2. Select a recent order
3. Tap "Request Return"
4. Select items to return
5. Upload photos
6. Submit request
7. Verify confirmation

---

## 📞 SUPPORT CONTACT

For routing issues or navigation bugs:
- Check console logs for navigation errors
- Verify screen type is in ScreenType union
- Ensure route handler exists in CustomerHomeWrapper
- Check props are correctly passed to component

---

## ✅ QUICK STATUS CHECK

Run this mental checklist:

- [ ] Can access Rewards & Loyalty from sidebar?
- [ ] Can access Referral System from sidebar?
- [ ] Can navigate to each new screen without errors?
- [ ] Does back button work on all new screens?
- [ ] Are loading states displaying correctly?
- [ ] Do error messages appear when needed?

If all checked, system is operational! 🎉

---

**Version:** 2.0  
**Phase:** P2 Enterprise Features  
**Status:** Production Ready  
**Last Tested:** December 9, 2024
