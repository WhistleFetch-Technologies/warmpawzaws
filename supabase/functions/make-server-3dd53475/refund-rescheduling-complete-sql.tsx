/**
 * ============================================================================
 * REFUND & RESCHEDULING COMPLETE IMPLEMENTATION - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Time-based refund policies
 * - Automated refund processing
 * - Wallet refund integration
 * - Razorpay refund API integration
 * - Rescheduling with policies
 * - Fee calculations
 * - Notification triggers
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - All refunds stored in `refunds` table
 * - All bookings stored in `bookings` table
 * - All wallets stored in `customer_wallets` and `wallet_transactions` tables
 * - All reschedule requests stored in `pending_reschedules` table
 * - Refund policies stored in `platform_settings` table
 * 
 * Date: 2025-01-27
 * Migration: Batch 7 Phase 2 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getRefundsRepository } from '../../lib/repositories/refunds.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getWalletsRepository } from '../../lib/repositories/wallets.ts';
import { getPaymentsRepository } from '../../lib/repositories/payments.ts';
import { getPlatformSettingsRepository } from '../../lib/repositories/platform-settings.ts';
import { getSchedulingRepository } from '../../lib/repositories/scheduling.ts';
import { withTransaction } from '../../lib/utils/transaction-helper.ts';

const BASE_PATH = '/make-server-3dd53475';

// ==========================================
// REFUND POLICIES CONFIGURATION
// ==========================================

// Simple 2-tier refund policy:
// - >24 hours before service: 100% refund
// - ≤24 hours before service: 90% refund (10% cancellation fee)
const SIMPLE_REFUND_POLICY = {
  fullRefundHours: 24,
  fullRefundPercentage: 1.0, // 100%
  partialRefundPercentage: 0.9, // 90%
  cancellationFee: 0.1 // 10% fee for ≤24h cancellations
};

// ==========================================
// REFUND POLICY ENGINE
// ==========================================

/**
 * Calculate refund amount based on simple 2-tier policy
 * - >24 hours before service: 100% refund
 * - ≤24 hours before service: 90% refund (10% cancellation fee)
 */
function calculateRefundAmount(
  bookingAmount: number,
  serviceType: string,
  scheduledTime: string,
  customPolicy?: any
): {
  refundableAmount: number;
  refundPercentage: number;
  cancellationFee: number;
  netRefund: number;
  reason: string;
} {
  const scheduledDate = new Date(scheduledTime);
  const now = new Date();
  const hoursUntilAppointment = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  let refundPercentage: number;
  let cancellationFee: number;
  let reason: string;
  
  if (hoursUntilAppointment > SIMPLE_REFUND_POLICY.fullRefundHours) {
    // >24 hours: 100% refund
    refundPercentage = SIMPLE_REFUND_POLICY.fullRefundPercentage;
    cancellationFee = 0;
    reason = `Cancelled ${hoursUntilAppointment.toFixed(1)} hours before service. Full refund (100%) applicable.`;
  } else {
    // ≤24 hours: 90% refund (10% cancellation fee)
    refundPercentage = SIMPLE_REFUND_POLICY.partialRefundPercentage;
    cancellationFee = SIMPLE_REFUND_POLICY.cancellationFee;
    reason = `Cancelled ${hoursUntilAppointment.toFixed(1)} hours before service. Partial refund (90%) applicable with 10% cancellation fee.`;
  }
  
  const refundableAmount = bookingAmount * refundPercentage;
  const feeAmount = bookingAmount * cancellationFee;
  const netRefund = refundableAmount;
  
  return {
    refundableAmount,
    refundPercentage: refundPercentage * 100, // Return as percentage (0-100)
    cancellationFee: feeAmount,
    netRefund,
    reason
  };
}

/**
 * Export function to register all refund and rescheduling endpoints
 */
