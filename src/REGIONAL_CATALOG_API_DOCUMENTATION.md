# 📚 Regional Catalog API Documentation

## Phase 1 Backend Implementation - Complete API Reference

All endpoints are prefixed with: `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`

Authorization: `Bearer ${publicAnonKey}` (for frontend calls)

---

## 🌍 Regional Package Endpoints

### 1. Get Packages by Region

**Endpoint**: `GET /packages/by-region/:regionId`

**Description**: Returns all packages available in a specific region with regional pricing applied.

**URL Parameters**:
- `regionId` (string, required): Region ID (e.g., "india", "usa", "singapore", "uae")

**Response**:
```json
{
  "success": true,
  "region": {
    "regionId": "india",
    "regionName": "India",
    "regionCode": "IN",
    "currency": {
      "code": "INR",
      "symbol": "₹",
      "symbolPosition": "before"
    },
    "timezone": "Asia/Kolkata"
  },
  "packages": [
    {
      "id": "pkg_123",
      "packageName": "Basic Vet Checkup",
      "category": "veterinary",
      "description": "Comprehensive veterinary checkup",
      "currentRegionPricing": {
        "regionId": "india",
        "basePrice": 500,
        "currency": "INR",
        "symbol": "₹",
        "taxRate": 18,
        "taxName": "GST",
        "taxAmount": 90,
        "finalPrice": 590
      },
      "regionalAvailability": {
        "mode": "specific",
        "regions": ["india", "singapore"]
      },
      "regionalPricing": [
        {
          "regionId": "india",
          "basePrice": 500,
          "currency": "INR",
          "symbol": "₹"
        }
      ],
      "status": "active",
      "isActive": true
    }
  ],
  "count": 15,
  "metadata": {
    "totalPackagesInSystem": 50,
    "availableInRegion": 15,
    "filteredOut": 35
  }
}
```

