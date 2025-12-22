/**
 * ============================================================================
 * INSURANCE CLAIM HANDLERS
 * ============================================================================
 * 
 * Handles insurance claim submission and processing
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import { getBookingsRepository } from "../repositories/bookings.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface InsuranceClaim {
  id: string;
  booking_id: string;
  customer_id: string;
  policy_id?: string | null;
  claim_type: 'medical' | 'accident' | 'illness' | 'surgery' | 'other';
  claim_amount: number;
  claim_status: 'claim_pending' | 'claim_approved' | 'claim_rejected' | 'claim_processed';
  claim_description: string;
  supporting_documents?: any;
  submitted_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  approved_amount?: number | null;
  rejection_reason?: string | null;
  processed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CLAIM HANDLERS
// ============================================================================

/**
 * Submit insurance claim
 */
export async function submitInsuranceClaim(
  bookingId: string,
  claimData: {
    claim_type: string;
    claim_amount: number;
    claim_description: string;
    supporting_documents?: any;
  }
): Promise<InsuranceClaim> {
  const client = getDbClient();
  const bookingsRepo = getBookingsRepository();
  
  // Verify booking exists and is insurance-related
  const booking = await bookingsRepo.findById(bookingId);
  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }
  
  // Create claim
  const { data: claim, error } = await client
    .from('insurance_claims')
    .insert({
      booking_id: bookingId,
      customer_id: booking.customer_id,
      claim_type: claimData.claim_type,
      claim_amount: claimData.claim_amount,
      claim_description: claimData.claim_description,
      supporting_documents: claimData.supporting_documents || {},
      claim_status: 'claim_pending',
    })
    .select()
    .single();
  
  if (error || !claim) {
    throw new Error(`Failed to create claim: ${error?.message || 'Unknown error'}`);
  }
  
  // Update booking status
  await bookingsRepo.update(bookingId, {
    status: 'claim_pending',
  });
  
  return claim as InsuranceClaim;
}

/**
 * Process insurance claim (approve/reject)
 */
export async function processInsuranceClaim(
  claimId: string,
  action: 'approve' | 'reject',
  reviewedBy: string,
  approvedAmount?: number,
  rejectionReason?: string
): Promise<InsuranceClaim> {
  const client = getDbClient();
  
  // Get claim
  const { data: claim, error: getError } = await client
    .from('insurance_claims')
    .select('*')
    .eq('id', claimId)
    .single();
  
  if (getError || !claim) {
    throw new Error(`Claim not found: ${claimId}`);
  }
  
  const updateData: any = {
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewedBy,
    updated_at: new Date().toISOString(),
  };
  
  if (action === 'approve') {
    updateData.claim_status = 'claim_approved';
    updateData.approved_amount = approvedAmount || claim.claim_amount;
    
    // Update booking status
    const bookingsRepo = getBookingsRepository();
    await bookingsRepo.update(claim.booking_id, {
      status: 'claim_approved',
    });
  } else {
    updateData.claim_status = 'claim_rejected';
    updateData.rejection_reason = rejectionReason || 'Claim rejected';
    
    // Update booking status
    const bookingsRepo = getBookingsRepository();
    await bookingsRepo.update(claim.booking_id, {
      status: 'claim_rejected',
    });
  }
  
  const { data: updatedClaim, error: updateError } = await client
    .from('insurance_claims')
    .update(updateData)
    .eq('id', claimId)
    .select()
    .single();
  
  if (updateError || !updatedClaim) {
    throw new Error(`Failed to process claim: ${updateError?.message || 'Unknown error'}`);
  }
  
  return updatedClaim as InsuranceClaim;
}

/**
 * Complete insurance claim processing (payout)
 */
export async function completeInsuranceClaim(claimId: string): Promise<InsuranceClaim> {
  const client = getDbClient();
  
  const { data: claim, error: getError } = await client
    .from('insurance_claims')
    .select('*')
    .eq('id', claimId)
    .eq('claim_status', 'claim_approved')
    .single();
  
  if (getError || !claim) {
    throw new Error(`Approved claim not found: ${claimId}`);
  }
  
  // Process payout to customer wallet
  const { data: wallet } = await client
    .from('customer_wallets')
    .select('*')
    .eq('customer_id', claim.customer_id)
    .single();
  
  if (wallet) {
    await client
      .from('customer_wallets')
      .update({
        balance: wallet.balance + (claim.approved_amount || claim.claim_amount),
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', claim.customer_id);
    
    // Create wallet transaction
    await client
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        transaction_type: 'credit',
        amount: claim.approved_amount || claim.claim_amount,
        balance_after: wallet.balance + (claim.approved_amount || claim.claim_amount),
        reference_type: 'insurance_claim',
        reference_id: claimId,
        description: `Insurance claim payout: ${claim.claim_description}`,
      });
  }
  
  // Update claim status
  const { data: updatedClaim, error: updateError } = await client
    .from('insurance_claims')
    .update({
      claim_status: 'claim_processed',
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId)
    .select()
    .single();
  
  if (updateError || !updatedClaim) {
    throw new Error(`Failed to complete claim: ${updateError?.message || 'Unknown error'}`);
  }
  
  // Update booking status
  const bookingsRepo = getBookingsRepository();
  await bookingsRepo.update(claim.booking_id, {
    status: 'completed',
  });
  
  return updatedClaim as InsuranceClaim;
}

/**
 * Get claims for booking
 */
export async function getBookingClaims(bookingId: string): Promise<InsuranceClaim[]> {
  const client = getDbClient();
  
  const { data: claims, error } = await client
    .from('insurance_claims')
    .select('*')
    .eq('booking_id', bookingId)
    .order('submitted_at', { ascending: false });
  
  if (error) {
    throw new Error(`Error fetching claims: ${error.message}`);
  }
  
  return (claims || []) as InsuranceClaim[];
}

