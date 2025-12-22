/**
 * ============================================================================
 * AUTOMATIC PAYOUT PROCESSING SERVICE
 * ============================================================================
 * 
 * Handles automatic payout processing for vendors
 * Processes payouts based on settlement schedules and rules
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import { getAutomationJobsRepository } from "../repositories/automation-jobs.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface PayoutRule {
  id: string;
  rule_name: string;
  min_payout_amount: number;
  processing_days: number;
  fee_percentage: number;
  is_active: boolean;
}

// ============================================================================
// PAYOUT PROCESSING
// ============================================================================

/**
 * Process automatic payouts for vendors
 */
export async function processAutomaticPayouts(): Promise<{
  processed: number;
  failed: number;
  totalAmount: number;
}> {
  const client = getDbClient();
  const stats = {
    processed: 0,
    failed: 0,
    totalAmount: 0,
  };
  
  // Get active payout rule
  const { data: payoutRule } = await client
    .from('payout_rules')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();
  
  if (!payoutRule) {
    console.warn('[PayoutProcessing] No active payout rule found');
    return stats;
  }
  
  // Get pending payouts
  const { data: pendingPayouts } = await client
    .from('pending_payouts')
    .select('*, payouts(*), vendors(*)')
    .order('priority', { ascending: false })
    .order('queued_at', { ascending: true })
    .limit(100);
  
  if (!pendingPayouts) return stats;
  
  for (const pending of pendingPayouts) {
    try {
      const payout = pending.payouts;
      const vendor = pending.vendors;
      
      if (!payout || !vendor) {
        console.error(`[PayoutProcessing] Missing payout or vendor data for ${pending.id}`);
        stats.failed++;
        continue;
      }
      
      // Check minimum payout amount
      if (payout.amount < payoutRule.min_payout_amount) {
        console.log(`[PayoutProcessing] Payout ${payout.id} below minimum amount`);
        continue;
      }
      
      // Process payout
      const success = await processSinglePayout(payout, vendor, payoutRule);
      
      if (success) {
        // Update payout status
        await client
          .from('payouts')
          .update({
            payout_status: 'completed',
            completed_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
          })
          .eq('id', payout.id);
        
        // Remove from pending queue
        await client
          .from('pending_payouts')
          .delete()
          .eq('id', pending.id);
        
        stats.processed++;
        stats.totalAmount += payout.amount;
      } else {
        stats.failed++;
      }
    } catch (error) {
      console.error(`[PayoutProcessing] Error processing payout ${pending.id}:`, error);
      stats.failed++;
    }
  }
  
  return stats;
}

/**
 * Process a single payout
 */
async function processSinglePayout(
  payout: any,
  vendor: any,
  rule: PayoutRule
): Promise<boolean> {
  try {
    // Get vendor bank details
    const client = getDbClient();
    const { data: bankDetails } = await client
      .from('vendor_bank_details')
      .select('*')
      .eq('vendor_id', vendor.id)
      .eq('is_verified', true)
      .single();
    
    if (!bankDetails) {
      console.error(`[PayoutProcessing] No verified bank details for vendor ${vendor.id}`);
      return false;
    }
    
    // Calculate fee
    const feeAmount = (payout.amount * rule.fee_percentage) / 100;
    const netAmount = payout.amount - feeAmount;
    
    // Process via Razorpay (if configured)
    const { getRazorpayCredentials } = await import("../../functions/make-server-3dd53475/razorpay-credentials-helper.tsx");
    const credentials = await getRazorpayCredentials();
    
    if (credentials.enabled && credentials.keyId && credentials.keySecret) {
      return await processRazorpayPayout(payout, bankDetails, netAmount, credentials);
    }
    
    // Fallback: Mark as processing (manual processing required)
    await client
      .from('payouts')
      .update({
        payout_status: 'processing',
        processed_at: new Date().toISOString(),
      })
      .eq('id', payout.id);
    
    return true;
  } catch (error) {
    console.error(`[PayoutProcessing] Error processing payout ${payout.id}:`, error);
    return false;
  }
}

/**
 * Process payout via Razorpay
 */
