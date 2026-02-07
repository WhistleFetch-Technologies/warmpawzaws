# 🎨 Figma Prompt: Flow 1 - Customer Onboarding → Booking Creation
## Complete Design System with Exact Code Reference

**Date:** January 2026  
**Flow:** Phase 1 - Customer Onboarding → Booking Creation  
**Design Reference:** CustomerHomeComplete.tsx (Exact code provided below)

---

## 📋 CRITICAL DESIGN REQUIREMENTS

### ⚠️ MANDATORY: Match Customer Home Design EXACTLY

**Reference Component Code:**
```tsx
// EXACT HEADER STRUCTURE FROM CustomerHomeComplete.tsx
<div className="bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] px-4 pt-4 pb-4">
  {/* Top Row - User Info & Actions */}
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-3">
      <button className="w-11 h-11 bg-white rounded-full flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-white/60 transition-all shadow-md">
        {/* Profile avatar */}
      </button>
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <h1 className="text-white text-lg font-bold tracking-tight">Hi, {name}!</h1>
          <span className="text-base">👋</span>
        </div>
        <p className="text-white/65 text-xs font-normal tracking-wide">Explore WarmPawz Services</p>
      </div>
    </div>
    <div className="flex items-center gap-1.5">
      {/* Wallet, Cart, Favorites icons */}
    </div>
  </div>
  {/* Pet Selector */}
</div>

// EXACT CONTENT AREA STRUCTURE
<div className="bg-white rounded-t-[24px] -mt-3 pt-4 pb-24">
  {/* Content */}
</div>

// EXACT FOOTER STRUCTURE FROM StandardizedFooter.tsx
<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 max-w-[430px] mx-auto">
  <div className="px-6 py-3">
    <div className="flex items-center justify-around">
      {/* Home, Cart, Bookings, Profile tabs */}
    </div>
  </div>
</div>
```

### Icon Library: **Lucide React (2D Icons ONLY)**
**DO NOT USE:** 3D icons, custom illustrations, emoji icons  
**USE ONLY:** Lucide React 2D icons (exact list below)

**Available Icons:**
- `Heart`, `Calendar`, `Plus`, `ChevronRight`, `Star`, `MapPin`, `Clock`
- `Scissors`, `Stethoscope`, `Home`, `ShoppingBag`, `Users`, `GraduationCap`
- `Coffee`, `Bike`, `Shield`, `Sparkles`, `TrendingUp`, `Phone`, `Video`
- `Building2`, `Bone`, `ShoppingCart`, `BookOpen`, `Wheat`, `User`, `Bot`
- `Menu`, `Settings`, `Palmtree`, `Pill`, `Navigation`, `AlertCircle`
- `Dog`, `Cat`, `UtensilsCrossed`, `Package`, `Shirt`, `Watch`, `Bed`, `Store`

**Icon Style:**
- Stroke width: 2px
- Size: 18px-24px for header icons, 16px-20px for content icons
- Color: White on gradient header, Gray-600 on white background
- Active state: `#FF8C42` (orange)

---

## 🎨 DESIGN SYSTEM SPECIFICATIONS

### Color Palette (EXACT VALUES)
- **Header Gradient Start:** `#FF8C42`
- **Header Gradient Middle:** `#FF7A35`
- **Header Gradient End:** `#FF6B35`
- **Primary Orange:** `#FF8C42`
- **Background White:** `#FFFFFF`
- **Text White:** `#FFFFFF`
- **Text White Secondary:** `rgba(255, 255, 255, 0.65)` (65% opacity)
- **Text Dark:** `#1F2937` (gray-900)
- **Text Gray:** `#6B7280` (gray-500)
- **Border Gray:** `#E5E7EB` (gray-200)
- **Card Shadow:** `rgba(0, 0, 0, 0.05)` (5% opacity, 0-2px blur)

### Typography (EXACT VALUES)
- **Header H1:** `text-lg font-bold tracking-tight` (18px, bold, -0.025em)
- **Header Subtitle:** `text-xs font-normal tracking-wide` (12px, normal, 0.025em)
- **Body Text:** `text-base` (16px)
- **Small Text:** `text-xs` (12px)
- **Button Text:** `text-sm font-semibold` (14px, semibold)

