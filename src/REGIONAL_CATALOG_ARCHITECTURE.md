# 🏗️ Regional Catalog Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        WARMPAWZ PLATFORM                         │
│                   Multi-Region Service Catalog                   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
        ┌────────────────────────────────────────────┐
        │         REGION CONFIGURATION              │
        │  (Phase 1.5 - Already Complete)          │
        ├────────────────────────────────────────────┤
        │ • India   - Active ✅                     │
        │ • USA     - Inactive                      │
        │ • UAE     - Inactive                      │
        │ • Singapore - Inactive                    │
        │                                           │
        │ Each Region has:                          │
        │ ├─ Currency (₹, $, AED, S$)              │
        │ ├─ Tax Settings (GST, VAT, etc)          │
        │ ├─ Service Catalog (enabled services)     │
        │ └─ Phone/Localization config              │
        └────────────────────────────────────────────┘
                                 │
                                 ▼
        ┌────────────────────────────────────────────┐
        │      REGIONAL PACKAGE CONFIGURATION       │
        │     (Phase 1 Backend - THIS PHASE)        │
        ├────────────────────────────────────────────┤
        │                                           │
        │  Package: "Basic Vet Checkup"            │
        │  ┌─────────────────────────────────────┐ │
        │  │ Regional Availability               │ │
        │  │ mode: "specific"                    │ │
        │  │ regions: ["india", "singapore"]     │ │
        │  └─────────────────────────────────────┘ │
        │                                           │
        │  ┌─────────────────────────────────────┐ │
        │  │ Regional Pricing                    │ │
        │  │ India:                              │ │
        │  │   basePrice: 500                    │ │
        │  │   currency: "INR"                   │ │
        │  │   symbol: "₹"                       │ │
        │  │                                     │ │
        │  │ Singapore:                          │ │
        │  │   basePrice: 50                     │ │
        │  │   currency: "SGD"                   │ │
        │  │   symbol: "S$"                      │ │
        │  └─────────────────────────────────────┘ │
        └────────────────────────────────────────────┘
                                 │
                                 ▼
        ┌────────────────────────────────────────────┐
        │        AUTOMATIC FILTERING ENGINE         │
        │     (Phase 1 Backend - THIS PHASE)        │
        ├────────────────────────────────────────────┤
        │                                           │
        │  Customer Region: India                   │
        │                                           │
        │  Filter Rules:                            │
        │  ├─ Rule 1: Service category enabled?    │
        │  │          ✅ veterinary = true         │
        │  │                                       │
        │  ├─ Rule 2: Package available?           │
        │  │          ✅ "india" in regions        │
        │  │                                       │
        │  └─ Rule 3: Has pricing?                 │
        │             ✅ India pricing exists       │
        │                                           │
        │  Result: ✅ SHOW PACKAGE                 │
        │  Price: ₹590 (500 + 18% GST)            │
        └────────────────────────────────────────────┘
                                 │
                                 ▼
        ┌────────────────────────────────────────────┐
        │           CUSTOMER EXPERIENCE             │
        │        (Phase 3 - Coming Soon)            │
        ├────────────────────────────────────────────┤
        │                                           │
        │  Customer sees:                           │
        │  ✅ Basic Vet Checkup - ₹590             │
        │  ✅ Premium Grooming - ₹1,180            │
        │  ✅ Dog Training - ₹5,900                │
        │                                           │
        │  Customer does NOT see:                   │
        │  ❌ Packages not available in India      │
        │  ❌ Packages without India pricing       │
        │  ❌ Disabled service categories          │
        └────────────────────────────────────────────┘
