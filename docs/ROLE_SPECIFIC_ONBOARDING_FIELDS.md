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

### Required Fields
1. **GPS Tracking Consent**
   - Type: Checkbox
   - Label: "Enable GPS tracking during walks"
   - Description: "Allow customers to track your location during active walks"
   - Required: Yes
   - Default: true

2. **Service Radius**
   - Type: Number (km)
   - Label: "Maximum service radius"
   - Description: "Maximum distance you're willing to travel for walks"
   - Required: Yes
   - Min: 1 km
   - Max: 50 km
   - Default: 5 km

3. **Maximum Dogs Per Walk**
   - Type: Number
   - Label: "Maximum dogs per walk"
   - Description: "How many dogs can you walk simultaneously?"
   - Required: Yes
   - Min: 1
   - Max: 10
   - Default: 3

4. **Walk Duration Options**
   - Type: Multi-select
   - Label: "Available walk durations"
   - Options: ["15 minutes", "20 minutes", "30 minutes", "45 minutes", "60 minutes"]
   - Required: Yes
   - Default: ["30 minutes"]

5. **Experience Level**
   - Type: Select
   - Label: "Years of experience"
   - Options: ["Less than 1 year", "1-2 years", "3-5 years", "5+ years"]
   - Required: Yes

6. **Dog Size Preferences**
   - Type: Multi-select
   - Label: "Dog sizes you can handle"
   - Options: ["Small (under 20 lbs)", "Medium (20-50 lbs)", "Large (50-100 lbs)", "Extra Large (100+ lbs)"]
   - Required: Yes

7. **Special Needs Experience**
   - Type: Multi-select
   - Label: "Special needs experience"
   - Options: ["Senior dogs", "Puppies", "Aggressive dogs", "Disabled dogs", "Medical conditions"]
   - Required: No

8. **Background Check**
   - Type: File upload
   - Label: "Background check certificate"
   - Description: "Upload your background check certificate"
   - Required: Yes
   - Accepted formats: PDF, JPG, PNG

9. **Insurance Certificate**
   - Type: File upload
   - Label: "Pet care insurance certificate"
   - Description: "Upload your insurance certificate"
   - Required: Yes
   - Accepted formats: PDF, JPG, PNG

10. **Emergency Contact**
    - Type: Text
    - Label: "Emergency contact name"
    - Required: Yes

11. **Emergency Phone**
    - Type: Tel
    - Label: "Emergency contact phone"
    - Required: Yes

### Optional Fields
- References (name, phone, relationship)
- Certifications (dog training, pet first aid, etc.)
- Languages spoken
- Availability schedule (preferred times)

---

## 🛍️ E-commerce/Seller Role - Additional Fields

### Required Fields
1. **Business Type**
   - Type: Select
   - Label: "Business type"
   - Options: ["Individual seller", "Small business", "Retail store", "Online store", "Manufacturer"]
   - Required: Yes

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

3. **Shipping Options**
   - Type: Multi-select
   - Label: "Shipping methods offered"
   - Options: ["Standard shipping", "Express shipping", "Same-day delivery", "Pickup available"]
   - Required: Yes
   - Default: ["Standard shipping"]

4. **Shipping Radius (for local delivery)**
   - Type: Number (km)
   - Label: "Local delivery radius"
   - Description: "Maximum distance for same-day/local delivery (0 = shipping only)"
   - Required: Yes
   - Min: 0
   - Max: 100 km
   - Default: 0

5. **Inventory Management**
   - Type: Select
   - Label: "Inventory management system"
   - Options: ["Manual", "Automated", "Third-party integration"]
   - Required: Yes
   - Default: "Manual"

6. **Return Policy**
   - Type: Textarea
   - Label: "Return policy"
   - Description: "Describe your return and refund policy"
   - Required: Yes
   - Min length: 50 characters
   - Placeholder: "e.g., 7-day return policy, items must be unused..."

7. **GST/VAT Number**
   - Type: Text
   - Label: "GST/VAT registration number"
   - Description: "Your tax registration number for e-commerce"
   - Required: Yes (if applicable in your region)

8. **Product Catalog Sample**
   - Type: File upload
   - Label: "Product catalog (PDF or images)"
   - Description: "Upload a sample of your product catalog"
   - Required: Yes
   - Accepted formats: PDF, ZIP (for multiple images)
   - Max size: 10 MB

9. **Warehouse Address** (if different from business address)
   - Type: Address + Map pin
   - Label: "Warehouse/Storage location"
   - Description: "Where products are stored and shipped from"
   - Required: No (if same as business address)

10. **Minimum Order Value**
    - Type: Number
    - Label: "Minimum order value (₹)"
    - Description: "Minimum order amount for free shipping"
    - Required: No
    - Default: 0

11. **Payment Methods Accepted**
    - Type: Multi-select
    - Label: "Payment methods"
    - Options: ["Cash on delivery", "Credit/Debit card", "UPI", "Net banking", "Wallet"]
    - Required: Yes
    - Default: ["UPI", "Credit/Debit card"]

### Optional Fields
- Social media links (Instagram, Facebook, etc.)
- Product warranty information
- Bulk order discounts policy
- Gift wrapping service
- Product installation service availability

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