async function processRazorpayPayout(
  payout: any,
  bankDetails: any,
  amount: number,
  credentials: { keyId: string; keySecret: string }
): Promise<boolean> {
  try {
    const auth = btoa(`${credentials.keyId}:${credentials.keySecret}`);
    
    const response = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_number: bankDetails.account_number,
        fund_account: {
          account_type: 'bank_account',
          bank_account: {
            name: bankDetails.account_holder_name,
            ifsc: bankDetails.ifsc_code,
            account_number: bankDetails.account_number,
          },
        },
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        mode: 'NEFT',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: `payout_${payout.id}`,
        narration: `Payout for vendor ${payout.vendor_id}`,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[PayoutProcessing] Razorpay payout error:', errorData);
      
      // Update payout with failure
      const client = getDbClient();
      await client
        .from('payouts')
        .update({
          payout_status: 'failed',
          failure_reason: errorData.error?.description || 'Payout processing failed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', payout.id);
      
      return false;
    }
    
    const payoutData = await response.json();
    
    // Update payout with Razorpay payout ID
    const client = getDbClient();
    await client
      .from('payouts')
      .update({
        razorpay_payout_id: payoutData.id,
        payout_status: payoutData.status === 'queued' ? 'processing' : 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', payout.id);
    
    return true;
  } catch (error) {
    console.error('[PayoutProcessing] Razorpay payout error:', error);
    return false;
  }
}

/**
 * Create payout from settlement
 */
export async function createPayoutFromSettlement(settlementId: string): Promise<string> {
  const client = getDbClient();
  
  // Get settlement
  const { data: settlement } = await client
    .from('settlements')
    .select('*, vendors(*)')
    .eq('id', settlementId)
    .single();
  
  if (!settlement) {
    throw new Error(`Settlement not found: ${settlementId}`);
  }
  
  const vendor = settlement.vendors;
  if (!vendor) {
    throw new Error(`Vendor not found for settlement ${settlementId}`);
  }
  
  // Get vendor bank details
  const { data: bankDetails } = await client
    .from('vendor_bank_details')
    .select('*')
    .eq('vendor_id', vendor.id)
    .eq('is_verified', true)
    .single();
  
  if (!bankDetails) {
    throw new Error(`No verified bank details for vendor ${vendor.id}`);
  }
  
  // Create payout
  const { data: payout, error } = await client
    .from('payouts')
    .insert({
      vendor_id: vendor.id,
      amount: settlement.net_amount,
      currency: 'INR',
      payout_status: 'pending',
      bank_account_number: bankDetails.account_number,
      ifsc_code: bankDetails.ifsc_code,
      account_holder_name: bankDetails.account_holder_name,
      settlement_id: settlementId,
      payment_ids: settlement.payment_ids,
    })
    .select()
    .single();
  
  if (error || !payout) {
    throw new Error(`Failed to create payout: ${error?.message || 'Unknown error'}`);
  }
  
  // Add to pending queue
  await client
    .from('pending_payouts')
    .insert({
      payout_id: payout.id,
      vendor_id: vendor.id,
      amount: payout.amount,
      priority: 5, // Default priority
    });
  
  return payout.id;
}

/**
 * Schedule automatic payout processing
 */
export async function scheduleAutomaticPayouts(): Promise<void> {
  const automationRepo = getAutomationJobsRepository();
  
  // Get all vendors with pending settlements
  const client = getDbClient();
  const { data: settlements } = await client
    .from('settlements')
    .select('*')
    .eq('settlement_status', 'completed')
    .is('payout_id', null)
    .limit(100);
  
  if (!settlements) return;
  
  for (const settlement of settlements) {
    try {
      // Check if payout already exists
      const { data: existingPayout } = await client
        .from('payouts')
        .select('id')
        .eq('settlement_id', settlement.id)
        .maybeSingle();
      
      if (existingPayout) continue;
      
      // Create payout
      await createPayoutFromSettlement(settlement.id);
    } catch (error) {
      console.error(`[PayoutProcessing] Error creating payout for settlement ${settlement.id}:`, error);
    }
  }
}

