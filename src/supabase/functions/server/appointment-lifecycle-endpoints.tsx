// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import {
  getBookingsRepository,
  getVendorsRepository,
  getStaffRepository,
  getCustomersRepository,
  getRefundPoliciesRepository,
  getWalletsRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

const app = new Hono();

// ============================================
// APPOINTMENT LIFECYCLE ENDPOINTS
// ============================================

// Helper: Get refund policy from admin settings
async function getRefundPolicy(vendorRoleId: string, serviceStyle: string) {
  // ✅ SQL: Get refund policy from platform settings
  const refundPoliciesRepo = getRefundPoliciesRepository();
  const policy = await refundPoliciesRepo.findByRoleAndStyle(vendorRoleId, serviceStyle);
  
  // Default policy if not found
  const defaultPolicy = {
    allowRefund: true,
    refundPercentage: 100,
    cancellationWindow: 24, // hours before appointment
    cancellationFeePercentage: 10
  };

  return { 
    policy: policy || defaultPolicy, 
    refundSettings: { 
      policies: policy ? { [vendorRoleId]: policy } : {},
      cancellationFees: {},
      vendorPenalties: {}
    } 
  };
}

// Helper: Calculate refund amount
function calculateRefundAmount(
  originalAmount: number,
  policy: any,
  hoursUntilAppointment: number,
  refundToWallet: boolean
) {
  // If refund to wallet, always 100% refund (no cancellation fee)
  if (refundToWallet) {
    return {
      refundAmount: originalAmount,
      cancellationFee: 0,
      refundPercentage: 100
    };
  }

  // If refund to original source, apply cancellation fee
  let refundPercentage = policy.refundPercentage || 100;
  
  // Check if within cancellation window
  if (hoursUntilAppointment < (policy.cancellationWindow || 24)) {
    // Apply cancellation fee
    const cancellationFeePercentage = policy.cancellationFeePercentage || 10;
    refundPercentage = refundPercentage - cancellationFeePercentage;
  }

  const refundAmount = (originalAmount * refundPercentage) / 100;
  const cancellationFee = originalAmount - refundAmount;

  return {
    refundAmount,
    cancellationFee,
    refundPercentage
  };
}

// GET /appointment/:appointmentId - Get appointment details
app.get('/:appointmentId', async (c) => {
  const { appointmentId } = c.req.param();

  try {
    // ✅ SQL: Get appointment (booking)
    const bookingsRepo = getBookingsRepository();
    const appointment = await bookingsRepo.findById(appointmentId);
    
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // ✅ SQL: Get vendor details
    const vendorsRepo = getVendorsRepository();
    const vendorId = appointment.vendor_id || appointment.vendorId;
    const vendor = vendorId ? await vendorsRepo.findById(vendorId) : null;
    
    // ✅ SQL: Get staff details
    const staffRepo = getStaffRepository();
    const staffId = appointment.staff_id || appointment.staffId;
    const staff = staffId ? await staffRepo.findById(staffId) : null;

    // ✅ SQL: Get customer details
    const customersRepo = getCustomersRepository();
    const customerId = appointment.customer_id || appointment.customerId;
    const customer = customerId ? await customersRepo.findById(customerId) : null;

    // ✅ SQL: Get location details if applicable
    let location = null;
    const locationId = appointment.location_id || appointment.locationId;
    if (locationId && vendorId) {
      const db = getDbClient();
      const { data: locations } = await db
        .from('vendor_locations')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('id', locationId)
        .single();
      location = locations;
    }

    return c.json({
      success: true,
      appointment,
      vendor,
      staff,
      customer,
      location
    });
  } catch (error) {
    console.error(`❌ Error fetching appointment ${appointmentId}:`, error);
    return c.json({ error: 'Failed to fetch appointment' }, 500);
  }
});

