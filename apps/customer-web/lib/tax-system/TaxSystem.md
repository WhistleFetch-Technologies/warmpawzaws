# Flexible Tax System Architecture

## Overview

This document defines a flexible, rule-based tax system that can handle multiple tax types (GST, Service Tax, Education Cess, etc.) with different rates based on products, services, categories, and other rules.

---

## Indian Tax System Research

### GST (Goods and Services Tax)
- **CGST** (Central GST): Collected by Central Government
- **SGST** (State GST): Collected by State Government  
- **IGST** (Integrated GST): For inter-state transactions
- **GST Rates**: 0%, 5%, 12%, 18%, 28% (with cess on certain items)

### Service Tax (Pre-GST Era, may still apply in some contexts)
- **Service Tax**: 15% (before GST)
- **Swachh Bharat Cess**: 0.5% on service tax
- **Krishi Kalyan Cess**: 0.5% on service tax
- **Education Cess**: 2% on service tax
- **Secondary and Higher Education Cess**: 1% on service tax

### Cess
- **Health and Education Cess**: 4% on income tax
- **GST Cess**: Additional cess on specific items (luxury cars, tobacco, etc.)
- **Infrastructure Cess**: On certain products

### Current Implementation (GST Era)
Most transactions now use GST, but the system should be flexible to support:
- Multiple tax types simultaneously
- Different rates for different categories
- Exemptions and special cases
- Future tax changes

---

## Tax Rule System Design

### Core Concepts

1. **Tax Type**: The type of tax (GST, Service Tax, Cess, etc.)
2. **Tax Rule**: A rule that determines when and how a tax applies
3. **Tax Rate**: The percentage or fixed amount to apply
4. **Tax Slab**: A combination of tax type + rate + applicable rules
5. **Tax Calculation**: The process of applying rules and calculating tax amount

---

## Tax Configuration Structure

```typescript
// Tax Types
type TaxType = 'gst' | 'service_tax' | 'education_cess' | 'infrastructure_cess' | 'custom';

// Tax Calculation Method
type TaxCalculationMethod = 'percentage' | 'fixed' | 'compound';

// Tax Applicability Rule
interface TaxRule {
  id: string;
  name: string;
  taxType: TaxType;
  rate: number; // Percentage (e.g., 18) or fixed amount
  calculationMethod: TaxCalculationMethod;
  
  // Rule Conditions (when this tax applies)
  conditions: {
    // Product/Service Filters
    categoryIds?: string[]; // Apply to specific categories
    serviceTypes?: string[]; // Apply to specific service types
    productTypes?: string[]; // Apply to specific product types
    vendorRoles?: string[]; // Apply to specific vendor roles
    
    // Transaction Filters
    transactionType?: 'product' | 'service' | 'both';
    minAmount?: number; // Minimum transaction amount
    maxAmount?: number; // Maximum transaction amount
    
    // Geographic Filters (future)
    states?: string[]; // Apply to specific states
    pincodes?: string[]; // Apply to specific pincodes
    
    // Date Range (future)
    validFrom?: Date;
    validTo?: Date;
  };
  
  // Priority (lower number = higher priority)
  priority: number;
  
  // Exemptions
  exemptions?: {
    categoryIds?: string[]; // Categories exempt from this tax
    productIds?: string[]; // Specific products exempt
    serviceIds?: string[]; // Specific services exempt
  };
  
  // Compound Tax (tax on tax)
  compoundOnTaxIds?: string[]; // Calculate this tax on top of other taxes
}

// Tax Configuration
interface TaxConfiguration {
  rules: TaxRule[];
  defaultRule?: TaxRule; // Default rule if no rules match
}
```

---

## Example Tax Rules

### Example 1: Standard GST (18%)
```typescript
{
  id: 'gst_standard_18',
  name: 'Standard GST 18%',
  taxType: 'gst',
  rate: 18,
  calculationMethod: 'percentage',
  conditions: {
    transactionType: 'both',
    // Applies to all products/services by default
  },
  priority: 100
}
```

### Example 2: GST Exempt Categories (0%)
```typescript
{
  id: 'gst_exempt_food',
  name: 'GST Exempt - Food Products',
  taxType: 'gst',
  rate: 0,
  calculationMethod: 'percentage',
  conditions: {
    categoryIds: ['food_products', 'pet_food'],
    transactionType: 'product'
  },
  priority: 50 // Higher priority (lower number) for exemptions
}
```

### Example 3: Reduced GST (5%)
```typescript
{
  id: 'gst_reduced_5',
  name: 'Reduced GST 5% - Essential Items',
  taxType: 'gst',
  rate: 5,
  calculationMethod: 'percentage',
  conditions: {
    categoryIds: ['medicines', 'healthcare_products'],
    transactionType: 'product'
  },
  priority: 50
}
```

### Example 4: Service Tax (Pre-GST Era)
```typescript
{
  id: 'service_tax_15',
  name: 'Service Tax 15%',
  taxType: 'service_tax',
  rate: 15,
  calculationMethod: 'percentage',
  conditions: {
    transactionType: 'service',
    // Apply only to services
  },
  priority: 100
}
```

### Example 5: Education Cess on Service Tax
```typescript
{
  id: 'education_cess_service_tax',
  name: 'Education Cess 2% on Service Tax',
  taxType: 'education_cess',
  rate: 2,
  calculationMethod: 'compound', // Calculated on service tax
  compoundOnTaxIds: ['service_tax_15'],
  conditions: {
    transactionType: 'service'
  },
  priority: 200
}
```

