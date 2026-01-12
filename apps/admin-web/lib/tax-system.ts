/**
 * ============================================================================
 * TAX SYSTEM UTILITIES (Admin Web)
 * ============================================================================
 * 
 * Simple tax calculation utility for admin preview
 * For full tax calculations, use API endpoints
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { TaxableItem, TaxResult, TaxRule, TaxBreakdown, TaxByType } from '@/types/tax-system';

/**
 * Simple tax calculation for preview purposes
 * Uses default 18% GST rule for demonstration
 */
export function calculateTax(items: TaxableItem[]): TaxResult {
  const subtotal = items.reduce((sum, item) => sum + (item.amount * (item.quantity || 1)), 0);
  
  // Default rule: 18% GST
  const defaultRule: TaxRule = {
    id: 'default_gst_18',
    name: 'GST Standard 18%',
    taxType: 'gst',
    rate: 18,
    calculationMethod: 'percentage',
    priority: 100,
    isActive: true,
    conditions: { transactionType: 'both' }
  };
  
  const taxAmount = subtotal * (defaultRule.rate / 100);
  
  const breakdown: TaxBreakdown[] = items.map(item => ({
    ruleId: defaultRule.id,
    ruleName: defaultRule.name,
    taxType: defaultRule.taxType,
    rate: defaultRule.rate,
    baseAmount: item.amount * (item.quantity || 1),
    taxAmount: (item.amount * (item.quantity || 1)) * (defaultRule.rate / 100),
    itemId: item.id,
    itemType: item.type
  }));
  
  const byType: TaxByType[] = [{
    taxType: defaultRule.taxType,
    totalAmount: taxAmount,
    breakdown
  }];
  
  return {
    subtotal,
    breakdown,
    byType,
    total: taxAmount,
    grandTotal: subtotal + taxAmount,
    currency: 'INR'
  };
}
