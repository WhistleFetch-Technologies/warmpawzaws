/**
 * ============================================================================
 * BOOKING AUTOMATION SERVICE
 * ============================================================================
 * 
 * Handles automatic booking status transitions and business rule enforcement
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getBookingsRepository } from "../repositories/bookings.ts";
import { getAutomationJobsRepository } from "../repositories/automation-jobs.ts";
import { getDbClient, selectQuery } from "../db.ts";
import type { Booking } from "../repositories/bookings.ts";

// ============================================================================
// AUTOMATIC STATUS TRANSITIONS
// ============================================================================

/**
 * Automatically transition booking status based on time and conditions
 */
export async function processAutomaticStatusTransitions(): Promise<void> {
  const bookingsRepo = getBookingsRepository();
  const automationRepo = getAutomationJobsRepository();
  
  // Get all pending automatic transitions
  const pendingJobs = await automationRepo.getPendingJobs('status_transition', 100);
  
  for (const job of pendingJobs) {
    try {
      await automationRepo.updateJobStatus(job.id, 'processing');
      
      const booking = await bookingsRepo.findById(job.entity_id);
      if (!booking) {
        await automationRepo.updateJobStatus(job.id, 'failed', 'Booking not found');
        continue;
      }
      
      // Execute transition based on metadata
      const transition = job.metadata?.transition;
      if (transition) {
        await bookingsRepo.update(booking.id, {
          status: transition.to_status,
        });
        
        // Log transition
        const client = getDbClient();
        await client.from('booking_status_transitions').insert({
          booking_id: booking.id,
          from_status: transition.from_status,
          to_status: transition.to_status,
          transition_type: 'automatic',
          executed_at: new Date().toISOString(),
        });
      }
      
      await automationRepo.updateJobStatus(job.id, 'completed');
    } catch (error) {
      console.error(`[BookingAutomation] Error processing job ${job.id}:`, error);
      await automationRepo.incrementRetry(job.id);
    }
  }
}

/**
 * Schedule automatic status transition
 */
export async function scheduleStatusTransition(
  bookingId: string,
  fromStatus: string,
  toStatus: string,
  scheduledAt: Date
): Promise<void> {
  const automationRepo = getAutomationJobsRepository();
  
  await automationRepo.createJob({
    job_type: 'status_transition',
    entity_type: 'booking',
    entity_id: bookingId,
    scheduled_at: scheduledAt.toISOString(),
    metadata: {
      transition: {
        from_status: fromStatus,
        to_status: toStatus,
      },
    },
  });
}

/**
 * Auto-confirm bookings that are pending for too long (e.g., 24 hours before service)
 */
export async function autoConfirmPendingBookings(): Promise<void> {
  const bookingsRepo = getBookingsRepository();
  const pendingBookings = await bookingsRepo.findPending({ limit: 100 });
  
  const now = new Date();
  
  for (const booking of pendingBookings) {
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
    const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // Auto-confirm if booking is less than 24 hours away and still pending
    if (hoursUntilBooking < 24 && hoursUntilBooking > 0) {
      await bookingsRepo.confirm(booking.id);
      
      // Schedule auto-start for in_progress (30 minutes before booking time)
      const startTime = new Date(bookingDateTime.getTime() - 30 * 60 * 1000);
      if (startTime > now) {
        await scheduleStatusTransition(booking.id, 'confirmed', 'in_progress', startTime);
      }
    }
  }
}

/**
 * Auto-complete bookings that are in_progress and past their end time
 */
export async function autoCompleteInProgressBookings(): Promise<void> {
  const bookingsRepo = getBookingsRepository();
  const client = getDbClient();
  
  // Get in_progress bookings
  const { data: bookings } = await client
    .from('bookings')
    .select('*')
    .eq('status', 'in_progress')
    .limit(100);
  
  if (!bookings) return;
  
  const now = new Date();
  
  for (const booking of bookings as Booking[]) {
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
    // Assume service duration is 1 hour if not specified
    const endTime = new Date(bookingDateTime.getTime() + 60 * 60 * 1000);
    
    // Auto-complete if past end time
    if (now > endTime) {
      await bookingsRepo.complete(booking.id);
    }
  }
}

/**
 * Auto-cancel bookings with failed payments after timeout
 */
