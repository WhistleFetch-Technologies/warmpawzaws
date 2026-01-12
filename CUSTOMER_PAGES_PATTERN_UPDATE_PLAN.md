# 🔄 Customer Pages Pattern Update Plan

**Date:** January 2026  
**Goal:** Update all customer pages to match home page pattern (orange gradient header)

---

## 🎯 TARGET PATTERN (Home Page Pattern)

### **Header:**
```tsx
<div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 py-4">
  <div className="max-w-7xl mx-auto">
    <h1 className="text-white text-2xl font-bold">Page Title</h1>
    <p className="text-white/90 text-sm mt-1">Page subtitle</p>
  </div>
</div>
```

### **Content:**
```tsx
<div className="bg-white rounded-t-[32px] -mt-6 pt-6 pb-24">
  <div className="px-6">
    {/* Page content */}
  </div>
</div>
```

### **Container:**
```tsx
<div className="min-h-screen bg-white">
  {/* Header */}
  {/* Content */}
</div>
```

**Key Changes:**
- ✅ Header: Orange gradient `from-[#FF8C42] to-[#FF6B35]`
- ✅ Header Text: White `text-white`
- ✅ Content: White background `bg-white`
- ✅ Content: Rounded top corners `rounded-t-[32px] -mt-6`
- ✅ Background: White `bg-white` (no gradient)
- ✅ Layout: Full-width (remove `max-w-7xl` restriction from content)

---

## 📋 PAGES TO UPDATE (13 pages)

1. Shop (`/shop`)
2. Orders (`/orders`)
3. Profile (`/profile`)
4. Pets (`/pets`)
5. Rewards (`/rewards`)
6. Search (`/search`)
7. Notifications (`/notifications`)
8. Subscriptions (`/subscriptions`)
9. Medical Records (`/medical-records`)
10. Insurance (`/insurance`)
11. Events (`/events`)
12. Donations (`/donations`)
13. Referrals (`/referrals`)

---

## 🔄 CHANGE PATTERN

### **FROM (Current Pattern):**
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
      {/* Content */}
    </div>
  </div>
</div>
```

### **TO (Home Page Pattern):**
```tsx
<div className="min-h-screen bg-white">
  {/* Header */}
  <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 py-4 sticky top-0 z-10">
    <div className="max-w-7xl mx-auto">
      <h1 className="text-white text-2xl font-bold">Page Title</h1>
      <p className="text-white/90 text-sm mt-1">Page subtitle</p>
    </div>
  </div>

  {/* Content */}
  <div className="bg-white rounded-t-[32px] -mt-6 pt-6 pb-24">
    <div className="px-6">
      {/* Content */}
    </div>
  </div>
</div>
```

---

## 📝 NOTES

1. **Keep Special Sections:**
   - Rewards, Donations, Referrals: May have hero sections - preserve if needed
   - Medical Records: May have pet selector tabs - preserve functionality

2. **Modal Positioning:**
   - Ensure modals are outside content wrapper (fixed positioning)

3. **Content Spacing:**
   - Use `px-6` for horizontal padding
   - Use `pt-6 pb-24` for content area padding

---

**Last Updated:** January 2026  
**Status:** Ready to update pages

