# 👀 Customer Web Pages Preview Guide

**Date:** January 2026  
**Purpose:** Preview the updated Customer Web pages

---

## 📋 UPDATED PAGES SUMMARY

### **13 Full Page Implementations - ALL COMPLETE ✅**

All these pages follow the **migrated pattern** (orange/amber gradient background with white headers):

1. ✅ **Shop** (`/shop`)
   - Header: White with backdrop blur
   - Content: Product grid with filters
   - Background: Orange/amber gradient

2. ✅ **Orders** (`/orders`)
   - Header: White sticky header
   - Content: Order list with status filters
   - Background: Orange/amber gradient

3. ✅ **Profile** (`/profile`)
   - Header: White sticky header
   - Content: Profile information with edit mode
   - Background: Orange/amber gradient

4. ✅ **Pets** (`/pets`)
   - Header: White sticky header
   - Content: Pet cards grid with add pet modal
   - Background: Orange/amber gradient

5. ✅ **Rewards** (`/rewards`)
   - Header: Special hero section (orange gradient)
   - Content: Rewards catalog, history, redeemed items
   - Background: Orange/amber gradient

6. ✅ **Search** (`/search`)
   - Header: White sticky header with search bar
   - Content: Search results grid
   - Background: Orange/amber gradient

7. ✅ **Notifications** (`/notifications`)
   - Header: White sticky header
   - Content: Notification list
   - Background: Orange/amber gradient

8. ✅ **Subscriptions** (`/subscriptions`)
   - Header: White sticky header
   - Content: Subscription cards with usage progress
   - Background: Orange/amber gradient

9. ✅ **Medical Records** (`/medical-records`)
   - Header: White sticky header with pet selector
   - Content: Timeline and vaccinations tabs
   - Background: Orange/amber gradient

10. ✅ **Insurance** (`/insurance`)
    - Header: White sticky header
    - Content: Insurance plans, policies, claims tabs
    - Background: Orange/amber gradient

11. ✅ **Events** (`/events`)
    - Header: White sticky header
    - Content: Events discovery and registrations
    - Background: Orange/amber gradient

12. ✅ **Donations** (`/donations`)
    - Header: Special hero section (orange gradient)
    - Content: Donation campaigns and history
    - Background: Orange/amber gradient

13. ✅ **Referrals** (`/referrals`)
    - Header: Special hero section (orange gradient)
    - Content: Referral code, stats, referral list
    - Background: Orange/amber gradient

---

## 🎨 DESIGN PATTERN APPLIED (Migrated Pages)

### **Standard Pattern:**
```tsx
<div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
  {/* Header */}
  <div className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
    <div className="max-w-7xl mx-auto px-6 py-4">
      <h1 className="text-2xl font-bold text-gray-800">Page Title</h1>
      <p className="text-sm text-gray-500 mt-1">Page subtitle</p>
    </div>
  </div>

  {/* Content */}
  <div className="flex-1 overflow-y-auto">
    <div className="max-w-7xl mx-auto p-6">
      {/* Page content */}
    </div>
  </div>
</div>
```

### **Key Characteristics:**
- ✅ Background: `bg-gradient-to-br from-orange-50 to-amber-50` (warm gradient)
- ✅ Header: `bg-white/90 backdrop-blur-sm border-b border-orange-200` (white with blur)
- ✅ Typography: `text-2xl font-bold` for headers
- ✅ Container: `max-w-7xl mx-auto px-6 py-4` (centered, responsive)
- ✅ Content: `max-w-7xl mx-auto p-6` (consistent spacing)

---

## 🏠 HOME PAGE DESIGN (Reference for New Pages)

### **Home Page Pattern:**
```tsx
<div className="min-h-screen bg-white">
  {/* Header - Orange Gradient */}
  <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pb-6">
    <h1 className="text-white">Hi, {name}! 👋</h1>
    {/* Pet selector */}
  </div>

  {/* Content - White Background */}
  <div className="bg-white rounded-t-[32px] -mt-6 pt-6 pb-24">
    {/* Services grid, pet profiles, etc. */}
  </div>
</div>
```