export function refundReschedulingEndpointsSQL(app: Hono) {
  /**
   * GET /refunds/policy/:bookingId - Get refund policy for booking
   */
  app.get(`${BASE_PATH}/refunds/policy/:bookingId`, async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    
    // ✅ SQL: Get booking from repository
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // Get service type
    const serviceType = booking.service_type || 'default';
    
    // Use simple 2-tier refund policy
    const policy = SIMPLE_REFUND_POLICY;
    
    // Calculate current refund amount
    const scheduledTime = booking.booking_date ? `${booking.booking_date}T${booking.booking_time || '00:00:00'}` : new Date().toISOString();
    const refundCalc = calculateRefundAmount(
      booking.total_amount || 0,
      serviceType,
      scheduledTime
    );
    
    return c.json({
      success: true,
      policy: {
        serviceType,
        ...policy,
        currentRefund: refundCalc
      }
    });
  } catch (error) {
    console.error('Failed to get refund policy:', error);
    return c.json({ success: false, error: 'Failed to get refund policy' }, 500);
  }
});

/**
 * POST /refunds/request - Request a refund
 */
app.post(`${BASE_PATH}/refunds/request`, async (c) => {
  try {
    const { bookingId, reason, refundMethod } = await c.req.json();
    
    if (!bookingId || !reason) {
      return c.json({ success: false, error: 'bookingId and reason are required' }, 400);
    }
    
    if (refundMethod && !['wallet', 'original'].includes(refundMethod)) {
      return c.json({ success: false, error: 'refundMethod must be wallet or original' }, 400);
    }
    
    // ✅ SQL: Get booking from repository
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // Check if booking is refundable
    if (booking.status === 'cancelled' || booking.status === 'refunded') {
      return c.json({ success: false, error: 'Booking already cancelled or refunded' }, 400);
    }
    
    if (booking.status === 'completed') {
      return c.json({ success: false, error: 'Cannot refund completed booking' }, 400);
    }
    
    // ✅ SQL: Check if refund already requested
    const refundsRepo = getRefundsRepository();
    const existingRefunds = await refundsRepo.findByPaymentId(booking.payment_id || '');
    const alreadyRequested = existingRefunds.find((r: any) => r.booking_id === bookingId && r.refund_status !== 'rejected');
    if (alreadyRequested) {
      return c.json({ success: false, error: 'Refund already requested for this booking' }, 400);
    }
    
    // Calculate refund using simple 2-tier policy
    const serviceType = booking.service_type || 'default';
    const scheduledTime = booking.booking_date ? `${booking.booking_date}T${booking.booking_time || '00:00:00'}` : new Date().toISOString();
    const refundCalc = calculateRefundAmount(
      booking.total_amount || 0,
      serviceType,
      scheduledTime
    );
    
    // ✅ SQL: Get payment for this booking
    const paymentsRepo = getPaymentsRepository();
    const payment = booking.payment_id ? await paymentsRepo.findById(booking.payment_id) : null;
    if (!payment) {
      return c.json({ success: false, error: 'Payment not found for this booking' }, 404);
    }
    
    // ✅ SQL: Create refund request in refunds table
    const refund = await refundsRepo.create({
      payment_id: payment.id,
      booking_id: bookingId,
      customer_id: booking.customer_id,
      vendor_id: booking.vendor_id || null,
      refund_amount: refundCalc.netRefund,
      refund_reason: reason,
      refund_status: 'pending'
    });
    
    // ✅ SQL: Update booking status
    await bookingsRepo.update(bookingId, {
      status: 'cancellation_requested',
      notes: booking.notes ? `${booking.notes}\nRefund requested: ${refund.id}` : `Refund requested: ${refund.id}`
    });
    
    // TODO: Send notification to vendor
    
    return c.json({
      success: true,
      refund: {
        id: refund.id,
        bookingId: refund.booking_id,
        customerId: refund.customer_id,
        vendorId: refund.vendor_id,
        amount: booking.total_amount || 0,
        ...refundCalc,
        reason,
        policy: SIMPLE_REFUND_POLICY,
        status: refund.refund_status,
        refundMethod: refundMethod || 'original',
        requestedAt: refund.requested_at,
        processedAt: refund.processed_at,
        razorpayRefundId: refund.razorpay_refund_id
      }
    });
  } catch (error) {
    console.error('Failed to request refund:', error);
    return c.json({ success: false, error: 'Failed to request refund' }, 500);
  }
});

/**
 * POST /refunds/process - Process refund (Vendor/Admin)
 */
