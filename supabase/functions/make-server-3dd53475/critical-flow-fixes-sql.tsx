/**
 * CRITICAL FLOW FIXES (SQL-ONLY VERSION)
 * 
 * Implements missing validations and optimizations identified in flow analysis:
 * 1. Data validation between lifecycle steps
 * 2. Booking conflict detection
 * 3. OTP expiry tracking
 * 4. Pagination support
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL repository calls
 * - All data now comes from SQL tables (vendors, services, bookings, availability)
 * 
 * Date: 2025-01-27
 * Migration: Batch 8 - Complete KV to SQL Migration
 * Status: ✅ NEW IMPLEMENTATION
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { sendSuccess, sendError } from './response-utils.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getSchedulingRepository } from '../../lib/repositories/scheduling.ts';
import { getDbClient } from '../../lib/db.ts';

const BASE_PATH = '/make-server-3dd53475';

export function registerCriticalFlowFixesSQL(app: Hono) {
  console.log('✅ Registering Critical Flow Fixes (SQL-only)...');

  app.use('*', cors());

  const vendorsRepo = getVendorsRepository();
  const servicesRepo = getServicesRepository();
  const bookingsRepo = getBookingsRepository();
  const schedulingRepo = getSchedulingRepository();
  const client = getDbClient();

  // ==========================================================================
  // FIX 1: DATA VALIDATION BETWEEN LIFECYCLE STEPS
  // ==========================================================================

  /**
   * POST /vendor/setup/availability-validated
   * Enhanced availability setup with service validation
   */
  app.post(`${BASE_PATH}/vendor/setup/availability-validated`, async (c) => {
    try {
      const { vendorId, availability } = await c.req.json();

      if (!vendorId || !availability) {
        return sendError(c, 'Missing required fields: vendorId, availability', 400);
      }

      // ✅ SQL: Validate vendor exists and is approved
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      if (vendor.status !== 'approved' && vendor.status !== 'active') {
        return sendError(c, 'Vendor must be approved before setting availability', 403);
      }

      // ✅ SQL: Validate services are configured first
      const { data: services } = await client
        .from('services')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true);

      if (!services || services.length === 0) {
        return sendError(c, 'No services configured. Add at least one service before setting availability', 400);
      }

      // ✅ SQL: Validate availability matches service styles
      const configuredStyles = new Set<string>();
      services.forEach((service: any) => {
        if (service.service_styles && Array.isArray(service.service_styles)) {
          service.service_styles.forEach((style: string) => configuredStyles.add(style));
        }
      });

      // Validate availability object matches configured styles
      const availabilityStyles = new Set<string>();
      for (const [day, slots] of Object.entries(availability)) {
        if (typeof slots === 'object' && slots !== null) {
          for (const style in slots) {
            if (style !== 'enabled' && style !== 'slots') {
              availabilityStyles.add(style);
            }
          }
        }
      }

      // Check for styles in availability that don't have services
      const invalidStyles: string[] = [];
      availabilityStyles.forEach(style => {
        if (!configuredStyles.has(style)) {
          invalidStyles.push(style);
        }
      });

      if (invalidStyles.length > 0) {
        return sendError(c, `Availability includes service styles not configured: ${invalidStyles.join(', ')}`, 400);
      }

      // ✅ SQL: Validate time format and logic
      for (const [day, dayConfig] of Object.entries(availability)) {
        if (typeof dayConfig === 'object' && dayConfig !== null) {
          for (const [style, config] of Object.entries(dayConfig)) {
            if (typeof config === 'object' && config !== null && 'slots' in config) {
              const slots = (config as any).slots;
              if (Array.isArray(slots)) {
                for (const slot of slots) {
                  if (typeof slot === 'string') {
                    // Validate time format (HH:MM-HH:MM)
                    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
                    if (!timeRegex.test(slot)) {
                      return sendError(c, `Invalid time slot format: ${slot}. Expected: HH:MM-HH:MM`, 400);
                    }

                    // Validate start < end
                    const [start, end] = slot.split('-');
                    const [startH, startM] = start.split(':').map(Number);
                    const [endH, endM] = end.split(':').map(Number);
                    const startMinutes = startH * 60 + startM;
                    const endMinutes = endH * 60 + endM;

                    if (startMinutes >= endMinutes) {
                      return sendError(c, `Invalid time slot: start time must be before end time: ${slot}`, 400);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // ✅ SQL: Save availability
      await client
        .from('vendor_availability')
        .upsert({
          vendor_id: vendorId,
          availability_data: availability,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'vendor_id'
        });

      // ✅ SQL: Update vendor status
      await client
        .from('vendors')
        .update({
          setup_completed: true,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', vendorId);

      console.log(`✅ Availability configured for vendor ${vendorId}`);

      return sendSuccess(c, {
        message: 'Availability configured successfully',
        vendor: {
          id: vendorId,
          setupCompleted: true,
          isActive: true
        }
      });
    } catch (error) {
      console.error('Error in availability setup:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ==========================================================================
  // FIX 2: BOOKING CONFLICT DETECTION
  // ==========================================================================

  /**
   * Helper: Check for booking conflicts
   */
  async function checkBookingConflicts(
    vendorId: string,
    scheduledDate: string,
    scheduledTime: string,
    duration: number,
    serviceStyle: string
  ) {
    // ✅ SQL: Get all vendor bookings on same date
    const { data: bookings } = await client
      .from('bookings')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('booking_date', scheduledDate)
      .in('status', ['pending', 'confirmed', 'in_progress']);

    if (!bookings || bookings.length === 0) {
      return { hasConflict: false };
    }

    // Convert scheduled time to minutes
    const [reqHour, reqMin] = scheduledTime.split(':').map(Number);
    const requestedStart = reqHour * 60 + reqMin;
    const requestedEnd = requestedStart + duration;

    // Check for overlaps
    const conflicts: any[] = [];

    for (const booking of bookings) {
      const [bookHour, bookMin] = booking.booking_time.split(':').map(Number);
      const bookingStart = bookHour * 60 + bookMin;
      const bookingDuration = booking.duration || 60;
      const bookingEnd = bookingStart + bookingDuration;

      // Check overlap: (Start1 < End2) AND (Start2 < End1)
      if (requestedStart < bookingEnd && bookingStart < requestedEnd) {
        conflicts.push({
          bookingId: booking.id,
          scheduledTime: booking.booking_time,
          duration: bookingDuration,
          serviceName: booking.service_name,
          status: booking.status
        });
      }
    }

    if (conflicts.length > 0) {
      return {
        hasConflict: true,
        conflicts,
        message: 'Time slot already booked or overlaps with existing booking'
      };
    }

    return { hasConflict: false };
  }

  /**
   * POST /bookings/validate-slot
   * Validate time slot availability before booking
   */
  app.post(`${BASE_PATH}/bookings/validate-slot`, async (c) => {
    try {
      const { vendorId, scheduledDate, scheduledTime, duration, serviceStyle, serviceType, tableId, date, time } = await c.req.json();

      // ✅ FIX: Support cafe table bookings
      if (serviceType === 'pet_cafe' || serviceStyle === 'pet_cafe') {
        const cafeDate = date || scheduledDate;
        const cafeTime = time || scheduledTime;

        if (!vendorId || !cafeDate || !cafeTime || !tableId) {
          return sendError(c, 'Missing required fields for cafe booking: vendorId, date, time, tableId', 400);
        }

        // ✅ SQL: Check if table is available
        const { data: reservations } = await client
          .from('cafe_reservations')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('reservation_date', cafeDate)
          .eq('reservation_time', cafeTime)
          .eq('table_id', tableId)
          .in('status', ['confirmed', 'pending']);

        if (reservations && reservations.length > 0) {
          return sendError(c, 'Table is already booked for this time slot', 409);
        }

        return sendSuccess(c, {
          valid: true,
          message: 'Table is available',
          tableId,
          date: cafeDate,
          time: cafeTime
        });
      }

      // Standard slot validation for other services
      if (!vendorId || !scheduledDate || !scheduledTime || !duration || !serviceStyle) {
        return sendError(c, 'Missing required fields: vendorId, scheduledDate, scheduledTime, duration, serviceStyle', 400);
      }

      // Check for conflicts
      const conflictCheck = await checkBookingConflicts(
        vendorId,
        scheduledDate,
        scheduledTime,
        duration,
        serviceStyle
      );

      if (conflictCheck.hasConflict) {
        return sendError(c, 'Time slot not available', 409);
      }

      return sendSuccess(c, {
        valid: true,
        message: 'Time slot available',
        scheduledTime,
        scheduledDate
      });
    } catch (error) {
      console.error('Error validating slot:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ==========================================================================
  // FIX 3: OTP EXPIRY TRACKING
  // ==========================================================================

  /**
   * Helper: Generate OTP with expiry
   */
  function generateOTPWithExpiry() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    const createdAt = new Date();

    return {
      otp,
      expiresAt: expiresAt.toISOString(),
      createdAt: createdAt.toISOString(),
      attempts: 0,
      maxAttempts: 5
    };
  }

  /**
   * POST /bookings/:bookingId/verify-otp-enhanced
   * Enhanced OTP verification with expiry and attempt tracking
   */
  app.post(`${BASE_PATH}/bookings/:bookingId/verify-otp-enhanced`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      const { otp, otpType = 'end' } = await c.req.json(); // 'start' or 'end'

      if (!otp) {
        return sendError(c, 'OTP required', 400);
      }

      // ✅ SQL: Get booking
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // ✅ SQL: Get OTP data from booking metadata
      const metadata = booking.metadata || {};
      const otpField = otpType === 'start' ? 'startOtpData' : 'endOtpData';
      const otpData = metadata[otpField];

      if (!otpData) {
        return sendError(c, 'OTP not generated for this booking', 400);
      }

      // ✅ FIX 3.1: Check expiry
      const now = new Date();
      const expiresAt = new Date(otpData.expiresAt);

      if (now > expiresAt) {
        return sendError(c, 'OTP expired', 400);
      }

      // ✅ FIX 3.2: Check attempt limit
      if (otpData.attempts >= otpData.maxAttempts) {
        return sendError(c, 'Maximum OTP attempts exceeded', 403);
      }

      // ✅ FIX 3.3: Verify OTP
      if (otp !== otpData.otp) {
        // Increment attempt counter
        otpData.attempts += 1;
        metadata[otpField] = otpData;

        await client
          .from('bookings')
          .update({
            metadata: metadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);

        return sendError(c, `Invalid OTP. ${otpData.maxAttempts - otpData.attempts} attempts remaining`, 400);
      }

      // ✅ OTP verified successfully
      // Update booking based on OTP type
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (otpType === 'start') {
        updateData.status = 'in_progress';
        updateData.actual_start_time = new Date().toISOString();
      } else {
        updateData.status = 'completed';
        updateData.actual_end_time = new Date().toISOString();
      }

      await client
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);

      console.log(`✅ ${otpType.toUpperCase()} OTP verified for booking ${bookingId}`);

      return sendSuccess(c, {
        message: `${otpType === 'start' ? 'Service started' : 'Service completed'} successfully`,
        booking: {
          id: bookingId,
          status: updateData.status
        }
      });
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /bookings/:bookingId/resend-otp
   * Resend OTP with new expiry
   */
  app.post(`${BASE_PATH}/bookings/:bookingId/resend-otp`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      const { otpType = 'end' } = await c.req.json();

      // ✅ SQL: Get booking
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Generate new OTP
      const newOtpData = generateOTPWithExpiry();
      const metadata = booking.metadata || {};
      const otpField = otpType === 'start' ? 'startOtpData' : 'endOtpData';
      metadata[otpField] = newOtpData;

      // ✅ SQL: Update booking with new OTP
      await client
        .from('bookings')
        .update({
          metadata: metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      console.log(`📱 ${otpType.toUpperCase()} OTP resent for booking ${bookingId}: ${newOtpData.otp}`);

      return sendSuccess(c, {
        message: 'OTP resent successfully',
        otp: newOtpData.otp, // In production, send via SMS
        expiresAt: newOtpData.expiresAt,
        expiresIn: '30 minutes'
      });
    } catch (error) {
      console.error('Error resending OTP:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ==========================================================================
  // FIX 4: PAGINATION SUPPORT
  // ==========================================================================

  /**
   * GET /customer/:customerId/bookings-paginated
   * Get customer bookings with pagination
   */
  app.get(`${BASE_PATH}/customer/:customerId/bookings-paginated`, async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '20');
      const status = c.req.query('status');
      const sortBy = c.req.query('sortBy') || 'date';
      const sortOrder = c.req.query('sortOrder') || 'desc';

      // Validate pagination params
      if (page < 1 || limit < 1 || limit > 100) {
        return sendError(c, 'Invalid pagination parameters. page must be >= 1, limit must be between 1 and 100', 400);
      }

      // ✅ SQL: Get customer bookings with pagination
      let query = client
        .from('bookings')
        .select('*', { count: 'exact' })
        .eq('customer_id', customerId);

      if (status) {
        query = query.eq('status', status);
      }

      const orderBy = sortBy === 'date' ? 'booking_date' : 'total_amount';
      query = query.order(orderBy, { ascending: sortOrder === 'asc' });

      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: bookings, count, error } = await query;

      if (error) {
        console.error('Error fetching paginated bookings:', error);
        return sendError(c, 'Failed to fetch bookings', 500);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);
      const hasMore = offset + limit < totalCount;

      return sendSuccess(c, {
        bookings: bookings || [],
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasMore,
          hasPrevious: page > 1,
          nextPage: hasMore ? page + 1 : null,
          previousPage: page > 1 ? page - 1 : null
        },
        filters: {
          status,
          sortBy,
          sortOrder
        }
      });
    } catch (error) {
      console.error('Error fetching paginated bookings:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /vendor/:vendorId/bookings-paginated
   * Get vendor bookings with pagination
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/bookings-paginated`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '20');
      const status = c.req.query('status');
      const dateFrom = c.req.query('dateFrom');
      const dateTo = c.req.query('dateTo');

      // ✅ SQL: Get vendor bookings with pagination
      let query = client
        .from('bookings')
        .select('*', { count: 'exact' })
        .eq('vendor_id', vendorId);

      if (status) {
        query = query.eq('status', status);
      }

      if (dateFrom) {
        query = query.gte('booking_date', dateFrom);
      }

      if (dateTo) {
        query = query.lte('booking_date', dateTo);
      }

      query = query.order('booking_date', { ascending: false });

      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: bookings, count, error } = await query;

      if (error) {
        console.error('Error fetching vendor bookings:', error);
        return sendError(c, 'Failed to fetch bookings', 500);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return sendSuccess(c, {
        bookings: bookings || [],
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasMore: offset + limit < totalCount
        }
      });
    } catch (error) {
      console.error('Error fetching vendor bookings:', error);
      return sendError(c, String(error), 500);
    }
  });

  console.log('✅ Critical Flow Fixes endpoints registered (SQL-only)');
}

