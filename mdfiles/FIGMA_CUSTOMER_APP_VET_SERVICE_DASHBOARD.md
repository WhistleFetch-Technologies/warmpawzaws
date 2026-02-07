# 🎨 Figma Prompt: Vet Service Dashboard (Customer App)
## Complete Design with Exact Code Reference

**Date:** January 2026  
**Focus:** Customer App Only - Vet Service Dashboard  
**Design Reference:** CustomerHomeComplete.tsx + VetServiceRouter.tsx

---

## 📋 CRITICAL: EXACT CODE REFERENCE

### Header Structure (MUST MATCH EXACTLY)

**From CustomerHomeComplete.tsx (lines 913-1031):**
```tsx
<div className="bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] px-4 pt-4 pb-4">
  {/* Top Row - User Info & Actions */}
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-3">
      <button className="w-11 h-11 bg-white rounded-full flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-white/60 transition-all shadow-md">
        {/* Profile avatar - gradient if no photo */}
        <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-base font-bold">
          {userName.charAt(0).toUpperCase()}
        </div>
      </button>
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <h1 className="text-white text-lg font-bold tracking-tight">Hi, {userName}!</h1>
          <span className="text-base">👋</span>
        </div>
        <p className="text-white/65 text-xs font-normal tracking-wide">Explore WarmPawz Services</p>
      </div>
    </div>
    <div className="flex items-center gap-1.5">
      {/* Wallet, Cart, Favorites icons */}
      <WalletIcon size="sm" showBalance={true} />
      <button className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm relative">
        <ShoppingCart className="w-[18px] h-[18px] text-white" />
      </button>
      <button className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm">
        <Heart className="w-[18px] h-[18px] text-white" />
      </button>
    </div>
  </div>
  {/* Pet Selector - horizontal scroll */}
</div>
```

### Content Area Structure (MUST MATCH EXACTLY)

**From CustomerHomeComplete.tsx (line 1035):**
```tsx
<div className="bg-white rounded-t-[24px] -mt-3 pt-4 pb-24">
  {/* Content */}
</div>
```

### Footer Structure (MUST MATCH EXACTLY)

**From StandardizedFooter.tsx:**
```tsx
<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 max-w-[430px] mx-auto">
  <div className="px-6 py-3">
    <div className="flex items-center justify-around">
      {/* Home, Cart, Bookings, Profile tabs */}
    </div>
  </div>
</div>
```

---

## 🎨 DESIGN SYSTEM (EXACT VALUES)

### Colors
- **Header Gradient:** `#FF8C42` → `#FF7A35` → `#FF6B35` (bg-gradient-to-br)
- **Primary Orange:** `#FF8C42`
- **Background White:** `#FFFFFF`
- **Text White:** `#FFFFFF`
- **Text White Secondary:** `rgba(255, 255, 255, 0.65)` (65% opacity)
- **Text Dark:** `#1F2937` (gray-900)
- **Card Shadow:** `rgba(0, 0, 0, 0.05)` (5% opacity)

### Icons: Lucide React 2D ONLY
**Available Icons:**
- `Stethoscope`, `Video`, `Home`, `Building2`, `Star`, `MapPin`, `Clock`
- `Heart`, `Plus`, `ChevronRight`, `Calendar`, `User`, `ShoppingCart`
- **NO 3D ICONS, NO CUSTOM ILLUSTRATIONS**

### Typography
- **Header H1:** `text-lg font-bold tracking-tight` (18px)
- **Header Subtitle:** `text-xs font-normal tracking-wide` (12px)
- **Body:** `text-base` (16px)
- **Small:** `text-xs` (12px)

---

## 📱 SCREEN: Vet Service Dashboard

### Design Specifications

**Header:**
- Use exact header structure from CustomerHomeComplete.tsx
- Title: "Vet Care" (or dynamic from props)
- Back button (left): `ArrowLeft` icon, white
- Pet selector: Horizontal scroll (if pets exist)

**Content Area:**
1. **Stats Cards (Top Section):**
   - 3 cards in grid: "24/7 Available", "<5min Avg Wait", "4.8 Rating"
   - Style: `bg-orange-50 rounded-xl p-2.5 border border-orange-100`
   - Text: Orange (`text-orange-600`, `text-orange-700`)

2. **Service Style Selection (Main):**
   - 3 large cards:
     - **Clinic Visit** (`Building2` icon, blue theme)
     - **Tele Consultation** (`Video` icon, purple theme)
     - **Home Visit** (`Home` icon, green theme)
   - Each card:
     - Icon (large, 48px)
     - Title (bold)
     - Description (small text)
     - Price range (e.g., "Starting from ₹399")
     - "Book Now" button or clickable card

3. **Health Problems Grid (Below Services):**
   - Grid of problem cards (2 columns)
   - Problems: Vomiting, Diarrhea, Not Eating, Skin Issues, Limping, Fever, Vaccination, Checkup
   - Each card: Icon/emoji, problem name
   - Clickable → Navigate to problem-based service discovery

4. **Featured Vets (Optional):**
   - Horizontal scroll
   - Vet cards: Photo, name, rating, specialty
   - "View All" button

**API Contracts:**
```json
// Get Vet Services
{
  "endpoint": "GET /customer/discover-services?category=vet&roleId=veterinarian",
  "response": {
    "vendors": [
      {
        "id": "uuid",
        "vendorName": "string",
        "rating": number,
        "serviceStyle": "at_center | at_home | tele",
        "price": number
      }
    ]
  }
}

// Get Dashboard Config
{
  "endpoint": "GET /config/ui/dashboard?roleId=veterinarian",
  "response": {
    "config": {
      "buttons": [
        {
          "id": "vet",
          "allowedServiceStyles": ["at_center", "at_home", "tele"]
        }
      ]
    }
  }
}
```

**Navigation Handlers:**
```typescript
// Clinic Visit:
onNavigate('vet-clinic-list', {});

// Tele Consultation:
onNavigate('vet-tele-consultation', {});

// Home Visit:
onNavigate('vet-home-visit', {});

// Problem-based:
onNavigate('services_by_problem', { 
  problemId: problemId,
  problemTitle: problemName,
  category: 'vet'
});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Vet Service Dashboard.fig`

---

## ✅ DESIGN CHECKLIST

- [ ] Header matches CustomerHomeComplete.tsx exactly
- [ ] Content area: `bg-white rounded-t-[24px] -mt-3 pt-4 pb-24`
- [ ] Footer: StandardizedFooter component
- [ ] Icons: Lucide React 2D only
- [ ] Colors: Exact hex values
- [ ] Service cards: Large, prominent, clickable
- [ ] Problem grid: 2 columns, clear icons
- [ ] API contracts: Annotated in comments
- [ ] Navigation: Handlers defined

---

**End of Vet Service Dashboard Prompt**
