/**
 * ============================================================================
 * GST CALCULATION SERVICE
 * ============================================================================
 * 
 * Centralized GST calculation service
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { getDbClient } from "../db.ts";

export interface GSTCalculation {
  baseAmount: number;
  gstPercentage: number;
  cgstPercentage: number;
  sgstPercentage: number;
  igstPercentage: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

/**
 * Calculate GST for an amount
 */
export async function calculateGST(
  amount: number,
  serviceCategory?: string,
  vendorState?: string,
  customerState?: string
): Promise<GSTCalculation> {
  const client = getDbClient();

  // Get GST config based on service category
  let gstConfig: any = null;
  
  if (serviceCategory) {
    const { data: configs } = await client
      .from('gst_configs')
      .select('*')
      .eq('is_active', true)
      .limit(1);
    
    // Use first active config or default
    gstConfig = configs?.[0] || {
      gst_percentage: 18,
      cgst_percentage: 9,
      sgst_percentage: 9,
    };
  } else {
    // Default GST config
    gstConfig = {
      gst_percentage: 18,
      cgst_percentage: 9,
      sgst_percentage: 9,
    };
  }

  const gstPercentage = Number(gstConfig.gst_percentage) || 18;
  const cgstPercentage = Number(gstConfig.cgst_percentage) || 9;
  const sgstPercentage = Number(gstConfig.sgst_percentage) || 9;

  // Determine if IGST (inter-state) or CGST+SGST (intra-state)
  const isInterState = vendorState && customerState && vendorState !== customerState;
  
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    // Inter-state: IGST
    const igstPercentage = Number(gstConfig.igst_percentage) || gstPercentage;
    igstAmount = (amount * igstPercentage) / 100;
  } else {
    // Intra-state: CGST + SGST
    cgstAmount = (amount * cgstPercentage) / 100;
    sgstAmount = (amount * sgstPercentage) / 100;
  }

  const gstAmount = cgstAmount + sgstAmount + igstAmount;
  const totalAmount = amount + gstAmount;

  return {
    baseAmount: amount,
    gstPercentage,
    cgstPercentage,
    sgstPercentage,
    igstPercentage: isInterState ? (Number(gstConfig.igst_percentage) || gstPercentage) : 0,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount,
  };
}

/**
 * Get GST config for a service category
 */
export async function getGSTConfig(serviceCategory?: string): Promise<any> {
  const client = getDbClient();

  const { data: configs } = await client
    .from('gst_configs')
    .select('*')
    .eq('is_active', true)
    .limit(1);

  return configs?.[0] || {
    gst_percentage: 18,
    cgst_percentage: 9,
    sgst_percentage: 9,
    igst_percentage: 18,
  };
}

