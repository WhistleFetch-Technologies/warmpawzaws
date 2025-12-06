# 🌍 Region-Specific Service Catalog - Architecture Design

## 🎯 Problem Statement

**Current Situation**:
- ✅ Regions have service toggles (veterinary, grooming, etc.)
- ✅ Service catalog has packages and services
- ❌ These two systems are not connected
- ❌ Packages appear in all regions regardless of region settings
- ❌ No region-specific pricing
- ❌ No regional service variations

**What We Need**:
- ✅ Packages filtered by region
- ✅ Region-specific pricing (₹ in India, $ in USA)
- ✅ Regional service availability control
- ✅ Vendor services limited by region
- ✅ Customer sees only regional services
- ✅ Admin can control catalog per region

---

## 🏗️ Architecture Design

### **Level 1: Region Service Enablement** (DONE ✅)

This controls which SERVICE CATEGORIES are allowed in a region.

```typescript
// In Region configuration
serviceCatalog: {
  veterinary: true,    // Vet services allowed in this region
  grooming: true,      // Grooming allowed
  training: true,      // Training allowed
  walking: true,       // Walking allowed
  boarding: false,     // Boarding NOT allowed (regulations)
  sunset: false,       // Sunset services NOT allowed (cultural)
  // ... etc
}
```

**Purpose**: High-level regulatory/cultural control  
**Controls**: Service category availability  
**Managed by**: Platform Admin via Region Manager  
**Status**: ✅ Already implemented

---

### **Level 2: Package Regional Availability** (TO BUILD 🔨)

This controls which SPECIFIC PACKAGES are available in which regions.

```typescript
// In Service Package
{
  packageId: "vet-basic-checkup",
  packageName: "Basic Veterinary Checkup",
  serviceCategory: "veterinary",
  
  // NEW: Regional Availability
  regionalAvailability: {
    mode: "specific",  // "all" | "specific" | "exclude"
    regions: ["india", "singapore"],  // Only available in these regions
  },
  
  // NEW: Regional Pricing
  regionalPricing: [
    {
      regionId: "india",
      basePrice: 500,      // ₹500
      currency: "INR",
      symbol: "₹"
    },
    {
      regionId: "singapore",
      basePrice: 50,       // S$50
      currency: "SGD",
      symbol: "S$"
    }
  ],
  
  // ... other package fields
}
```

**Purpose**: Granular package control  
**Controls**: Individual package availability and pricing  
**Managed by**: Platform Admin via Service Catalog UI  
**Status**: 🔨 To be built

---

### **Level 3: Service Filtering Logic** (TO BUILD 🔨)

This automatically filters services based on user's region.

```typescript
// Customer App
function getAvailablePackages(userRegionId: string) {
  // Get region configuration
  const region = await getRegion(userRegionId);
  
  // Get all packages
  const allPackages = await getAllPackages();
  
  // Filter by region rules
  const availablePackages = allPackages.filter(pkg => {
    // Rule 1: Service category must be enabled in region
    if (!region.serviceCatalog[pkg.serviceCategory]) {
      return false;
    }
    
    // Rule 2: Package must be available in this region
    if (pkg.regionalAvailability.mode === "specific") {
      if (!pkg.regionalAvailability.regions.includes(userRegionId)) {
        return false;
      }
    }
    
    if (pkg.regionalAvailability.mode === "exclude") {
      if (pkg.regionalAvailability.regions.includes(userRegionId)) {
        return false;
      }
    }
    
    // Rule 3: Package must have pricing for this region
    const hasRegionalPricing = pkg.regionalPricing.some(
      p => p.regionId === userRegionId
    );
    if (!hasRegionalPricing) {
      return false;
    }
    
    return true;
  });
  
  return availablePackages;
}
```

**Purpose**: Automatic filtering  
**Controls**: What customers see  
**Managed by**: System logic  
**Status**: 🔨 To be built

---

## 📊 Data Model Updates

### **1. Service Package Schema** (Update Needed)

