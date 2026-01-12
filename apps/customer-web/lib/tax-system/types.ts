/**
 * ============================================================================
 * TAX SYSTEM TYPES
 * ============================================================================
 * 
 * Flexible tax system that supports multiple tax types (GST, Service Tax,
 * Education Cess, etc.) with rule-based tax calculation.
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

// ============================================================================
// TAX TYPES
// ============================================================================

export type TaxType = 
  | 'gst'                    // Goods and Services Tax (CGST + SGST or IGST)
  | 'cgst'                   // Central GST
  | 'sgst'                   // State GST
  | 'igst'                   // Integrated GST (inter-state)
  | 'service_tax'            // Service Tax (pre-GST era, may still apply)
  | 'education_cess'         // Education Cess (on service tax or income tax)
  | 'swachh_bharat_cess'     // Swachh Bharat Cess
  | 'krishi_kalyan_cess'     // Krishi Kalyan Cess
  | 'infrastructure_cess'    // Infrastructure Cess (GST Cess on luxury items)
  | 'custom';                // Custom tax types

export type TaxCalculationMethod = 
  | 'percentage'             // Percentage of base amount (e.g., 18%)
  | 'fixed'                  // Fixed amount per item/transaction
  | 'compound';              // Percentage of another tax amount (tax on tax)

export type TransactionType = 
  | 'product'                // Product purchase
  | 'service'                // Service booking
  | 'both';                  // Both product and service

// ============================================================================
// TAX RULE CONDITIONS
// ============================================================================

export interface TaxRuleConditions {
  // Product/Service Filters
  categoryIds?: string[];              // Apply to specific categories
  subCategoryIds?: string[];           // Apply to specific sub-categories
  serviceTypes?: string[];             // Apply to specific service types (at_center, at_home, tele, etc.)
  productTypes?: string[];             // Apply to specific product types
  vendorRoles?: string[];              // Apply to specific vendor roles
  serviceIds?: string[];               // Apply to specific services
  productIds?: string[];               // Apply to specific products
  
  // Transaction Filters
  transactionType?: TransactionType;   // Apply to products, services, or both
  minAmount?: number;                  // Minimum transaction amount
  maxAmount?: number;                  // Maximum transaction amount
  minQuantity?: number;                // Minimum quantity
  maxQuantity?: number;                // Maximum quantity
  
  // Geographic Filters (future)
  states?: string[];                   // Apply to specific states
  cities?: string[];                   // Apply to specific cities
  pincodes?: string[];                 // Apply to specific pincodes
  
  // Date Range (future)
  validFrom?: string;                  // ISO date string
  validTo?: string;                    // ISO date string
  
  // Customer Filters (future)
  customerTypes?: string[];            // B2B, B2C, etc.
}

// ============================================================================
// TAX EXEMPTIONS
// ============================================================================

export interface TaxExemptions {
  categoryIds?: string[];              // Categories exempt from this tax
  subCategoryIds?: string[];           // Sub-categories exempt
  productIds?: string[];               // Specific products exempt
  serviceIds?: string[];               // Specific services exempt
  vendorIds?: string[];                // Specific vendors exempt
  vendorRoles?: string[];              // Vendor roles exempt
  minAmount?: number;                  // Exempt if amount below this
  maxAmount?: number;                  // Exempt if amount above this
}

// ============================================================================
// TAX RULE
// ============================================================================

export interface TaxRule {
  id: string;                          // Unique rule ID
  name: string;                        // Human-readable rule name
  description?: string;                // Rule description
  taxType: TaxType;                    // Type of tax
  rate: number;                        // Tax rate (percentage or fixed amount)
  calculationMethod: TaxCalculationMethod; // How to calculate the tax
  
  // Rule Conditions (when this tax applies)
  conditions: TaxRuleConditions;
  
  // Priority (lower number = higher priority, applied first)
  priority: number;
  
  // Exemptions (items exempt from this tax even if conditions match)
  exemptions?: TaxExemptions;
  
  // Compound Tax (tax calculated on top of another tax)
  compoundOnTaxIds?: string[];         // Calculate this tax on top of these tax rule IDs
  compoundOnTaxType?: TaxType;         // Calculate this tax on top of this tax type
  
  // Status
  isActive: boolean;                   // Whether this rule is active
  createdAt?: string;                  // ISO date string
  updatedAt?: string;                  // ISO date string
}

// ============================================================================
// TAX CONFIGURATION
// ============================================================================

export interface TaxConfiguration {
  id?: string;                         // Configuration ID
  name: string;                        // Configuration name
  description?: string;                // Configuration description
  rules: TaxRule[];                    // Tax rules
  defaultRule?: TaxRule;               // Default rule if no rules match
  isActive: boolean;                   // Whether this configuration is active
  version?: string;                    // Configuration version
  createdAt?: string;                  // ISO date string
  updatedAt?: string;                  // ISO date string
}

// ============================================================================
// TAXABLE ITEM
// ============================================================================

export interface TaxableItem {
  id: string;                          // Item ID
  type: 'product' | 'service';         // Item type
  categoryId?: string;                 // Category ID
  subCategoryId?: string;              // Sub-category ID
  serviceType?: string;                // Service type (at_center, at_home, tele, etc.)
  vendorRole?: string;                 // Vendor role
  amount: number;                      // Base amount (before tax)
  quantity?: number;                   // Quantity
  vendorId?: string;                   // Vendor ID
  serviceId?: string;                  // Service ID (for services)
  productId?: string;                  // Product ID (for products)
}

// ============================================================================
// TAX BREAKDOWN
// ============================================================================

export interface TaxBreakdown {
  ruleId: string;                      // Tax rule ID
  ruleName: string;                    // Tax rule name
  taxType: TaxType;                    // Tax type
  rate: number;                        // Tax rate applied
  baseAmount: number;                  // Base amount this tax is calculated on
  taxAmount: number;                   // Tax amount
  itemId: string;                      // Item ID this tax applies to
  itemType: 'product' | 'service';     // Item type
  isCompound?: boolean;                // Whether this is a compound tax
  compoundOnRuleId?: string;           // If compound, the rule ID it compounds on
}

// ============================================================================
// TAX RESULT
// ============================================================================

export interface TaxByType {
  taxType: TaxType;                    // Tax type
  totalAmount: number;                 // Total tax amount for this type
  breakdown: TaxBreakdown[];           // Detailed breakdown
}

export interface TaxResult {
  subtotal: number;                    // Subtotal (before tax)
  breakdown: TaxBreakdown[];           // Detailed tax breakdown by item
  byType: TaxByType[];                 // Taxes aggregated by type
  total: number;                       // Total tax amount
  grandTotal: number;                  // Grand total (subtotal + tax)
  currency?: string;                   // Currency code (default: INR)
}

// ============================================================================
// TAX CALCULATION OPTIONS
// ============================================================================

export interface TaxCalculationOptions {
  configuration?: TaxConfiguration;    // Tax configuration to use (uses default if not provided)
  includeInactive?: boolean;           // Include inactive rules
  roundTo?: number;                    // Round to decimal places (default: 2)
  returnDetailed?: boolean;            // Return detailed breakdown (default: true)
}