// POST /appointment/:appointmentId/reschedule - Reschedule appointment
app.post('/:appointmentId/reschedule', async (c) => {
  const { appointmentId } = c.req.param();
  const { newDate, newTime } = await c.req.json();

  if (!newDate || !newTime) {
    return c.json({ error: 'New date and time are required' }, 400);
  }

  try {
    // ✅ SQL: Get appointment
    const bookingsRepo = getBookingsRepository();
    const appointment = await bookingsRepo.findById(appointmentId);
    
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // Check if appointment can be rescheduled
    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
      return c.json({ error: 'Cannot reschedule completed or cancelled appointment' }, 400);
    }

    // Check if service has started (for packages)
    if (appointment.isPackage && appointment.completedSessions > 0) {
      return c.json({ 
        error: `Cannot reschedule - ${appointment.completedSessions} session(s) already completed` 
      }, 400);
    }

    // Check if appointment has started (for single bookings)
    if (appointment.status === 'in_progress') {
      return c.json({ error: 'Cannot reschedule - service already started' }, 400);
    }

    // Check if staff is available at new time
    // ✅ Lambda: Use relative path or API Gateway URL for internal calls
    const apiBaseUrl = process.env.API_GATEWAY_URL || 'https://api.warmpawz.com';
    const staffSlotCheck = await fetch(
      `${apiBaseUrl}/make-server-3dd53475/staff/${appointment.staffId}/available-slots?date=${newDate}&duration=${appointment.duration}&serviceStyle=${appointment.serviceStyle}`,
      {
        headers: { 
          'Authorization': `Bearer ${process.env.API_KEY || ''}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (staffSlotCheck.ok) {
      const slotsData = await staffSlotCheck.json();
      const isAvailable = slotsData.availableSlots?.some((slot: any) => slot.startTime === newTime);
      
      if (!isAvailable) {
        return c.json({ error: 'Selected time slot is not available' }, 400);
      }
    }

    // Save old date/time for history
    const oldDate = appointment.date;
    const oldTime = appointment.startTime;

    // ✅ SQL: Update appointment
    const bookingsRepo = getBookingsRepository();
    const rescheduleHistory = appointment.reschedule_history || appointment.rescheduleHistory || [];
    rescheduleHistory.push({
      oldDate,
      oldTime,
      newDate,
      newTime,
      rescheduledAt: new Date().toISOString()
    });
    
    await bookingsRepo.update(appointmentId, {
      scheduled_date: newDate,
      scheduled_time: newTime,
      reschedule_count: (appointment.reschedule_count || appointment.rescheduleCount || 0) + 1,
      reschedule_history: rescheduleHistory,
      updated_at: new Date().toISOString()
    });
    
    const updatedAppointment = await bookingsRepo.findById(appointmentId);

    console.log(`✅ Appointment ${appointmentId} rescheduled from ${oldDate} ${oldTime} to ${newDate} ${newTime}`);

    return c.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error(`❌ Error rescheduling appointment ${appointmentId}:`, error);
    return c.json({ error: 'Failed to reschedule appointment' }, 500);
  }
});

// POST /appointment/:appointmentId/cancel - Cancel appointment with refund
app.post('/:appointmentId/cancel', async (c) => {
  const { appointmentId } = c.req.param();
  const { 
    cancelledBy, // 'customer' or 'vendor'
    reason,
    refundMethod // 'wallet' or 'original'
  } = await c.req.json();

  if (!cancelledBy) {
    return c.json({ error: 'cancelledBy is required' }, 400);
  }

  try {
    // ✅ SQL: Get appointment
    const bookingsRepo = getBookingsRepository();
    const appointment = await bookingsRepo.findById(appointmentId);
    
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // Check if appointment can be cancelled
    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
      return c.json({ error: 'Appointment already completed or cancelled' }, 400);
    }

    // Check if service has started
    if (appointment.status === 'in_progress' && cancelledBy === 'customer') {
      return c.json({ error: 'Cannot cancel - service already started' }, 400);
    }

    // Check if package has started
    if (appointment.isPackage && appointment.completedSessions > 0 && cancelledBy === 'customer') {
      return c.json({ 
        error: `Cannot cancel - ${appointment.completedSessions} session(s) already completed` 
      }, 400);
    }

    // Get refund policy
    const { policy, refundSettings } = await getRefundPolicy(
      appointment.vendor_role_id || appointment.vendorRoleId || 'veterinarian',
      appointment.service_style || appointment.serviceStyle || 'at_center'
    );

    // Calculate hours until appointment
    const appointmentDateTime = new Date(`${appointment.scheduled_date || appointment.date}T${appointment.scheduled_time || appointment.startTime}:00`);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Determine refund method (customer choice or auto)
    const refundToWallet = cancelledBy === 'vendor' ? true : (refundMethod === 'wallet');

    // Calculate refund
    const refundCalculation = calculateRefundAmount(
      appointment.total_amount || appointment.amount || 0,
      policy,
      hoursUntilAppointment,
      refundToWallet
    );

    // ✅ SQL: Process refund to wallet
    if (refundCalculation.refundAmount > 0 && refundToWallet) {
      const walletsRepo = getWalletsRepository();
      const customerId = appointment.customer_id || appointment.customerId;
      await walletsRepo.credit({
        customer_id: customerId,
        amount: refundCalculation.refundAmount,
        source: 'refund',
        description: `Refund for cancelled appointment #${appointmentId}`,
        reference_id: appointmentId
      });
    }

    // ✅ SQL: Apply vendor penalty if vendor cancelled
    if (cancelledBy === 'vendor') {
      const vendorPenaltyPercentage = refundSettings.vendorPenalties?.[appointment.vendor_role_id || appointment.vendorRoleId] || 5;
      const vendorPenalty = (appointment.total_amount || appointment.amount || 0) * (vendorPenaltyPercentage / 100);
      
      // ✅ SQL: Record vendor penalty
      const db = getDbClient();
      const vendorId = appointment.vendor_id || appointment.vendorId;
      await db.from('vendor_penalties').insert({
        id: `${appointmentId}_penalty_${Date.now()}`,
        vendor_id: vendorId,
        appointment_id: appointmentId,
        amount: vendorPenalty,
        reason: 'Appointment cancelled by vendor',
        created_at: new Date().toISOString()
      });
    }

    // ✅ SQL: Update appointment status
    const bookingsRepo = getBookingsRepository();
    await bookingsRepo.update(appointmentId, {
      status: 'cancelled',
      cancelled_by: cancelledBy,
      cancellation_reason: reason || 'No reason provided',
      cancelled_at: new Date().toISOString(),
      refund_amount: refundCalculation.refundAmount,
      cancellation_fee: refundCalculation.cancellationFee,
      refund_method: refundToWallet ? 'wallet' : 'original',
      refund_status: refundToWallet ? 'completed' : 'pending',
      updated_at: new Date().toISOString()
    });
    
    const cancelledAppointment = await bookingsRepo.findById(appointmentId);

    console.log(`✅ Appointment ${appointmentId} cancelled by ${cancelledBy}`);
    console.log(`   Refund: ₹${refundCalculation.refundAmount} (${refundCalculation.refundPercentage}%)`);
    console.log(`   Cancellation fee: ₹${refundCalculation.cancellationFee}`);
    console.log(`   Refund method: ${refundToWallet ? 'wallet' : 'original'}`);

    return c.json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment: cancelledAppointment,
      refund: {
        amount: refundCalculation.refundAmount,
        cancellationFee: refundCalculation.cancellationFee,
        percentage: refundCalculation.refundPercentage,
        method: refundToWallet ? 'wallet' : 'original',
        status: refundToWallet ? 'completed' : 'pending'
      }
    });
  } catch (error) {
    console.error(`❌ Error cancelling appointment ${appointmentId}:`, error);
    return c.json({ error: 'Failed to cancel appointment' }, 500);
  }
});