```

---

## Three-Level Filtering System

```
┌──────────────────────────────────────────────────────────────────┐
│                         LEVEL 1                                   │
│                  REGION SERVICE CATALOG                           │
│                   (High-level Control)                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Region: UAE                                                      │
│  ┌────────────────────────────────────────────────────┐         │
│  │ serviceCatalog:                                     │         │
│  │   veterinary: true   ✅                            │         │
│  │   grooming: true     ✅                            │         │
│  │   training: true     ✅                            │         │
│  │   sunset: false      ❌ (Cultural reasons)         │         │
│  │   petCafe: false     ❌ (Not common)               │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                   │
│  Effect: ALL sunset and petCafe packages hidden in UAE           │
└──────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                         LEVEL 2                                   │
│              PACKAGE REGIONAL AVAILABILITY                        │
│                  (Granular Control)                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Package: "Pet Cafe Experience"                                   │
│  ┌────────────────────────────────────────────────────┐         │
│  │ regionalAvailability:                               │         │
│  │   mode: "specific"                                  │         │
│  │   regions: ["india", "singapore"]                   │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                   │
│  Effect: Package ONLY shows in India and Singapore                │
└──────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                         LEVEL 3                                   │
│                   AUTOMATIC FILTERING                             │
│                   (System Enforcement)                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Customer in USA requests packages:                               │
│                                                                   │
│  Package A: "Emergency Vet Call"                                  │
│  ├─ Level 1: veterinary enabled in USA? ✅ Yes                   │
│  ├─ Level 2: Available in USA? ✅ Yes (mode: "all")              │
│  └─ Level 3: Has USA pricing? ✅ Yes ($100)                      │
│  Result: ✅ SHOW - Price: $100                                   │
│                                                                   │
│  Package B: "Pet Cafe Experience"                                 │
│  ├─ Level 1: petCafe enabled in USA? ❌ No                       │
│  Result: ❌ HIDE                                                 │
│                                                                   │
│  Package C: "Traditional Grooming"                                │
│  ├─ Level 1: grooming enabled in USA? ✅ Yes                     │
│  ├─ Level 2: Available in USA? ❌ No (mode: "exclude" USA)       │
│  Result: ❌ HIDE                                                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Architecture

```
┌─────────────┐
│   ADMIN     │
│   PORTAL    │
└──────┬──────┘
       │
       │ 1. Create Package
       │    with Regional Config
       ▼
┌─────────────────────────────────────────┐
│  POST /admin/packages                   │
│                                         │
│  {                                      │
│    packageName: "...",                  │
│    regionalAvailability: {...},        │
│    regionalPricing: [...]               │
│  }                                      │
└────────┬────────────────────────────────┘
         │
         │ 2. Validate & Store
         ▼
┌─────────────────────────────────────────┐
│  KV STORE                               │
│                                         │
│  package:pkg_123 → {                    │
│    id: "pkg_123",                       │
│    regionalAvailability: {...},        │
│    regionalPricing: [...]               │
│  }                                      │
└────────┬────────────────────────────────┘
         │
         │ 3. Customer Requests
         ▼
┌─────────────────────────────────────────┐
│  CUSTOMER APP                           │
│                                         │
│  User Region: India                     │
│  GET /packages/by-region/india          │
└────────┬────────────────────────────────┘
         │
         │ 4. Filter & Enrich
         ▼
┌─────────────────────────────────────────┐
│  FILTERING ENGINE                       │
│                                         │
│  1. Get region config                   │
│  2. Get all packages                    │
│  3. Apply 3-level filtering             │
│  4. Enrich with regional pricing        │
│  5. Calculate tax                       │
└────────┬────────────────────────────────┘
         │
         │ 5. Return Filtered Results
         ▼
┌─────────────────────────────────────────┐
│  RESPONSE                               │
│                                         │
│  {                                      │
│    packages: [                          │
│      {                                  │
│        packageName: "...",              │
│        currentRegionPricing: {          │
│          basePrice: 500,                │
│          taxAmount: 90,                 │
│          finalPrice: 590,               │
│          symbol: "₹"                    │
│        }                                │
│      }                                  │
│    ]                                    │
│  }                                      │
└─────────────────────────────────────────┘
```

---

