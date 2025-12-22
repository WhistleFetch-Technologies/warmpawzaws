/**
 * ============================================================================
 * BOOKING SERVICE ROUTER
 * ============================================================================
 * 
 * Routes bookings to appropriate lifecycle handlers based on service type
 * Ensures all services go through complete lifecycle
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getBookingsRepository } from "../repositories/bookings.ts";
import { standardizeServiceStyle } from "../repositories/service-style-mapper.ts";

// ============================================================================
// SERVICE ROUTING
// ============================================================================

/**
 * Route booking creation to appropriate handlers
 */
export async function routeBookingCreation(
  bookingId: string,
  serviceType: string,
  bookingData: any
): Promise<void> {
  const bookingsRepo = getBookingsRepository();
  const booking = await bookingsRepo.findById(bookingId);
  
  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }
  
  const standardizedType = await standardizeServiceStyle(serviceType);
  
  // Route based on service characteristics
  if (bookingData.is_subscription) {
    // Nutrition subscription - create subscription
    const { createSubscription } = await import("./subscription-lifecycle.ts");
    await createSubscription(bookingId, {
      subscription_type: bookingData.subscription_type || 'monthly',
      billing_amount: booking.total_amount,
      start_date: booking.booking_date,
      auto_renew: bookingData.auto_renew !== false,
    });
  } else if (bookingData.requires_insurance) {
    // Insurance purchase - no special handler needed (product purchase)
    // Claims will be submitted separately
  } else if (bookingData.requires_adoption) {
    // Adoption - create application
    const { createAdoptionApplication } = await import("./adoption-approval.ts");
    await createAdoptionApplication(bookingId, {
      pet_id: bookingData.pet_id,
      application_data: bookingData.application_data || {},
    });
  } else if (bookingData.is_package) {
    // Package booking - create milestones
    const { createPackageMilestones } = await import("./package-milestone-tracking.ts");
    await createPackageMilestones(bookingId, {
      total_milestones: bookingData.total_milestones || bookingData.package_details?.total_sessions || 1,
      milestone_type: bookingData.milestone_type || 'session',
      start_date: booking.booking_date,
      start_time: booking.booking_time,
    });
  } else if (bookingData.is_emergency || serviceType === 'ambulance') {
    // Emergency service - create post-service payment option
    const { createPostServicePayment } = await import("./post-service-payment.ts");
    await createPostServicePayment(bookingId, booking.total_amount);
  }
}

/**
 * Route booking completion to appropriate handlers
 */
export async function routeBookingCompletion(bookingId: string): Promise<void> {
  const bookingsRepo = getBookingsRepository();
  const booking = await bookingsRepo.findById(bookingId);
  
  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }
  
  // Check if booking is package and has milestones
  if (booking.is_package) {
    const { getBookingMilestones } = await import("./package-milestone-tracking.ts");
    const milestones = await getBookingMilestones(bookingId);
    
    // If all milestones completed, proceed to settlement
    const allCompleted = milestones.every(m => m.status === 'completed');
    if (allCompleted) {
      await triggerSettlement(bookingId);
    }
  } else {
    // Regular booking - trigger settlement immediately
    await triggerSettlement(bookingId);
  }
}

/**
 * Trigger settlement for completed booking
 */
async function triggerSettlement(bookingId: string): Promise<void> {
  const bookingsRepo = getBookingsRepository();
  const booking = await bookingsRepo.findById(bookingId);
  
  if (!booking || !booking.vendor_id) {
    return; // No vendor to settle with
  }
  
  // Get payment
  const client = await import("../db.ts").then(m => m.getDbClient());
  const { data: payment } = await client
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('payment_status', 'completed')
    .single();
  
  if (!payment) {
    return; // No payment to settle
  }
  
  // Check if settlement already exists for this payment
  const { data: existingSettlements } = await client
    .from('settlements')
    .select('id, payment_ids')
    .eq('vendor_id', booking.vendor_id);
  
  const alreadySettled = existingSettlements?.some((s: any) => 
    Array.isArray(s.payment_ids) && s.payment_ids.includes(payment.id)
  );
  
  if (alreadySettled) {
    return; // Already settled
  }
  
  // Create settlement (will be processed by payout automation)
  const { createPayoutFromSettlement } = await import("./payout-processing.ts");
  try {
    // First create settlement
    const { data: settlement, error: settlementError } = await client
      .from('settlements')
      .insert({
        vendor_id: booking.vendor_id,
        total_amount: payment.amount,
        commission_amount: (payment.amount * 0.15), // 15% commission
        net_amount: (payment.amount * 0.85),
        settlement_status: 'pending',
        settlement_period_start: new Date().toISOString().split('T')[0],
        settlement_period_end: new Date().toISOString().split('T')[0],
        payment_ids: [payment.id],
      })
      .select()
      .single();
    
    if (settlement && !settlementError) {
      // Schedule payout
      await createPayoutFromSettlement(settlement.id);
    }
  } catch (error) {
    console.error(`[Settlement] Error creating settlement for booking ${bookingId}:`, error);
  }
}

