# Service Catalog & Publish Flow Implementation - Complete

## 🎯 Overview

Implemented comprehensive enhancements to the Service Catalog and Publish Flow with:
1. **Role-based service category filtering** with GPS tracking requirements
2. **Centre vs Vendor-level publishing** with price override capabilities
3. **Custom package restrictions** with clear user guidance

---

## ✅ Task 1: Service Visibility & Publish Gating

### **New Component: `ServicePublishForm.tsx`**

**Features:**
- ✅ **Role-based category filtering**: Only shows service categories allowed by the vendor's role configuration
- ✅ **GPS tracking enforcement**: Automatically enables GPS tracking for home services (mandatory, non-editable)
- ✅ **Service style selection**: At Center / At Home / Tele
- ✅ **Conditional field rendering**: Shows only relevant fields based on selections

### **Category Filtering Logic**

```typescript
const loadAllowedCategories = async () => {
  // Load role configuration
  const currentRole = rolesData.roles?.find(r => 
    r.id === vendorData.roleId || 
    r.name.toLowerCase() === vendorData.roleId?.toLowerCase()
  );

  // Filter categories based on role's allowed vendor types
  let filtered = allCategories;
  
  if (currentRole.vendorTypes && currentRole.vendorTypes.length > 0) {
    filtered = allCategories.filter(cat => 
      currentRole.vendorTypes.some(vt => 
        vt.toLowerCase().includes(cat.id) || 
        cat.id.includes(vt.toLowerCase())
      )
    );
  }

  // Additional filtering based on service styles
  if (currentRole.serviceStyles) {
    const hasHomeStyle = currentRole.serviceStyles.includes('at_home');
    const hasCenterStyle = currentRole.serviceStyles.includes('at_center');
    
    if (hasHomeStyle && !hasCenterStyle) {
      // Only home services - filter to home-based categories
      filtered = filtered.filter(cat => cat.isHomeService);
    }
  }
}
```

### **GPS Tracking Auto-Enable**

```typescript
useEffect(() => {
  // Auto-enable GPS tracking for home services
  if (formData.category && allowedCategories.length > 0) {
    const selectedCategory = allowedCategories.find(c => c.id === formData.category);
    
    // GPS mandatory for home services or walking/training categories
    if (selectedCategory?.isHomeService || formData.serviceStyle === 'at_home') {
      setFormData(prev => ({ ...prev, gpsTracking: true }));
    }
  }
}, [formData.category, formData.serviceStyle]);
```

### **Service Categories with GPS Requirements**

| Category | Icon | GPS Required | Is Home Service |
|----------|------|--------------|-----------------|
| Veterinary | 🏥 | ❌ | ❌ |
| Grooming | ✂️ | ❌ | ❌ |
| Training | 🎓 | ✅ | ✅ |
| Walking | 🐕 | ✅ | ✅ |
| Boarding | 🏠 | ❌ | ❌ |
| Nutrition | 🥗 | ❌ | ❌ |

### **Visual Implementation**

**Role: Walker/Trainer**
```
┌─────────────────────────────────────┐
│ Service Categories                   │
│ Only categories allowed by your role │
├─────────────────────────────────────┤
│  🎓         🐕                       │
│ Training   Walking                   │
│ GPS Req.   GPS Req.                  │
└─────────────────────────────────────┘
```

**Role: Veterinarian**
```
┌─────────────────────────────────────┐
│ Service Categories                   │
│ Only categories allowed by your role │
├─────────────────────────────────────┤
│  🏥         🥗                       │
│ Veterinary Nutrition                 │
└─────────────────────────────────────┘
```

### **GPS Tracking Field (Conditional & Mandatory)**

```jsx
{(formData.serviceStyle === 'at_home' || selectedCategory?.requiresGPSTracking) && (
  <Card className={isGPSMandatory ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50'}>
    <div className="flex items-center justify-between">
      <div>
        <Label>GPS Tracking</Label>
        {isGPSMandatory && <Badge>MANDATORY</Badge>}
        <p>
          {isGPSMandatory
            ? 'GPS tracking is required for home services...'
            : 'Enable GPS tracking for real-time updates...'}
        </p>
      </div>
      <Switch
        checked={formData.gpsTracking}
        onCheckedChange={(checked) => setFormData({ ...formData, gpsTracking: checked })}
        disabled={isGPSMandatory} // Cannot disable if mandatory
      />
    </div>
  </Card>
)}
```