### Spacing (EXACT VALUES)
- **Container Padding:** `px-4 pt-4 pb-4` (16px horizontal, 16px vertical)
- **Content Padding:** `px-4` or `px-6` (16px or 24px)
- **Card Padding:** `p-4` (16px)
- **Gap Between Elements:** `gap-3` (12px)
- **Bottom Padding (Footer Space):** `pb-24` (96px)

### Layout Constraints
- **Max Width:** `max-w-[430px]` (mobile-first, centered)
- **Border Radius:** `rounded-t-[24px]` (24px top corners for content area)
- **Card Radius:** `rounded-xl` (12px) or `rounded-2xl` (16px)

---

## 📱 SCREEN 1.1: Customer Authentication

### Design Specifications

**Header:**
- Gradient: `bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]`
- Padding: `px-4 pt-4 pb-4`
- Title: "Welcome to WarmPawz" (white, text-lg font-bold)
- Subtitle: "Enter your phone number to continue" (white/65, text-xs)

**Content Area:**
- Background: White
- Rounded top: `rounded-t-[24px] -mt-3`
- Padding: `px-6 py-8`

**Components:**
1. **Phone Input Field:**
   - Style: White background, border `border-gray-300`, rounded `rounded-lg`
   - Placeholder: "+91 98765 43210"
   - Icon: `Phone` (Lucide, 20px, gray-400)
   - Height: 48px

2. **Send OTP Button:**
   - Style: Orange gradient `bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]`
   - Text: White, `text-sm font-semibold`
   - Height: 48px
   - Full width
   - Rounded: `rounded-lg`

3. **OTP Input (After Send):**
   - 6 input fields (one per digit)
   - Auto-focus on first field
   - Style: White background, border, rounded
   - Size: 48px x 48px each
   - Gap: 8px between fields

4. **Verify OTP Button:**
   - Same style as Send OTP button
   - Text: "Verify OTP"

**API Contract Annotations:**
```json
// Send OTP
{
  "endpoint": "POST /customer/auth/send-otp",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "phone": "string (10 digits)",
    "role": "customer"
  },
  "response": {
    "success": true,
    "message": "OTP sent successfully"
  }
}

// Verify OTP
{
  "endpoint": "POST /customer/auth/verify-otp",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "phone": "string",
    "otp": "string (6 digits)"
  },
  "response": {
    "success": true,
    "token": "string",
    "user": {
      "id": "uuid",
      "phone": "string",
      "name": "string",
      "isNew": boolean
    }
  }
}
```

**Navigation Handler:**
```typescript
// On OTP verification success:
if (response.user.isNew) {
  onNavigate('pet-registration', { customerId: response.user.id });
} else {
  onNavigate('home', { phone: phone });
}
```