**Example Usage**:
```typescript
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/packages/by-region/india`,
  {
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`
    }
  }
);
const data = await response.json();
console.log(`Found ${data.count} packages in India`);
```

---

### 2. Create Regional Package

**Endpoint**: `POST /admin/packages`

**Description**: Creates a new package with regional availability and pricing configuration.

**Request Body**:
```json
{
  "packageName": "Basic Vet Checkup",
  "category": "veterinary",
  "description": "Comprehensive veterinary checkup",
  "packageType": "bundle",
  
  "regionalAvailability": {
    "mode": "specific",
    "regions": ["india", "singapore"]
  },
  
  "regionalPricing": [
    {
      "regionId": "india",
      "basePrice": 500,
      "currency": "INR",
      "symbol": "₹"
    },
    {
      "regionId": "singapore",
      "basePrice": 50,
      "currency": "SGD",
      "symbol": "S$"
    }
  ],
  
  "regionalVariations": {
    "india": {
      "name": "Basic Vet Checkup - Hindi",
      "description": "Complete veterinary checkup in India"
    }
  },
  
  "validityType": "months",
  "validityPeriod": 1,
  "usageType": "appointments",
  "totalSessions": 1,
  "terms": ["Valid for 30 days", "Non-refundable"]
}
```

**Response**:
```json
{
  "success": true,
  "packageId": "pkg_123456",
  "package": {
    "id": "pkg_123456",
    "packageName": "Basic Vet Checkup",
    "category": "veterinary",
    "regionalAvailability": { ... },
    "regionalPricing": [ ... ],
    "status": "active",
    "isActive": true,
    "createdAt": "2025-11-27T10:00:00Z",
    "updatedAt": "2025-11-27T10:00:00Z"
  }
}
```

**Validation Rules**:
1. ✅ `packageName` is required
2. ✅ `category` is required
3. ✅ `regionalAvailability.mode` must be one of: "all", "specific", "exclude"
4. ✅ If mode is "specific" or "exclude", `regions` array must not be empty
5. ✅ All regions in `regionalAvailability.regions` must exist in system
6. ✅ `regionalPricing` must include pricing for all regions where package is available
7. ✅ Each pricing entry must have: `regionId`, `basePrice`, `currency`, `symbol`
8. ✅ `basePrice` must be greater than 0

---

### 3. Update Regional Package

**Endpoint**: `PUT /admin/packages/:packageId`

**Description**: Updates an existing package's regional configuration.

**URL Parameters**:
- `packageId` (string, required): Package ID to update

**Request Body**: (same structure as create, but all fields optional)
```json
{
  "regionalAvailability": {
    "mode": "all",
    "regions": []
  },
  "regionalPricing": [
    {
      "regionId": "uae",
      "basePrice": 150,
      "currency": "AED",
      "symbol": "AED"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "package": {
    "id": "pkg_123456",
    "packageName": "Basic Vet Checkup",
    "updatedAt": "2025-11-27T11:00:00Z",
    ...
  }
}
```

---

### 4. Get Single Package with Regional Pricing

**Endpoint**: `GET /packages/:packageId/region/:regionId`

**Description**: Gets a specific package with pricing for a specific region.

**URL Parameters**:
- `packageId` (string, required): Package ID
- `regionId` (string, required): Region ID

**Response**:
```json
{
  "success": true,
  "package": {
    "id": "pkg_123456",
    "packageName": "Basic Vet Checkup",
    "currentRegionPricing": {
      "regionId": "india",
      "basePrice": 500,
      "currency": "INR",
      "symbol": "₹",
      "taxRate": 18,
      "taxName": "GST",
      "taxAmount": 90,
      "finalPrice": 590
    },
    ...
  }
}
```

**Error Response** (Package not available in region):
```json
{
  "success": false,
  "error": "Package pkg_123456 is not available in region usa"
}
```

---

### 5. Get Package Stats by Region

**Endpoint**: `GET /admin/packages/stats/by-region`

**Description**: Returns package availability statistics for all regions.

**Response**:
```json
{
  "success": true,
  "stats": [
    {
      "regionId": "india",
      "regionName": "India",
      "regionCode": "IN",
      "isActive": true,
      "totalPackages": 45,
      "packagesByCategory": {
        "veterinary": 12,
        "grooming": 8,
        "training": 15,
        "walking": 10
      }
    },
    {
      "regionId": "usa",
      "regionName": "United States",
      "regionCode": "US",
      "isActive": true,
      "totalPackages": 38,
      "packagesByCategory": {
        "veterinary": 10,
        "grooming": 12,
        "training": 16
      }
    }
  ],
  "totals": {
    "totalRegions": 4,
    "activeRegions": 2,
    "totalPackages": 50
  }
}
```

---

## 🔄 Migration Endpoints

### 6. Migrate All Packages to Regional Format

**Endpoint**: `POST /admin/packages/migrate/regional`

**Description**: Migrates all existing packages (without regional config) to regional format.

**Request Body**:
```json
{
  "defaultRegionId": "india"
}
```

**Response**:
```json
{
  "success": true,
  "migrated": 25,
  "skipped": 10,
  "errors": []
}
```

**What it does**:
- Finds all packages without `regionalAvailability` or `regionalPricing`
- Adds regional configuration with default region
- Converts `packagePrice` to `regionalPricing[0].basePrice`
- Skips packages that already have regional configuration

---

### 7. Add Region to All Packages

**Endpoint**: `POST /admin/packages/add-region`

**Description**: Adds pricing for a new region to all compatible packages.

**Request Body**:
```json
{
  "regionId": "uae",
  "defaultBasePrice": 100
}
```

**Response**:
```json
{
  "success": true,
  "updated": 30,
  "skipped": 15,
  "errors": []
}
```

**What it does**:
- Adds regional pricing for the specified region to all packages
- Skips packages with `mode: "exclude"` that exclude this region
- Skips packages with `mode: "specific"` that don't include this region
- Skips packages that already have pricing for this region
- Uses `defaultBasePrice` or converts from existing pricing

---

### 8. Validate Regional Configuration

**Endpoint**: `GET /admin/packages/validate/regional`

**Description**: Validates regional configuration for all packages.

**Response**:
```json
{
  "success": true,
  "valid": 40,
  "invalid": 5,
  "issues": [
    {
      "packageId": "pkg_123",
      "issue": "Missing regionalAvailability"
    },
    {
      "packageId": "pkg_456",
      "issue": "Missing pricing for regions: usa, singapore"
    },
    {
      "packageId": "pkg_789",
      "issue": "Invalid price for region india"
    }
  ]
}
```

**Validation Checks**:
1. ✅ Has `regionalAvailability` configured
2. ✅ Has `regionalPricing` array with at least one entry
3. ✅ Pricing exists for all regions where package should be available
4. ✅ All pricing entries have valid `basePrice > 0`
5. ✅ All pricing entries have `currency` and `symbol`

---

## 🧪 Testing Endpoints

### 9. Run Test Suite

**Endpoint**: `GET /test/regional-catalog/all`

**Description**: Runs comprehensive test suite for regional catalog functionality.

**Response**:
```json
{
  "testSuite": "Regional Catalog Integration",
  "timestamp": "2025-11-27T10:00:00Z",
  "tests": [
    {
      "name": "Create Regional Package",
      "passed": true,
      "details": "Package created successfully with regional configuration"
    },
    {
      "name": "Filter Packages by Region",
      "passed": true,
      "details": "Filtering logic validated"
    },
    {
      "name": "Regional Pricing Calculation",
      "passed": true,
      "details": "Pricing calculation correct: ₹1000 + 18% tax = ₹1180"
    }
  ],
  "summary": {
    "total": 5,
    "passed": 5,
    "failed": 0
  }
}
```

---

### 10. Seed Sample Packages

**Endpoint**: `POST /test/regional-catalog/seed`

**Description**: Creates sample regional packages for testing.

**Response**:
```json
{
  "success": true,
  "message": "Created 4 sample packages",
  "created": [
    "test_pkg_123",
    "test_pkg_456",
    "test_pkg_789",
    "test_pkg_012"
  ],
  "errors": []
}
```

**Sample Packages Created**:
1. **Emergency Vet Call** - Available in all regions
2. **Pet Cafe Package** - Only India & Singapore
3. **Traditional Grooming** - Excluded from USA
4. **Dog Training Program** - With regional variations

---

### 11. Cleanup Test Packages

**Endpoint**: `DELETE /test/regional-catalog/cleanup`

**Description**: Removes all test packages (IDs starting with "test_pkg_").

**Response**:
```json
{
  "success": true,
  "removed": 4
}
```

---

## 📊 Data Models

### RegionalPackage Interface

```typescript
interface RegionalPackage {
  // Identity
  id: string;
  vendorId: string;
  packageName: string;
  packageType: string;
  description: string;
  category: string;
  
  // Regional Configuration
  regionalAvailability: {
    mode: 'all' | 'specific' | 'exclude';
    regions: string[];
  };
  
  regionalPricing: Array<{
    regionId: string;
    basePrice: number;
    currency: string;
    symbol: string;
    taxRate?: number;
    customTaxName?: string;
  }>;
  
  regionalVariations?: {
    [regionId: string]: {
      name?: string;
      description?: string;
      duration?: number;
      restrictions?: string[];
      additionalInfo?: string;
    };
  };
  
  // Package Details
  validityType?: string;
  validityPeriod?: number;
  usageType?: string;
  totalSessions?: number;
  unlimitedUsage?: boolean;
  includedServices?: string[];
  includedServicesDetails?: any[];
  benefits?: string[];
  terms?: string[];
  refundPolicy?: string;
  cancellationPolicy?: string;
  
  // Status
  status: string;
  isActive: boolean;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  approvedAt?: string | null;
  
  // Analytics
  totalPurchases?: number;
  totalRevenue?: number;
  activeSubscribers?: number;
}
```

---

## 🔍 Filtering Logic

### How Packages Are Filtered by Region

The system applies **THREE levels of filtering**:

#### Level 1: Service Category Check
```
IF region.serviceCatalog[packageCategory] === false
  → Package is HIDDEN
```

Example: If `region.serviceCatalog.sunset = false` in UAE, all sunset packages are hidden.

#### Level 2: Regional Availability Check
```
IF regionalAvailability.mode === "all"
  → Package is AVAILABLE

IF regionalAvailability.mode === "specific"
  IF regionId IN regionalAvailability.regions
    → Package is AVAILABLE
  ELSE
    → Package is HIDDEN

IF regionalAvailability.mode === "exclude"
  IF regionId IN regionalAvailability.regions
    → Package is HIDDEN
  ELSE
    → Package is AVAILABLE
```

#### Level 3: Pricing Check
```
IF package has pricing for regionId
  → Package is AVAILABLE
ELSE
  → Package is HIDDEN (safety check)
```

---

## 💡 Usage Examples

### Example 1: Customer App - Show Available Packages

```typescript
// Customer logs in, detect their region
const userRegion = 'india';

// Fetch packages for their region
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/packages/by-region/${userRegion}`,
  {
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`
    }
  }
);

const { packages, region } = await response.json();

// Display packages with regional pricing
packages.forEach(pkg => {
  console.log(pkg.packageName);
  console.log(`Price: ${pkg.currentRegionPricing.symbol}${pkg.currentRegionPricing.finalPrice}`);
  console.log(`(Base: ${pkg.currentRegionPricing.basePrice} + ${pkg.currentRegionPricing.taxName}: ${pkg.currentRegionPricing.taxAmount})`);
});
```

### Example 2: Admin - Create Multi-Region Package

```typescript
// Admin creates a package available in multiple regions
const packageData = {
  packageName: "Premium Grooming Package",
  category: "grooming",
  description: "Complete grooming service",
  packageType: "bundle",
  
  // Available in India, USA, Singapore
  regionalAvailability: {
    mode: "specific",
    regions: ["india", "usa", "singapore"]
  },
  
  // Different pricing per region
  regionalPricing: [
    {
      regionId: "india",
      basePrice: 1000,
      currency: "INR",
      symbol: "₹"
    },
    {
      regionId: "usa",
      basePrice: 80,
      currency: "USD",
      symbol: "$"
    },
    {
      regionId: "singapore",
      basePrice: 90,
      currency: "SGD",
      symbol: "S$"
    }
  ],
  
  validityType: "months",
  validityPeriod: 1
};

const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/packages`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(packageData)
  }
);