```typescript
interface ServicePackage {
  // Existing fields
  packageId: string;
  packageName: string;
  serviceCategory: 'veterinary' | 'grooming' | 'training' | etc;
  description: string;
  duration: number;
  
  // NEW: Regional Availability
  regionalAvailability: {
    mode: 'all' | 'specific' | 'exclude';
    regions: string[];  // ["india", "usa", "singapore"]
  };
  
  // NEW: Regional Pricing
  regionalPricing: Array<{
    regionId: string;
    basePrice: number;
    currency: string;
    symbol: string;
    taxRate?: number;  // Override region default tax if needed
  }>;
  
  // NEW: Regional Variations (Optional)
  regionalVariations?: {
    [regionId: string]: {
      name?: string;           // Different name in different regions
      description?: string;    // Different description
      duration?: number;       // Different duration
      restrictions?: string[]; // Regional restrictions
    };
  };
  
  // Existing fields
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}
```

---

### **2. Vendor Service Schema** (Update Needed)

```typescript
interface VendorService {
  vendorId: string;
  serviceId: string;
  serviceCategory: string;
  
  // NEW: Region constraint
  regionId: string;  // Vendor can only offer services in their region
  
  // Pricing will use region-specific defaults
  customPricing?: number;  // Optional custom pricing
  
  // ... other fields
}
```

---

### **3. Booking Schema** (Update Needed)

```typescript
interface Booking {
  bookingId: string;
  customerId: string;
  vendorId: string;
  packageId: string;
  
  // NEW: Region tracking
  regionId: string;
  
  // NEW: Regional pricing snapshot
  pricingSnapshot: {
    basePrice: number;
    currency: string;
    symbol: string;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
  };
  
  // ... other fields
}
```

---

## 🎨 Admin UI Updates Needed

### **1. Service Catalog Management - Add Region Controls**

#### **Package Creation/Edit Screen**

```
┌─────────────────────────────────────────────┐
│ Create/Edit Package                         │
├─────────────────────────────────────────────┤
│                                             │
│ Package Name: [Basic Vet Checkup________]  │
│ Category: [Veterinary ▼]                   │
│ Duration: [30] minutes                      │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ 🌍 Regional Availability            │   │
│ ├─────────────────────────────────────┤   │
│ │ ○ Available in all regions          │   │
│ │ ● Available in specific regions     │   │
│ │ ○ Exclude from specific regions     │   │
│ │                                     │   │
│ │ Select Regions:                     │   │
│ │ ☑ 🇮🇳 India                         │   │
│ │ ☑ 🇺🇸 United States                 │   │
│ │ ☐ 🇦🇪 UAE                           │   │
│ │ ☑ 🇸🇬 Singapore                     │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ 💰 Regional Pricing                 │   │
│ ├─────────────────────────────────────┤   │
│ │ 🇮🇳 India                           │   │
│ │   Base Price: [500] ₹               │   │
│ │   Tax Rate: [18]% (GST)            │   │
│ │   Final: ₹590                       │   │
│ │                                     │   │
│ │ 🇺🇸 United States                   │   │
│ │   Base Price: [50] $                │   │
│ │   Tax Rate: [0]% (State var)       │   │
│ │   Final: $50                        │   │
│ │                                     │   │
│ │ 🇸🇬 Singapore                       │   │
│ │   Base Price: [50] S$               │   │
│ │   Tax Rate: [8]% (GST)             │   │
│ │   Final: S$54                       │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ [Cancel] [Save Package]                    │
└─────────────────────────────────────────────┘
```

---

### **2. Region Manager - Show Active Packages**

Add a new tab to Region Manager edit view:

```
┌─────────────────────────────────────────────┐
│ Edit Region: India                          │
├─────────────────────────────────────────────┤
│ [Basic] [Currency] [Phone] [Localization]   │
│ [Services] [Breeds] [📦 Active Packages]    │
├─────────────────────────────────────────────┤
│                                             │
│ Active Packages in India (45 packages)      │
│                                             │
│ Veterinary (12 packages)                    │
│ ├─ Basic Checkup - ₹500                     │
│ ├─ Vaccination - ₹800                       │
│ ├─ Surgery Consultation - ₹1,200            │
│ └─ ... 9 more                               │
│                                             │
│ Grooming (8 packages)                       │
│ ├─ Basic Bath - ₹400                        │
│ ├─ Full Grooming - ₹1,000                   │
│ └─ ... 6 more                               │
│                                             │
│ Training (15 packages)                      │
│ Walking (10 packages)                       │
│                                             │
│ [View All Packages]                         │
└─────────────────────────────────────────────┘
```

---

## 🔄 Implementation Flow

### **Flow 1: Admin Creates Regional Package**