**File Location (After Design):**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Flow 1 - Onboarding to Booking/Screen 1.1 - Customer Authentication.fig`

---

## 📱 SCREEN 1.2: Pet Registration (New Users Only)

### Design Specifications

**Header:**
- Same gradient as Screen 1.1
- Title: "Add Your Pet"
- Subtitle: "Tell us about your furry friend"

**Content Area:**
- Scrollable form
- White background

**Form Fields:**
1. **Pet Name:** Text input
2. **Pet Type:** Radio buttons (Dog, Cat, Bird, Rabbit, Other)
   - Icons: `Dog`, `Cat`, `Heart` (for others)
   - Style: Cards with icon, selected state = orange border
3. **Breed:** Text input (optional)
4. **Age:** Text input (optional)
5. **Gender:** Radio buttons (Male, Female, Unknown)
6. **Weight:** Text input (optional)
7. **Photo Upload:** 
   - Style: Square box with dashed border
   - Icon: `Plus` in center
   - Text: "Add Photo"

**Save Pet Button:**
- Orange gradient, full width
- Text: "Save Pet"

**API Contract:**
```json
{
  "endpoint": "POST /pets/customer/{customerId}",
  "method": "POST",
  "body": {
    "name": "string",
    "type": "Dog | Cat | Bird | Rabbit | Other",
    "breed": "string (optional)",
    "age": "string (optional)",
    "gender": "Male | Female | Unknown (optional)",
    "weight": "string (optional)",
    "photo": "string (URL, optional)"
  },
  "response": {
    "success": true,
    "pet": {
      "id": "uuid",
      "name": "string",
      "type": "string"
    }
  }
}
```

**Navigation:**
```typescript
onNavigate('home', { phone: phone });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Flow 1 - Onboarding to Booking/Screen 1.2 - Pet Registration.fig`

---

## 📱 SCREEN 1.3: Service Discovery (Home Page - Reference)

**NOTE:** This screen already exists. Use as exact reference for all other screens.

**Key Elements to Copy:**
- Header gradient structure
- Pet selector horizontal scroll
- Search bar style
- Service cards grid layout
- Footer navigation

**File Location:**
Reference: `apps/customer-web/components/customer/CustomerHomeComplete.tsx`

---

## 📱 SCREEN 1.4: Service Details

### Design Specifications

**Header:**
- Back button (left): `ChevronLeft` icon, white
- Title: Service name (white, text-lg font-bold)
- Share button (right): `Share2` icon, white

**Content Area:**
1. **Vendor Info Card:**
   - White card with shadow
   - Vendor photo (circular, 60px)
   - Vendor name (bold)
   - Rating (stars + number)
   - Location (`MapPin` icon)
   - "View Profile" button (outline, orange border)

2. **Service Description:**
   - Heading: "About This Service"
   - Description text
   - Service features (bullet list with check icons)

3. **Pricing Card:**
   - Base price (large, bold)
   - Service style options (at_center/at_home/tele)
   - Price variations by style

4. **Availability Calendar:**
   - Month view
   - Available dates highlighted (orange)
   - Selected date (orange background)

5. **Time Slots:**
   - Grid of time buttons
   - Available slots (white, orange border)
   - Selected slot (orange background, white text)
   - Unavailable slots (gray, disabled)

**Fixed Bottom Button:**
- "Book Now" button
- Orange gradient, full width
- Position: Fixed at bottom (above footer)
- Height: 56px

**API Contracts:**
```json
// Get Service
{
  "endpoint": "GET /services/{serviceId}",
  "response": {
    "id": "uuid",
    "name": "string",
    "description": "string",
    "basePrice": number,
    "vendorId": "uuid"
  }
}

// Get Vendor
{
  "endpoint": "GET /vendor/{vendorId}/profile",
  "response": {
    "id": "uuid",
    "businessName": "string",
    "rating": number,
    "location": "string"
  }
}

// Get Availability
{
  "endpoint": "GET /vendor/{vendorId}/availability?date={YYYY-MM-DD}",
  "response": {
    "date": "YYYY-MM-DD",
    "availableSlots": ["09:00", "10:00", "11:00", ...]
  }
}
```

**Navigation:**
```typescript
onNavigate('booking-flow', { 
  serviceId: serviceId, 
  vendorId: vendorId 
});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Flow 1 - Onboarding to Booking/Screen 1.4 - Service Details.fig`

---

## 📱 SCREEN 1.5: Booking Flow (Multi-Step)

### Design Specifications

**Header:**
- Progress indicator (top): Steps 1/5, 2/5, etc.
- Title: "Book Service" (changes per step)
- Back button

**Step 1: Service Style Selection**
- Radio buttons (cards):
  - "At Center" (`Building2` icon)
  - "At Home" (`Home` icon)
  - "Teleconsultation" (`Phone` icon)
- Selected: Orange border + background tint
- Continue button (bottom)

**Step 2: Staff Selection (if at_home)**
- Staff cards grid:
  - Photo (circular, 60px)
  - Name
  - Rating
  - "Select" button
- Continue button

**Step 3: Date & Time**
- Calendar picker (same as Screen 1.4)
- Time slots (same as Screen 1.4)
- Continue button

**Step 4: Pet Selection**
- Pet cards (horizontal scroll):
  - Photo (circular, 80px)
  - Name
  - Type/Breed
  - Selected: Orange border
- Continue button

**Step 5: Address (if at_home/delivery)**
- Address input field
- "Use Current Location" button
- Map preview (optional)
- "Book Now" button (final step)

**API Contracts:**
```json
// Get Staff
{
  "endpoint": "GET /vendor/{vendorId}/staff?roleId={roleId}",
  "response": {
    "staff": [
      {
        "id": "uuid",
        "name": "string",
        "photo": "string",
        "rating": number
      }
    ]
  }
}

