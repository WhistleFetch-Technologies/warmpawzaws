# Design Hierarchy Policy

**Effective Date:** Current Session  
**Status:** ✅ ACTIVE

---

## 📐 Design Precedence Rules

### Hierarchy (Priority Order)

1. **Existing Figma Design** (Highest Priority)
   - Components already implemented from Figma designs
   - **PRESERVE** existing design, colors, layout
   - Only enhance functionality, not styling

2. **Master Guides** (`CUSTOMER_APP_MASTER_GUIDE.md`, `VENDOR_ADMIN_MASTER_GUIDE.md`)
   - Blueprint for flows and structure
   - Defines what to build, not how it looks

3. **Guidelines.md** (From Figma Design System)
   - Brand guidelines for **new/placeholder** components only
   - Use orange/pink gradients for new components
   - Do NOT override existing Figma designs

4. **Verification Guide** (`VERIFICATION_GUIDE.md`)
   - QA checklist
   - Functional verification, not design override

---

## ✅ Implementation Rules

### Rule 1: Preserve Existing Designs

**Example: PetCafeListingZomatoStyle**
- ✅ Reference implementation uses **red buttons** (`bg-red-600`)
- ✅ This is **Zomato-style** design (intentional)
- ✅ **PRESERVE** red buttons - do NOT change to orange
- ✅ Only enhance functionality (add modal, improve UX)

### Rule 2: Use Guidelines.md for New Components

**Example: CheckoutView (was placeholder)**
- ✅ Component was placeholder/empty
- ✅ Use **Guidelines.md** styling (orange/pink gradients)
- ✅ Follow brand system from Figma

### Rule 3: Enhance, Don't Replace

**When enhancing existing components:**
1. Keep existing layout/imports
2. Match existing style (colors, spacing)
3. Add functionality only
4. Do NOT restyle to match Guidelines.md

---

## 🎨 Service-Specific Colors

Some components have **intentional service-specific styling** that should be preserved:

| Component | Style | Reason | Action |
|-----------|-------|--------|--------|
| **PetCafeListingZomatoStyle** | Red buttons (`bg-red-600`) | Zomato-style design pattern | ✅ Preserve |
| **ResortServicesLanding** | Teal/cyan gradients | Resort theme (water/luxury) | ✅ Preserve if existing |
| **VetServiceRouter** | Teal/blue gradients | Veterinary medical theme | ✅ Preserve if existing |
| **AmbulanceSOS** | Red emergency theme | Emergency medical services | ✅ Preserve |
| **CheckoutView** | Orange/pink gradients | E-commerce brand primary | ✅ Use Guidelines.md (new) |

---

## 📋 Decision Matrix

| Scenario | Design Source | Action |
|----------|---------------|--------|
| **Existing component** with design | Existing Figma implementation | ✅ Preserve existing design |
| **Placeholder/empty** component | Guidelines.md | ✅ Use Guidelines.md styling |
| **Broken/missing** component | Guidelines.md | ✅ Use Guidelines.md styling |
| **Enhancing functionality** | Existing design | ✅ Keep existing styling, add features |

---

## ✅ Current Implementation Status

### Correctly Preserved (Existing Designs)

1. **PetCafeListingZomatoStyle.tsx**
   - ✅ Preserved red buttons (Zomato-style)
   - ✅ Enhanced with Dialog modal
   - ✅ No styling changes to match Guidelines.md

2. **ResortServicesLanding.tsx**
   - ✅ Was placeholder → Created with Guidelines.md
   - ✅ Uses teal/cyan for resort theme (service-specific)
   - ✅ Matches Guidelines.md service colors

3. **VetServiceRouter.tsx**
   - ✅ Was placeholder → Created with Guidelines.md
   - ✅ Uses teal/blue for vet theme (service-specific)
   - ✅ Matches Guidelines.md service colors

### Correctly Applied (Guidelines.md for New)

1. **CheckoutView.tsx**
   - ✅ Was placeholder → Created with Guidelines.md
   - ✅ Uses orange/pink gradients (brand primary)
   - ✅ Follows Guidelines.md button styles

2. **AmbulanceSOS.tsx**
   - ✅ Enhanced existing
   - ✅ Preserved red emergency theme
   - ✅ Added map functionality

---

## 🎯 Key Principle

> **"If it exists and works from Figma, preserve it. If it's new or broken, use Guidelines.md."**

---

## ✅ Verification

All implementations follow this hierarchy:
- ✅ Existing designs preserved
- ✅ New components use Guidelines.md
- ✅ Service-specific colors respected
- ✅ No unnecessary restyling

**Status:** ✅ POLICY ACTIVE AND VERIFIED