const { success, packageId } = await response.json();
console.log(`Package created: ${packageId}`);
```

### Example 3: Admin - Launch New Region

```typescript
// Step 1: Create new region (already done via Region Manager)
// Region "uae" is now active

// Step 2: Add UAE pricing to all existing packages
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/packages/add-region`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      regionId: "uae",
      defaultBasePrice: 100  // Default price, admin can adjust later
    })
  }
);

const { updated, skipped } = await response.json();
console.log(`Updated ${updated} packages for UAE launch`);
```

### Example 4: Booking - Capture Regional Pricing

```typescript
// When customer books a package
const packageId = "pkg_123";
const regionId = "india";

// Get package with regional pricing
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/packages/${packageId}/region/${regionId}`,
  {
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`
    }
  }
);

const { package: pkg } = await response.json();

// Create booking with pricing snapshot
const booking = {
  bookingId: generateId(),
  customerId: currentUser.id,
  packageId: packageId,
  regionId: regionId,
  
  // IMPORTANT: Snapshot pricing at booking time
  pricingSnapshot: {
    basePrice: pkg.currentRegionPricing.basePrice,
    currency: pkg.currentRegionPricing.currency,
    symbol: pkg.currentRegionPricing.symbol,
    taxRate: pkg.currentRegionPricing.taxRate,
    taxAmount: pkg.currentRegionPricing.taxAmount,
    totalAmount: pkg.currentRegionPricing.finalPrice
  },
  
  status: "pending",
  createdAt: new Date().toISOString()
};

// Save booking...
```

---

## ✅ Testing Workflow

### Quick Test Sequence

```bash
# 1. Seed sample packages
POST /test/regional-catalog/seed

# 2. Run test suite
GET /test/regional-catalog/all

# 3. Test India packages
GET /packages/by-region/india

# 4. Test USA packages
GET /packages/by-region/usa

# 5. View stats
GET /admin/packages/stats/by-region

# 6. Validate all packages
GET /admin/packages/validate/regional

# 7. Cleanup
DELETE /test/regional-catalog/cleanup
```

---

## 🚀 Phase 1 Complete!

**Backend Implementation Status**: ✅ COMPLETE

**Available Features**:
- ✅ Regional package storage with availability & pricing
- ✅ Regional filtering by service category & package config
- ✅ Multi-region pricing with tax calculation
- ✅ Package creation & update with validation
- ✅ Migration utilities for existing packages
- ✅ Regional statistics & reporting
- ✅ Comprehensive test suite

**Next Phase**: Admin UI Components (RegionalAvailabilitySelector, RegionalPricingEditor)

---

## 📞 Support

For questions or issues:
- Check validation errors in API responses
- Use test endpoints to debug
- Verify region configuration in Region Manager
- Ensure all required fields are provided

**Happy Regional Catalog Management!** 🌍🎉
