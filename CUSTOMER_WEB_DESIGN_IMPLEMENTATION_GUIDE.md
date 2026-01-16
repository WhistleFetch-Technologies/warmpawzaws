# 🎯 Customer Web Design Implementation Guide

**Date:** January 2026  
**Purpose:** Quick reference for implementing new Customer Web pages

---

## 🎨 QUICK REFERENCE: HOME PAGE PATTERN

### **Template for New Pages:**
```tsx
'use client';

export default function NewPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header - Orange Gradient */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-bold">Page Title</h1>
            <p className="text-white/90 text-sm mt-1">Page subtitle</p>
          </div>
          {/* Action buttons (optional) */}
          <div className="flex items-center gap-2">
            {/* Buttons with bg-white/20 backdrop-blur-sm */}
          </div>
        </div>
      </div>

      {/* Main Content - White Background */}
      <div className="bg-white pb-20">
        <div className="px-6 py-6">
          {/* Your page content here */}
          
          {/* Example: Service Cards */}
          <div className="grid grid-cols-2 gap-4">
            {services.map(service => (
              <div key={service.id} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition">
                {/* Card content */}
              </div>
            ))}
          </div>
          
          {/* Example: Pet Profiles (if applicable) */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6">
            {pets.map(pet => (
              <div key={pet.id} className="flex-shrink-0 w-16 h-20 bg-white rounded-2xl flex flex-col items-center justify-center shadow-sm">
                {/* Pet card content */}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 🎨 COLOR PALETTE

### **Primary Colors:**
```css
/* Orange Gradient Header */
bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]

/* Text on Orange Header */
text-white        /* Headings */
text-white/90     /* Secondary text */

/* Content Background */
bg-white          /* Main content area */

/* Accents */
#FF8C42          /* Orange (buttons, selected states) */
```

---

## 📐 LAYOUT PATTERNS

### **1. Header Pattern:**
```tsx
<div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 py-6">
  {/* Content */}
</div>
```

### **2. Content Container:**
```tsx
<div className="bg-white pb-20">
  <div className="px-6 py-6">
    {/* Content */}
  </div>
</div>
```

### **3. Service Card Pattern:**
```tsx
<div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition">
  {/* Card content */}
</div>
```

### **4. Pet Card Pattern:**
```tsx
<div className="flex-shrink-0 w-16 h-20 bg-white rounded-2xl flex flex-col items-center justify-center shadow-sm">
  {/* Pet card content */}
</div>
```

---

## 📱 RESPONSIVE CONSIDERATIONS

### **Mobile-First Approach:**
- Use `px-6` for horizontal padding (consistent across screen sizes)
- Use `grid-cols-2` for service cards on mobile
- Use `overflow-x-auto` for horizontal scrolling sections
- Add `pb-20` if bottom navigation is present

### **Breakpoints:**
- Mobile: Default (no prefix)
- Tablet: `md:` prefix
- Desktop: `lg:` prefix

---

## ⚠️ IMPORTANT REMINDERS

### **DO:**
✅ Use `bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]` for headers  
✅ Use `bg-white` for content areas  
✅ Use `text-white` for header text  
✅ Use full-width layout (no `max-w-7xl`)  
✅ Follow home page design structure  

### **DON'T:**
❌ Use `bg-gradient-to-br from-orange-50 to-amber-50` (that's for migrated pages)  
❌ Use `bg-white/90 backdrop-blur-sm` headers (that's for migrated pages)  
❌ Use `max-w-7xl` container (use full-width instead)  
❌ Change migrated pages (keep them as-is)  

---

## 📋 MIGRATED PAGES (DO NOT CHANGE)

These pages use a different pattern and should remain as-is:
- Shop, Orders, Profile, Pets, Rewards
- Search, Notifications, Subscriptions
- Medical Records, Insurance, Events
- Donations, Referrals

**Pattern Used:** `bg-gradient-to-br from-orange-50 to-amber-50` with `bg-white/90 backdrop-blur-sm` headers

---

## 🔗 REFERENCE FILES

- **Home Page Component:** `apps/customer-web/components/customer/CustomerHomeComplete.tsx`
- **Design Strategy:** `CUSTOMER_WEB_DESIGN_STRATEGY.md`
- **Implementation Guide:** This file

---

**Last Updated:** January 2026