// Create Booking
{
  "endpoint": "POST /bookings/create",
  "method": "POST",
  "body": {
    "customerId": "uuid",
    "vendorId": "uuid",
    "serviceId": "uuid",
    "staffId": "uuid (optional)",
    "bookingDate": "YYYY-MM-DD",
    "bookingTime": "HH:MM",
    "serviceType": "at_center | at_home | tele",
    "address": "string (optional)",
    "petId": "uuid",
    "amount": number
  },
  "response": {
    "success": true,
    "bookingId": "uuid",
    "status": "pending"
  }
}
```

**Navigation:**
```typescript
// After booking creation:
onNavigate('payment', { bookingId: response.bookingId });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Flow 1 - Onboarding to Booking/Screen 1.5 - Booking Flow.fig`

---

## 📱 SCREEN 1.6: Payment Screen

### Design Specifications

**Header:**
- Title: "Complete Payment"
- Subtitle: "Secure payment via Razorpay"

**Content:**
1. **Booking Summary Card:**
   - Service name
   - Date & time
   - Pet name
   - Vendor name
   - Address (if applicable)

2. **Price Breakdown:**
   - Base price
   - Discount (if any)
   - Tax
   - **Total** (large, bold)

3. **Payment Method:**
   - Razorpay logo
   - Text: "Pay securely with Razorpay"
   - Payment options: UPI, Card, Net Banking, Wallet

**Pay Now Button:**
- Orange gradient
- Full width
- Fixed bottom
- Text: "Pay ₹{amount}"

**API Contracts:**
```json
// Create Razorpay Order
{
  "endpoint": "POST /razorpay/orders/create",
  "method": "POST",
  "body": {
    "amount": number,
    "currency": "INR",
    "receipt": "string",
    "bookingId": "uuid"
  },
  "response": {
    "success": true,
    "orderId": "string",
    "key": "string (Razorpay key)"
  }
}

// Verify Payment
{
  "endpoint": "POST /razorpay/payments/verify",
  "method": "POST",
  "body": {
    "razorpayOrderId": "string",
    "razorpayPaymentId": "string",
    "razorpaySignature": "string",
    "bookingId": "uuid"
  },
  "response": {
    "success": true,
    "payment": {
      "id": "uuid",
      "status": "completed"
    }
  }
}
```

**Navigation:**
```typescript
// On payment success:
onNavigate('booking-confirmation', { 
  bookingId: bookingId,
  paymentId: response.payment.id 
});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Flow 1 - Onboarding to Booking/Screen 1.6 - Payment.fig`

---

## ✅ DESIGN CHECKLIST

For each screen, verify:
- [ ] Header uses exact gradient: `from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]`
- [ ] Header padding: `px-4 pt-4 pb-4`
- [ ] Content area: White background, `rounded-t-[24px] -mt-3`
- [ ] Footer: Standardized footer with 4 tabs (Home, Cart, Bookings, Profile)
- [ ] Icons: Only Lucide React 2D icons (no 3D, no custom)
- [ ] Colors: Exact hex values as specified
- [ ] Typography: Exact font sizes and weights
- [ ] Spacing: Exact padding and gaps
- [ ] API contracts: Annotated in comments/layers
- [ ] Navigation handlers: Defined in annotations
- [ ] Mobile-first: Max width 430px, centered
- [ ] Loading states: Spinner/skeleton designed
- [ ] Error states: Error message + retry button
- [ ] Success states: Confirmation message

---

## 📦 EXPORT INSTRUCTIONS

1. **Save Location:** `/Users/ketan/Documents/Figma UI Customer APP/Flow 1 - Onboarding to Booking/`
2. **File Naming:** `Screen X.X - Screen Name.fig`
3. **Export Format:**
   - Design: Figma file (.fig)
   - Specs: Export as PDF with annotations
   - Assets: Export icons as SVG (if needed)
4. **Include in Design:**
   - API contract annotations (as text layers or comments)
   - Navigation handler notes (as annotations)
   - Component structure notes

---

**End of Flow 1 Prompt**