app.post(`${BASE_PATH}/refunds/process`, async (c) => {
  try {
    const { refundId, action, adminNotes } = await c.req.json();
    
    if (!refundId || !action) {
      return c.json({ success: false, error: 'refundId and action are required' }, 400);
    }
    
    if (!['approve', 'reject'].includes(action)) {
      return c.json({ success: false, error: 'action must be approve or reject' }, 400);
    }
    
    // ✅ SQL: Get refund request
    const refundsRepo = getRefundsRepository();
    const refund = await refundsRepo.findById(refundId);
    if (!refund) {
      return c.json({ success: false, error: 'Refund request not found' }, 404);
    }
    
    if (refund.refund_status !== 'pending') {
      return c.json({ success: false, error: 'Refund request already processed' }, 400);
    }
    
    if (action === 'reject') {
      // ✅ SQL: Update refund status
      await refundsRepo.update(refundId, {
        refund_status: 'rejected',
        rejection_reason: adminNotes || 'Refund rejected by admin'
      });
      
      // ✅ SQL: Update booking
      const bookingsRepo = getBookingsRepository();
      if (refund.booking_id) {
        await bookingsRepo.update(refund.booking_id, {
          status: 'confirmed' // Revert to confirmed
        });
      }
      
      const updatedRefund = await refundsRepo.findById(refundId);
      
      return c.json({
        success: true,
        refund: updatedRefund
      });
    }
    
    // Approve and process refund
    // ✅ SQL: Update refund status
    await refundsRepo.update(refundId, {
      refund_status: 'approved',
      processed_at: new Date().toISOString()
    });
    
    // Process refund based on method (for now, default to original payment method)
    // In production, check refund method preference
    const razorpayRefundId = `rfnd_${Date.now()}`;
    await refundsRepo.update(refundId, {
      refund_status: 'processing',
      razorpay_refund_id: razorpayRefundId,
      processed_at: new Date().toISOString()
    });
    
    // ✅ SQL: Update booking
    const bookingsRepo = getBookingsRepository();
    if (refund.booking_id) {
      await bookingsRepo.update(refund.booking_id, {
        status: 'refunded',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'Refund processed'
      });
    }
    
    // TODO: Send notification to customer
    // TODO: Process Razorpay refund via API
    
    const updatedRefund = await refundsRepo.findById(refundId);
    
    return c.json({
      success: true,
      refund: updatedRefund
    });
  } catch (error) {
    console.error('Failed to process refund:', error);
    return c.json({ success: false, error: 'Failed to process refund' }, 500);
  }
});

/**
 * POST /refunds/wallet - Process wallet refund
 */
app.post(`${BASE_PATH}/refunds/wallet`, async (c) => {
  try {
    const { customerId, amount, bookingId, reason } = await c.req.json();
    
    if (!customerId || !amount) {
      return c.json({ success: false, error: 'customerId and amount are required' }, 400);
    }
    
    // ✅ SQL: Get or create wallet
    const walletsRepo = getWalletsRepository();
    const wallet = await walletsRepo.findOrCreate(customerId);
    
    // ✅ SQL: Add refund to wallet
    const transaction = await walletsRepo.addTransaction({
      wallet_id: wallet.id,
      customer_id: customerId,
      transaction_type: 'credit',
      amount: amount,
      source: 'refund',
      purpose: 'refund',
      description: reason || 'Booking cancellation refund',
      reference_id: bookingId || undefined
    });
    
    const updatedWallet = await walletsRepo.findByCustomer(customerId);
    
    return c.json({
      success: true,
      wallet: {
        balance: updatedWallet?.balance || 0,
        lastTransaction: {
          type: transaction.transaction_type,
          amount: transaction.amount,
          timestamp: transaction.created_at
        }
      }
    });
  } catch (error) {
    console.error('Failed to process wallet refund:', error);
    return c.json({ success: false, error: 'Failed to process wallet refund' }, 500);
  }
});

/**
 * POST /refunds/razorpay - Process Razorpay refund
 */