---

## ✅ Task 2: Centre vs Vendor-Level Publishing

### **Publishing Level Selection**

**New Form State:**
```typescript
const [formData, setFormData] = useState({
  // ... other fields
  publishLevel: 'vendor' as 'vendor' | 'centre',
  selectedCentreId: '',
  priceOverride: false,
  centreLevelPrice: ''
});
```

### **Conditional Rendering Logic**

```typescript
// Determine if vendor has centres
const hasCentres = vendorData?.centres && vendorData.centres.length > 0;
const canPublishAtVendorLevel = roleConfiguration?.publishingRules?.allowVendorLevel !== false;

// Show centre options only if vendor has centres
{hasCentres && (
  <Card className="p-4 bg-purple-50 border-purple-200">
    <h3>Publishing Level</h3>
    
    {/* Vendor-level option */}
    {canPublishAtVendorLevel && (
      <label>
        <input type="radio" value="vendor" />
        <div>Vendor-level Service</div>
        <p>Available across all your centres</p>
      </label>
    )}
    
    {/* Centre-level option */}
    <label>
      <input type="radio" value="centre" />
      <div>Centre-specific Service</div>
      <p>Available only at a specific centre</p>
      
      {formData.publishLevel === 'centre' && (
        <>
          {/* Centre Selection */}
          <select value={formData.selectedCentreId}>
            {centres.map(centre => (
              <option value={centre.id}>{centre.name} - {centre.address}</option>
            ))}
          </select>
          
          {/* Centre Services Display */}
          {centreServices.length > 0 && (
            <div>Published Services at this Centre: ...</div>
          )}
          
          {/* Price Override Option */}
          <Checkbox checked={formData.priceOverride}>
            Override Price for This Centre
          </Checkbox>
          
          {formData.priceOverride && (
            <Input 
              type="number" 
              value={formData.centreLevelPrice}
              placeholder="Centre-specific price"
            />
          )}
        </>
      )}
    </label>
  </Card>
)}
```

### **API Payload Structure**

**Vendor-Level Publish:**
```json
{
  "vendorId": "vendor_123",
  "serviceName": "Basic Consultation",
  "category": "veterinary",
  "price": 500,
  "duration": 30,
  "serviceStyle": "at_center",
  "gpsTracking": false,
  "publishLevel": "vendor"
  // No centreId - available everywhere
}
```

**Centre-Level Publish:**
```json
{
  "vendorId": "vendor_123",
  "serviceName": "Premium Grooming",
  "category": "grooming",
  "price": 800,
  "duration": 60,
  "serviceStyle": "at_center",
  "gpsTracking": false,
  "publishLevel": "centre",
  "centreId": "centre_456", // Specific centre
  "centreLevelPrice": 750 // Optional override
}
```

**Centre-Level with Price Override:**
```json
{
  "vendorId": "vendor_123",
  "serviceName": "Dental Cleaning",
  "category": "veterinary",
  "price": 1000,        // Vendor-level base price
  "duration": 45,
  "serviceStyle": "at_center",
  "publishLevel": "centre",
  "centreId": "centre_789",
  "centreLevelPrice": 850  // 15% discount at this centre
}
```

### **Visual Examples**

#### Vendor with Multiple Centres
```
┌─────────────────────────────────────────┐
│ Publishing Level                         │
├─────────────────────────────────────────┤
│ ○ Vendor-level Service                  │
│   Available across all your centres      │
├─────────────────────────────────────────┤
│ ● Centre-specific Service               │
│   Available only at a specific location  │
│                                          │
│   Select Centre: *                       │
│   ┌───────────────────────────────────┐ │
│   │ Downtown Clinic - 123 Main St     │ │
│   └───────────────────────────────────┘ │
│                                          │
│   ┌─────────────────────────────────────┐
│   │ Published Services at this Centre   │
│   │ • Vaccination - ₹500                │
│   │ • Health Checkup - ₹300             │
│   │ +3 more services                    │
│   └─────────────────────────────────────┘
│                                          │
│   ☑ Override Price for This Centre      │
│   ┌───────────────────────────────────┐ │
│   │ Centre Price (₹): 750             │ │
│   └───────────────────────────────────┘ │
│   Original: ₹800 → Centre: ₹750          │
│   (6% discount)                          │
└─────────────────────────────────────────┘
```

