/**
 * ============================================================================
 * SUBSCRIPTION LIFECYCLE MANAGEMENT
 * ============================================================================
 * 
 * Handles subscription lifecycle: active, paused, renewal, cancellation
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

export interface Subscription {
  id: string;
  booking_id: string;
  customer_id: string;
  vendor_id?: string | null;
  service_id: string;
  subscription_type: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  status: 'active' | 'paused' | 'cancelled' | 'expired' | 'renewal_pending';
  start_date: string;
  end_date?: string | null;
  next_billing_date?: string | null;
  billing_amount: number;
  auto_renew: boolean;
  payment_method?: string | null;
  last_payment_id?: string | null;
  pause_reason?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SUBSCRIPTION LIFECYCLE
// ============================================================================

/**
 * Create subscription from booking
 */
export async function createSubscription(
  bookingId: string,
  subscriptionData: {
    subscription_type: string;
    billing_amount: number;
    start_date: string;
    auto_renew?: boolean;
  }
): Promise<Subscription> {
  const client = getDbClient();
  const bookingsRepo = getBookingsRepository();
  
  // Get booking
  const booking = await bookingsRepo.findById(bookingId);
  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }
  
  // Calculate next billing date
  const startDate = new Date(subscriptionData.start_date);
  const nextBillingDate = calculateNextBillingDate(startDate, subscriptionData.subscription_type);
  
  // Create subscription
  const { data: subscription, error } = await client
    .from('subscriptions')
    .insert({
      booking_id: bookingId,
      customer_id: booking.customer_id,
      vendor_id: booking.vendor_id,
      service_id: booking.service_id,
      subscription_type: subscriptionData.subscription_type,
      status: 'active',
      start_date: subscriptionData.start_date,
      next_billing_date: nextBillingDate.toISOString().split('T')[0],
      billing_amount: subscriptionData.billing_amount,
      auto_renew: subscriptionData.auto_renew !== false,
    })
    .select()
    .single();
  
  if (error || !subscription) {
    throw new Error(`Failed to create subscription: ${error?.message || 'Unknown error'}`);
  }
  
  // Update booking status
  await bookingsRepo.update(bookingId, {
    status: 'active',
  });
  
  // Schedule first delivery
  await scheduleSubscriptionDelivery(subscription.id, startDate);
  
  return subscription as Subscription;
}

/**
 * Calculate next billing date
 */
function calculateNextBillingDate(startDate: Date, subscriptionType: string): Date {
  const nextDate = new Date(startDate);
  
  switch (subscriptionType) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
  }
  
  return nextDate;
}

/**
 * Pause subscription
 */