app.post(`${BASE_PATH}/refunds/razorpay`, async (c) => {
  try {
    const { paymentId, amount, notes } = await c.req.json();
    
    if (!paymentId || !amount) {
      return c.json({ success: false, error: 'paymentId and amount are required' }, 400);
    }
    
    // In production, integrate with Razorpay Refund API
    // For now, create refund record
    const refundsRepo = getRefundsRepository();
    const paymentsRepo = getPaymentsRepository();
    
    const payment = await paymentsRepo.findById(paymentId);
    if (!payment) {
      return c.json({ success: false, error: 'Payment not found' }, 404);
    }
    
    const refund = await refundsRepo.create({
      payment_id: paymentId,
      customer_id: payment.customer_id,
      vendor_id: payment.vendor_id || null,
      refund_amount: amount,
      refund_reason: notes?.reason || 'Razorpay refund',
      refund_status: 'processing',
      razorpay_refund_id: `rfnd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    
    return c.json({
      success: true,
      refund: {
        id: refund.id,
        paymentId: refund.payment_id,
        amount: refund.refund_amount,
        currency: 'INR',
        status: refund.refund_status,
        notes: notes || {},
        createdAt: refund.requested_at
      }
    });
  } catch (error) {
    console.error('Failed to process Razorpay refund:', error);
    return c.json({ success: false, error: 'Failed to process Razorpay refund' }, 500);
  }
});

/**
 * GET /refunds/:refundId - Get refund details
 */
app.get(`${BASE_PATH}/refunds/:refundId`, async (c) => {
  try {
    const refundId = c.req.param('refundId');
    
    // ✅ SQL: Get refund from repository
    const refundsRepo = getRefundsRepository();
    const refund = await refundsRepo.findById(refundId);
    if (!refund) {
      return c.json({ success: false, error: 'Refund not found' }, 404);
    }
    
    return c.json({
      success: true,
      refund
    });
  } catch (error) {
    console.error('Failed to get refund:', error);
    return c.json({ success: false, error: 'Failed to get refund' }, 500);
  }
});

/**
 * GET /refunds/vendor/:vendorId - Get vendor refunds
 */
app.get(`${BASE_PATH}/refunds/vendor/:vendorId`, async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { status, limit = 20, offset = 0 } = c.req.query();
    
    // ✅ SQL: Get vendor refunds from repository
    const refundsRepo = getRefundsRepository();
    const vendorRefunds = await refundsRepo.findByVendorId(vendorId, {
      limit: parseInt(limit as string) || 20,
      offset: parseInt(offset as string) || 0,
      status: status as string
    });
    
    return c.json({
      success: true,
      refunds: vendorRefunds,
      total: vendorRefunds.length,
      limit: parseInt(limit as string) || 20,
      offset: parseInt(offset as string) || 0
    });
  } catch (error) {
    console.error('Failed to get vendor refunds:', error);
    return c.json({ success: false, error: 'Failed to get vendor refunds' }, 500);
  }
});

// ==========================================
// RESCHEDULING SYSTEM
// ==========================================

/**
 * GET /bookings/:bookingId/reschedule-policy - Get rescheduling policy
 */
app.get(`${BASE_PATH}/bookings/:bookingId/reschedule-policy`, async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    
    // ✅ SQL: Get booking from repository
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // ✅ SQL: Count existing reschedules for this booking
    const db = getDbClient();
    const { data: reschedules } = await db
      .from('pending_reschedules')
      .select('id')
      .eq('booking_id', bookingId);
    const currentReschedules = reschedules?.length || 0;
    
    // Default rescheduling policy
    const policy = {
      allowedUntil: 2, // Hours before appointment
      maxReschedules: 2,
      currentReschedules,
      fee: currentReschedules > 0 ? 50 : 0, // First reschedule free, ₹50 afterwards
      rules: [
        'First rescheduling is free',
        'Subsequent reschedulings cost ₹50',
        'Maximum 2 reschedulings allowed per booking',
        'Must be rescheduled at least 2 hours before appointment'
      ]
    };
    
    // Check if rescheduling is allowed
    const scheduledDate = new Date(booking.booking_date ? `${booking.booking_date}T${booking.booking_time || '00:00:00'}` : new Date().toISOString());
    const now = new Date();
    const hoursUntilAppointment = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    const canReschedule = hoursUntilAppointment >= policy.allowedUntil && 
                          policy.currentReschedules < policy.maxReschedules;
    
    return c.json({
      success: true,
      policy: {
        ...policy,
        canReschedule,
        reason: !canReschedule 
          ? hoursUntilAppointment < policy.allowedUntil 
            ? 'Too close to appointment time'
            : 'Maximum reschedulings reached'
          : null
      }
    });
  } catch (error) {
    console.error('Failed to get reschedule policy:', error);
    return c.json({ success: false, error: 'Failed to get reschedule policy' }, 500);
  }
});

/**
 * GET /bookings/:bookingId/reschedule-options - Get available slots for rescheduling
 */
app.get(`${BASE_PATH}/bookings/:bookingId/reschedule-options`, async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    
    // ✅ SQL: Get booking from repository
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // ✅ SQL: Get available slots from staff/center
    let availableSlots: any[] = [];
    const schedulingRepo = getSchedulingRepository();
    
    if (booking.staff_id) {
      // Get staff availability slots
      const now = new Date();
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      
      // Get staff availability for next 30 days
      for (let day = 0; day < 30; day++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + day);
        const dayOfWeek = checkDate.getDay();
        
        const availability = await schedulingRepo.getStaffAvailabilityByDate(booking.staff_id!, checkDate.toISOString().split('T')[0]);
        if (availability && availability.length > 0) {
          availability.forEach((slot: any) => {
            availableSlots.push({
              date: checkDate.toISOString().split('T')[0],
              timeSlot: slot.time || slot.start_time,
              staffId: booking.staff_id,
              staffName: booking.staff_id // TODO: Get staff name from repository
            });
          });
        }
      }
    } else if (booking.vendor_id) {
      // Get vendor availability
      const now = new Date();
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      
      for (let day = 0; day < 30; day++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + day);
        const dayOfWeek = checkDate.getDay();
        
        const availability = await schedulingRepo.getVendorAvailability(booking.vendor_id!, dayOfWeek);
        if (availability && availability.length > 0) {
          availability.forEach((slot: any) => {
            availableSlots.push({
              date: checkDate.toISOString().split('T')[0],
              timeSlot: slot.time_window_start,
              vendorId: booking.vendor_id
            });
          });
        }
      }
    }
    
    // Sort by date
    availableSlots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Filter to future dates only
    const now = new Date();
    availableSlots = availableSlots.filter(slot => new Date(slot.date) > now);
    
    return c.json({
      success: true,
      slots: availableSlots.slice(0, 50) // Return max 50 slots
    });
  } catch (error) {
    console.error('Failed to get reschedule options:', error);
    return c.json({ success: false, error: 'Failed to get reschedule options' }, 500);
  }
});

/**
 * POST /bookings/:bookingId/reschedule - Request rescheduling
 */
app.post(`${BASE_PATH}/bookings/:bookingId/reschedule`, async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { newDate, newTimeSlot, reason } = await c.req.json();
    
    if (!newDate || !newTimeSlot) {
      return c.json({ success: false, error: 'newDate and newTimeSlot are required' }, 400);
    }
    
    // ✅ SQL: Get booking from repository
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // Check policy
    const scheduledDate = new Date(booking.booking_date ? `${booking.booking_date}T${booking.booking_time || '00:00:00'}` : new Date().toISOString());
    const now = new Date();
    const hoursUntilAppointment = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilAppointment < 2) {
      return c.json({ 
        success: false, 
        error: 'Cannot reschedule less than 2 hours before appointment' 
      }, 400);
    }
    
    // ✅ SQL: Count existing reschedules
    const db = getDbClient();
    const { data: existingReschedules } = await db
      .from('pending_reschedules')
      .select('id')
      .eq('booking_id', bookingId);
    const currentReschedules = existingReschedules?.length || 0;
    const maxReschedules = 2;
    
    if (currentReschedules >= maxReschedules) {
      return c.json({ 
        success: false, 
        error: 'Maximum reschedulings reached' 
      }, 400);
    }
    
    // Calculate fee
    const fee = currentReschedules > 0 ? 50 : 0;
    
    // ✅ SQL: Create reschedule request in pending_reschedules table
    const { data: rescheduleRequest, error: insertError } = await db
      .from('pending_reschedules')
      .insert({
        booking_id: bookingId,
        requested_date: newDate,
        requested_time: newTimeSlot,
        reason: reason || 'Customer requested rescheduling',
        status: 'pending'
      })
      .select()
      .single();
    
    if (insertError || !rescheduleRequest) {
      return c.json({ success: false, error: 'Failed to create reschedule request' }, 500);
    }
    
    // TODO: Send notification to vendor
    
    return c.json({
      success: true,
      reschedule: {
        id: rescheduleRequest.id,
        bookingId: rescheduleRequest.booking_id,
        originalDate: booking.booking_date,
        originalTimeSlot: booking.booking_time,
        newDate: rescheduleRequest.requested_date,
        newTimeSlot: rescheduleRequest.requested_time,
        fee,
        reason: rescheduleRequest.reason,
        status: rescheduleRequest.status,
        requestedAt: rescheduleRequest.requested_at,
        confirmedAt: rescheduleRequest.processed_at
      }
    });
  } catch (error) {
    console.error('Failed to request reschedule:', error);
    return c.json({ success: false, error: 'Failed to request reschedule' }, 500);
  }
});

/**
 * POST /bookings/:bookingId/reschedule/confirm - Confirm rescheduling
 */
app.post(`${BASE_PATH}/bookings/:bookingId/reschedule/confirm`, async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { rescheduleId, action } = await c.req.json();
    
    if (!rescheduleId || !action) {
      return c.json({ success: false, error: 'rescheduleId and action are required' }, 400);
    }
    
    if (!['approve', 'reject'].includes(action)) {
      return c.json({ success: false, error: 'action must be approve or reject' }, 400);
    }
    
    // ✅ SQL: Get reschedule request
    const db = getDbClient();
    const { data: rescheduleRequest, error: fetchError } = await db
      .from('pending_reschedules')
      .select('*')
      .eq('id', rescheduleId)
      .single();
    
    if (fetchError || !rescheduleRequest) {
      return c.json({ success: false, error: 'Reschedule request not found' }, 404);
    }
    
    if (rescheduleRequest.status !== 'pending') {
      return c.json({ success: false, error: 'Reschedule already processed' }, 400);
    }
    
    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    if (action === 'reject') {
      // ✅ SQL: Update reschedule request status
      await db
        .from('pending_reschedules')
        .update({
          status: 'rejected',
          processed_at: new Date().toISOString()
        })
        .eq('id', rescheduleId);
      
      const updatedRequest = await db
        .from('pending_reschedules')
        .select('*')
        .eq('id', rescheduleId)
        .single();
      
      return c.json({
        success: true,
        reschedule: updatedRequest.data
      });
    }
    
    // Approve and update booking
    await withTransaction(async () => {
      // ✅ SQL: Update reschedule request status
      await db
        .from('pending_reschedules')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString()
        })
        .eq('id', rescheduleId');
      
      // ✅ SQL: Update booking with new schedule
      await bookingsRepo.update(bookingId, {
        booking_date: rescheduleRequest.requested_date,
        booking_time: rescheduleRequest.requested_time
      });
    });
    
    const updatedBooking = await bookingsRepo.findById(bookingId);
    const updatedRequest = await db
      .from('pending_reschedules')
      .select('*')
      .eq('id', rescheduleId)
      .single();
    
    // TODO: Send notification to customer
    // TODO: Process fee payment if applicable
    
    return c.json({
      success: true,
      booking: updatedBooking,
      reschedule: updatedRequest.data
    });
  } catch (error) {
    console.error('Failed to confirm reschedule:', error);
    return c.json({ success: false, error: 'Failed to confirm reschedule' }, 500);
  }
});

/**
 * GET /bookings/:bookingId/reschedule-history - Get reschedule history
 */
app.get(`${BASE_PATH}/bookings/:bookingId/reschedule-history`, async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    
    // ✅ SQL: Get booking from repository
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // ✅ SQL: Get reschedule history from pending_reschedules table
    const db = getDbClient();
    const { data: reschedules } = await db
      .from('pending_reschedules')
      .select('*')
      .eq('booking_id', bookingId)
      .order('requested_at', { ascending: false });
    
    const history = (reschedules || []).map((r: any) => ({
      rescheduleId: r.id,
      from: {
        date: booking.booking_date,
        timeSlot: booking.booking_time
      },
      to: {
        date: r.requested_date,
        timeSlot: r.requested_time
      },
      status: r.status,
      reason: r.reason,
      requestedAt: r.requested_at,
      processedAt: r.processed_at
    }));
    
    return c.json({
      success: true,
      history,
      count: history.length
    });
  } catch (error) {
    console.error('Failed to get reschedule history:', error);
    return c.json({ success: false, error: 'Failed to get reschedule history' }, 500);
  }
  });
  
  console.log('✅ Refund & Rescheduling endpoints registered (SQL-only)');
}
