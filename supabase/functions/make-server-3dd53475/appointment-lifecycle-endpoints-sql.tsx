/**
 * ============================================================================
 * APPOINTMENT LIFECYCLE ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Get appointment details
 * - Reschedule appointments
 * - Cancel appointments with refund
 * - Get customer appointments
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `bookings` table (appointments are bookings)
 * - Uses `booking_status_history` for status transitions
 * - Uses `refund_rules` table for refund policies
 * - Uses `BookingsRepository`, `VendorsRepository`, `StaffRepository`, `CustomersRepository`
 * 
 * Date: 2025-01-28
 * Migration: Batch 13 - KV to SQL (13 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getRefundsRepository } from '../../lib/repositories/refunds.ts';

const app = new Hono();

// Helper: Get refund policy from SQL
async function getRefundPolicy(vendorRoleId: string, serviceStyle: string) {
  const db = getDbClient();
  
  // ✅ SQL: Get refund rules from refund_rules table
  const { data: refundRules } = await db
    .from('refund_rules')
    .select('*')
    .eq('role_id', vendorRoleId)
    .eq('service_style', serviceStyle)
    .eq('enabled', true)
    .order('priority', { ascending: true })
    .limit(1);

  if (refundRules && refundRules.length > 0) {
    const rule = refundRules[0];
    return {
      policy: {
        allowRefund: rule.allow_refund !== false,
        refundPercentage: rule.refund_percentage || 100,
        cancellationWindow: rule.cancellation_window_hours || 24,
        cancellationFeePercentage: rule.cancellation_fee_percentage || 10
      }
    };
  }

  // Default policy
  return {
    policy: {
      allowRefund: true,
      refundPercentage: 100,
      cancellationWindow: 24,
      cancellationFeePercentage: 10
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
  if (refundToWallet) {
    return {
      refundAmount: originalAmount,
      cancellationFee: 0,
      refundPercentage: 100
    };
  }

  let refundPercentage = policy.refundPercentage || 100;
  
  if (hoursUntilAppointment < (policy.cancellationWindow || 24)) {
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
app.get('/make-server-3dd53475/appointment/:appointmentId', async (c) => {
  const { appointmentId } = c.req.param();

  try {
    // ✅ SQL: Get booking (appointment)
    const bookingsRepo = getBookingsRepository();
    const appointment = await bookingsRepo.findById(appointmentId);
    
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // ✅ SQL: Get vendor details
    const vendorsRepo = getVendorsRepository();
    const vendor = appointment.vendor_id ? await vendorsRepo.findById(appointment.vendor_id) : null;
    
    // ✅ SQL: Get staff details
    const staffRepo = getStaffRepository();
    const staff = appointment.staff_id ? await staffRepo.findById(appointment.staff_id) : null;

    // ✅ SQL: Get customer details
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(appointment.customer_id);

    // ✅ SQL: Get location details if applicable (from vendor)
    let location = null;
    if (vendor && vendor.latitude && vendor.longitude) {
      location = {
        latitude: vendor.latitude,
        longitude: vendor.longitude,
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        pincode: vendor.pincode
      };
    }

    return c.json({
      success: true,
      appointment: {
        id: appointment.id,
        bookingDate: appointment.booking_date,
        bookingTime: appointment.booking_time,
        status: appointment.status,
        serviceType: appointment.service_type,
        totalAmount: appointment.total_amount,
        paymentStatus: appointment.payment_status,
        notes: appointment.notes,
        createdAt: appointment.created_at,
        updatedAt: appointment.updated_at
      },
      vendor: vendor ? {
        id: vendor.id,
        businessName: vendor.business_name,
        ownerName: vendor.owner_name,
        phone: vendor.phone,
        address: vendor.address
      } : null,
      staff: staff ? {
        id: staff.id,
        fullName: staff.fullName,
        phone: staff.phone,
        role: staff.role
      } : null,
      customer: customer ? {
        id: customer.id,
        fullName: customer.full_name,
        phone: customer.phone
      } : null,
      location
    });
  } catch (error) {
    console.error(`❌ Error fetching appointment ${appointmentId}:`, error);
    return c.json({ error: 'Failed to fetch appointment' }, 500);
  }
});

// POST /appointment/:appointmentId/reschedule - Reschedule appointment
app.post('/make-server-3dd53475/appointment/:appointmentId/reschedule', async (c) => {
  const { appointmentId } = c.req.param();
  const { newDate, newTime } = await c.req.json();

  if (!newDate || !newTime) {
    return c.json({ error: 'New date and time are required' }, 400);
  }

  try {
    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const appointment = await bookingsRepo.findById(appointmentId);
    
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // Check if appointment can be rescheduled
    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
      return c.json({ error: 'Cannot reschedule completed or cancelled appointment' }, 400);
    }

    // Check if service has started
    if (appointment.status === 'in_progress') {
      return c.json({ error: 'Cannot reschedule - service already started' }, 400);
    }

    // Save old date/time for history
    const oldDate = appointment.booking_date;
    const oldTime = appointment.booking_time;

    // ✅ SQL: Update booking
    await bookingsRepo.update(appointmentId, {
      booking_date: newDate,
      booking_time: newTime,
      status: 'rescheduled'
    });

    // ✅ SQL: Log status change in booking_status_history
    const db = getDbClient();
    await db.from('booking_status_history').insert({
      booking_id: appointmentId,
      from_status: appointment.status,
      to_status: 'rescheduled',
      changed_by: 'customer',
      note: `Rescheduled from ${oldDate} ${oldTime} to ${newDate} ${newTime}`
    });

    console.log(`✅ Appointment ${appointmentId} rescheduled from ${oldDate} ${oldTime} to ${newDate} ${newTime}`);

    return c.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      appointment: {
        id: appointment.id,
        bookingDate: newDate,
        bookingTime: newTime,
        status: 'rescheduled'
      }
    });
  } catch (error) {
    console.error(`❌ Error rescheduling appointment ${appointmentId}:`, error);
    return c.json({ error: 'Failed to reschedule appointment' }, 500);
  }
});

// POST /appointment/:appointmentId/cancel - Cancel appointment with refund
app.post('/make-server-3dd53475/appointment/:appointmentId/cancel', async (c) => {
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
    // ✅ SQL: Get booking
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

    // Get vendor role for refund policy
    const vendorsRepo = getVendorsRepository();
    const vendor = appointment.vendor_id ? await vendorsRepo.findById(appointment.vendor_id) : null;
    const vendorRoleId = vendor?.role_id || 'veterinarian';

    // Get refund policy
    const { policy } = await getRefundPolicy(
      vendorRoleId,
      appointment.service_type || 'at_center'
    );

    // Calculate hours until appointment
    const appointmentDateTime = new Date(`${appointment.booking_date}T${appointment.booking_time}:00`);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Determine refund method
    const refundToWallet = cancelledBy === 'vendor' ? true : (refundMethod === 'wallet');

    // Calculate refund
    const refundCalculation = calculateRefundAmount(
      appointment.total_amount || 0,
      policy,
      hoursUntilAppointment,
      refundToWallet
    );

    // ✅ SQL: Process refund if amount > 0
    if (refundCalculation.refundAmount > 0) {
      const refundsRepo = getRefundsRepository();
      await refundsRepo.create({
        booking_id: appointmentId,
        customer_id: appointment.customer_id,
        vendor_id: appointment.vendor_id,
        amount: refundCalculation.refundAmount,
        refund_method: refundToWallet ? 'wallet' : 'original',
        reason: reason || 'Appointment cancelled',
        status: refundToWallet ? 'completed' : 'pending'
      });
    }

    // ✅ SQL: Update booking status
    await bookingsRepo.update(appointmentId, {
      status: 'cancelled',
      cancellation_reason: reason || 'No reason provided',
      cancelled_at: new Date().toISOString()
    });

    // ✅ SQL: Log status change
    const db = getDbClient();
    await db.from('booking_status_history').insert({
      booking_id: appointmentId,
      from_status: appointment.status,
      to_status: 'cancelled',
      changed_by: cancelledBy,
      note: `Cancelled: ${reason || 'No reason provided'}`
    });

    console.log(`✅ Appointment ${appointmentId} cancelled by ${cancelledBy}`);
    console.log(`   Refund: ₹${refundCalculation.refundAmount} (${refundCalculation.refundPercentage}%)`);

    return c.json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment: {
        id: appointment.id,
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      },
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
app.get('/make-server-3dd53475/appointments/customer/:customerId', async (c) => {
  const { customerId } = c.req.param();
  const status = c.req.query('status'); // upcoming, completed, cancelled, all

  try {
    // ✅ SQL: Get all bookings for customer
    const bookingsRepo = getBookingsRepository();
    let customerAppointments = await bookingsRepo.findByCustomer(customerId);

    // Filter by status if provided
    if (status && status !== 'all') {
      if (status === 'upcoming') {
        const now = new Date();
        customerAppointments = customerAppointments.filter((apt: any) => {
          const aptDate = new Date(`${apt.booking_date}T${apt.booking_time}:00`);
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
      const dateA = new Date(`${a.booking_date}T${a.booking_time}:00`);
      const dateB = new Date(`${b.booking_date}T${b.booking_time}:00`);
      return dateB.getTime() - dateA.getTime();
    });

    return c.json({
      success: true,
      appointments: customerAppointments.map((apt: any) => ({
        id: apt.id,
        bookingDate: apt.booking_date,
        bookingTime: apt.booking_time,
        status: apt.status,
        serviceType: apt.service_type,
        totalAmount: apt.total_amount,
        paymentStatus: apt.payment_status,
        createdAt: apt.created_at
      })),
      count: customerAppointments.length
    });
  } catch (error) {
    console.error(`❌ Error fetching appointments for customer ${customerId}:`, error);
    return c.json({ error: 'Failed to fetch appointments' }, 500);
  }
});

export default app;

