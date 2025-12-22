/**
 * ============================================================================
 * POST-SERVICE PAYMENT HANDLER
 * ============================================================================
 * 
 * Handles post-service payment for emergency services
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import { getBookingsRepository } from "../repositories/bookings.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface PostServicePayment {
  id: string;
  booking_id: string;
  customer_id: string;
  vendor_id: string;
  amount: number;
  payment_status: 'pending' | 'processing' | 'completed' | 'failed';
  payment_method?: string | null;
  payment_id?: string | null;
  due_date: string;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// POST-SERVICE PAYMENT HANDLERS
// ============================================================================

/**
 * Create post-service payment for emergency booking
 */
export async function createPostServicePayment(
  bookingId: string,
  amount: number,
  dueDate?: string
): Promise<PostServicePayment> {
  const client = getDbClient();
  const bookingsRepo = getBookingsRepository();
  
  // Get booking
  const booking = await bookingsRepo.findById(bookingId);
  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }
  
  // Check if booking is emergency
  const isEmergency = booking.service_type === 'ambulance' || 
                     booking.notes?.toLowerCase().includes('emergency');
  
  if (!isEmergency) {
    throw new Error(`Post-service payment only allowed for emergency services`);
  }
  
  // Calculate due date (default: 7 days from now)
  const due = dueDate ? new Date(dueDate) : new Date();
  due.setDate(due.getDate() + 7);
  
  // Create post-service payment
  const { data: payment, error } = await client
    .from('post_service_payments')
    .insert({
      booking_id: bookingId,
      customer_id: booking.customer_id,
      vendor_id: booking.vendor_id || '',
      amount: amount,
      payment_status: 'pending',
      due_date: due.toISOString().split('T')[0],
    })
    .select()
    .single();
  
  if (error || !payment) {
    throw new Error(`Failed to create post-service payment: ${error?.message || 'Unknown error'}`);
  }
  
  // Update booking to allow completion without payment
  await bookingsRepo.update(bookingId, {
    payment_status: 'pending_post_service',
  });
  
  return payment as PostServicePayment;
}

/**
 * Process post-service payment
 */
export async function processPostServicePayment(
  paymentId: string,
  paymentMethod: string,
  transactionId?: string
): Promise<PostServicePayment> {
  const client = getDbClient();
  
  const { data: payment, error: getError } = await client
    .from('post_service_payments')
    .select('*')
    .eq('id', paymentId)
    .eq('payment_status', 'pending')
    .single();
  
  if (getError || !payment) {
    throw new Error(`Pending payment not found: ${paymentId}`);
  }
  
  // Create payment record
  const mainPaymentId = `pay_post_${Date.now()}`;
  const { data: mainPayment, error: paymentError } = await client
    .from('payments')
    .insert({
      id: mainPaymentId,
      booking_id: payment.booking_id,
      customer_id: payment.customer_id,
      vendor_id: payment.vendor_id,
      amount: payment.amount,
      currency: 'INR',
      payment_method: paymentMethod,
      payment_status: 'completed',
      transaction_id: transactionId,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (paymentError || !mainPayment) {
    throw new Error(`Failed to create payment: ${paymentError?.message || 'Unknown error'}`);
  }
  
  // Update post-service payment
  const { data: updated, error: updateError } = await client
    .from('post_service_payments')
    .update({
      payment_status: 'completed',
      payment_method: paymentMethod,
      payment_id: mainPaymentId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .select()
    .single();
  
  if (updateError || !updated) {
    throw new Error(`Failed to update payment: ${updateError?.message || 'Unknown error'}`);
  }
  
  // Update booking payment status
  const bookingsRepo = getBookingsRepository();
  await bookingsRepo.update(payment.booking_id, {
    payment_status: 'paid',
    payment_id: mainPaymentId,
  });
  
  return updated as PostServicePayment;
}

/**
 * Get post-service payment for booking
 */
export async function getBookingPostServicePayment(bookingId: string): Promise<PostServicePayment | null> {
  const client = getDbClient();
  
  const { data: payment, error } = await client
    .from('post_service_payments')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();
  
  if (error) {
    throw new Error(`Error fetching post-service payment: ${error.message}`);
  }
  
  return payment as PostServicePayment | null;
}