export async function autoCancelFailedPaymentBookings(): Promise<void> {
  const client = getDbClient();
  
  // Get bookings with pending payment that are past timeout
  const { data: bookings } = await client
    .from('bookings')
    .select('*')
    .eq('payment_status', 'pending')
    .eq('status', 'pending')
    .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // 15 minutes ago
    .limit(100);
  
  if (!bookings) return;
  
  const bookingsRepo = getBookingsRepository();
  
  for (const booking of bookings as Booking[]) {
    await bookingsRepo.cancel(booking.id, 'Payment timeout - booking automatically cancelled');
  }
}

// ============================================================================
// BUSINESS RULE ENFORCEMENT
// ============================================================================

/**
 * Enforce cancellation policy
 */
export async function enforceCancellationPolicy(
  bookingId: string,
  cancellationReason: string
): Promise<{ refundPercentage: number; feePercentage: number }> {
  const bookingsRepo = getBookingsRepository();
  const booking = await bookingsRepo.findById(bookingId);
  
  if (!booking) {
    throw new Error('Booking not found');
  }
  
  const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
  const now = new Date();
  const hoursBefore = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  // Get cancellation policy
  const client = getDbClient();
  const { data: policies } = await client
    .from('cancellation_policies')
    .select('*')
    .eq('is_active', true)
    .or(`service_type.is.null,service_type.eq.${booking.service_type}`)
    .order('hours_before_booking', { ascending: false })
    .limit(1);
  
  if (policies && policies[0]) {
    const policy = policies[0];
    if (hoursBefore >= policy.hours_before_booking) {
      return {
        refundPercentage: policy.refund_percentage,
        feePercentage: policy.cancellation_fee_percentage,
      };
    }
  }
  
  // Default: No refund if less than 2 hours
  if (hoursBefore < 2) {
    return { refundPercentage: 0, feePercentage: 100 };
  }
  
  // Default: 50% refund if 2-24 hours
  if (hoursBefore < 24) {
    return { refundPercentage: 50, feePercentage: 50 };
  }
  
  // Default: Full refund if more than 24 hours
  return { refundPercentage: 100, feePercentage: 0 };
}

/**
 * Enforce rescheduling policy
 */
export async function enforceReschedulingPolicy(
  bookingId: string
): Promise<{ allowed: boolean; feePercentage: number; maxReschedules: number }> {
  const bookingsRepo = getBookingsRepository();
  const booking = await bookingsRepo.findById(bookingId);
  
  if (!booking) {
    throw new Error('Booking not found');
  }
  
  // Check reschedule count
  const client = getDbClient();
  const { data: reschedules } = await client
    .from('bookings')
    .select('id')
    .eq('rescheduled_from_booking_id', bookingId)
    .limit(10);
  
  const rescheduleCount = reschedules?.length || 0;
  
  // Get rescheduling policy
  const { data: policies } = await client
    .from('rescheduling_policies')
    .select('*')
    .eq('is_active', true)
    .or(`service_type.is.null,service_type.eq.${booking.service_type}`)
    .limit(1);
  
  if (policies && policies[0]) {
    const policy = policies[0];
    return {
      allowed: rescheduleCount < policy.max_reschedules,
      feePercentage: policy.rescheduling_fee_percentage,
      maxReschedules: policy.max_reschedules,
    };
  }
  
  // Default: Allow up to 3 reschedules
  return {
    allowed: rescheduleCount < 3,
    feePercentage: 0,
    maxReschedules: 3,
  };
}

/**
 * Enforce no-show policy
 */
export async function enforceNoShowPolicy(bookingId: string): Promise<{ penaltyPercentage: number; shouldBlacklist: boolean }> {
  const bookingsRepo = getBookingsRepository();
  const booking = await bookingsRepo.findById(bookingId);
  
  if (!booking) {
    throw new Error('Booking not found');
  }
  
  // Get customer's no-show count
  const client = getDbClient();
  const { data: noShows } = await client
    .from('bookings')
    .select('id')
    .eq('customer_id', booking.customer_id)
    .eq('status', 'no_show')
    .limit(10);
  
  const noShowCount = noShows?.length || 0;
  
  // Get no-show policy
  const { data: policies } = await client
    .from('no_show_policies')
    .select('*')
    .eq('is_active', true)
    .or(`service_type.is.null,service_type.eq.${booking.service_type}`)
    .limit(1);
  
  if (policies && policies[0]) {
    const policy = policies[0];
    return {
      penaltyPercentage: policy.penalty_percentage,
      shouldBlacklist: noShowCount >= policy.blacklist_after_count,
    };
  }
  
  // Default policy
  return {
    penaltyPercentage: 50,
    shouldBlacklist: noShowCount >= 3,
  };
}

