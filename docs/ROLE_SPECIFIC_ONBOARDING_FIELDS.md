# Role-Specific Onboarding Fields

This document defines the additional onboarding fields needed for each vendor role beyond the common fields.

## Common Fields (All Roles)
- Business name
- Contact information (phone, email)
- Address and location (map pin)
- Business registration documents
- Tax identification
- Bank account details
- Profile photo/logo
- Business description

---

## 🐾 Walker Role - Additional Fields

### Required Fields (Simplified - Only Essential)
1. **GPS Tracking Consent**
   - Type: Checkbox
   - Label: "Enable GPS tracking during walks"
   - Description: "Allow customers to track your location during active walks"
   - Required: Yes
   - Default: true
   - **Used in:** Live tracking during active walks

2. **Background Check**
   - Type: File upload
   - Label: "Background check certificate"
   - Description: "Upload your background check certificate"
   - Required: Yes
   - Accepted formats: PDF, JPG, PNG
   - **Used in:** Vendor verification

3. **Insurance Certificate**
   - Type: File upload
   - Label: "Pet care insurance certificate"
   - Description: "Upload your insurance certificate"
   - Required: Yes
   - Accepted formats: PDF, JPG, PNG
   - **Used in:** Vendor verification

4. **Emergency Contact Name**
   - Type: Text
   - Label: "Emergency contact name"
   - Required: Yes
   - **Used in:** Safety and emergency situations

5. **Emergency Contact Phone**
   - Type: Tel
   - Label: "Emergency contact phone"
   - Required: Yes
   - **Used in:** Safety and emergency situations

### Removed Fields (Not Used in Operations)
- ❌ Service Radius - Can be set in service catalog per service
- ❌ Maximum Dogs Per Walk - Can be set in service catalog per service
- ❌ Walk Duration Options - Can be set in service catalog when creating services
- ❌ Experience Level - Not used in operations
- ❌ Dog Size Preferences - Not used in booking logic
- ❌ Special Needs Experience - Not used in operations

**Note:** Service-specific details (radius, max dogs, durations) should be configured in the **service catalog** when creating walk services, not during onboarding.

---

## 🛍️ E-commerce/Seller Role - Additional Fields

### Required Fields (Simplified - Only Essential)
1. **Business Type**
   - Type: Select
   - Label: "Business type"
   - Options: ["Individual seller", "Small business", "Retail store", "Online store", "Manufacturer"]
   - Required: Yes
   - **Used in:** Vendor categorization

2. **Product Categories**
   - Type: Multi-select
   - Label: "Product categories you sell"
   - Options: [
      "Pet Food & Treats",
      "Toys & Accessories",
      "Grooming Products",
      "Health & Wellness",
      "Beds & Furniture",
      "Leashes & Collars",
      "Training Equipment",
      "Pet Clothing",
      "Crates & Carriers",
      "Litter & Waste Management",
      "Aquarium Supplies",
      "Bird Supplies",
      "Small Animal Supplies",
      "Reptile Supplies"
    ]
   - Required: Yes
   - Min selections: 1
   - **Used in:** Product catalog, search, and categorization

3. **Payment Methods Accepted**
   - Type: Multi-select
   - Label: "Payment methods"
   - Options: ["Cash on delivery", "Credit/Debit card", "UPI", "Net banking", "Wallet"]
   - Required: Yes
   - Default: ["UPI", "Credit/Debit card"]
   - **Used in:** Order processing

4. **GST/VAT Number**
   - Type: Text
   - Label: "GST/VAT registration number"
   - Description: "Your tax registration number for e-commerce (if applicable)"
   - Required: No (optional)
   - **Used in:** Tax compliance

5. **Product Catalog Sample**
   - Type: File upload
   - Label: "Product catalog (PDF or images)"
   - Description: "Upload a sample of your product catalog"
   - Required: Yes
   - Accepted formats: PDF, ZIP (for multiple images)
   - Max size: 10 MB
   - **Used in:** Vendor verification

