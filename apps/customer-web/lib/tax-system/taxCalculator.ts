/**
 * ============================================================================
 * TAX CALCULATOR
 * ============================================================================
 * 
 * Flexible tax calculation engine that applies rule-based tax calculations.
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { 
  TaxConfiguration, 
  TaxRule, 
  TaxableItem, 
  TaxResult, 
  TaxBreakdown,
  TaxByType,
  TaxCalculationOptions,
  TransactionType
} from './types';
import { DEFAULT_TAX_CONFIGURATION } from './config';
import { getTaxCategoriesForCategory } from './config';

/**
 * Calculate tax for a list of items
 */
export function calculateTax(
  items: TaxableItem[],
  options: TaxCalculationOptions = {}
): TaxResult {
  const config = options.configuration || DEFAULT_TAX_CONFIGURATION;
  const roundTo = options.roundTo ?? 2;
  
  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => sum + (item.amount * (item.quantity || 1)), 0);
  
  // Calculate tax breakdown for each item
  const breakdown: TaxBreakdown[] = [];
  
  for (const item of items) {
    const itemBreakdown = calculateTaxForItem(item, config, options);
    breakdown.push(...itemBreakdown);
  }
  
  // Aggregate by tax type
  const byType = aggregateByTaxType(breakdown);
  
  // Calculate total tax
  const total = breakdown.reduce((sum, tax) => sum + tax.taxAmount, 0);
  const totalRounded = roundToDecimals(total, roundTo);
  
  // Calculate grand total
  const grandTotal = subtotal + totalRounded;
  
  return {
    subtotal: roundToDecimals(subtotal, roundTo),
    breakdown,
    byType,
    total: totalRounded,
    grandTotal: roundToDecimals(grandTotal, roundTo),
    currency: 'INR'
  };
}

/**
 * Calculate tax for a single item
 */
function calculateTaxForItem(
  item: TaxableItem,
  config: TaxConfiguration,
  options: TaxCalculationOptions
): TaxBreakdown[] {
  const breakdown: TaxBreakdown[] = [];
  
  // Get applicable rules for this item
  const applicableRules = findApplicableRules(item, config, options);
  
  // Sort by priority (lower number = higher priority)
  applicableRules.sort((a, b) => a.priority - b.priority);
  
  // Track base taxes for compound tax calculation
  const baseTaxes: Map<string, number> = new Map();
  
  for (const rule of applicableRules) {
    // Check exemptions
    if (isExempt(item, rule)) {
      continue;
    }
    
    // Calculate base tax
    let baseTaxAmount = 0;
    let compoundTaxAmount = 0;
    
    if (rule.calculationMethod === 'percentage') {
      if (rule.compoundOnTaxIds || rule.compoundOnTaxType) {
        // Compound tax - calculate on base tax amount
        const baseTaxKey = rule.compoundOnTaxIds?.[0] || rule.compoundOnTaxType || '';
        const baseTax = baseTaxes.get(baseTaxKey) || 0;
        
        if (baseTax > 0) {
          compoundTaxAmount = (baseTax * rule.rate) / 100;
        } else {
          // Base tax not found, skip compound tax
          continue;
        }
      } else {
        // Base tax - calculate on item amount
        baseTaxAmount = (item.amount * (item.quantity || 1) * rule.rate) / 100;
        baseTaxes.set(rule.id, baseTaxAmount);
      }
    } else if (rule.calculationMethod === 'fixed') {
      baseTaxAmount = rule.rate * (item.quantity || 1);
      baseTaxes.set(rule.id, baseTaxAmount);
    }
    
    const taxAmount = baseTaxAmount + compoundTaxAmount;
    
    if (taxAmount > 0) {
      breakdown.push({
        ruleId: rule.id,
        ruleName: rule.name,
        taxType: rule.taxType,
        rate: rule.rate,
        baseAmount: item.amount * (item.quantity || 1),
        taxAmount: roundToDecimals(taxAmount, 2),
        itemId: item.id,
        itemType: item.type,
        isCompound: rule.calculationMethod === 'compound',
        compoundOnRuleId: rule.compoundOnTaxIds?.[0]
      });
    }
  }
  
  // If no rules matched, use default rule
  if (breakdown.length === 0 && config.defaultRule) {
    const defaultTax = (item.amount * (item.quantity || 1) * config.defaultRule.rate) / 100;
    breakdown.push({
      ruleId: config.defaultRule.id,
      ruleName: config.defaultRule.name,
      taxType: config.defaultRule.taxType,
      rate: config.defaultRule.rate,
      baseAmount: item.amount * (item.quantity || 1),
      taxAmount: roundToDecimals(defaultTax, 2),
      itemId: item.id,
      itemType: item.type
    });
  }
  
  return breakdown;
}

/**
 * Find applicable tax rules for an item
 */
function findApplicableRules(
  item: TaxableItem,
  config: TaxConfiguration,
  options: TaxCalculationOptions
): TaxRule[] {
  const applicableRules: TaxRule[] = [];
  
  for (const rule of config.rules) {
    // Skip inactive rules unless explicitly included
    if (!rule.isActive && !options.includeInactive) {
      continue;
    }
    
    // Check if rule conditions match
    if (matchesConditions(item, rule)) {
      applicableRules.push(rule);
    }
  }
  
  return applicableRules;
}

/**
 * Check if item matches rule conditions
 */