## Package Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        PACKAGE CREATION                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Admin Creates Package │
                    │  with Regional Config  │
                    └────────┬───────────────┘
                             │
                ┌────────────┴───────────┐
                │                        │
                ▼                        ▼
    ┌───────────────────────┐  ┌───────────────────────┐
    │  Validate Regions     │  │  Validate Pricing     │
    │  - Regions exist?     │  │  - All regions priced?│
    │  - Mode valid?        │  │  - Prices valid?      │
    └───────────┬───────────┘  └───────────┬───────────┘
                │                           │
                └───────────┬───────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   Store in KV Store   │
                │   package:pkg_xxx     │
                └───────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Customer App │  │ Vendor Portal│  │ Admin Portal │
│ See Package  │  │ Offer Package│  │ Manage Package│
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Regional Pricing Calculation

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRICING CALCULATION FLOW                      │
└─────────────────────────────────────────────────────────────────┘

Package: "Basic Vet Checkup"
Region: India

Step 1: Get Base Price
┌────────────────────────┐
│ regionalPricing        │
│   regionId: "india"    │
│   basePrice: 500       │ ──────► ₹500
│   currency: "INR"      │
│   symbol: "₹"          │
└────────────────────────┘

Step 2: Get Tax Rate
┌────────────────────────┐
│ Region Config          │
│   business.taxRate: 18 │ ──────► 18%
│   business.taxName: GST│
└────────────────────────┘

Step 3: Calculate Tax
┌────────────────────────┐
│ Tax Calculation        │
│ 500 × 18 / 100        │ ──────► ₹90
└────────────────────────┘

Step 4: Calculate Final Price
┌────────────────────────┐
│ Final Price            │
│ 500 + 90              │ ──────► ₹590
└────────────────────────┘

Step 5: Format for Display
┌────────────────────────┐
│ Display Format         │
│ ₹590 (incl. GST)      │
└────────────────────────┘
```

---

## Multi-Region Launch Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     LAUNCHING NEW REGION                         │
└─────────────────────────────────────────────────────────────────┘

Phase 1: Region Setup (30 seconds)
┌────────────────────────────────────────┐
│ Admin Portal → Region Manager          │
│                                        │
│ 1. Click "Create Region"               │
│ 2. Select Template: "Singapore"        │
│ 3. Review Settings                     │
│ 4. Click "Save"                        │
│                                        │
│ Result: Singapore region created ✅    │
└────────────────────────────────────────┘
                    │
                    ▼
Phase 2: Package Pricing (1 minute)
┌────────────────────────────────────────┐
│ POST /admin/packages/add-region        │
│                                        │
│ {                                      │
│   regionId: "singapore",               │
│   defaultBasePrice: 50                 │
│ }                                      │
│                                        │
│ Result: 45 packages updated ✅         │
└────────────────────────────────────────┘
                    │
                    ▼
Phase 3: Validation (30 seconds)
┌────────────────────────────────────────┐
│ GET /admin/packages/validate/regional  │
│                                        │
│ Result:                                │
│   valid: 45                            │
│   invalid: 0                           │
│   issues: []                           │
│                                        │
│ All packages ready ✅                  │
└────────────────────────────────────────┘
                    │
                    ▼
Phase 4: Activation (10 seconds)
┌────────────────────────────────────────┐
│ Admin Portal → Region Manager          │
│                                        │
│ 1. Select Singapore                    │
│ 2. Toggle "isActive" to true           │
│ 3. Click "Save"                        │
│                                        │
│ Result: Singapore LIVE! ✅             │
└────────────────────────────────────────┘
                    │
                    ▼
Phase 5: Customer Experience
┌────────────────────────────────────────┐
│ Customer in Singapore                  │
│                                        │
│ GET /packages/by-region/singapore      │
│                                        │
│ Sees:                                  │
│ ✅ 45 packages                         │
│ ✅ Prices in S$                        │
│ ✅ Tax calculated (8% GST)             │
│                                        │
│ Region launch complete! 🎉             │
└────────────────────────────────────────┘

Total Time: < 3 minutes
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING                              │
└─────────────────────────────────────────────────────────────────┘

Scenario 1: Invalid Region
┌────────────────────────┐
│ GET /packages/by-      │
│     region/invalid     │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ Check Region Exists    │
│ Result: NOT FOUND      │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ Return Error           │
│ 404: Region not found  │
└────────────────────────┘

Scenario 2: Missing Pricing
┌────────────────────────┐
│ POST /admin/packages   │
│ (missing pricing)      │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ Validate Pricing       │
│ Result: MISSING        │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ Return Error           │
│ 400: Missing pricing   │
│      for regions       │
└────────────────────────┘

Scenario 3: Package Not Available
┌────────────────────────┐
│ GET /packages/pkg_123/ │
│     region/usa         │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ Check Availability     │
│ Result: NOT AVAILABLE  │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ Return Error           │
│ 404: Package not       │
│      available in USA  │
└────────────────────────┘
```