### Removed Fields (Handled by Platform)
- ❌ **Shipping Options** - Removed
  - **Reason:** Delivery handled by Warmpawz via Shiprocket/Nimbus Posts
  - Platform manages all delivery logistics
  - No need for vendor to specify

- ❌ **Shipping Radius** - Removed
  - **Reason:** Delivery handled by platform delivery partners
  - Platform manages delivery radius and logistics
  - Vendor doesn't need to specify

- ❌ **Return Policy** - Removed
  - **Reason:** 
    - Most products don't allow returns
    - Return delivery charges handled by platform (back and forth)
    - Platform manages return logistics and policies
    - No need for vendor to specify policy

- ❌ **Inventory Management** - Removed
  - **Reason:** Not needed for onboarding
  - Can be configured later if needed

**Note:** 
- Delivery is handled by **Warmpawz via Shiprocket/Nimbus Posts**
- Delivery charges are charged by platform (successful delivery + return charges)
- Most products don't allow returns
- Return logistics handled by platform

---

## 🔧 Implementation Notes

### Backend Changes Required

1. **Update Form Schema Endpoint**
   - Endpoint: `/vendor/onboarding/form-schema/:roleId`
   - Add role-specific fields to the schema response
   - Ensure fields are properly validated

2. **Database Schema**
   - Add columns to `vendor_profiles` table:
     - `walker_service_radius` (integer)
     - `walker_max_dogs` (integer)
     - `walker_gps_enabled` (boolean)
     - `seller_product_categories` (jsonb)
     - `seller_shipping_options` (jsonb)
     - `seller_shipping_radius` (integer)
     - `seller_return_policy` (text)

3. **Validation Rules**
   - Service radius: 1-50 km for walkers
   - Maximum dogs: 1-10 for walkers
   - Product categories: At least 1 required for sellers
   - Shipping options: At least 1 required for sellers

### Frontend Changes Required

1. **Dynamic Form Rendering**
   - Update `DynamicVendorOnboardingForm.tsx` to render role-specific fields
   - Add field components for:
     - Multi-select dropdowns
     - Number inputs with min/max
     - File uploads with validation
     - Map pin for warehouse address

2. **Field Validation**
   - Add client-side validation for role-specific fields
   - Show appropriate error messages
   - Validate file uploads (size, format)

3. **UI Components**
   - Create reusable components for:
     - Multi-select with search
     - Number input with unit display
     - File upload with preview
     - GPS consent checkbox

---

## 📋 Testing Checklist

### Walker Onboarding
- [ ] GPS tracking consent can be toggled
- [ ] Service radius accepts 1-50 km
- [ ] Maximum dogs accepts 1-10
- [ ] Walk duration options can be selected
- [ ] Background check file uploads correctly
- [ ] Insurance certificate uploads correctly
- [ ] Emergency contact fields are required
- [ ] Form validates all required fields
- [ ] Form submits successfully with all fields

### Seller Onboarding
- [ ] Business type can be selected
- [ ] Product categories can be selected (min 1)
- [ ] Shipping options can be selected (min 1)
- [ ] Shipping radius accepts 0-100 km
- [ ] Return policy accepts text (min 50 chars)
- [ ] GST/VAT number validates correctly
- [ ] Product catalog file uploads correctly
- [ ] Warehouse address map pin works
- [ ] Payment methods can be selected
- [ ] Form validates all required fields
- [ ] Form submits successfully with all fields

---

## 🎯 Priority

**High Priority:**
- Walker: GPS tracking consent, Service radius, Maximum dogs
- Seller: Product categories, Shipping options, Return policy

**Medium Priority:**
- Walker: Experience level, Special needs experience
- Seller: Shipping radius, Payment methods

**Low Priority:**
- Walker: References, Certifications
- Seller: Social media links, Gift wrapping

---

**Last Updated:** January 15, 2026