### Example 6: GST Cess on Luxury Items (28% + Cess)
```typescript
{
  id: 'gst_luxury_28',
  name: 'GST Luxury Items 28%',
  taxType: 'gst',
  rate: 28,
  calculationMethod: 'percentage',
  conditions: {
    categoryIds: ['luxury_items', 'premium_products'],
    transactionType: 'product'
  },
  priority: 50
},
{
  id: 'gst_cess_luxury',
  name: 'GST Cess on Luxury Items',
  taxType: 'infrastructure_cess',
  rate: 15, // 15% cess on luxury items
  calculationMethod: 'compound',
  compoundOnTaxIds: ['gst_luxury_28'],
  conditions: {
    categoryIds: ['luxury_items'],
    transactionType: 'product'
  },
  priority: 200
}
```

---

## Tax Calculation Flow

1. **Identify Applicable Rules**: Filter rules based on transaction context (category, service type, amount, etc.)
2. **Sort by Priority**: Apply higher priority rules first
3. **Check Exemptions**: Skip rules if item is exempt
4. **Calculate Base Taxes**: Calculate percentage or fixed amount taxes
5. **Calculate Compound Taxes**: Calculate taxes on top of base taxes
6. **Aggregate**: Sum all applicable taxes
7. **Return Breakdown**: Return detailed tax breakdown and total

---

## Tax Calculation Algorithm

```typescript
function calculateTax(items: TaxableItem[], configuration: TaxConfiguration): TaxResult {
  const applicableRules: TaxRule[] = [];
  const taxBreakdown: TaxBreakdown[] = [];
  
  // For each item, find applicable rules
  for (const item of items) {
    const itemRules = findApplicableRules(item, configuration.rules);
    
    // Sort by priority (lower = higher priority)
    itemRules.sort((a, b) => a.priority - b.priority);
    
    // Apply rules
    for (const rule of itemRules) {
      // Check exemptions
      if (isExempt(item, rule)) continue;
      
      // Calculate base tax
      const baseTax = calculateBaseTax(item, rule);
      
      // Calculate compound taxes (if any)
      const compoundTaxes = calculateCompoundTaxes(baseTax, rule, taxBreakdown);
      
      taxBreakdown.push({
        ruleId: rule.id,
        ruleName: rule.name,
        taxType: rule.taxType,
        rate: rule.rate,
        baseAmount: item.amount,
        taxAmount: baseTax + compoundTaxes,
        itemId: item.id
      });
    }
  }
  
  // Aggregate taxes by type
  const aggregated = aggregateByTaxType(taxBreakdown);
  
  return {
    breakdown: taxBreakdown,
    byType: aggregated,
    total: sum(taxBreakdown.map(t => t.taxAmount)),
    subtotal: sum(items.map(i => i.amount))
  };
}
```

---

## Implementation Strategy

### Phase 1: Core Tax System
1. Create tax configuration structure
2. Implement tax rule engine
3. Create tax calculation service
4. Default configuration with GST rules

### Phase 2: Integration
1. Update checkout flows to use tax system
2. Update cart calculations
3. Update order creation to include tax breakdown

### Phase 3: Advanced Features
1. Admin UI for tax configuration
2. API endpoints for tax management
3. Tax reporting and analytics
4. Multi-state tax support (IGST/CGST/SGST)

---

## Default Tax Configuration (GST Era)

```typescript
const DEFAULT_TAX_CONFIGURATION: TaxConfiguration = {
  rules: [
    // GST Exempt (0%)
    {
      id: 'gst_exempt_food',
      name: 'GST Exempt - Food Products',
      taxType: 'gst',
      rate: 0,
      calculationMethod: 'percentage',
      conditions: {
        categoryIds: ['food_products', 'unprocessed_food'],
        transactionType: 'product'
      },
      priority: 10
    },
    
    // Reduced GST (5%)
    {
      id: 'gst_reduced_5',
      name: 'GST Reduced 5% - Essential Items',
      taxType: 'gst',
      rate: 5,
      calculationMethod: 'percentage',
      conditions: {
        categoryIds: ['medicines', 'healthcare_products', 'food_products'],
        transactionType: 'product'
      },
      priority: 20
    },
    
    // Standard GST (12%)
    {
      id: 'gst_standard_12',
      name: 'GST Standard 12%',
      taxType: 'gst',
      rate: 12,
      calculationMethod: 'percentage',
      conditions: {
        categoryIds: ['processed_food', 'restaurant_services'],
        transactionType: 'both'
      },
      priority: 30
    },
    
    // Standard GST (18%) - Default
    {
      id: 'gst_standard_18',
      name: 'GST Standard 18%',
      taxType: 'gst',
      rate: 18,
      calculationMethod: 'percentage',
      conditions: {
        transactionType: 'both'
      },
      priority: 100 // Lower priority - applied when no other rules match
    },
    
    // High GST (28%)
    {
      id: 'gst_high_28',
      name: 'GST High 28% - Luxury Items',
      taxType: 'gst',
      rate: 28,
      calculationMethod: 'percentage',
      conditions: {
        categoryIds: ['luxury_items', 'premium_products'],
        transactionType: 'product'
      },
      priority: 20
    }
  ],
  
  defaultRule: {
    id: 'gst_default_18',
    name: 'Default GST 18%',
    taxType: 'gst',
    rate: 18,
    calculationMethod: 'percentage',
    conditions: {},
    priority: 1000
  }
};
```

---

## Future Extensibility

The system is designed to support:
- **Multiple Tax Types**: GST, Service Tax, Cess, Custom taxes
- **Complex Rules**: Category-based, amount-based, date-based, geographic
- **Compound Taxes**: Tax on tax (e.g., Education Cess on Service Tax)
- **Exemptions**: Category-level, product-level, service-level
- **Multi-State**: IGST/CGST/SGST support
- **Admin Configuration**: UI to manage tax rules without code changes

