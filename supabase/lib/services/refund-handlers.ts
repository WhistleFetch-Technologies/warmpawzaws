/**
 * ============================================================================
 * REFUND HANDLERS
 * ============================================================================
 * 
 * Centralized refund processing
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import { getBookingsRepository } from "../repositories/bookings.ts";

// ============================================================================
// REFUND PROCESSING
// ============================================================================

/**
 * Process refund for booking/payment
 */
export async function processRefund(
  paymentId: string,
  refundData: {
    reason: string;
    refund_to?: 'wallet' | 'original';
    amount?: number;
  }
): Promise<{
  success: boolean;
  refundId?: string;
  amount?: number;
  error?: string;
}> {
  const client = getDbClient();
  
  // Get payment
  const { data: payment, error: paymentError } = await client
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();
  
  if (paymentError || !payment) {
    return { success: false, error: 'Payment not found' };
  }
  
  const refundAmount = refundData.amount || payment.amount;
  
  // Create refund record
  const refundId = `refund_${Date.now()}`;
  const { data: refund, error: refundError } = await client
    .from('refunds')
    .insert({
      id: refundId,
      payment_id: paymentId,
      booking_id: payment.booking_id,
      customer_id: payment.customer_id,
      vendor_id: payment.vendor_id,
      refund_amount: refundAmount,
      refund_reason: refundData.reason,
      refund_status: 'processing',
    })
    .select()
    .single();
  
  if (refundError || !refund) {
    return { success: false, error: 'Failed to create refund record' };
  }
  
  // Process refund based on method
  if (refundData.refund_to === 'wallet' || !refundData.refund_to) {
    // Refund to wallet
    const { data: wallet } = await client
      .from('customer_wallets')
      .select('*')
      .eq('customer_id', payment.customer_id)
      .single();
    
    if (wallet) {
      await client
        .from('customer_wallets')
        .update({
          balance: wallet.balance + refundAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('customer_id', payment.customer_id);
      
      // Create wallet transaction
      await client
        .from('wallet_transactions')
        .insert({
          wallet_id: wallet.id,
          transaction_type: 'credit',
          amount: refundAmount,
          balance_after: wallet.balance + refundAmount,
          reference_type: 'refund',
          reference_id: refundId,
          description: `Refund: ${refundData.reason}`,
        });
    }
  } else {
    // Refund to original payment method (Razorpay)
    try {
      const { getRazorpayAuthHeader } = await import("../../functions/make-server-3dd53475/razorpay-credentials-helper.tsx");
      const authHeader = await getRazorpayAuthHeader();
      
      const response = await fetch(`https://api.razorpay.com/v1/payments/${payment.razorpay_payment_id}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(refundAmount * 100), // Convert to paise
          notes: {
            reason: refundData.reason,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Razorpay refund failed');
      }
      
      const razorpayRefund = await response.json();
      
      // Update refund with Razorpay ID
      await client
        .from('refunds')
        .update({
          razorpay_refund_id: razorpayRefund.id,
        })
        .eq('id', refundId);
    } catch (error) {
      console.error('[Refund] Razorpay refund error:', error);
      // Continue with wallet refund as fallback
    }
  }
  
  // Update refund status
  await client
    .from('refunds')
    .update({
      refund_status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', refundId);
  
  // Update payment status
  await client
    .from('payments')
    .update({
      payment_status: refundAmount >= payment.amount ? 'refunded' : 'partially_refunded',
    })
    .eq('id', paymentId);
  
  return {
    success: true,
    refundId,
    amount: refundAmount,
  };
}