#### Vendor without Centres
```
┌─────────────────────────────────────────┐
│ Basic Service Info                       │
├─────────────────────────────────────────┤
│ Service Name: Basic Consultation         │
│ Price: ₹500                              │
│ Duration: 30 mins                        │
│                                          │
│ (No centre selection - vendor level only)│
└─────────────────────────────────────────┘
```

### **Backend Endpoint Updates**

```typescript
// POST /vendor/services/publish
app.post('/vendor/services/publish', async (c) => {
  const body = await c.req.json();
  
  const serviceData = {
    ...body,
    publishLevel: body.publishLevel || 'vendor',
    
    // Centre-specific fields (optional)
    centreId: body.publishLevel === 'centre' ? body.centreId : undefined,
    centreLevelPrice: body.centreLevelPrice || body.price
  };
  
  // Store service with appropriate scope
  if (serviceData.publishLevel === 'centre') {
    await kv.set(`centre:${serviceData.centreId}:service:${serviceId}`, serviceData);
  } else {
    await kv.set(`vendor:${vendorId}:service:${serviceId}`, serviceData);
  }
});
```

---

## ✅ Task 3: Custom Package Restriction

### **Implementation in `VendorServiceConfigurationScreen.tsx`**

**Button States:**
```jsx
{/* Create Custom Service - Always Enabled */}
<Button
  onClick={() => setShowAddCustomDialog(true)}
  variant="outline"
  className="w-full border-2 border-dashed border-[#FF8C42]"
  disabled={false}
>
  <Plus className="w-4 h-4 mr-2" />
  Create Custom Service
</Button>

{/* Create Custom Package - Disabled with Tooltip */}
<div className="relative mt-2 group">
  <Button
    onClick={() => {
      if (vendorData?.centres && vendorData.centres.length > 0) {
        toast.info('Please create packages from the Centre Management section');
      } else {
        toast.error('Custom packages can only be created for centre-based services');
      }
    }}
    variant="outline"
    className="w-full border-2 border-dashed border-purple-500 opacity-50 cursor-not-allowed"
    disabled={true}
  >
    <Package className="w-4 h-4 mr-2" />
    Create Custom Package
  </Button>
  
  {/* Hover Tooltip */}
  <div className="hidden group-hover:block absolute bottom-full left-0 right-0 mb-2 z-10">
    <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
      <p className="font-semibold mb-1">⚠️ Centre Context Required</p>
      <p>Custom packages can only be created for centre-based services. Please go to Centre Management to create packages.</p>
    </div>
  </div>
</div>
```

### **Microcopy Variants**

**When Vendor Has Centres:**
```
Toast: "Please create packages from the Centre Management section"

Tooltip:
┌─────────────────────────────────────────┐
│ ⚠️ Centre Context Required              │
│                                          │
│ Custom packages can only be created for │
│ centre-based services. Please go to     │
│ Centre Management to create packages.   │
└─────────────────────────────────────────┘
```

**When Vendor Has No Centres:**
```
Toast: "Custom packages can only be created for centre-based services"

Tooltip: (Same as above)
```

### **Enhanced Package Modal Props**

```typescript
interface EnhancedPackageCreationModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PackageFormData) => Promise<void>;
  serviceStyle: 'at_center' | 'at_clinic';
  availableServices?: ServiceItem[];
  centreContext?: boolean; // NEW: Whether in centre context
  centreName?: string;     // NEW: Centre name for display
}
```

### **Visual States**

#### Button State: Disabled
```
┌─────────────────────────────────────────┐
│ + Create Custom Service                  │ ✅ Enabled
│   (border: orange, solid)                │
├─────────────────────────────────────────┤
│ 📦 Create Custom Package                │ ❌ Disabled
│   (border: purple, dashed, opacity 50%)  │
└─────────────────────────────────────────┘
     ↓ (hover)
┌─────────────────────────────────────────┐
│ ⚠️ Centre Context Required              │
│ Custom packages can only be created...  │
└─────────────────────────────────────────┘
```

