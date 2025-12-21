# Phase 3: Integration Guide

## Overview
This guide explains how to navigate to the new Phase 3 customer components from various entry points in the app.

## Component Integration Status

### ✅ Integrated Components
All 7 new components are now integrated into `CustomerHomeWrapper.tsx`:

1. **EventListView** - Screen: `events-list`
2. **EventDetailView** - Screen: `event-detail`
3. **MemorialServicesView** - Screen: `memorial-services`
4. **MealProductCatalog** - Screen: `meal-products`
5. **DonationCampaignView** - Screen: `donation-campaigns`
6. **CounselingBookingView** - Screen: `counseling-sessions`
7. **DietChartsView** - Screen: `diet-charts`

## Navigation Patterns

### From Vendor Profile Views

To navigate to vendor-specific features, you need to:
1. Set `selectedVendorId` state
2. Set `selectedVendorName` state (optional)
3. Navigate to the appropriate screen

**Example from ClinicProfileView:**
```typescript
// In ClinicProfileView.tsx or similar vendor profile component
onNavigate('events-list', { 
  vendorId: clinicId,
  vendorName: clinic.name 
});
```

**In CustomerHomeWrapper:**
```typescript
// The wrapper will handle setting state and routing
if (screen === 'events-list') {
  setSelectedVendorId(data?.vendorId);
  setSelectedVendorName(data?.vendorName);
  setCurrentScreen('events-list');
}
```

### From Service Landing Pages

**Example from NutritionistServicesLanding:**
```typescript
// Navigate to meal products for a specific vendor
onNavigate('meal-products', {
  vendorId: vendor.id,
  vendorName: vendor.businessName
});
```

**Example from SunsetServiceRouter:**
```typescript
// Navigate to memorial services
onNavigate('memorial-services', {
  vendorId: vendor.id,
  vendorName: vendor.businessName
});
```

### From Customer Profile/Account

**Example for Diet Charts:**
```typescript
// Navigate from pet profile or customer account
onNavigate('diet-charts', {
  customerId: phone, // or actual customerId if different
  petId: petId // optional
});
```

## Required State Variables

The following state variables are used in `CustomerHomeWrapper`:

- `selectedVendorId` - Required for vendor-specific screens
- `selectedVendorName` - Optional, for display purposes
- `selectedEvent` - Required for event detail view
- `customerId` - Optional, defaults to `phone`
- `selectedPetId` - Optional, for pet-specific features

## Screen Types Added

New screen types added to `ScreenType` union:
- `'events-list'`
- `'event-detail'`
- `'memorial-services'`
- `'meal-products'`
- `'donation-campaigns'`
- `'counseling-sessions'`
- `'diet-charts'`

## Component Props

### EventListView
```typescript
{
  vendorId: string; // Required
  vendorName?: string; // Optional
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}
```

### EventDetailView
```typescript
{
  event: Event; // Required - event object
  vendorId: string; // Required
  customerId?: string; // Optional, defaults to phone
  customerPhone?: string; // Optional
  onBack: () => void;
  onSuccess?: () => void;
}
```

### MemorialServicesView
```typescript
{
  vendorId: string; // Required
  vendorName?: string; // Optional
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}
```

### MealProductCatalog
```typescript
{
  vendorId: string; // Required
  vendorName?: string; // Optional
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}
```

### DonationCampaignView
```typescript
{
  vendorId: string; // Required
  vendorName?: string; // Optional
  customerId?: string; // Optional
  customerName?: string; // Optional
  customerPhone?: string; // Optional
  onBack: () => void;
  onSuccess?: () => void;
}
```

### CounselingBookingView
```typescript
{
  vendorId: string; // Required
  vendorName?: string; // Optional
  customerId?: string; // Optional
  customerName?: string; // Optional
  customerPhone?: string; // Optional
  onBack: () => void;
  onSuccess?: () => void;
}
```

### DietChartsView
```typescript
{
  customerId: string; // Required
  petId?: string; // Optional
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}
```

## Integration Examples

### Example 1: Add Events Link to Clinic Profile

In `ClinicProfileView.tsx`:
```typescript
<Button onClick={() => onNavigate('events-list', { 
  vendorId: clinicId,
  vendorName: clinic.name 
})}>
  View Events
</Button>
```

### Example 2: Add Meal Products Link to Nutritionist Landing

In `NutritionistServicesLanding.tsx`:
```typescript
<Button onClick={() => onNavigate('meal-products', {
  vendorId: vendor.id,
  vendorName: vendor.businessName
})}>
  Browse Meal Products
</Button>
```

### Example 3: Add Diet Charts Link to Pet Profile

In `PetProfile.tsx` or `CustomerPetProfile.tsx`:
```typescript
<Button onClick={() => onNavigate('diet-charts', {
  customerId: phone,
  petId: pet.id
})}>
  View Diet Charts
</Button>
```

## Testing Checklist

### Manual Testing Steps

1. **Events Integration**
   - [ ] Navigate to a clinic/vendor profile
   - [ ] Click "View Events" or similar button
   - [ ] Verify events list loads
   - [ ] Click on an event
   - [ ] Verify event detail view loads
   - [ ] Fill registration form
   - [ ] Submit registration
   - [ ] Verify success message

2. **Memorial Services Integration**
   - [ ] Navigate to memorial service provider
   - [ ] Click "View Services" or similar
   - [ ] Verify services/products load
   - [ ] Switch between Services/Products tabs
   - [ ] Test search functionality

3. **Meal Products Integration**
   - [ ] Navigate to nutritionist profile
   - [ ] Click "Browse Products" or similar
   - [ ] Verify products load
   - [ ] Test filters (diet type, suitable for)
   - [ ] Test search functionality

4. **Donation Campaigns Integration**
   - [ ] Navigate to shelter/rescue profile
   - [ ] Click "View Campaigns" or similar
   - [ ] Verify campaigns load
   - [ ] Click "Donate Now"
   - [ ] Fill donation form
   - [ ] Submit donation
   - [ ] Verify success message

5. **Counseling Sessions Integration**
   - [ ] Navigate to behavioral specialist profile
   - [ ] Click "Book Session" or similar
   - [ ] Verify sessions load
   - [ ] Click "Book Session" on a session
   - [ ] Fill booking form
   - [ ] Submit booking
   - [ ] Verify success message

6. **Diet Charts Integration**
   - [ ] Navigate from pet profile or account
   - [ ] Click "View Diet Charts" or similar
   - [ ] Verify charts load
   - [ ] Click on a chart
   - [ ] Verify chart details load
   - [ ] Verify meal schedule displays correctly

## Error Handling

All components include:
- ✅ Network error detection
- ✅ User-friendly error messages
- ✅ Loading states
- ✅ Empty state handling
- ✅ Graceful fallbacks

## Next Steps

1. **Add Navigation Links**: Add buttons/links in vendor profile views to navigate to these new screens
2. **Test End-to-End**: Run through all integration scenarios
3. **Add Analytics**: Track usage of new features
4. **Gather Feedback**: Monitor user interactions and feedback

## Notes

- All components use standardized API endpoints
- All components handle standardized response formats
- All components are mobile-responsive
- All components follow consistent UI patterns
- Customer ID defaults to phone number if not provided

