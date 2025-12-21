# Phase 3: Role-Service Mapping Analysis

## Critical Understanding

**Before building any customer-facing integration, we MUST understand which vendor roles have which capabilities.**

## Role-Capability Mapping

### Events (`events` capability)
**Roles with this capability:**
- ✅ `pet_shelter` - Shelters/NGOs organize adoption events, fundraisers, awareness campaigns
- ✅ `pet_cafe` - Cafes organize pet meetups, socialization events

**Roles WITHOUT this capability:**
- ❌ `veterinarian` - Vets don't organize events
- ❌ `veterinary_clinic` - Clinics don't organize events
- ❌ Other roles

**Customer App Integration:**
- Events should be accessible from **Shelter/Adoption Center profiles**
- Events should be accessible from **Pet Cafe profiles**
- Events should NOT be in Vet/Clinic profiles

### Memorial Services (`memorial` capability)
**Roles with this capability:**
- ✅ `pet_sunset_services` - Memorial service providers offer cremation, burial, memorial products

**Roles WITHOUT this capability:**
- ❌ `veterinarian` - Vets don't provide memorial services
- ❌ `veterinary_clinic` - Clinics don't provide memorial services
- ❌ Other roles

**Customer App Integration:**
- Memorial services should be accessible from **Sunset Services provider profiles**
- Memorial services should NOT be in Vet/Clinic profiles

### Meal Products (`meal_plans` capability)
**Roles with this capability:**
- ✅ `nutritionist` - Nutritionists create and sell meal plans/products

**Roles WITHOUT this capability:**
- ❌ All other roles

**Customer App Integration:**
- Meal products should be accessible from **Nutritionist profiles**
- This is already correctly implemented ✅

### Donation Campaigns (`donation` capability)
**Roles with this capability:**
- ✅ `pet_shelter` - Shelters/NGOs run donation campaigns for rescue operations

**Roles WITHOUT this capability:**
- ❌ All other roles

**Customer App Integration:**
- Donation campaigns should be accessible from **Shelter/Adoption Center profiles**
- Donation campaigns should NOT be in Vet/Clinic profiles

### Counseling (`counseling` capability)
**Roles with this capability:**
- ✅ `pet_sunset_services` - Memorial providers offer grief counseling
- ✅ `pet_behaviorist` - Behaviorists offer behavioral counseling (different from grief counseling)

**Roles WITHOUT this capability:**
- ❌ `veterinarian` - Vets don't provide counseling (they provide medical care)
- ❌ Other roles

**Customer App Integration:**
- Counseling should be accessible from **Sunset Services provider profiles** (grief counseling)
- Counseling should be accessible from **Behaviorist profiles** (behavioral counseling)
- Counseling should NOT be in Vet/Clinic profiles

### Diet Charts (`diet_charts` capability)
**Roles with this capability:**
- ✅ `nutritionist` - Nutritionists create diet charts for pets

**Roles WITHOUT this capability:**
- ❌ All other roles

**Customer App Integration:**
- Diet charts are customer-owned (created by nutritionists for customers)
- Should be accessible from **Customer Profile** (not vendor profile)
- This is already correctly implemented ✅

## Correct Navigation Structure

### Vet/Clinic Profile (`ClinicProfileView.tsx`)
**Should NOT have:**
- ❌ Events button
- ❌ Memorial Services button
- ❌ Donation Campaigns button
- ❌ Counseling Sessions button

**Should have:**
- ✅ Diagnostic Tests (if clinic offers diagnostics)
- ✅ Emergency Protocols (if clinic offers emergency services)
- ✅ Ambulance Services (if clinic offers ambulance)
- ✅ Gallery/Portfolio (if available)

### Shelter/Adoption Center Profile (`AdoptionCenterProfileView.tsx`)
**Should have:**
- ✅ Events button → Navigate to events list
- ✅ Donation Campaigns button → Navigate to donation campaigns
- ✅ View Pets button → Navigate to adoptable pets list

**Should NOT have:**
- ❌ Memorial Services (shelters don't provide memorial services)
- ❌ Meal Products (shelters don't sell meal products)

### Sunset Services Profile (`SunsetServiceProfileView.tsx`)
**Should have:**
- ✅ Memorial Services button → Navigate to memorial services/products
- ✅ Counseling Sessions button → Navigate to grief counseling sessions

**Should NOT have:**
- ❌ Events (memorial providers don't organize events)
- ❌ Donation Campaigns (memorial providers don't run campaigns)

### Nutritionist Profile
**Should have:**
- ✅ Meal Products button → Navigate to meal products catalog
- ✅ Diet Charts (accessible from customer profile, created by nutritionist)

**Should NOT have:**
- ❌ Events
- ❌ Memorial Services
- ❌ Donation Campaigns
- ❌ Counseling (unless they also offer behavioral counseling)

### Pet Cafe Profile
**Should have:**
- ✅ Events button → Navigate to events list (pet meetups, socialization events)

**Should NOT have:**
- ❌ Memorial Services
- ❌ Donation Campaigns
- ❌ Meal Products (cafes have menus, not meal plans)

## Customer Web App Alignment

The customer mobile app should match the customer web app exactly:

### Service Categories on Landing Page
1. **Vet Care** → Veterinarian/Clinic profiles
2. **Grooming** → Groomer profiles
3. **Training** → Trainer profiles
4. **Boarding** → Boarding/Resort profiles
5. **Adoption** → Shelter profiles (Events + Donations)
6. **Sunset Care** → Sunset Services profiles (Memorial + Counseling)
7. **Nutritionist** → Nutritionist profiles (Meal Products)
8. **Pet Cafes** → Cafe profiles (Events)

### Flow Consistency
- Mobile app flows should match web app flows
- Navigation patterns should be identical
- Service discovery should work the same way
- Profile views should show the same information

## Implementation Checklist

### ✅ Fixed
- [x] Removed Events/Memorial from Clinic Profile View
- [x] Added Donation Campaigns to Adoption Center Profile View
- [x] Added Memorial Services to Sunset Services Profile View
- [x] Meal Products correctly linked from Nutritionist profiles

### ⚠️ Needs Fixing
- [ ] Add Events button to Adoption Center Profile View
- [ ] Add Counseling button to Sunset Services Profile View
- [ ] Add Events button to Pet Cafe Profile View (if exists)
- [ ] Verify all navigation links match role capabilities
- [ ] Update testing guide with correct role-service associations

## Testing Strategy

### Test by Role
1. **Vet/Clinic**: Should NOT see Events, Memorial, Donations, Counseling
2. **Shelter**: Should see Events, Donations, Adoption Pets
3. **Sunset Services**: Should see Memorial, Counseling
4. **Nutritionist**: Should see Meal Products
5. **Pet Cafe**: Should see Events

### Test Navigation
- Each role profile should only show capabilities that role has
- Navigation should work correctly from each profile
- Customer should be able to access all relevant services

## Philosophy

**The customer app should reflect the vendor dashboard capabilities exactly.**

- If a vendor role doesn't have a capability in their dashboard, customers shouldn't see it in the profile
- If a vendor role has a capability, customers should be able to access it from the profile
- The mobile app should match the web app in structure, flows, and options
- Role configuration drives everything - capabilities are role-based, not universal

