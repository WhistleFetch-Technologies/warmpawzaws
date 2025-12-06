import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// ============================================
// APPOINTMENT LIFECYCLE ENDPOINTS
// ============================================

// Helper: Get refund policy from admin settings
async function getRefundPolicy(vendorRoleId: string, serviceStyle: string) {
  const refundSettings = await kv.get('platform:refund_settings') || {
    policies: {},
    cancellationFees: {},
    vendorPenalties: {}
  };

  // Get policy for this vendor role and service style
  const policyKey = `${vendorRoleId}_${serviceStyle}`;
  const policy = refundSettings.policies[policyKey] || refundSettings.policies[vendorRoleId] || {
    // Default policy
    allowRefund: true,
    refundPercentage: 100,
    cancellationWindow: 24, // hours before appointment
    cancellationFeePercentage: 10
  };

  return { policy, refundSettings };
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
    const appointment = await kv.get(`appointment:${appointmentId}`);
    
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // Get vendor details
    const vendor = await kv.get(`vendor:${appointment.vendorId}`);
    
    // Get staff details
    const staff = await kv.get(`staff:${appointment.staffId}`);

    // Get customer details
    const customer = await kv.get(`customer:${appointment.customerId}`);

    // Get location details if applicable
    let location = null;
    if (appointment.locationId) {
      const locations = await kv.get(`vendor:${appointment.vendorId}:locations`) || [];
      location = locations.find((loc: any) => loc.id === appointment.locationId);
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
    const appointment = await kv.get(`appointment:${appointmentId}`);
    
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
    const staffSlotCheck = await fetch(
      `https://${Deno.env.get('SUPABASE_URL')}/functions/v1/make-server-3dd53475/staff/${appointment.staffId}/available-slots?date=${newDate}&duration=${appointment.duration}&serviceStyle=${appointment.serviceStyle}`,
      {
        headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` }
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

    // Update appointment
    appointment.date = newDate;
    appointment.startTime = newTime;
    appointment.rescheduleCount = (appointment.rescheduleCount || 0) + 1;
    appointment.rescheduleHistory = [
      ...(appointment.rescheduleHistory || []),
      {
        oldDate,
        oldTime,
        newDate,
        newTime,
        rescheduledAt: new Date().toISOString()
      }
    ];

    await kv.set(`appointment:${appointmentId}`, appointment);

    console.log(`✅ Appointment ${appointmentId} rescheduled from ${oldDate} ${oldTime} to ${newDate} ${newTime}`);

    return c.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      appointment
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
    const appointment = await kv.get(`appointment:${appointmentId}`);
    
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
      appointment.vendorRoleId || 'veterinarian',
      appointment.serviceStyle || 'at_center'
    );

    // Calculate hours until appointment
    const appointmentDateTime = new Date(`${appointment.date}T${appointment.startTime}:00`);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Determine refund method (customer choice or auto)
    const refundToWallet = cancelledBy === 'vendor' ? true : (refundMethod === 'wallet');

    // Calculate refund
    const refundCalculation = calculateRefundAmount(
      appointment.amount || 0,
      policy,
      hoursUntilAppointment,
      refundToWallet
    );

    // Process refund to wallet
    if (refundCalculation.refundAmount > 0) {
      const walletCredit = await fetch(
        `https://${Deno.env.get('SUPABASE_URL')}/functions/v1/make-server-3dd53475/wallet/${appointment.customerId}/credit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
          },
          body: JSON.stringify({
            amount: refundToWallet ? refundCalculation.refundAmount : 0,
            source: 'refund',
            description: `Refund for cancelled appointment #${appointmentId}`,
            referenceId: appointmentId
          })
        }
      );

      if (!walletCredit.ok) {
        console.error('Failed to credit wallet for refund');
      }
    }

    // Apply vendor penalty if vendor cancelled
    if (cancelledBy === 'vendor') {
      const vendorPenaltyPercentage = refundSettings.vendorPenalties?.[appointment.vendorRoleId] || 5;
      const vendorPenalty = (appointment.amount || 0) * (vendorPenaltyPercentage / 100);
      
      // Record vendor penalty (for later deduction from vendor earnings)
      const vendorPenalties = await kv.get(`vendor:${appointment.vendorId}:penalties`) || [];
      vendorPenalties.push({
        appointmentId,
        amount: vendorPenalty,
        reason: 'Appointment cancelled by vendor',
        timestamp: new Date().toISOString()
      });
      await kv.set(`vendor:${appointment.vendorId}:penalties`, vendorPenalties);
    }

    // Update appointment status
    appointment.status = 'cancelled';
    appointment.cancelledBy = cancelledBy;
    appointment.cancellationReason = reason || 'No reason provided';
    appointment.cancelledAt = new Date().toISOString();
    appointment.refundAmount = refundCalculation.refundAmount;
    appointment.cancellationFee = refundCalculation.cancellationFee;
    appointment.refundMethod = refundToWallet ? 'wallet' : 'original';
    appointment.refundStatus = refundToWallet ? 'completed' : 'pending';

    await kv.set(`appointment:${appointmentId}`, appointment);

    console.log(`✅ Appointment ${appointmentId} cancelled by ${cancelledBy}`);
    console.log(`   Refund: ₹${refundCalculation.refundAmount} (${refundCalculation.refundPercentage}%)`);
    console.log(`   Cancellation fee: ₹${refundCalculation.cancellationFee}`);
    console.log(`   Refund method: ${refundToWallet ? 'wallet' : 'original'}`);

    return c.json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment,
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
    const allAppointments = await kv.getByPrefix('appointment:') || [];
    
    // Filter appointments for this customer
    let customerAppointments = allAppointments.filter((apt: any) => 
      apt.customerId === customerId
    );

    // Filter by status if provided
    if (status && status !== 'all') {
      if (status === 'upcoming') {
        const now = new Date();
        customerAppointments = customerAppointments.filter((apt: any) => {
          const aptDate = new Date(`${apt.date}T${apt.startTime}:00`);
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
      const dateA = new Date(`${a.date}T${a.startTime}:00`);
      const dateB = new Date(`${b.date}T${b.startTime}:00`);
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