```
1. Admin goes to Service Catalog
2. Clicks "Create Package"
3. Fills package details
4. Selects "Available in specific regions"
5. Checks: India, USA, Singapore
6. Sets pricing:
   - India: ₹500
   - USA: $50
   - Singapore: S$50
7. Saves package
8. System stores with regional metadata
```

**Result**: Package only appears in selected regions with correct pricing

---

### **Flow 2: Customer Views Catalog**

```
1. Customer logs in (region: India)
2. Navigates to Services
3. System detects region: "india"
4. System filters packages:
   - Check region.serviceCatalog
   - Check package.regionalAvailability
   - Check package.regionalPricing
5. Shows only India-available packages
6. Displays prices in ₹
```

**Result**: Customer sees only India packages with ₹ pricing

---

### **Flow 3: Vendor Registers Service**

```
1. Vendor registers in India
2. Goes to "My Services"
3. Clicks "Add Service"
4. System shows only:
   - Services enabled in India (region.serviceCatalog)
   - Packages available in India
5. Vendor selects "Basic Vet Checkup"
6. System shows India pricing: ₹500
7. Vendor can customize or accept default
8. Saves service
```

**Result**: Vendor can only offer India-available services

---

### **Flow 4: Booking Creation**

```
1. Customer selects package (region: India)
2. Selects vendor
3. System creates booking with:
   - regionId: "india"
   - pricingSnapshot:
     - basePrice: 500
     - currency: "INR"
     - symbol: "₹"
     - taxRate: 18
     - taxAmount: 90
     - totalAmount: 590
4. Payment processes in ₹
```

**Result**: Booking has correct regional pricing locked in

---

## 🎯 Use Cases

### **Use Case 1: Different Pricing Per Region**

**Scenario**: Basic Vet Checkup costs different amounts:
- India: ₹500 (economic factors)
- USA: $50 (higher costs)
- Singapore: S$50 (market rates)

**Solution**: Regional pricing array in package

---

### **Use Case 2: Service Not Available in Region**

**Scenario**: "Sunset Services" not culturally acceptable in UAE

**Solution**: 
1. Region Manager: Disable "sunset" in UAE serviceCatalog
2. Even if package has UAE in availableRegions, it won't show
3. Double protection: category + package level

---

### **Use Case 3: Package Only in Specific Regions**

**Scenario**: "Pet Cafe Package" only in India and Singapore (not common elsewhere)

**Solution**:
- regionalAvailability.mode = "specific"
- regions = ["india", "singapore"]
- Only these regions see the package

---

### **Use Case 4: Global Package**

**Scenario**: "Emergency Vet Call" available everywhere

**Solution**:
- regionalAvailability.mode = "all"
- regions = []
- Set pricing for each region
- Available in all active regions

---

### **Use Case 5: Regional Variations**

**Scenario**: "Dog Training" has different durations:
- India: 30 days (cultural norm)
- USA: 14 days (different approach)

**Solution**:
```typescript
regionalVariations: {
  "india": {
    duration: 30,
    description: "30-day comprehensive training program"
  },
  "usa": {
    duration: 14,
    description: "2-week intensive training program"
  }
}
```

---

## 🔧 Backend Changes Needed

### **1. Update Package Storage**

```typescript
// In region-catalog-integration.tsx

async function createPackage(packageData: ServicePackage) {
  // Validate regional availability
  if (packageData.regionalAvailability.mode === 'specific') {
    // Ensure all regions exist
    for (const regionId of packageData.regionalAvailability.regions) {
      const region = await kv.get(`region_${regionId}`);
      if (!region) {
        throw new Error(`Region ${regionId} does not exist`);
      }
    }
  }
  
  // Validate regional pricing
  for (const pricing of packageData.regionalPricing) {
    const region = await kv.get(`region_${pricing.regionId}`);
    if (!region) {
      throw new Error(`Region ${pricing.regionId} does not exist`);
    }
    
    // Ensure currency matches region
    if (pricing.currency !== region.currency.code) {
      console.warn(`Currency mismatch for ${pricing.regionId}`);
    }
  }
  
  // Store package
  await kv.set(`package_${packageData.packageId}`, packageData);
  
  return { success: true, package: packageData };
}
```

---

### **2. Create Filtering Endpoint**

