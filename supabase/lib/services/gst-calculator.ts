/**
 * ============================================================================
 * GST CALCULATOR SERVICE
 * ============================================================================
 * 
 * Calculate GST based on role + service style combination
 * Enforces GST policy server-side
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";

export interface GSTCalculation {
  subtotal: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  ruleId: string;
  ruleName: string;
  rate: number;
  isInterState: boolean;
}

export interface GSTCalculationParams {
  amount: number;
  roleId?: string;
  serviceStyle?: string;
  category?: string;
  customerState?: string;
  vendorState?: string;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Calculate GST based on role and service style
 */
export async function calculateGST(params: GSTCalculationParams): Promise<GSTCalculation> {
  const client = getDbClient();
  
  if (!params.amount || params.amount <= 0) {
    throw new Error('Invalid amount for GST calculation');
  }
  
  // Get all enabled GST rules, ordered by priority
  let query = client
    .from('gst_rules')
    .select('*')
    .eq('enabled', true)
    .order('priority', { ascending: true });
  
  const { data: rules, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch GST rules: ${error.message}`);
  }
  
  // Find matching rule
  let matchedRule: any = null;
  
  if (rules && rules.length > 0) {
    for (const rule of rules) {
      let matches = true;
      
      // Check role
      if (rule.role_id && params.roleId) {
        matches = matches && rule.role_id === params.roleId;
      }
      
      // Check service style
      if (rule.service_style && params.serviceStyle) {
        matches = matches && rule.service_style === params.serviceStyle;
      }
      
      // Check category
      if (rule.category && params.category) {
        matches = matches && rule.category === params.category;
      }
      
      // Check amount range
      if (rule.min_amount) {
        matches = matches && params.amount >= rule.min_amount;
      }
      if (rule.max_amount) {
        matches = matches && params.amount <= rule.max_amount;
      }
      
      // Check state (for IGST vs CGST+SGST)
      if (rule.vendor_state && params.vendorState) {
        matches = matches && rule.vendor_state === params.vendorState;
      }
      
      if (matches) {
        matchedRule = rule;
        break;
      }
    }
  }
  
  // Default rule (18% GST)
  if (!matchedRule) {
    matchedRule = {
      id: 'default',
      rule_name: 'Default GST Rule',
      gst_type: 'percentage',
      gst_rate: 18.00,
      cgst_percentage: null,
      sgst_percentage: null,
      igst_percentage: null
    };
  }
  
  // Calculate GST
  const isInterState = params.customerState && params.vendorState && 
                       params.customerState !== params.vendorState;
  
  let gstAmount = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  
  if (matchedRule.gst_type === 'percentage') {
    gstAmount = (params.amount * matchedRule.gst_rate) / 100;
    
    if (isInterState) {
      // Inter-state: IGST
      if (matchedRule.igst_percentage) {
        igst = (params.amount * matchedRule.igst_percentage) / 100;
        gstAmount = igst;
      } else {
        igst = gstAmount;
      }
    } else {
      // Intra-state: CGST + SGST
      if (matchedRule.cgst_percentage && matchedRule.sgst_percentage) {
        cgst = (params.amount * matchedRule.cgst_percentage) / 100;
        sgst = (params.amount * matchedRule.sgst_percentage) / 100;
        gstAmount = cgst + sgst;
      } else {
        // Split 50-50 if not specified
        cgst = gstAmount / 2;
        sgst = gstAmount / 2;
      }
    }
  } else {
    // Fixed amount
    gstAmount = matchedRule.gst_rate;
    if (isInterState) {
      igst = gstAmount;
    } else {
      cgst = gstAmount / 2;
      sgst = gstAmount / 2;
    }
  }
  
  return {
    subtotal: params.amount,
    gstAmount: Math.round(gstAmount * 100) / 100,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: Math.round(igst * 100) / 100,
    total: Math.round((params.amount + gstAmount) * 100) / 100,
    ruleId: matchedRule.id,
    ruleName: matchedRule.rule_name,
    rate: matchedRule.gst_rate,
    isInterState
  };
}

/**
 * Validate GST amount (for payment verification)
 */
export async function validateGSTAmount(
  amount: number,
  gstAmount: number,
  params: GSTCalculationParams
): Promise<{ valid: boolean; expected: number; difference: number }> {
  const calculation = await calculateGST({ ...params, amount });
  const difference = Math.abs(gstAmount - calculation.gstAmount);
  const tolerance = 0.01; // ₹0.01 tolerance for rounding
  
  return {
    valid: difference <= tolerance,
    expected: calculation.gstAmount,
    difference
  };
}

