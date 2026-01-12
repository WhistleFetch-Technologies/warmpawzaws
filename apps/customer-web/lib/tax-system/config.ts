/**
 * ============================================================================
 * DEFAULT TAX CONFIGURATION
 * ============================================================================
 * 
 * Default GST-based tax configuration for Indian market.
 * This can be replaced with API-fetched configuration or admin-configured rules.
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { TaxConfiguration, TaxRule } from './types';

/**
 * Default GST Tax Configuration
 * Based on Indian GST rates and common categories
 */
export const DEFAULT_TAX_CONFIGURATION: TaxConfiguration = {
  id: 'default_gst_config',
  name: 'Default GST Configuration',
  description: 'Standard GST configuration for Indian market',
  isActive: true,
  version: '1.0.0',
  rules: [
    // ========================================================================
    // GST EXEMPT (0%)
    // ========================================================================
    {
      id: 'gst_exempt_food_unprocessed',
      name: 'GST Exempt - Unprocessed Food',
      description: 'Unprocessed food products are GST exempt',
      taxType: 'gst',
      rate: 0,
      calculationMethod: 'percentage',
      conditions: {
        categoryIds: ['unprocessed_food', 'fresh_food', 'raw_food'],
        transactionType: 'product'
      },
      priority: 10,
      isActive: true
    },
    
    // ========================================================================
    // REDUCED GST (5%)
    // ========================================================================
    {
      id: 'gst_reduced_5_essential',
      name: 'GST Reduced 5% - Essential Items',
      description: 'Essential items like medicines, healthcare products',
      taxType: 'gst',
      rate: 5,
      calculationMethod: 'percentage',
      conditions: {
        categoryIds: ['medicines', 'healthcare_products', 'pharmaceuticals'],
        transactionType: 'product'
      },
      priority: 20,
      isActive: true
    },
    
    {
      id: 'gst_reduced_5_pet_food',
      name: 'GST Reduced 5% - Pet Food',
      description: 'Pet food products',
      taxType: 'gst',
      rate: 5,
      calculationMethod: 'percentage',
      conditions: {
        categoryIds: ['pet_food', 'animal_feed'],
        transactionType: 'product'
      },
      priority: 20,
      isActive: true
    },
    
    // ========================================================================
    // STANDARD GST (12%)
    // ========================================================================
    {
      id: 'gst_standard_12_processed_food',
      name: 'GST Standard 12% - Processed Food',
      description: 'Processed food products',
      taxType: 'gst',
      rate: 12,
      calculationMethod: 'percentage',
      conditions: {
        categoryIds: ['processed_food', 'packaged_food'],
        transactionType: 'product'
      },
      priority: 30,
      isActive: true
    },
    
    {
      id: 'gst_standard_12_restaurant',
      name: 'GST Standard 12% - Restaurant Services',
      description: 'Restaurant and cafe services',
      taxType: 'gst',
      rate: 12,
      calculationMethod: 'percentage',
      conditions: {
        categoryIds: ['restaurant', 'cafe', 'food_service'],
        transactionType: 'service'
      },
      priority: 30,
      isActive: true
    },
    
    // ========================================================================
    // STANDARD GST (18%) - DEFAULT
    // ========================================================================
    {
      id: 'gst_standard_18_default',
      name: 'GST Standard 18% - Default',
      description: 'Standard GST rate for most products and services',
      taxType: 'gst',
      rate: 18,
      calculationMethod: 'percentage',
      conditions: {
        transactionType: 'both'
      },
      priority: 100, // Lower priority - applied when no other rules match
      isActive: true
    },
    
    // ========================================================================
    // HIGH GST (28%)
    // ========================================================================
    {
      id: 'gst_high_28_luxury',
      name: 'GST High 28% - Luxury Items',
      description: 'Luxury and premium products',
      taxType: 'gst',
      rate: 28,
      calculationMethod: 'percentage',
      conditions: {
        categoryIds: ['luxury_items', 'premium_products', 'luxury_services'],
        transactionType: 'both'
      },
      priority: 20,
      isActive: true
    },
    
    // ========================================================================
    // GST CESS ON LUXURY ITEMS
    // ========================================================================
    {
      id: 'gst_cess_luxury',
      name: 'GST Cess - Luxury Items',
      description: 'Additional cess on luxury items (calculated on GST amount)',
      taxType: 'infrastructure_cess',
      rate: 15, // 15% cess on luxury GST amount
      calculationMethod: 'compound',
      compoundOnTaxType: 'gst',
      conditions: {
        categoryIds: ['luxury_items', 'premium_products'],
        transactionType: 'product'
      },
      priority: 200,
      isActive: true
    },
    
    // ========================================================================
    // SERVICE-SPECIFIC TAXES (Future/Alternative)
    // ========================================================================
    
    // Service Tax (15%) - For pre-GST era or special cases
    {
      id: 'service_tax_15',
      name: 'Service Tax 15%',
      description: 'Service Tax for specific service categories (if applicable)',
      taxType: 'service_tax',
      rate: 15,
      calculationMethod: 'percentage',
      conditions: {
        transactionType: 'service',
        vendorRoles: ['service_provider'] // Apply only if GST doesn't apply
      },
      priority: 150,
      isActive: false // Disabled by default (GST era)
    },
    
    // Education Cess on Service Tax (2%)
    {
      id: 'education_cess_service_tax',
      name: 'Education Cess 2% on Service Tax',
      description: 'Education Cess calculated on Service Tax amount',
      taxType: 'education_cess',
      rate: 2,
      calculationMethod: 'compound',
      compoundOnTaxType: 'service_tax',
      conditions: {
        transactionType: 'service'
      },
      priority: 250,
      isActive: false // Disabled by default (GST era)
    }
  ],
  
  defaultRule: {
    id: 'gst_default_18',
    name: 'Default GST 18%',
    description: 'Default GST rate when no other rules match',
    taxType: 'gst',
    rate: 18,
    calculationMethod: 'percentage',
    conditions: {
      transactionType: 'both'
    },
    priority: 1000,
    isActive: true
  }
};

/**
 * Category Mapping
 * Maps product/service categories to tax categories
 */
export const CATEGORY_TAX_MAPPING: Record<string, string[]> = {
  // Product Categories
  'food': ['unprocessed_food', 'processed_food'],
  'pet_food': ['pet_food'],
  'medicines': ['medicines', 'healthcare_products'],
  'pharmacy': ['medicines', 'pharmaceuticals'],
  'toys': ['pet_accessories'],
  'accessories': ['pet_accessories'],
  'grooming_products': ['pet_accessories'],
  
  // Service Categories
  'veterinary': ['healthcare_services'],
  'grooming': ['pet_services'],
  'training': ['pet_services'],
  'boarding': ['pet_services'],
  'walking': ['pet_services'],
  'cafe': ['restaurant', 'food_service'],
  'restaurant': ['restaurant', 'food_service'],
  
  // Default
  'default': ['general']
};

/**
 * Get tax category IDs for a given category
 */
export function getTaxCategoriesForCategory(categoryId: string): string[] {
  return CATEGORY_TAX_MAPPING[categoryId] || CATEGORY_TAX_MAPPING['default'] || [];
}

