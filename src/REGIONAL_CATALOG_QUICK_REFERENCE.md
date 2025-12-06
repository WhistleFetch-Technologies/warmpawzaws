# 🚀 Regional Catalog - Quick Reference Card

## 📍 Base URL
```
https://${projectId}.supabase.co/functions/v1/make-server-3dd53475
```

---

## 🔥 Most Used Endpoints

### 1. Get Packages for Region (Customer App)
```typescript
GET /packages/by-region/india
```
Returns all packages available in India with ₹ pricing.

### 2. Create Regional Package (Admin)
```typescript
POST /admin/packages
Body: {
  packageName: "...",
  category: "veterinary",
  regionalAvailability: { mode: "specific", regions: ["india"] },
  regionalPricing: [{ regionId: "india", basePrice: 500, currency: "INR", symbol: "₹" }]
}
```

### 3. View Regional Stats (Admin)
```typescript
GET /admin/packages/stats/by-region
```
Shows package count per region.

---

## 📦 Package Structure

```typescript
{
  id: "pkg_123",
  packageName: "Basic Vet Checkup",
  category: "veterinary",
  
  // Regional Config
  regionalAvailability: {
    mode: "specific",  // "all" | "specific" | "exclude"
    regions: ["india", "singapore"]
  },
  
  regionalPricing: [
    {
      regionId: "india",
      basePrice: 500,
      currency: "INR",
      symbol: "₹"
    }
  ]
}
```

---

## 🔍 Availability Modes

| Mode | Behavior | Example |
|------|----------|---------|
| `all` | Available everywhere | Emergency services |
| `specific` | Only in selected regions | Pet Cafe (India, Singapore) |
| `exclude` | Available except selected | Traditional service (exclude USA) |

---

## 🧪 Quick Test

```bash
# Seed samples
POST /test/regional-catalog/seed

# View India packages
GET /packages/by-region/india

# View stats
GET /admin/packages/stats/by-region

# Cleanup
DELETE /test/regional-catalog/cleanup
```

---

## ✅ Validation Rules

1. Package name required
2. Category required
3. Mode must be: "all", "specific", or "exclude"
4. Pricing required for all available regions
5. Base price must be > 0

---

## 🔧 Migration

### Migrate All Packages
```typescript
POST /admin/packages/migrate/regional
Body: { defaultRegionId: "india" }
```

### Add New Region
```typescript
POST /admin/packages/add-region
Body: { regionId: "uae", defaultBasePrice: 100 }
```

### Validate Configuration
```typescript
GET /admin/packages/validate/regional
```

---

## 💡 Common Patterns

### Pattern 1: Global Package
```typescript
regionalAvailability: { mode: "all", regions: [] }
regionalPricing: [
  { regionId: "india", basePrice: 500, currency: "INR", symbol: "₹" },
  { regionId: "usa", basePrice: 50, currency: "USD", symbol: "$" },
  { regionId: "singapore", basePrice: 50, currency: "SGD", symbol: "S$" },
  { regionId: "uae", basePrice: 150, currency: "AED", symbol: "AED" }
]
```

### Pattern 2: Region-Specific
```typescript
regionalAvailability: { mode: "specific", regions: ["india", "singapore"] }
regionalPricing: [
  { regionId: "india", basePrice: 800, currency: "INR", symbol: "₹" },
  { regionId: "singapore", basePrice: 60, currency: "SGD", symbol: "S$" }
]
```

### Pattern 3: Exclude Region
```typescript
regionalAvailability: { mode: "exclude", regions: ["usa"] }
regionalPricing: [
  { regionId: "india", basePrice: 600, currency: "INR", symbol: "₹" },
  { regionId: "singapore", basePrice: 50, currency: "SGD", symbol: "S$" },
  { regionId: "uae", basePrice: 150, currency: "AED", symbol: "AED" }
]
```

---

## 📊 Response Format

### Filtered Packages Response
```json
{
  "success": true,
  "region": {
    "regionId": "india",
    "regionName": "India",
    "currency": { "code": "INR", "symbol": "₹" }
  },
  "packages": [
    {
      "id": "pkg_123",
      "packageName": "Basic Vet Checkup",
      "currentRegionPricing": {
        "basePrice": 500,
        "taxRate": 18,
        "taxAmount": 90,
        "finalPrice": 590,
        "symbol": "₹"
      }
    }
  ],
  "count": 15
}
```

---

## 🎯 Quick Checklist

### Creating a Package
- [ ] Package name provided
- [ ] Category selected
- [ ] Availability mode chosen
- [ ] Regions selected (if specific/exclude)
- [ ] Pricing added for each region
- [ ] Base price > 0
- [ ] Currency & symbol provided

### Launching New Region
- [ ] Region created via Region Manager
- [ ] Region marked as active
- [ ] Service catalog configured
- [ ] Run: POST /admin/packages/add-region
- [ ] Test: GET /packages/by-region/{regionId}
- [ ] Validate: GET /admin/packages/validate/regional

---

## 🆘 Troubleshooting

### Package not showing in region?
1. Check region is active
2. Check service category enabled in region
3. Check package has pricing for region
4. Check regionalAvailability mode

### Pricing calculation wrong?
1. Check region tax rate
2. Check package taxRate override
3. Formula: finalPrice = basePrice + (basePrice * taxRate / 100)

### Validation errors?
1. Check all required fields present
2. Check regions exist in system
3. Check pricing matches availability
4. Run: GET /admin/packages/validate/regional

---

## 📞 Support Endpoints

```bash
# Health check
GET /packages/by-region/india

# Statistics
GET /admin/packages/stats/by-region

# Validation
GET /admin/packages/validate/regional

# Test suite
GET /test/regional-catalog/all
```

---

## 🎉 Quick Win Example

```typescript
// 1. Create package
POST /admin/packages
{
  "packageName": "Pet Wellness Package",
  "category": "veterinary",
  "regionalAvailability": { "mode": "all", "regions": [] },
  "regionalPricing": [
    { "regionId": "india", "basePrice": 1000, "currency": "INR", "symbol": "₹" }
  ]
}

// 2. View in India
GET /packages/by-region/india
// Shows: ₹1,180 (₹1,000 + 18% GST)

// 3. Add USA pricing
PUT /admin/packages/pkg_xxx
{
  "regionalPricing": [
    { "regionId": "india", "basePrice": 1000, "currency": "INR", "symbol": "₹" },
    { "regionId": "usa", "basePrice": 100, "currency": "USD", "symbol": "$" }
  ]
}

// 4. View in USA
GET /packages/by-region/usa
// Shows: $100 (no tax in USA template)
```

---

**Phase 1 Backend: COMPLETE ✅**  
**Ready for Phase 2: Admin UI** 🚀