```typescript
// GET /packages/by-region/:regionId

app.get('/packages/by-region/:regionId', async (c) => {
  const regionId = c.req.param('regionId');
  
  // Get region configuration
  const region = await kv.get<Region>(`region_${regionId}`);
  if (!region) {
    return c.json({ success: false, error: 'Region not found' }, 404);
  }
  
  // Get all packages
  const allPackages = await kv.getByPrefix<ServicePackage>('package_');
  
  // Filter by region rules
  const availablePackages = allPackages.filter(pkg => {
    // Rule 1: Service category enabled?
    if (!region.serviceCatalog[pkg.serviceCategory]) {
      return false;
    }
    
    // Rule 2: Package available in region?
    if (pkg.regionalAvailability.mode === 'specific') {
      return pkg.regionalAvailability.regions.includes(regionId);
    }
    
    if (pkg.regionalAvailability.mode === 'exclude') {
      return !pkg.regionalAvailability.regions.includes(regionId);
    }
    
    // Rule 3: Has regional pricing?
    return pkg.regionalPricing.some(p => p.regionId === regionId);
  });
  
  // Add regional pricing to each package
  const packagesWithPricing = availablePackages.map(pkg => {
    const pricing = pkg.regionalPricing.find(p => p.regionId === regionId);
    return {
      ...pkg,
      currentRegionPricing: pricing
    };
  });
  
  return c.json({
    success: true,
    region: {
      regionId: region.regionId,
      regionName: region.regionName,
      currency: region.currency
    },
    packages: packagesWithPricing,
    count: packagesWithPricing.length
  });
});
```

---

### **3. Update Package Creation Endpoint**

```typescript
// POST /admin/packages

app.post('/admin/packages', async (c) => {
  const packageData = await c.req.json();
  
  // Validate required fields
  if (!packageData.packageName || !packageData.serviceCategory) {
    return c.json({ success: false, error: 'Missing required fields' }, 400);
  }
  
  // Validate regional availability
  if (!packageData.regionalAvailability) {
    return c.json({ success: false, error: 'Regional availability required' }, 400);
  }
  
  // Validate regional pricing
  if (!packageData.regionalPricing || packageData.regionalPricing.length === 0) {
    return c.json({ success: false, error: 'Regional pricing required' }, 400);
  }
  
  // Create package
  const result = await createPackage(packageData);
  
  return c.json(result);
});
```

---

## 🎨 Frontend Components Needed

### **1. RegionalAvailabilitySelector Component**

```typescript
interface RegionalAvailabilitySelectorProps {
  value: {
    mode: 'all' | 'specific' | 'exclude';
    regions: string[];
  };
  onChange: (value: any) => void;
  availableRegions: Region[];
}

export function RegionalAvailabilitySelector({
  value,
  onChange,
  availableRegions
}: RegionalAvailabilitySelectorProps) {
  return (
    <Card className="p-4">
      <Label className="text-base mb-4">Regional Availability</Label>
      
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="radio"
            checked={value.mode === 'all'}
            onChange={() => onChange({ mode: 'all', regions: [] })}
          />
          <span>Available in all regions</span>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="radio"
            checked={value.mode === 'specific'}
            onChange={() => onChange({ mode: 'specific', regions: [] })}
          />
          <span>Available in specific regions</span>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="radio"
            checked={value.mode === 'exclude'}
            onChange={() => onChange({ mode: 'exclude', regions: [] })}
          />
          <span>Exclude from specific regions</span>
        </div>
      </div>
      
      {value.mode !== 'all' && (
        <div className="mt-4 space-y-2">
          <Label>Select Regions:</Label>
          {availableRegions.map(region => (
            <div key={region.regionId} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.regions.includes(region.regionId)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange({
                      ...value,
                      regions: [...value.regions, region.regionId]
                    });
                  } else {
                    onChange({
                      ...value,
                      regions: value.regions.filter(r => r !== region.regionId)
                    });
                  }
                }}
              />
              <span>
                {region.regionCode === 'IN' ? '🇮🇳' : 
                 region.regionCode === 'US' ? '🇺🇸' :
                 region.regionCode === 'AE' ? '🇦🇪' :
                 region.regionCode === 'SG' ? '🇸🇬' : '🌍'}{' '}
                {region.regionName}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

---

### **2. RegionalPricingEditor Component**

```typescript
interface RegionalPricingEditorProps {
  value: Array<{
    regionId: string;
    basePrice: number;
    currency: string;
    symbol: string;
  }>;
  onChange: (value: any[]) => void;
  selectedRegions: string[];
  allRegions: Region[];
}

