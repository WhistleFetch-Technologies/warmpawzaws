/**
 * ============================================================================
 * COMMISSION CALCULATOR SERVICE
 * ============================================================================
 * 
 * Centralized commission calculation based on vendor tier
 * Replaces all hardcoded commission rates
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";

export interface CommissionCalculation {
  commissionRate: number;
  commissionAmount: number;
  vendorAmount: number;
  tierId: string;
  tierName: string;
  isFreeTier: boolean;
}

/**
 * Calculate commission based on vendor tier
 * @param vendorId Vendor ID
 * @param amount Payment amount
 * @param bookingTime Optional: booking time to get tier at that time
 * @returns Commission calculation
 */
export async function calculateCommission(
  vendorId: string,
  amount: number,
  bookingTime?: Date
): Promise<CommissionCalculation> {
  const client = getDbClient();
  
  // Get vendor with current tier
  const { data: vendor, error: vendorError } = await client
    .from('vendors')
    .select(`
      id,
      current_tier_id,
      tier,
      vendor_tiers (
        id,
        tier_name,
        display_name,
        commission_rate,
        is_free_tier
      )
    `)
    .eq('id', vendorId)
    .single();
  
  if (vendorError || !vendor) {
    throw new Error(`Vendor not found: ${vendorId}`);
  }
  
  // Get tier from subscription or default
  let tier: any = null;
  
  if (vendor.current_tier_id) {
    // Get tier from subscription
    const { data: subscription } = await client
      .from('vendor_tier_subscriptions')
      .select(`
        tier_id,
        vendor_tiers (
          id,
          tier_name,
          display_name,
          commission_rate,
          is_free_tier
        )
      `)
      .eq('vendor_id', vendorId)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1)
      .single();
    
    if (subscription?.vendor_tiers) {
      tier = subscription.vendor_tiers;
    }
  }
  
  // Fallback to default tier (Bronze - free tier)
  if (!tier) {
    const { data: defaultTier } = await client
      .from('vendor_tiers')
      .select('*')
      .eq('is_default', true)
      .eq('is_active', true)
      .single();
    
    tier = defaultTier || {
      id: 'bronze',
      tier_name: 'bronze',
      display_name: 'Bronze Tier',
      commission_rate: 15.00,
      is_free_tier: true
    };
  }
  
  const commissionRate = tier.commission_rate || 15.00;
  const commissionAmount = (amount * commissionRate) / 100;
  const vendorAmount = amount - commissionAmount;
  
  return {
    commissionRate,
    commissionAmount: Math.round(commissionAmount * 100) / 100,
    vendorAmount: Math.round(vendorAmount * 100) / 100,
    tierId: tier.id,
    tierName: tier.tier_name || tier.display_name,
    isFreeTier: tier.is_free_tier || false
  };
}

/**
 * Get commission rate for a vendor (for display purposes)
 */
export async function getVendorCommissionRate(vendorId: string): Promise<number> {
  const calculation = await calculateCommission(vendorId, 100); // Use 100 as base
  return calculation.commissionRate;
}