function matchesConditions(item: TaxableItem, rule: TaxRule): boolean {
  const conditions = rule.conditions;
  
  // Transaction type check
  if (conditions.transactionType) {
    if (conditions.transactionType === 'product' && item.type !== 'product') return false;
    if (conditions.transactionType === 'service' && item.type !== 'service') return false;
    // 'both' matches everything
  }
  
  // Category check
  if (conditions.categoryIds && conditions.categoryIds.length > 0) {
    if (!item.categoryId || !conditions.categoryIds.includes(item.categoryId)) {
      // Also check mapped categories
      const mappedCategories = getTaxCategoriesForCategory(item.categoryId || '');
      const hasMatch = mappedCategories.some(cat => conditions.categoryIds?.includes(cat));
      if (!hasMatch) return false;
    }
  }
  
  // Sub-category check
  if (conditions.subCategoryIds && conditions.subCategoryIds.length > 0) {
    if (!item.subCategoryId || !conditions.subCategoryIds.includes(item.subCategoryId)) {
      return false;
    }
  }
  
  // Service type check
  if (conditions.serviceTypes && conditions.serviceTypes.length > 0) {
    if (!item.serviceType || !conditions.serviceTypes.includes(item.serviceType)) {
      return false;
    }
  }
  
  // Vendor role check
  if (conditions.vendorRoles && conditions.vendorRoles.length > 0) {
    if (!item.vendorRole || !conditions.vendorRoles.includes(item.vendorRole)) {
      return false;
    }
  }
  
  // Product/Service ID check
  if (conditions.productIds && conditions.productIds.length > 0) {
    if (!item.productId || !conditions.productIds.includes(item.productId)) {
      return false;
    }
  }
  
  if (conditions.serviceIds && conditions.serviceIds.length > 0) {
    if (!item.serviceId || !conditions.serviceIds.includes(item.serviceId)) {
      return false;
    }
  }
  
  // Amount range check
  const itemAmount = item.amount * (item.quantity || 1);
  if (conditions.minAmount !== undefined && itemAmount < conditions.minAmount) {
    return false;
  }
  if (conditions.maxAmount !== undefined && itemAmount > conditions.maxAmount) {
    return false;
  }
  
  // Quantity range check
  const quantity = item.quantity || 1;
  if (conditions.minQuantity !== undefined && quantity < conditions.minQuantity) {
    return false;
  }
  if (conditions.maxQuantity !== undefined && quantity > conditions.maxQuantity) {
    return false;
  }
  
  // Date range check (future)
  // if (conditions.validFrom || conditions.validTo) {
  //   const now = new Date();
  //   if (conditions.validFrom && new Date(conditions.validFrom) > now) return false;
  //   if (conditions.validTo && new Date(conditions.validTo) < now) return false;
  // }
  
  return true;
}

/**
 * Check if item is exempt from tax rule
 */
function isExempt(item: TaxableItem, rule: TaxRule): boolean {
  if (!rule.exemptions) return false;
  
  const exemptions = rule.exemptions;
  
  // Category exemption
  if (exemptions.categoryIds && exemptions.categoryIds.length > 0) {
    if (item.categoryId && exemptions.categoryIds.includes(item.categoryId)) {
      return true;
    }
  }
  
  // Product/Service ID exemption
  if (exemptions.productIds && exemptions.productIds.length > 0) {
    if (item.productId && exemptions.productIds.includes(item.productId)) {
      return true;
    }
  }
  
  if (exemptions.serviceIds && exemptions.serviceIds.length > 0) {
    if (item.serviceId && exemptions.serviceIds.includes(item.serviceId)) {
      return true;
    }
  }
  
  // Vendor exemption
  if (exemptions.vendorIds && exemptions.vendorIds.length > 0) {
    if (item.vendorId && exemptions.vendorIds.includes(item.vendorId)) {
      return true;
    }
  }
  
  // Amount exemption
  const itemAmount = item.amount * (item.quantity || 1);
  if (exemptions.minAmount !== undefined && itemAmount < exemptions.minAmount) {
    return true;
  }
  if (exemptions.maxAmount !== undefined && itemAmount > exemptions.maxAmount) {
    return true;
  }
  
  return false;
}

/**
 * Aggregate tax breakdown by tax type
 */
function aggregateByTaxType(breakdown: TaxBreakdown[]): TaxByType[] {
  const byTypeMap = new Map<string, TaxByType>();
  
  for (const tax of breakdown) {
    const existing = byTypeMap.get(tax.taxType);
    
    if (existing) {
      existing.totalAmount += tax.taxAmount;
      existing.breakdown.push(tax);
    } else {
      byTypeMap.set(tax.taxType, {
        taxType: tax.taxType,
        totalAmount: tax.taxAmount,
        breakdown: [tax]
      });
    }
  }
  
  return Array.from(byTypeMap.values()).map(type => ({
    ...type,
    totalAmount: roundToDecimals(type.totalAmount, 2)
  }));
}

/**
 * Round to decimal places
 */
function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate tax for a single amount (simplified version)
 * Useful for quick calculations
 */
export function calculateTaxForAmount(
  amount: number,
  taxRate: number,
  options: { roundTo?: number } = {}
): number {
  const roundTo = options.roundTo ?? 2;
  const taxAmount = (amount * taxRate) / 100;
  return roundToDecimals(taxAmount, roundTo);
}

/**
 * Get tax rate for an item (returns the primary tax rate)
 * Useful for display purposes
 */
export function getTaxRateForItem(
  item: TaxableItem,
  config: TaxConfiguration = DEFAULT_TAX_CONFIGURATION
): number {
  const applicableRules = findApplicableRules(item, config, {});
  
  if (applicableRules.length === 0 && config.defaultRule) {
    return config.defaultRule.rate;
  }
  
  // Return the highest priority rule's rate
  applicableRules.sort((a, b) => a.priority - b.priority);
  return applicableRules[0]?.rate || config.defaultRule?.rate || 0;
}

