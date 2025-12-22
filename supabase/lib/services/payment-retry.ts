/**
 * ============================================================================
 * PAYMENT RETRY SERVICE
 * ============================================================================
 * 
 * Handles payment retry mechanism and timeout handling
 * Automatically retries failed payments with exponential backoff
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import { getBookingsRepository } from "../repositories/bookings.ts";
import { getAutomationJobsRepository } from "../repositories/automation-jobs.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface PaymentRetryLog {
  id: string;
  payment_id: string;
  retry_attempt: number;
  retry_status: 'pending' | 'processing' | 'success' | 'failed';
  error_message?: string | null;
  retried_at: string;
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Retry failed payment
 */
export async function retryPayment(
  paymentId: string,
  maxRetries: number = 3
): Promise<{ success: boolean; attempt: number; error?: string }> {
  const client = getDbClient();
  
  // Get payment
  const { data: payment, error: paymentError } = await client
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();
  
  if (paymentError || !payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }
  
  // Get retry count
  const { data: retryLogs } = await client
    .from('payment_retry_log')
    .select('*')
    .eq('payment_id', paymentId)
    .order('retry_attempt', { ascending: false })
    .limit(1);
  
  const lastRetry = retryLogs?.[0];
  const retryAttempt = lastRetry ? lastRetry.retry_attempt + 1 : 1;
  
  if (retryAttempt > maxRetries) {
    // Mark payment as failed permanently
    await client
      .from('payments')
      .update({
        payment_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);
    
    // Cancel associated booking if exists
    if (payment.booking_id) {
      const bookingsRepo = getBookingsRepository();
      await bookingsRepo.cancel(payment.booking_id, 'Payment failed after maximum retries');
    }
    
    return {
      success: false,
      attempt: retryAttempt,
      error: 'Maximum retries exceeded',
    };
  }
  
  // Log retry attempt
  await client
    .from('payment_retry_log')
    .insert({
      payment_id: paymentId,
      retry_attempt: retryAttempt,
      retry_status: 'processing',
      retried_at: new Date().toISOString(),
    });
  
  try {
    // Attempt payment retry based on payment method
    let retrySuccess = false;
    let errorMessage: string | null = null;
    
    switch (payment.payment_method) {
      case 'razorpay':
        retrySuccess = await retryRazorpayPayment(payment);
        break;
      case 'wallet':
        retrySuccess = await retryWalletPayment(payment);
        break;
      default:
        errorMessage = `Payment method ${payment.payment_method} does not support retry`;
    }
    
    // Update retry log
    await client
      .from('payment_retry_log')
      .update({
        retry_status: retrySuccess ? 'success' : 'failed',
        error_message: errorMessage,
      })
      .eq('payment_id', paymentId)
      .eq('retry_attempt', retryAttempt);
    
    if (retrySuccess) {
      // Update payment status
      await client
        .from('payments')
        .update({
          payment_status: 'completed',
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
      
      // Update booking payment status
      if (payment.booking_id) {
        const bookingsRepo = getBookingsRepository();
        await bookingsRepo.update(payment.booking_id, {
          payment_status: 'paid',
          payment_id: paymentId,
        });
      }
    } else {
      // Schedule next retry with exponential backoff
      const backoffMinutes = Math.pow(2, retryAttempt) * 5; // 5, 10, 20 minutes
      const nextRetryTime = new Date(Date.now() + backoffMinutes * 60 * 1000);
      
      const automationRepo = getAutomationJobsRepository();
      await automationRepo.createJob({
        job_type: 'status_transition',
        entity_type: 'payment',
        entity_id: paymentId,
        scheduled_at: nextRetryTime.toISOString(),
        metadata: {
          action: 'retry_payment',
          retry_attempt: retryAttempt + 1,
        },
      });
    }
    
    return {
      success: retrySuccess,
      attempt: retryAttempt,
      error: errorMessage || undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Update retry log with error
    await client
      .from('payment_retry_log')
      .update({
        retry_status: 'failed',
        error_message: errorMsg,
      })
      .eq('payment_id', paymentId)
      .eq('retry_attempt', retryAttempt);
    
    return {
      success: false,
      attempt: retryAttempt,
      error: errorMsg,
    };
  }
}

/**
 * Retry Razorpay payment
 */
async function retryRazorpayPayment(payment: any): Promise<boolean> {
  try {
    const { getRazorpayAuthHeader } = await import("../../functions/make-server-3dd53475/razorpay-credentials-helper.tsx");
    
    if (!payment.razorpay_order_id) {
      // Create new order if doesn't exist
      const authHeader = await getRazorpayAuthHeader();
      const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(payment.amount * 100), // Convert to paise
          currency: payment.currency || 'INR',
          receipt: `retry_${payment.id}`,
        }),
      });
      
      if (!orderResponse.ok) {
        return false;
      }
      
      const orderData = await orderResponse.json();
      // Update payment with new order ID
      const client = getDbClient();
      await client
        .from('payments')
        .update({
          razorpay_order_id: orderData.id,
        })
        .eq('id', payment.id);
      
      return true;
    }
    
    // For existing orders, check payment status
    const authHeader = await getRazorpayAuthHeader();
    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/orders/${payment.razorpay_order_id}/payments`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      }
    );
    
    if (!paymentResponse.ok) {
      return false;
    }
    
    const paymentsData = await paymentResponse.json();
    const successfulPayment = paymentsData.items?.find((p: any) => p.status === 'captured');
    
    if (successfulPayment) {
      // Update payment with successful payment ID
      const client = getDbClient();
      await client
        .from('payments')
        .update({
          razorpay_payment_id: successfulPayment.id,
          razorpay_signature: successfulPayment.signature,
        })
        .eq('id', payment.id);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[PaymentRetry] Razorpay retry error:', error);
    return false;
  }
}

/**
 * Retry wallet payment
 */
async function retryWalletPayment(payment: any): Promise<boolean> {
  try {
    const client = getDbClient();
    
    // Check wallet balance
    const { data: wallet } = await client
      .from('customer_wallets')
      .select('*')
      .eq('customer_id', payment.customer_id)
      .single();
    
    if (!wallet || wallet.balance < payment.amount) {
      return false;
    }
    
    // Deduct from wallet
    await client
      .from('customer_wallets')
      .update({
        balance: wallet.balance - payment.amount,
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', payment.customer_id);
    
    // Create wallet transaction
    await client
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        transaction_type: 'debit',
        amount: payment.amount,
        balance_after: wallet.balance - payment.amount,
        reference_type: 'payment',
        reference_id: payment.id,
        description: `Payment retry for booking ${payment.booking_id || 'N/A'}`,
      });
    
    return true;
  } catch (error) {
    console.error('[PaymentRetry] Wallet retry error:', error);
    return false;
  }
}

/**
 * Process pending payment retries
 */
export async function processPendingPaymentRetries(): Promise<void> {
  const automationRepo = getAutomationJobsRepository();
  const pendingJobs = await automationRepo.getPendingJobs('status_transition', 100);
  
  for (const job of pendingJobs) {
    if (job.entity_type === 'payment' && job.metadata?.action === 'retry_payment') {
      try {
        await automationRepo.updateJobStatus(job.id, 'processing');
        await retryPayment(job.entity_id);
        await automationRepo.updateJobStatus(job.id, 'completed');
      } catch (error) {
        console.error(`[PaymentRetry] Error processing retry for payment ${job.entity_id}:`, error);
        await automationRepo.incrementRetry(job.id);
      }
    }
  }
}

/**
 * Auto-cancel bookings with failed payments after timeout
 */
export async function autoCancelFailedPayments(): Promise<void> {
  const client = getDbClient();
  
  // Get payments that failed and are past timeout
  const { data: failedPayments } = await client
    .from('payments')
    .select('*')
    .eq('payment_status', 'failed')
    .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // 15 minutes ago
    .limit(100);
  
  if (!failedPayments) return;
  
  const bookingsRepo = getBookingsRepository();
  
  for (const payment of failedPayments) {
    if (payment.booking_id) {
      await bookingsRepo.cancel(payment.booking_id, 'Payment failed - booking automatically cancelled');
    }
  }
}