export async function pauseSubscription(
  subscriptionId: string,
  reason?: string
): Promise<Subscription> {
  const client = getDbClient();
  
  const { data: subscription, error } = await client
    .from('subscriptions')
    .update({
      status: 'paused',
      pause_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .select()
    .single();
  
  if (error || !subscription) {
    throw new Error(`Failed to pause subscription: ${error?.message || 'Unknown error'}`);
  }
  
  // Update booking status
  const bookingsRepo = getBookingsRepository();
  await bookingsRepo.update(subscription.booking_id, {
    status: 'paused',
  });
  
  return subscription as Subscription;
}

/**
 * Resume subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<Subscription> {
  const client = getDbClient();
  
  const { data: subscription, error } = await client
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();
  
  if (error || !subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }
  
  // Recalculate next billing date
  const today = new Date();
  const nextBillingDate = calculateNextBillingDate(today, subscription.subscription_type);
  
  const { data: updated, error: updateError } = await client
    .from('subscriptions')
    .update({
      status: 'active',
      pause_reason: null,
      next_billing_date: nextBillingDate.toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .select()
    .single();
  
  if (updateError || !updated) {
    throw new Error(`Failed to resume subscription: ${updateError?.message || 'Unknown error'}`);
  }
  
  // Update booking status
  const bookingsRepo = getBookingsRepository();
  await bookingsRepo.update(updated.booking_id, {
    status: 'active',
  });
  
  return updated as Subscription;
}

/**
 * Process subscription renewal
 */
export async function processSubscriptionRenewal(subscriptionId: string): Promise<{
  success: boolean;
  paymentId?: string;
  error?: string;
}> {
  const client = getDbClient();
  
  const { data: subscription, error: getError } = await client
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .eq('status', 'renewal_pending')
    .single();
  
  if (getError || !subscription) {
    return { success: false, error: 'Subscription not found or not pending renewal' };
  }
  
  try {
    // Process payment
    const { processPayment } = await import("./payment-retry.ts");
    // For now, create payment record
    const paymentId = `pay_sub_${Date.now()}`;
    
    const { data: payment, error: paymentError } = await client
      .from('payments')
      .insert({
        id: paymentId,
        customer_id: subscription.customer_id,
        vendor_id: subscription.vendor_id,
        amount: subscription.billing_amount,
        currency: 'INR',
        payment_method: subscription.payment_method || 'razorpay',
        payment_status: 'processing',
      })
      .select()
      .single();
    
    if (paymentError || !payment) {
      return { success: false, error: 'Payment creation failed' };
    }
    
    // Update subscription
    const nextBillingDate = calculateNextBillingDate(new Date(), subscription.subscription_type);
    
    await client
      .from('subscriptions')
      .update({
        status: 'active',
        next_billing_date: nextBillingDate.toISOString().split('T')[0],
        last_payment_id: paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);
    
    // Create subscription payment record
    await client
      .from('subscription_payments')
      .insert({
        subscription_id: subscriptionId,
        payment_id: paymentId,
        billing_date: new Date().toISOString().split('T')[0],
        amount: subscription.billing_amount,
        payment_status: 'processing',
      });
    
    // Schedule next delivery
    await scheduleSubscriptionDelivery(subscriptionId, new Date(nextBillingDate));
    
    return { success: true, paymentId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Schedule subscription delivery
 */
async function scheduleSubscriptionDelivery(
  subscriptionId: string,
  deliveryDate: Date
): Promise<void> {
  const client = getDbClient();
  
  await client
    .from('subscription_deliveries')
    .insert({
      subscription_id: subscriptionId,
      delivery_date: deliveryDate.toISOString().split('T')[0],
      delivery_status: 'pending',
    });
  
  // Schedule automation job for delivery
  const automationRepo = getAutomationJobsRepository();
  await automationRepo.createJob({
    job_type: 'shipment_creation',
    entity_type: 'subscription',
    entity_id: subscriptionId,
    scheduled_at: deliveryDate.toISOString(),
    metadata: {
      action: 'create_delivery',
    },
  });
}

/**
 * Process pending renewals
 */
export async function processPendingRenewals(): Promise<{
  processed: number;
  failed: number;
}> {
  const client = getDbClient();
  const stats = { processed: 0, failed: 0 };
  
  // Get subscriptions with renewal pending
  const { data: subscriptions } = await client
    .from('subscriptions')
    .select('*')
    .eq('status', 'renewal_pending')
    .lte('next_billing_date', new Date().toISOString().split('T')[0])
    .limit(100);
  
  if (!subscriptions) return stats;
  
  for (const subscription of subscriptions) {
    const result = await processSubscriptionRenewal(subscription.id);
    if (result.success) {
      stats.processed++;
    } else {
      stats.failed++;
    }
  }
  
  return stats;
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelledBy: string
): Promise<Subscription> {
  const client = getDbClient();
  
  const { data: subscription, error } = await client
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: cancelledBy,
      auto_renew: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .select()
    .single();
  
  if (error || !subscription) {
    throw new Error(`Failed to cancel subscription: ${error?.message || 'Unknown error'}`);
  }
  
  // Update booking status
  const bookingsRepo = getBookingsRepository();
  await bookingsRepo.update(subscription.booking_id, {
    status: 'cancelled',
  });
  
  return subscription as Subscription;
}