### **Key Characteristics:**
- 🟠 Header: `bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]` (bold orange gradient)
- ⚪ Content: `bg-white` (white background)
- 📱 Full-width: No `max-w-7xl` restriction
- 🎨 Mobile-first: Designed for mobile experience

---

## 🚀 HOW TO PREVIEW PAGES

### **Option 1: Run Development Server**

```bash
# Navigate to customer-web directory
cd apps/customer-web

# Install dependencies (if not already done)
npm install

# Run development server
npm run dev
```

Then open: `http://localhost:3000` (or the port shown)

### **Option 2: Run from Root**

```bash
# From project root
npm run dev --workspace=apps/customer-web
```

### **Option 3: Check Available Scripts**

```bash
# Check package.json for available scripts
cat apps/customer-web/package.json | grep -A 10 "scripts"
```

---

## 📱 PAGES TO PREVIEW

### **Direct URLs (assuming localhost:3000):**

1. **Home/Landing:** `http://localhost:3000/`
   - This is the reference design (orange gradient header)

2. **Shop:** `http://localhost:3000/shop`
   - Product catalog with filters

3. **Orders:** `http://localhost:3000/orders`
   - Order history and tracking

4. **Profile:** `http://localhost:3000/profile`
   - User profile management

5. **Pets:** `http://localhost:3000/pets`
   - Pet profiles management

6. **Rewards:** `http://localhost:3000/rewards`
   - Rewards and loyalty program

7. **Search:** `http://localhost:3000/search`
   - Service and vendor search

8. **Notifications:** `http://localhost:3000/notifications`
   - Notifications center

9. **Subscriptions:** `http://localhost:3000/subscriptions`
   - Subscription management

10. **Medical Records:** `http://localhost:3000/medical-records`
    - Pet health records

11. **Insurance:** `http://localhost:3000/insurance`
    - Insurance plans and policies

12. **Events:** `http://localhost:3000/events`
    - Events discovery

13. **Donations:** `http://localhost:3000/donations`
    - Donation campaigns

14. **Referrals:** `http://localhost:3000/referrals`
    - Referral program

---

## 🔍 WHAT TO LOOK FOR

### **Design Consistency:**
- ✅ Headers are sticky and have consistent styling
- ✅ Content wrappers use `max-w-7xl` for centered layout
- ✅ Orange/amber gradient background on all migrated pages
- ✅ Typography is consistent (`text-2xl font-bold` for headers)
- ✅ Spacing is standardized (`px-6 py-4` for headers, `p-6` for content)

### **Special Features:**
- **Rewards, Donations, Referrals:** Special hero sections with orange gradient headers
- **Search:** Has search bar in header
- **Medical Records:** Has pet selector tabs below header
- **Insurance, Events:** Has tab navigation

### **Home Page (Reference):**
- Bold orange gradient header (`from-[#FF8C42] to-[#FF6B35]`)
- White content background
- Pet selector in header
- Services grid
- Full-width layout

---

## ⚠️ IMPORTANT NOTES

### **Authentication Required:**
Most pages require authentication. You may need to:
1. Navigate to `/auth` first to log in
2. Or use UAT mode if configured
3. Check localStorage for session data

### **Mobile vs Desktop:**
- Pages are responsive
- Some features may work better on mobile
- Use browser dev tools to test different screen sizes

### **Component-Based Pages:**
These pages use components and may have different structure:
- `/bookings` - Uses `MyBookings` component
- `/wallet` - Uses `CustomerWallet` component
- `/settings` - Uses `CustomerSettings` component
- Home page (`/`) - Uses `CustomerHomeComplete` component

---

## 📊 DESIGN COMPARISON

### **Migrated Pages (13 pages):**
- Background: `bg-gradient-to-br from-orange-50 to-amber-50`
- Header: `bg-white/90 backdrop-blur-sm border-b border-orange-200`
- Container: `max-w-7xl mx-auto`
- Layout: Desktop-optimized with centered content

### **Home Page (Reference):**
- Background: `bg-white`
- Header: `bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]`
- Container: Full-width, no max-width restriction
- Layout: Mobile-first, full-width

---

**Last Updated:** January 2026  
**Status:** Ready for Preview

