# Tax Management Integration Flow - Visual Diagram

## Complete System Integration Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TAX MANAGEMENT SYSTEM                            │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                           ADMIN WEB APP                                   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Finance & Logistics → Tax Management                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │ │
│  │  │ Tax Rules    │  │ HSN Codes    │  │ Tax Categories│            │ │
│  │  │ Manager      │  │ Manager      │  │ Manager       │            │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │ │
│  └─────────┼──────────────────┼──────────────────┼────────────────────┘ │
│            │                  │                  │                      │
│            └──────────────────┴──────────────────┘                      │
│                              │                                            │
│                              ▼                                            │
│                    ┌─────────────────────┐                              │
│                    │  Admin API Endpoints │                              │
│                    │  /admin/tax-rules    │                              │
│                    │  /admin/hsn-codes    │                              │
│                    │  /admin/tax-categories│                             │
│                    └──────────┬────────────┘                              │
└───────────────────────────────┼──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICES                                  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    Tax Calculation Service                          │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │ 1. Get Items (Products/Services)                              │ │ │
│  │  │ 2. Lookup HSN Codes                                           │ │ │
│  │  │ 3. Get Customer/Vendor Locations                              │ │ │
│  │  │ 4. Match Tax Rules (Priority-based)                           │ │ │
│  │  │ 5. Calculate CGST/SGST/IGST                                   │ │ │
│  │  │ 6. Generate Tax Breakdown                                     │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
┌───────────────────────────┐    ┌───────────────────────────┐
│    CUSTOMER APP           │    │    VENDOR APP             │
│                           │    │                           │
│  ┌─────────────────────┐  │    │  ┌─────────────────────┐  │
│  │ Booking Flow        │  │    │  │ Payment Receipt     │  │
│  │ 1. Select Service   │  │    │  │ - Tax Breakdown    │  │
│  │ 2. View Tax        │  │    │  │ - HSN Codes        │  │
│  │ 3. Make Payment    │  │    │  │ - GST Details      │  │
│  └─────────┬───────────┘  │    │  └─────────┬───────────┘  │
│            │              │    │            │              │
│  ┌─────────▼───────────┐  │    │  ┌─────────▼───────────┐  │
│  │ Order Creation      │  │    │  │ Settlement View     │  │
│  │ POST /orders        │  │    │  │ - Tax in Settlement │  │
│  │ → Tax Calculated    │  │    │  │ - Commission Calc   │  │
│  └─────────┬───────────┘  │    │  └─────────┬───────────┘  │
│            │              │    │            │              │
│  ┌─────────▼───────────┐  │    │  ┌─────────▼───────────┐  │
│  │ Payment Processing  │  │    │  │ Invoice Generation  │  │
│  │ POST /payments      │  │    │  │ POST /vendor/invoices│ │
│  │ → Tax Stored       │  │    │  │ → Tax Included      │  │
│  └─────────┬───────────┘  │    │  └─────────┬───────────┘  │
│            │              │    │            │              │
│  ┌─────────▼───────────┐  │    └────────────┼──────────────┘
│  │ Invoice Display     │  │                 │
│  │ GET /orders/:id/   │  │                 │
│  │    invoice         │  │                 │
│  │ → HSN Codes        │  │                 │
│  │ → Tax Breakdown    │  │                 │
│  └────────────────────┘  │                 │
└───────────────────────────┘                 │
                                               │
                                               ▼
                          ┌────────────────────────────┐
                          │      DATABASE (RDS)         │
                          │                            │
                          │  ┌──────────────────────┐ │
                          │  │ gst_rules            │ │
                          │  │ hsn_codes            │ │
                          │  │ tax_categories       │ │
                          │  │ orders (tax_breakdown)│ │
                          │  │ payments (gst_*)     │ │
                          │  │ invoices (hsn_codes) │ │
                          │  └──────────────────────┘ │
                          └────────────────────────────┘