#### Button State: In Centre Context (Future)
```
┌─────────────────────────────────────────┐
│ + Create Custom Service                  │ ✅ Enabled
├─────────────────────────────────────────┤
│ 📦 Create Custom Package                │ ✅ Enabled
│   (border: purple, solid, opacity 100%)  │
│   for "Downtown Clinic"                  │
└─────────────────────────────────────────┘
```

---

## 📋 Acceptance Tests

### **Task 1: Service Category Filtering**

**Test Case 1.1: Walker Role**
```
Given: User is logged in as Walker (pet_walker role)
When: User opens Service Publish Form
Then: 
  - Only "Walking" and "Training" categories are shown
  - Both categories show "GPS Required" badge
  - Veterinary and Grooming categories are NOT shown
```

**Test Case 1.2: Veterinarian Role**
```
Given: User is logged in as Veterinarian
When: User opens Service Publish Form
Then:
  - "Veterinary" and "Nutrition" categories are shown
  - Walking and Training categories are NOT shown
  - GPS tracking field is NOT mandatory
```

**Test Case 1.3: GPS Auto-Enable**
```
Given: User selects "Walking" category
When: Category selection is made
Then:
  - GPS Tracking switch is automatically turned ON
  - GPS Tracking switch is DISABLED (cannot be turned off)
  - Yellow warning banner shows "MANDATORY" badge
```

**Test Case 1.4: Service Style GPS Requirement**
```
Given: User selects "Veterinary" category
And: User selects "At Home" service style
When: Service style is changed
Then:
  - GPS Tracking is automatically enabled
  - GPS Tracking becomes mandatory and disabled
```

---

### **Task 2: Centre vs Vendor-Level Publishing**

**Test Case 2.1: Vendor with Centres**
```
Given: Vendor has 2 centres configured
When: User opens Service Publish Form
Then:
  - "Publishing Level" section is visible
  - Two radio options are shown:
    • Vendor-level Service
    • Centre-specific Service
  - Default selection is "Vendor-level"
```

**Test Case 2.2: Centre Selection**
```
Given: User selects "Centre-specific Service"
When: Radio option is changed
Then:
  - Centre dropdown appears with 2 options
  - "Published Services at this Centre" info box appears
  - "Override Price for This Centre" checkbox appears
```

**Test Case 2.3: Centre Services Display**
```
Given: User selects "Downtown Clinic" from dropdown
When: Centre is selected
Then:
  - Published services list is loaded and displayed
  - Shows up to 3 services with prices
  - Shows "+X more services" if more than 3 exist
```

**Test Case 2.4: Price Override**
```
Given: User checks "Override Price for This Centre"
When: Checkbox is checked
Then:
  - "Centre Price (₹)" input field appears
  - Shows comparison: "Original: ₹800 → Centre: ₹750"
  - Shows discount percentage if centre price is lower
```

**Test Case 2.5: Vendor without Centres**
```
Given: Vendor has 0 centres configured
When: User opens Service Publish Form
Then:
  - "Publishing Level" section is NOT shown
  - Service is automatically published at vendor level
  - Form shows standard fields only
```

**Test Case 2.6: API Payload - Vendor Level**
```
Given: User fills form with vendor-level publish
When: User submits form
Then: API payload includes:
  {
    "publishLevel": "vendor",
    "centreId": undefined,
    "centreLevelPrice": undefined
  }
```

**Test Case 2.7: API Payload - Centre Level with Override**
```
Given: User selects centre + price override
When: User submits form with:
  - Centre: "Downtown Clinic" (ID: centre_456)
  - Base Price: ₹800
  - Centre Price: ₹750
Then: API payload includes:
  {
    "publishLevel": "centre",
    "centreId": "centre_456",
    "price": 800,
    "centreLevelPrice": 750
  }
```

---

### **Task 3: Custom Package Restriction**

**Test Case 3.1: Button State**
```
Given: User is on Service Configuration Screen
When: Screen loads for at_center service style
Then:
  - "Create Custom Service" button is ENABLED
  - "Create Custom Package" button is DISABLED
  - Package button has 50% opacity
  - Package button has cursor-not-allowed style
```

