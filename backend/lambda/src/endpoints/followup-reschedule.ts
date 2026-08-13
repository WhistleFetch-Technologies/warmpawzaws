/**
 * ============================================================================
 * FOLLOW-UP & RESCHEDULE ENDPOINTS
 * ============================================================================
 * 
 * Handles:
 * - Follow-up appointment creation
 * - Reschedule policy retrieval
 * - Available slots for rescheduling
 * 
 * Date: 2026-01-12
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, withTransaction } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { resolveVendorById, getVendorIdsForAvailabilityLookup } from './vendor/endpoints/vendorProfile.vendor';
import { getCompletedPayment, resolvePaymentPolicy } from '../utils/payment-policy';
import {
  assertSlotAvailableInTx,
  countOverlappingBookings,
  loadOccupyingBookings,
  parseBookingTimeMinutes,
  resolveDurationMinutes,
  SlotConflictError,
  SLOT_CONFLICT_MESSAGE,
} from '../utils/slot-occupancy';

export function registerFollowupRescheduleEndpoints(app: Hono) {
  /**
   * POST /followup/create
   * Create a follow-up appointment based on an original booking
   */
  app.post("/followup/create", async (c) => {
    try {
      const body = await c.req.json();
      const {
        originalBookingId,
        customerPhone,
        vendorId,
        vendorPhone,
        serviceId,
        selectedDate,
        selectedTime,
        petId,
        address,
        serviceStyle = 'at_center',
        paymentId,
        razorpayPaymentId,
        razorpayOrderId,
      } = body;

      if (!originalBookingId || !customerPhone || !vendorId || !selectedDate || !selectedTime) {
        return c.json({ 
          error: 'originalBookingId, customerPhone, vendorId, selectedDate, and selectedTime are required' 
        }, 400);
      }

      // Find customer by phone
      const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
      const customerResult = await query(
        `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
        [cleanPhone]
      );
      if (customerResult.rows.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }
      const customerId = customerResult.rows[0].id;

      // Verify original booking exists
      const originalBookingResult = await query(
        `SELECT * FROM bookings WHERE id::text = $1::text LIMIT 1`,
        [originalBookingId]
      );
      if (originalBookingResult.rows.length === 0) {
        return c.json({ error: 'Original booking not found' }, 404);
      }

      const originalBooking = originalBookingResult.rows[0];

      // Verify vendor exists
      const vendorResult = await query(
        `SELECT * FROM vendors WHERE id::text = $1::text LIMIT 1`,
        [vendorId]
      );
      if (vendorResult.rows.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const followupAmount = parseFloat(originalBooking.total_amount || '0');
      const vendorType = vendorResult.rows[0]?.category || vendorResult.rows[0]?.vendor_type || vendorResult.rows[0]?.vendorType || null;
      const policy = await resolvePaymentPolicy({
        vendorType,
        serviceType: serviceStyle,
        totalAmount: followupAmount,
      });

      let paymentRecord: any | null = null;
      let amountPaid = 0;
      if (policy.requiredUpfront > 0) {
        if (!paymentId && !razorpayPaymentId && !razorpayOrderId) {
          return c.json({
            error: 'Payment required before booking creation',
            requiredUpfront: policy.requiredUpfront,
            totalAmount: followupAmount,
            policyRule: policy.rule || null,
          }, 402);
        }

        paymentRecord = await getCompletedPayment({
          paymentId,
          razorpayPaymentId,
          razorpayOrderId,
          customerId,
          vendorId,
        });

        if (!paymentRecord) {
          return c.json({
            error: 'Payment not found or not completed',
            requiredUpfront: policy.requiredUpfront,
            totalAmount: followupAmount,
          }, 402);
        }

        amountPaid = parseFloat(paymentRecord.amount || '0') || 0;
        if (amountPaid + 0.01 < policy.requiredUpfront) {
          return c.json({
            error: 'Insufficient payment for booking creation',
            requiredUpfront: policy.requiredUpfront,
            totalAmount: followupAmount,
            amountPaid,
          }, 402);
        }
      }

      const remainingDue = Math.max(0, followupAmount - amountPaid);
      const initialStatus = 'pending';
      const initialPaymentStatus = followupAmount === 0
        ? 'paid'
        : remainingDue > 0
          ? 'partial'
          : 'paid';

      const followupDuration = Number(
        originalBooking.total_duration_minutes || originalBooking.duration_minutes || 30
      );
      const bookingPayload: Record<string, unknown> = {
        customer_id: customerId,
        vendor_id: vendorId,
        service_id: serviceId || originalBooking.service_id,
        booking_date: selectedDate,
        booking_time: selectedTime,
        service_type: serviceStyle,
        address: address || originalBooking.address || null,
        status: initialStatus,
        payment_status: initialPaymentStatus,
        base_price: originalBooking.base_price || 0,
        total_amount: followupAmount,
        payment_id: paymentRecord?.id || null,
        duration_minutes: followupDuration,
        notes: `Follow-up appointment for booking ${originalBookingId}`,
        metadata: {
          is_followup: true,
          original_booking_id: originalBookingId,
        },
      };

      let newBooking: any[];
      try {
        newBooking = await withTransaction(async (client) => {
          await assertSlotAvailableInTx(client, {
            vendorId: String(vendorId),
            date: selectedDate,
            startTime: selectedTime,
            durationMinutes: followupDuration,
            staffId: null,
          });
          const columns = Object.keys(bookingPayload);
          const values = columns.map((k) => bookingPayload[k]);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const inserted = await client.query(
            `INSERT INTO bookings (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            values
          );
          return inserted.rows;
        });
      } catch (slotErr: any) {
        if (
          slotErr instanceof SlotConflictError ||
          slotErr?.code === 'SLOT_CONFLICT' ||
          slotErr?.message === 'SLOT_CONFLICT'
        ) {
          return c.json({ error: SLOT_CONFLICT_MESSAGE, code: 'SLOT_CONFLICT' }, 409);
        }
        throw slotErr;
      }

      if (paymentRecord?.id) {
        await query(
          `UPDATE payments SET booking_id = $1, updated_at = NOW() WHERE id = $2`,
          [newBooking[0].id, paymentRecord.id]
        );
      }

      return c.json({
        success: true,
        message: 'Follow-up appointment created successfully',
        booking: newBooking[0],
      });
    } catch (error: any) {
      console.error('Error creating follow-up appointment:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/reschedule-policy
   * Get reschedule policy for a booking
   */
  app.get("/vendor/reschedule-policy", async (c) => {
    try {
      const bookingId = c.req.query('bookingId');

      if (!bookingId) {
        return c.json({ error: 'bookingId is required' }, 400);
      }

      // Get booking details
      const bookingResult = await query(
        `SELECT * FROM bookings WHERE id::text = $1::text LIMIT 1`,
        [bookingId]
      );
      if (bookingResult.rows.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookingResult.rows[0];

      // Get vendor
      const vendorResult = await query(
        `SELECT * FROM vendors WHERE id::text = $1::text LIMIT 1`,
        [booking.vendor_id]
      );
      if (vendorResult.rows.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendorResult.rows[0];

      // Calculate time until booking
      const bookingDate = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const now = new Date();
      const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Default policy
      const policy = {
        allowsReschedule: hoursUntilBooking > 24, // Can reschedule if more than 24 hours away
        minHoursNotice: 24,
        maxReschedules: 2,
        cancellationFee: hoursUntilBooking < 24 ? (booking.total_amount * 0.1) : 0, // 10% fee if less than 24h
        refundPolicy: hoursUntilBooking > 48 ? 'full' : hoursUntilBooking > 24 ? 'partial' : 'none',
        message: hoursUntilBooking > 24 
          ? 'You can reschedule this appointment free of charge'
          : hoursUntilBooking > 0
          ? `Rescheduling within 24 hours incurs a ${(booking.total_amount * 0.1).toFixed(2)} cancellation fee`
          : 'This appointment cannot be rescheduled as it has already passed'
      };

      // Check vendor-specific policy if exists
      if (vendor.metadata && typeof vendor.metadata === 'object') {
        const vendorPolicy = (vendor.metadata as any).reschedule_policy;
        if (vendorPolicy) {
          Object.assign(policy, vendorPolicy);
        }
      }

      return c.json({
        success: true,
        policy: policy,
      });
    } catch (error: any) {
      console.error('Error fetching reschedule policy:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /bookings/available-slots
   * Get available time slots for booking (customer-facing endpoint).
   * Uses vendor_availability_v2 only (legacy vendor_schedules removed).
   */
  app.get("/bookings/available-slots", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const date = c.req.query('date');
      const rawStyle = (c.req.query('serviceStyle') || 'at_center').toString().toLowerCase();
      const requestedDuration = resolveDurationMinutes(c.req.query('totalDuration'));

      if (!vendorId || !date) {
        return c.json({ error: 'vendorId and date are required' }, 400);
      }

      // Normalize legacy styles: at_vendor → at_center, online → tele
      const serviceStyle =
        rawStyle === 'at_vendor' || rawStyle === 'at_center' ? 'at_center'
          : rawStyle === 'tele' || rawStyle === 'online' || rawStyle === 'video_consultation' ? 'tele'
          : rawStyle === 'at_home' ? 'at_home'
          : 'at_center';

      const requestedDate = new Date(date);
      const dayOfWeek = requestedDate.getDay();

      let slots: any[] = [];
      const vendor = await resolveVendorById(vendorId);
      if (vendor) {
        const availabilityIds = await getVendorIdsForAvailabilityLookup(vendor.id);
        const acceptableStyles =
          serviceStyle === 'at_center' ? ['at_center', 'at_vendor']
            : serviceStyle === 'tele' ? ['tele', 'online', 'video_consultation']
            : [serviceStyle];

        try {
          let rows: any[] = [];
          try {
            const va2Result = await query(
                `SELECT time_window_start, time_window_end, start_time, end_time,
                        COALESCE(slot_duration_minutes, 30) as slot_duration_minutes,
                        COALESCE(max_capacity, 1) as max_capacity
                 FROM vendor_availability_v2
                 WHERE vendor_id::text = ANY($1::text[])
                   AND day_of_week = $2
                   AND (
                     (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[])
                     OR COALESCE(service_style, service_type)::text = ANY($3::text[])
                   )
                   AND COALESCE(is_available, is_enabled, true) = true
                 ORDER BY COALESCE(time_window_start, start_time)`,
                [availabilityIds, dayOfWeek, acceptableStyles]
              );
              rows = va2Result?.rows || [];
            } catch (colErr: any) {
              // 006 schema: service_style only, no service_styles
              const va206 = await query(
                `SELECT time_window_start, time_window_end,
                        time_window_start as start_time, time_window_end as end_time,
                        30 as slot_duration_minutes
                 FROM vendor_availability_v2
                 WHERE vendor_id::text = ANY($1::text[]) AND day_of_week = $2
                   AND service_style::text = ANY($3::text[])
                   AND (is_enabled = true OR is_enabled IS NULL)
                 ORDER BY time_window_start`,
                [availabilityIds, dayOfWeek, acceptableStyles]
              );
              rows = va206?.rows || [];
            }

            const timeToMinutes = (t: string): number => {
              const s = typeof t === 'string' ? t.substring(0, 5) : String(t);
              const [h, m] = s.split(':').map(Number);
              return (h || 0) * 60 + (m || 0);
            };

            for (const row of rows) {
              const startTime = row.time_window_start || row.start_time;
              const endTime = row.time_window_end || row.end_time;
              if (!startTime || !endTime) continue;
              const slotDuration = Number(row.slot_duration_minutes) || 30;
              const cap = Number(row.max_capacity) > 0 ? Number(row.max_capacity) : 1;
              const winStart = timeToMinutes(startTime);
              const winEnd = timeToMinutes(endTime);
              let current = winStart;
              while (current + slotDuration <= winEnd) {
                const timeStr = `${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}`;
                slots.push({ time: timeStr, available: true, maxCapacity: cap });
                current += slotDuration;
              }
            }

          slots = slots.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));

          try {
            const occupying = await loadOccupyingBookings(query, {
              vendorId: String(vendor.id),
              date,
              staffId: null,
            });
            slots = slots.map((s: any) => {
              const start = parseBookingTimeMinutes(s.time);
              const duration = requestedDuration;
              const cap = Number(s.maxCapacity) > 0 ? Number(s.maxCapacity) : 1;
              const booked = countOverlappingBookings(occupying, start, start + duration) >= cap;
              return { ...s, available: !booked, booked };
            });
          } catch (occErr: any) {
            console.error('[bookings/available-slots] occupancy failed:', occErr?.message);
            return c.json({
              success: false,
              slots: [],
              date,
              vendorId,
              error: 'Unable to calculate slot availability',
            }, 503);
          }
        } catch (va2Err: any) {
          console.warn('[bookings/available-slots] vendor_availability_v2 failed:', va2Err?.message);
        }
      }

      return c.json({
        success: true,
        slots,
        date,
        vendorId,
        serviceStyle,
      });
    } catch (error: any) {
      console.error('Error fetching available slots:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/available-slots
   * Get available slots for rescheduling a booking
   */
  app.get("/vendor/available-slots", async (c) => {
    try {
      const bookingId = c.req.query('bookingId');
      const date = c.req.query('date');
      const rawStyle = (c.req.query('serviceStyle') || 'at_center').toString().toLowerCase();
      // Normalize legacy styles so reschedule sees same slots as customer flow
      const serviceStyle =
        rawStyle === 'at_vendor' || rawStyle === 'at_center' ? 'at_center'
          : rawStyle === 'tele' || rawStyle === 'online' || rawStyle === 'video_consultation' ? 'tele'
          : rawStyle === 'at_home' ? 'at_home'
          : 'at_center';

      if (!bookingId) {
        return c.json({ error: 'bookingId is required' }, 400);
      }

      // Get booking details
      const bookingResult = await query(
        `SELECT * FROM bookings WHERE id::text = $1::text LIMIT 1`,
        [bookingId]
      );
      if (bookingResult.rows.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookingResult.rows[0];
      const bookingVendorId = booking.vendor_id;

      // Resolve to canonical vendors.id and get ids for availability lookup (vendor + vendor_identity)
      const vendor = await resolveVendorById(bookingVendorId);
      const resolvedVendorId = vendor?.id ?? bookingVendorId;
      const availabilityIds = await getVendorIdsForAvailabilityLookup(resolvedVendorId);
      const vendorIdsForQuery = availabilityIds.length > 0 ? availabilityIds : [resolvedVendorId];

      // If date provided, get slots for that date, otherwise get next 7 days
      const datesToCheck = date 
        ? [date]
        : Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i + 1);
            return d.toISOString().split('T')[0];
          });

      const styleArray =
        serviceStyle === 'at_center' ? ['at_center', 'at_vendor']
          : serviceStyle === 'tele' ? ['tele', 'online', 'video_consultation']
          : [serviceStyle];

      const allSlots: any[] = [];

      for (const checkDate of datesToCheck) {
        const requestedDate = new Date(checkDate);
        const dayOfWeek = requestedDate.getDay();

        let scheduleSlots: { rows: any[] };
        try {
          scheduleSlots = await query(
            `SELECT * FROM vendor_availability_v2
             WHERE vendor_id::text = ANY($1::text[])
             AND day_of_week = $2
             AND (
               service_style::text = ANY($3::text[])
               OR (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[])
               OR COALESCE(service_type, '')::text = ANY($3::text[])
             )
             AND COALESCE(is_enabled, is_available, true) = true
             ORDER BY COALESCE(time_window_start, start_time)`,
            [vendorIdsForQuery, dayOfWeek, styleArray]
          );
        } catch (_) {
          scheduleSlots = await query(
            `SELECT * FROM vendor_availability_v2
             WHERE vendor_id::text = ANY($1::text[])
             AND day_of_week = $2
             AND service_style = $3
             AND (is_enabled = true OR is_enabled IS NULL)
             ORDER BY time_window_start`,
            [vendorIdsForQuery, dayOfWeek, serviceStyle]
          );
        }

        let occupying: Awaited<ReturnType<typeof loadOccupyingBookings>> = [];
        try {
          occupying = await loadOccupyingBookings(query, {
            vendorId: String(resolvedVendorId),
            date: checkDate,
            excludeBookingId: bookingId,
          });
        } catch (occErr: any) {
          console.error('[vendor/available-slots] occupancy failed:', occErr?.message);
          return c.json({
            success: false,
            slots: [],
            error: 'Unable to calculate slot availability',
          }, 503);
        }

        for (const slot of scheduleSlots.rows) {
          const startTime = slot.time_window_start ?? slot.start_time;
          const endTime = slot.time_window_end ?? slot.end_time;
          if (!startTime || !endTime) continue;

          const generated = generateTimeSlots(startTime, endTime, 30);
          const cap = Number(slot.max_capacity) > 0 ? Number(slot.max_capacity) : 1;
          const duration = resolveDurationMinutes(
            booking.total_duration_minutes,
            booking.duration_minutes
          );

          for (const timeSlot of generated) {
            const start = parseBookingTimeMinutes(timeSlot);
            const overlapCount = countOverlappingBookings(occupying, start, start + duration);
            if (overlapCount < cap) {
              allSlots.push({
                date: checkDate,
                time: timeSlot,
                available: true,
              });
            }
          }
        }
      }

      return c.json({
        success: true,
        slots: allSlots,
        total: allSlots.length,
      });
    } catch (error: any) {
      console.error('Error fetching available slots:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

/**
 * Generate time slots between start and end time
 */
function generateTimeSlots(startTime: string, endTime: string, intervalMinutes: number): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`);
    
    currentMin += intervalMinutes;
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60);
      currentMin = currentMin % 60;
    }
  }
  
  return slots;
}