export function RegionalPricingEditor({
  value,
  onChange,
  selectedRegions,
  allRegions
}: RegionalPricingEditorProps) {
  const regions = allRegions.filter(r => selectedRegions.includes(r.regionId));
  
  return (
    <Card className="p-4">
      <Label className="text-base mb-4">Regional Pricing</Label>
      
      <div className="space-y-4">
        {regions.map(region => {
          const pricing = value.find(p => p.regionId === region.regionId) || {
            regionId: region.regionId,
            basePrice: 0,
            currency: region.currency.code,
            symbol: region.currency.symbol
          };
          
          return (
            <div key={region.regionId} className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">
                  {region.regionCode === 'IN' ? '🇮🇳' : 
                   region.regionCode === 'US' ? '🇺🇸' :
                   region.regionCode === 'AE' ? '🇦🇪' :
                   region.regionCode === 'SG' ? '🇸🇬' : '🌍'}
                </span>
                <span className="font-semibold">{region.regionName}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Base Price ({pricing.symbol})</Label>
                  <Input
                    type="number"
                    value={pricing.basePrice}
                    onChange={(e) => {
                      const updated = value.filter(p => p.regionId !== region.regionId);
                      updated.push({
                        ...pricing,
                        basePrice: parseFloat(e.target.value) || 0
                      });
                      onChange(updated);
                    }}
                  />
                </div>
                
                <div>
                  <Label>Tax Rate (%)</Label>
                  <Input
                    type="number"
                    value={region.business.taxRate}
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {region.business.taxName}: {pricing.symbol}
                    {(pricing.basePrice * region.business.taxRate / 100).toFixed(2)}
                  </p>
                </div>
              </div>
              
              <div className="mt-3 p-3 bg-gray-50 rounded">
                <p className="text-sm">
                  <span className="font-semibold">Final Price: </span>
                  {pricing.symbol}
                  {(pricing.basePrice * (1 + region.business.taxRate / 100)).toFixed(2)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

---

## 📋 Implementation Checklist

### **Phase 1: Backend** (Week 1)
- [ ] Update ServicePackage interface with regional fields
- [ ] Create package validation functions
- [ ] Build filtering endpoint `/packages/by-region/:regionId`
- [ ] Update package creation endpoint
- [ ] Create package update endpoint
- [ ] Add regional pricing validation
- [ ] Test all endpoints

### **Phase 2: Admin UI** (Week 2)
- [ ] Create RegionalAvailabilitySelector component
- [ ] Create RegionalPricingEditor component
- [ ] Update package creation form
- [ ] Update package edit form
- [ ] Add region filter to package list
- [ ] Add "Active Packages" tab to Region Manager
- [ ] Test all forms

### **Phase 3: Customer App** (Week 3)
- [ ] Detect customer region
- [ ] Filter service catalog by region
- [ ] Display regional pricing
- [ ] Update booking flow with regional data
- [ ] Test customer experience

### **Phase 4: Vendor Portal** (Week 4)
- [ ] Filter vendor service options by region
- [ ] Show regional pricing defaults
- [ ] Update vendor registration
- [ ] Test vendor flows

---

## 🎯 Success Criteria

✅ Admin can create packages with regional availability  
✅ Admin can set different prices per region  
✅ Customers only see packages available in their region  
✅ Prices display in correct currency (₹, $, S$, AED)  
✅ Vendors can only offer services available in their region  
✅ Bookings capture regional pricing correctly  
✅ Region Manager shows active packages per region  

---

## 🌍 Example: Complete Flow

### **Admin Creates Package**
```
Package: "Basic Vet Checkup"
Available in: India, USA, Singapore
Pricing:
  - India: ₹500 + 18% GST = ₹590
  - USA: $50 + 0% = $50
  - Singapore: S$50 + 8% GST = S$54
```

### **Customer in India**
```
- Sees "Basic Vet Checkup"
- Price shown: ₹590 (incl. GST)
- Books service
- Pays in ₹
```

### **Customer in UAE**
```
- DOES NOT see "Basic Vet Checkup"
- Package not available in UAE
- Sees only UAE-available packages
```

### **Vendor in Singapore**
```
- Registers in Singapore
- Sees "Basic Vet Checkup" in service options
- Default price: S$50
- Can offer at S$54 (after tax)
```

---

**This architecture provides**:
✅ Complete regional control  
✅ Flexible pricing  
✅ Automatic filtering  
✅ Cultural compliance  
✅ Scalable design  

Ready to implement! 🚀
