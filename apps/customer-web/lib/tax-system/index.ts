/**
 * ============================================================================
 * TAX SYSTEM - PUBLIC API
 * ============================================================================
 * 
 * Main entry point for tax system.
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

export * from './types';
export * from './config';
export * from './taxCalculator';

// Re-export commonly used functions
export {
  calculateTax,
  calculateTaxForAmount,
  getTaxRateForItem
} from './taxCalculator';

export {
  DEFAULT_TAX_CONFIGURATION,
  getTaxCategoriesForCategory,
  CATEGORY_TAX_MAPPING
} from './config';