```

## Tax Rule Application Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              TAX RULE MATCHING PROCESS                          │
└─────────────────────────────────────────────────────────────────┘

Item Received
     │
     ▼
┌─────────────────┐
│ Extract Item    │
│ Details:        │
│ - Type          │
│ - HSN Code      │
│ - Category      │
│ - Service Style │
│ - Role          │
│ - Amount        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Get Locations   │
│ - Customer State│
│ - Vendor State  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│ Query Tax Rules (Priority-based)                │
│                                                 │
│ SELECT * FROM gst_rules                         │
│ WHERE enabled = true                            │
│   AND (role_id IS NULL OR role_id = ?)         │
│   AND (service_style IS NULL OR = ?)           │
│   AND (category IS NULL OR = ?)                │
│   AND (customer_state IS NULL OR = ?)          │
│   AND (vendor_state IS NULL OR = ?)            │
│   AND (min_amount IS NULL OR <= ?)             │
│   AND (max_amount IS NULL OR >= ?)             │
│ ORDER BY priority DESC                          │
│ LIMIT 1                                         │
└────────┬────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Rule Found?     │
└────┬───────┬────┘
     │       │
    YES      NO
     │       │
     ▼       ▼
┌─────────┐ ┌──────────────┐
│ Use Rule│ │ Use Default  │
│ GST Rate│ │ (18% GST)    │
└────┬────┘ └──────┬───────┘
     │             │
     └──────┬──────┘
            │
            ▼
┌─────────────────┐
│ Check HSN Code  │
│ (if available)  │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ HSN Rate        │
│ Overrides Rule? │
└────┬───────┬────┘
     │       │
    YES      NO
     │       │
     ▼       ▼
┌─────────┐ ┌─────────┐
│ Use HSN │ │ Use Rule│
│ Rate    │ │ Rate    │
└────┬────┘ └────┬────┘
     │           │
     └─────┬─────┘
           │
           ▼
┌──────────────────────┐
│ Determine Tax Type   │
│                      │
│ Same State?          │
│   → CGST + SGST      │
│                      │
│ Different States?    │
│   → IGST             │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Calculate Tax        │
│                      │
│ Base × Rate = Tax    │
│                      │
│ Return Breakdown:    │
│ - Per Item Tax       │
│ - CGST/SGST/IGST     │
│ - HSN Summary        │
│ - Grand Total        │
└──────────────────────┘
```

## Example: Complete Transaction Flow

```
CUSTOMER APP                    BACKEND                        DATABASE
     │                            │                              │
     │─── Create Booking ────────>│                              │
     │                            │─── Get Service ────────────>│
     │                            │<── Service + HSN Code ──────│
     │                            │                              │
     │                            │─── Get Locations ──────────>│
     │                            │<── Customer/Vendor States ──│
     │                            │                              │
     │                            │─── Calculate Tax ──────────>│
     │                            │    (Tax Calculation Service) │
     │                            │                              │
     │                            │─── Match Tax Rules ────────>│
     │                            │<── Rule Selected ────────────│
     │                            │                              │
     │                            │─── Lookup HSN Code ────────>│
     │                            │<── HSN Rate ────────────────│
     │                            │                              │
     │                            │─── Calculate CGST/SGST/IGST│
     │                            │                              │
     │                            │─── Store Booking ──────────>│
     │                            │    (with tax breakdown)      │
     │<── Booking Created ────────│                              │
     │    (with tax)              │                              │
     │                            │                              │
     │─── Create Payment ─────────>│                              │
     │                            │─── Get Booking ────────────>│
     │                            │<── Booking + Tax ───────────│
     │                            │                              │
     │                            │─── Store Payment ──────────>│
     │                            │    (with tax amounts)        │
     │<── Payment Created ────────│                              │
     │    (with tax breakdown)    │                              │
     │                            │                              │
     │─── View Invoice ──────────>│                              │
     │                            │─── Get Order ──────────────>│
     │                            │<── Order + Tax Breakdown ────│
     │                            │                              │
     │                            │─── Format Invoice ─────────│
     │<── Invoice ───────────────│                              │
     │    (HSN codes + tax)       │                              │
     │                            │                              │
```

## Tax Rule Priority Example

```
Priority 999 (Lowest - Default)
    │
    │  Rule: Default GST
    │  Conditions: None
    │  GST: 18%
    │
    ▼
Priority 500
    │
    │  Rule: Veterinarian Services
    │  Conditions: Role = Veterinarian
    │  GST: 12%
    │
    ▼
Priority 300
    │
    │  Rule: At-Home Services
    │  Conditions: Service Style = at_home
    │  GST: 15%
    │
    ▼
Priority 200
    │
    │  Rule: Pet Food Category
    │  Conditions: Category = Pet Food
    │  GST: 5%
    │
    ▼
Priority 100 (Highest)
    │
    │  Rule: Premium Services
    │  Conditions: Role = Veterinarian
    │             AND Service Style = at_home
    │             AND Amount > 5000
    │  GST: 10%
    │
    ▼
    Selected Rule (Highest Priority that Matches)
```

## Integration Points Summary

### Customer App
1. **Booking Creation** → Tax calculated automatically
2. **Payment Processing** → Tax included in payment
3. **Invoice View** → Tax breakdown displayed

### Vendor App
1. **Payment Receipt** → Tax breakdown shown
2. **Settlement View** → Tax included
3. **Invoice Generation** → Tax calculated

### Admin Web
1. **Tax Management** → CRUD for rules, HSN codes, categories
2. **Finance & Logistics** → Tax Management tab
3. **Rule Configuration** → Priority and conditions

---

**Status**: ✅ All Integration Points Tested and Working