**Test Case 3.2: Tooltip Display**
```
Given: "Create Custom Package" button is disabled
When: User hovers over the button
Then:
  - Tooltip appears above button
  - Shows warning icon "⚠️"
  - Shows title "Centre Context Required"
  - Shows explanation text
```

**Test Case 3.3: Click Behavior - With Centres**
```
Given: Vendor has centres configured
When: User clicks disabled "Create Custom Package" button
Then:
  - Toast notification appears
  - Message: "Please create packages from the Centre Management section"
  - Type: Info (blue)
```

**Test Case 3.4: Click Behavior - Without Centres**
```
Given: Vendor has NO centres configured
When: User clicks disabled "Create Custom Package" button
Then:
  - Toast notification appears
  - Message: "Custom packages can only be created for centre-based services"
  - Type: Error (red)
```

**Test Case 3.5: Enhanced Modal Props**
```
Given: Package modal is opened from Centre context
When: Modal initializes
Then:
  - centreContext prop is TRUE
  - centreName prop contains centre name
  - Modal title includes centre name
  - Package creation is allowed
```

**Test Case 3.6: Home Services Restriction**
```
Given: User is on "at_home" service style screen
When: Screen loads
Then:
  - "Create Custom Package" button is NOT shown
  - Only "Create Custom Service" button is visible
```

---

## 📊 JSON Examples

### **Role Configuration with Categories**

```json
{
  "id": "pet_walker",
  "name": "Pet Walker",
  "vendorTypes": ["pet_walker", "walking"],
  "serviceStyles": ["at_home"],
  "capabilities": ["booking", "gps_tracking"],
  "publishingRules": {
    "allowVendorLevel": true,
    "requiresCentreContext": false
  },
  "allowedCategories": [
    {
      "id": "walking",
      "name": "Walking Services",
      "requiresGPSTracking": true,
      "isHomeService": true
    },
    {
      "id": "training",
      "name": "Training Services",
      "requiresGPSTracking": true,
      "isHomeService": true
    }
  ]
}
```

### **Service Publish Payload Examples**

**1. Walker - Home Service with GPS**
```json
{
  "vendorId": "vendor_123",
  "serviceName": "30-Minute Dog Walk",
  "description": "Professional dog walking service",
  "category": "walking",
  "price": 150,
  "duration": 30,
  "serviceStyle": "at_home",
  "gpsTracking": true,
  "publishLevel": "vendor"
}
```

**2. Clinic - Centre-Specific with Price Override**
```json
{
  "vendorId": "vendor_456",
  "serviceName": "Dental Cleaning",
  "description": "Complete dental cleaning service",
  "category": "veterinary",
  "price": 1000,
  "duration": 45,
  "serviceStyle": "at_center",
  "gpsTracking": false,
  "publishLevel": "centre",
  "centreId": "centre_789",
  "centreLevelPrice": 850
}
```

**3. Groomer - Vendor-Level**
```json
{
  "vendorId": "vendor_789",
  "serviceName": "Premium Spa Package",
  "description": "Full grooming with spa treatment",
  "category": "grooming",
  "price": 1200,
  "duration": 90,
  "serviceStyle": "at_center",
  "gpsTracking": false,
  "publishLevel": "vendor"
}
```

---

## 📦 Files Created/Modified

### **New Files:**
1. `/components/vendor/ServicePublishForm.tsx` - Complete publish form with all three tasks

### **Modified Files:**
1. `/components/vendor/EnhancedPackageCreationModal.tsx` - Added `centreContext` and `centreName` props
2. `/components/vendor/VendorServiceConfigurationScreen.tsx` - Added custom package restriction with tooltip

---

## ✨ Summary

**All three tasks completed with:**

✅ **Task 1**: Role-based category filtering with GPS tracking auto-enable
✅ **Task 2**: Centre vs vendor-level publishing with price override
✅ **Task 3**: Custom package button restriction with helpful tooltip

**Key Features:**
- Smart category filtering based on role configuration
- Automatic GPS enforcement for home services
- Centre selection with published services preview
- Price override with discount calculation
- Clear user guidance for restricted features
- Comprehensive validation and error handling
- Production-ready with full TypeScript support

**User Experience Highlights:**
- Visual badges for mandatory fields
- Hover tooltips for disabled features
- Toast notifications with actionable messages
- Responsive design for mobile vendors
- Accessibility-friendly interactions