// GET /appointments/customer/:customerId - Get all customer appointments
app.get('/customer/:customerId', async (c) => {
  const { customerId } = c.req.param();
  const status = c.req.query('status'); // upcoming, completed, cancelled, all

  try {
    // ✅ SQL: Get customer appointments
    const bookingsRepo = getBookingsRepository();
    let customerAppointments = await bookingsRepo.findByCustomer(customerId);

    // Filter by status if provided
    if (status && status !== 'all') {
      if (status === 'upcoming') {
        const now = new Date();
        customerAppointments = customerAppointments.filter((apt: any) => {
          const aptDate = new Date(`${apt.scheduled_date || apt.date}T${apt.scheduled_time || apt.startTime}:00`);
          return apt.status !== 'cancelled' && apt.status !== 'completed' && aptDate >= now;
        });
      } else {
        customerAppointments = customerAppointments.filter((apt: any) => 
          apt.status === status
        );
      }
    }

    // Sort by date (newest first)
    customerAppointments.sort((a: any, b: any) => {
      const dateA = new Date(`${a.scheduled_date || a.date}T${a.scheduled_time || a.startTime}:00`);
      const dateB = new Date(`${b.scheduled_date || b.date}T${b.scheduled_time || b.startTime}:00`);
      return dateB.getTime() - dateA.getTime();
    });

    return c.json({
      success: true,
      appointments: customerAppointments,
      count: customerAppointments.length
    });
  } catch (error) {
    console.error(`❌ Error fetching appointments for customer ${customerId}:`, error);
    return c.json({ error: 'Failed to fetch appointments' }, 500);
  }
});

export default app;
