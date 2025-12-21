# Phase 3: Corrected Manual Testing Guide

## ⚠️ CRITICAL: Role-Service Associations

**Before testing, understand which vendor roles have which capabilities!**

## Correct Entry Points by Role

### 1. Events Testing

#### ✅ Correct Entry Point: Shelter/Adoption Center Profile
1. Navigate to: **Adoption Services** → Select a **Shelter/Adoption Center**
2. In the center profile, look for **"Get Involved"** section
3. Click **"View Events"** button
4. You should see `EventListView` component

#### ✅ Alternative Entry Point: Pet Cafe Profile
1. Navigate to: **Pet Cafes** → Select a **Cafe**
2. Look for Events section/button
3. Click to view events

#### ❌ WRONG Entry Point: Vet/Clinic Profile
- **DO NOT** test events from clinic profiles
- Vets/clinics do NOT organize events
- Events button should NOT exist in clinic profiles

### 2. Memorial Services Testing

#### ✅ Correct Entry Point: Sunset Services Profile
1. Navigate to: **Sunset Care Services** → Select a **Memorial Service Provider**
2. In the provider profile, look for **"Services"** section
3. Click **"View Memorial Services & Products"** button
4. You should see `MemorialServicesView` component

#### ❌ WRONG Entry Point: Vet/Clinic Profile
- **DO NOT** test memorial services from clinic profiles
- Vets/clinics do NOT provide memorial services
- Memorial button should NOT exist in clinic profiles

### 3. Meal Products Testing

#### ✅ Correct Entry Point: Nutritionist Profile
1. Navigate to: **Nutritionist Services**
2. Click **"Book"** on any nutritionist card
3. You should see `MealProductCatalog` component

**This is already correctly implemented! ✅**

### 4. Donation Campaigns Testing

#### ✅ Correct Entry Point: Shelter/Adoption Center Profile
1. Navigate to: **Adoption Services** → Select a **Shelter/Adoption Center**
2. In the center profile, look for **"Get Involved"** section
3. Click **"View Donation Campaigns"** button
4. You should see `DonationCampaignView` component

#### ❌ WRONG Entry Point: Vet/Clinic Profile
- **DO NOT** test donations from clinic profiles
- Vets/clinics do NOT run donation campaigns
- Donation button should NOT exist in clinic profiles

### 5. Counseling Sessions Testing

#### ✅ Correct Entry Point: Sunset Services Profile
1. Navigate to: **Sunset Care Services** → Select a **Memorial Service Provider**
2. In the provider profile, look for **"Services"** section
3. Click **"Book Counseling Session"** button
4. You should see `CounselingBookingView` component

#### ✅ Alternative Entry Point: Behaviorist Profile
1. Navigate to: **Behavioral Services** → Select a **Behaviorist**
2. Look for counseling/consultation options
3. Click to book session

#### ❌ WRONG Entry Point: Vet/Clinic Profile
- **DO NOT** test counseling from clinic profiles
- Vets/clinics provide medical care, not counseling
- Counseling button should NOT exist in clinic profiles

### 6. Diet Charts Testing

#### ✅ Correct Entry Point: Customer Profile
1. Navigate to: **Customer Profile** (from sidebar or home)
2. In "Quick Links" section, click **"Diet Charts"**
3. You should see `DietChartsView` component

**This is already correctly implemented! ✅**

## Role-Capability Matrix

| Capability | Vet/Clinic | Shelter | Sunset Services | Nutritionist | Pet Cafe | Behaviorist |
|------------|------------|---------|-----------------|-------------|----------|-------------|
| Events | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Memorial | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Meal Products | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Donations | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Counseling | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Diet Charts | ❌ | ❌ | ❌ | ✅* | ❌ | ❌ |

*Diet charts are customer-owned, created by nutritionists

## Testing Checklist by Role

### Test Vet/Clinic Profile
- [ ] **Should NOT have**: Events, Memorial, Donations, Counseling buttons
- [ ] **Should have**: Diagnostic Tests, Emergency Protocols, Ambulance (if applicable)
- [ ] **Should have**: Gallery, Portfolio (if available)

### Test Shelter/Adoption Center Profile
- [ ] **Should have**: Events button → Navigate to events list
- [ ] **Should have**: Donation Campaigns button → Navigate to campaigns
- [ ] **Should have**: View Pets button → Navigate to adoptable pets
- [ ] **Should NOT have**: Memorial Services, Meal Products, Counseling

### Test Sunset Services Profile
- [ ] **Should have**: Memorial Services button → Navigate to memorial services
- [ ] **Should have**: Counseling Sessions button → Navigate to counseling
- [ ] **Should NOT have**: Events, Donations, Meal Products

### Test Nutritionist Profile
- [ ] **Should have**: Meal Products (via Book button) → Navigate to meal catalog
- [ ] **Should NOT have**: Events, Memorial, Donations, Counseling

### Test Pet Cafe Profile
- [ ] **Should have**: Events button → Navigate to events list
- [ ] **Should NOT have**: Memorial, Donations, Meal Products, Counseling

## Updated Test Scenarios

### Scenario 1: Shelter Events & Donations
1. Navigate to Adoption Services
2. Select a shelter
3. Verify "Get Involved" section shows:
   - Events button
   - Donation Campaigns button
4. Click Events → Test events list and registration
5. Click Donations → Test donation campaigns and contribution

### Scenario 2: Sunset Services Memorial & Counseling
1. Navigate to Sunset Care Services
2. Select a memorial service provider
3. Verify "Services" section shows:
   - Memorial Services button
   - Counseling Sessions button
4. Click Memorial → Test services/products browsing
5. Click Counseling → Test session booking

### Scenario 3: Nutritionist Meal Products
1. Navigate to Nutritionist Services
2. Click "Book" on nutritionist
3. Verify meal products catalog loads
4. Test filters, search, product details

### Scenario 4: Customer Diet Charts
1. Navigate to Customer Profile
2. Click "Diet Charts" in Quick Links
3. Verify charts list loads
4. Test chart details, meal schedules

## What Was Fixed

### ❌ Removed (Incorrect)
- Events button from Clinic Profile View
- Memorial Services button from Clinic Profile View

### ✅ Added (Correct)
- Events button to Adoption Center Profile View
- Donation Campaigns button to Adoption Center Profile View (already existed, verified)
- Counseling Sessions button to Sunset Services Profile View
- Memorial Services button to Sunset Services Profile View (already existed, verified)

### ✅ Verified (Correct)
- Meal Products from Nutritionist profiles
- Diet Charts from Customer Profile

## Philosophy Reminder

**The customer app must reflect vendor dashboard capabilities exactly.**

- If a vendor role doesn't have a capability → customers shouldn't see it
- If a vendor role has a capability → customers should access it from profile
- Mobile app = Web app (same structure, flows, options)
- Role configuration drives everything

## Next Steps

1. ✅ Verify all navigation links match role capabilities
2. ✅ Test each role profile to ensure correct buttons appear
3. ✅ Test navigation flows from each profile
4. ✅ Verify no incorrect buttons appear in wrong profiles
5. ✅ Document any missing profile views that need navigation links

