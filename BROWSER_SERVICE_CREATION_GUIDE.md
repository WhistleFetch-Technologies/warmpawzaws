# Browser Service Creation Guide

## Overview
This guide explains how to create services in the Service Catalog using browser actions in the Admin UI.

## Prerequisites
1. Admin credentials: `admin@warmpawz.com` / `Warmpawz2025`
2. Access to Admin UI at: `https://dfof7mguaa0a5.cloudfront.net/catalog-services`
3. Service data from `COMPLETE_SERVICE_CATALOG.json`

## Step-by-Step Browser Process

### 1. Navigate to Service Catalog
- Go to: `https://dfof7mguaa0a5.cloudfront.net/catalog-services`
- Sign in with admin credentials
- Click on "Catalog & Services" in sidebar
- Click on "Service Catalog" tab

### 2. Create Individual Services

For each service in `COMPLETE_SERVICE_CATALOG.json`:

1. **Click "Add Service" button**
   - Located at top right of Service Catalog tab

2. **Fill in the form:**
   - **Service Name**: Use `service_name` field
   - **Service Code**: Use `service_id` field
   - **Description**: Use `description` field
   - **Category**: Select from dropdown (match `category_name`)
   - **Price**: Enter `base_price` value
   - **Duration**: Enter `duration_minutes` + " min" (e.g., "30 min")
   - **Service Type**: 
     - Select "At Center" if `service_style` is `at_center`
     - Select "At Home" if `service_style` is `at_home`
   - **Status**: Select "Active"

3. **Click "Create Service"**

### 3. Service Style Mapping

The current UI form has limited service type options. For services with `tele` or `delivery` styles:
- Use "At Home" for `tele` services (can be updated later via API)
- Use "At Home" for `delivery` services (can be updated later via API)

### 4. Role Assignment

**Note**: The current `AddServiceModal` component may not support multiple role selection. After creating services, you may need to:
- Update services via API to add `applicable_roles`
- Or enhance the modal to support role selection

### 5. Creating Service Packages

For packages in `COMPLETE_SERVICE_CATALOG.json`:
1. Create as a regular service
2. Add metadata via API: `{ is_package: true, package_services: [...] }`

## Sample Services to Create First

### At Center Services (Start Here)
1. **General Health Checkup**
   - Name: General Health Checkup
   - Code: vet_general_checkup
   - Description: Comprehensive health checkup for your pet including vital signs, physical examination, and health assessment
   - Category: Veterinary Services
   - Price: 500
   - Duration: 30 min
   - Type: At Center

2. **Bath & Dry**
   - Name: Bath & Dry
   - Code: groom_bath
   - Description: Complete bathing and drying service with premium pet shampoo
   - Category: Grooming & Hygiene
   - Price: 600
   - Duration: 45 min
   - Type: At Center

3. **Basic Obedience Training**
   - Name: Basic Obedience Training
   - Code: train_basic_obedience
   - Description: Teach sit, stay, come, heel and basic commands
   - Category: Training & Behavior
   - Price: 1500
   - Duration: 60 min
   - Type: At Center

### At Home Services
1. **30 Min Walk**
   - Name: 30 Min Walk
   - Code: walk_30min
   - Description: 30 minute walking session for daily exercise
   - Category: Walking & Exercise
   - Price: 200
   - Duration: 30 min
   - Type: At Home

2. **Home Visit Consultation**
   - Name: Home Visit Consultation
   - Code: vet_home_visit
   - Description: Convenient at-home veterinary consultation
   - Category: Veterinary Services
   - Price: 1000
   - Duration: 45 min
   - Type: At Home

### Tele Services
1. **Tele-Consultation**
   - Name: Tele-Consultation
   - Code: vet_tele_consult
   - Description: Connect with veterinarian via video call
   - Category: Veterinary Services
   - Price: 300
   - Duration: 20 min
   - Type: At Home (update to tele via API)

2. **Nutrition Consultation**
   - Name: Nutrition Consultation
   - Code: nutrition_consult
   - Description: Personalized diet plan consultation
   - Category: Wellness & Nutrition
   - Price: 800
   - Duration: 30 min
   - Type: At Home (update to tele via API)

### Delivery Services
1. **Medicine Delivery**
   - Name: Medicine Delivery
   - Code: pharmacy_delivery
   - Description: Deliver medicines to your home for convenience
   - Category: Pharmacy & Medication
   - Price: 100
   - Duration: 30 min
   - Type: At Home (update to delivery via API)

## API Enhancement Script

After creating services via browser, run this to add missing fields:

```javascript
// Update service with roles and correct service_style
const updateService = async (serviceId, updates) => {
  const response = await fetch(`/admin/service-catalog/${serviceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  return response.json();
};

// Example: Update tele service
await updateService('vet_tele_consult', {
  service_style: 'tele',
  applicable_roles: ['veterinarian', 'vet_clinic']
});
```

## Validation Checklist

After creating services:
- [ ] All 77 individual services created
- [ ] All 8 packages created
- [ ] Services visible in Service Catalog tab
- [ ] Services have correct prices
- [ ] Services have correct durations
- [ ] Services mapped to correct categories
- [ ] Services can be edited/deleted
- [ ] Services appear in vendor dashboards (role-based)
- [ ] Services appear in customer app

## Troubleshooting

### Issue: Can't see "Add Service" button
- Ensure you're on the "Service Catalog" tab (not Categories or Products)
- Check if you have admin permissions

### Issue: Service creation fails
- Check browser console for errors
- Verify all required fields are filled
- Check API endpoint is accessible

### Issue: Services not appearing
- Refresh the page
- Check if services were created successfully (check network tab)
- Verify database connection

## Alternative: Direct API Creation

If browser automation has issues, use the API script:
```bash
node create-all-services-api.js
```

This will create all services directly via API calls.