---

## Performance Optimization

```
┌─────────────────────────────────────────────────────────────────┐
│                   PERFORMANCE STRATEGY                           │
└─────────────────────────────────────────────────────────────────┘

Caching Strategy:
┌────────────────────────────────────────┐
│ Region Configuration                   │
│ Cache Duration: 1 hour                 │
│ Invalidate on: Region update           │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Package List per Region                │
│ Cache Duration: 5 minutes              │
│ Invalidate on: Package create/update   │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Regional Pricing                       │
│ Cache Duration: 10 minutes             │
│ Invalidate on: Pricing update          │
└────────────────────────────────────────┘

Query Optimization:
┌────────────────────────────────────────┐
│ Use getByPrefix for bulk operations    │
│ Filter in memory (small dataset)       │
│ Index by: regionId, category           │
└────────────────────────────────────────┘
```

---

## Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS                             │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Authentication
┌────────────────────────────────────────┐
│ All requests require Bearer token      │
│ Authorization: Bearer ${publicAnonKey} │
└────────────────────────────────────────┘

Layer 2: Authorization
┌────────────────────────────────────────┐
│ Admin endpoints: Admin role required   │
│ Vendor endpoints: Vendor role required │
│ Customer endpoints: Public access      │
└────────────────────────────────────────┘

Layer 3: Validation
┌────────────────────────────────────────┐
│ Input validation on all endpoints      │
│ Region existence check                 │
│ Pricing completeness check             │
│ Price validity check (> 0)             │
└────────────────────────────────────────┘

Layer 4: Business Rules
┌────────────────────────────────────────┐
│ Service category must be enabled       │
│ Package must be available in region    │
│ Pricing must exist for region          │
│ Inactive regions hidden from customers │
└────────────────────────────────────────┘
```

---

## Monitoring & Analytics

```
┌─────────────────────────────────────────────────────────────────┐
│                    KEY METRICS TO TRACK                          │
└─────────────────────────────────────────────────────────────────┘

Business Metrics:
┌────────────────────────────────────────┐
│ • Packages per region                  │
│ • Revenue per region                   │
│ • Popular packages by region           │
│ • Conversion rate by region            │
└────────────────────────────────────────┘

Technical Metrics:
┌────────────────────────────────────────┐
│ • API response time                    │
│ • Filtering performance                │
│ • Cache hit rate                       │
│ • Validation failure rate              │
└────────────────────────────────────────┘

Operational Metrics:
┌────────────────────────────────────────┐
│ • Active regions count                 │
│ • Total packages count                 │
│ • Packages with regional config %      │
│ • Invalid packages count               │
└────────────────────────────────────────┘
```

---

## Future Enhancements

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROADMAP (Post Phase 1)                        │
└─────────────────────────────────────────────────────────────────┘

Phase 2: Admin UI
├─ RegionalAvailabilitySelector component
├─ RegionalPricingEditor component
├─ Package creation/edit forms
└─ Active Packages tab in Region Manager

Phase 3: Customer App
├─ Automatic region detection
├─ Regional package display
├─ Regional pricing display
└─ Booking with regional data

Phase 4: Vendor Portal
├─ Regional service filters
├─ Regional pricing defaults
└─ Regional constraints

Phase 5: Advanced Features
├─ Dynamic pricing by region
├─ Regional promotions
├─ Regional analytics dashboard
├─ A/B testing by region
└─ Regional conversion optimization
```

---

**Architecture Documentation Complete** ✅  
**Phase 1 Backend: Fully Implemented** 🚀
