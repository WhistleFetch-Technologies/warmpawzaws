# Figma Components Copy Plan
## Systematic Component Migration from Figma Design System

**Date:** 2026-01-28  
**Status:** 🚀 IN PROGRESS  
**Strategy:** Copy components from Figma, update imports, integrate with APIs

---

## 📊 Component Status Analysis

### ✅ Already Exists (No Action Needed)
- ✅ UniversalVendorCard.tsx - **EXISTS** in both Figma and customer app (identical)
- ✅ ProblemGridSection.tsx - **EXISTS** and being used
- ✅ EnhancedSearchBar.tsx - **EXISTS** and being used
- ✅ VendorBookingCard.tsx - **EXISTS** in vendor app
- ✅ Error Components - **CREATED** (not in Figma, production enhancements)

### ⚠️ Need to Copy from Figma

#### Customer App Components
1. **Service Landing Pages** (15+ pages)
   - Status: Some exist, need to verify all
   - Priority: HIGH
   - Location: `Warmpawz Ecosystem Development/src/components/customer/*ServicesLanding.tsx`

2. **SearchResultsGrid.tsx** (includes VendorResultCard)
   - Status: NOT in customer app
   - Priority: HIGH
   - Location: `Warmpawz Ecosystem Development/src/components/ui/SearchResultsGrid.tsx`

3. **ServiceCard.tsx** (from CustomerServicesPage)
   - Status: Embedded in CustomerServicesPage, may need extraction
   - Priority: MEDIUM

4. **BookingCard.tsx** (from CustomerBookingsPage)
   - Status: Embedded in CustomerBookingsPage, may need extraction
   - Priority: MEDIUM

#### Vendor App Components
1. **EarningsAnalytics.tsx**
   - Status: EXISTS in Figma, need to check if in vendor app
   - Priority: HIGH
   - Location: `Warmpawz Ecosystem Development/src/components/vendor/EarningsAnalytics.tsx`

2. **VendorAnalytics.tsx**
   - Status: EXISTS in Figma, need to check if in vendor app
   - Priority: HIGH
   - Location: `Warmpawz Ecosystem Development/src/components/vendor/VendorAnalytics.tsx`

3. **SettlementDashboard.tsx**
   - Status: EXISTS in Figma, need to verify if enhanced version needed
   - Priority: MEDIUM

#### Admin App Components
1. **AdminAnalyticsDashboard.tsx**
   - Status: EXISTS in Figma, need to check if in admin app
   - Priority: HIGH
   - Location: `Warmpawz Ecosystem Development/src/components/admin/analytics/AdminAnalyticsDashboard.tsx`

2. **RevenueChart.tsx**
   - Status: EXISTS in Figma
   - Priority: MEDIUM

3. **VendorPerformanceTable.tsx**
   - Status: EXISTS in Figma
   - Priority: MEDIUM

---

## 🎯 Copy Priority Order

### Phase 1: High Priority (Start Here)
1. **SearchResultsGrid.tsx** - Critical for search functionality
2. **EarningsAnalytics.tsx** - Vendor dashboard widget
3. **VendorAnalytics.tsx** - Vendor dashboard widget
4. **AdminAnalyticsDashboard.tsx** - Admin dashboard

### Phase 2: Medium Priority
5. Service Landing Pages (verify which are missing)
6. Extract ServiceCard and BookingCard if needed
7. RevenueChart and VendorPerformanceTable

### Phase 3: Low Priority
8. Additional specialized components as needed

---

## 📝 Copy Process

For each component:
1. Read component from Figma repo
2. Update imports to use local UI components (`@/components/ui/`)
3. Update API calls to use `apiClient` instead of direct fetch
4. Ensure design tokens are used (`#FF8C42` primary color)
5. Test component integration
6. Verify design consistency

---

## 🚀 Starting with SearchResultsGrid

This is the most critical missing component for search functionality.
