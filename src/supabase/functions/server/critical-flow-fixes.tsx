/**
 * CRITICAL FLOW FIXES
 * 
 * Implements missing validations and optimizations identified in flow analysis:
 * 1. Data validation between lifecycle steps
 * 2. Booking conflict detection
 * 3. OTP expiry tracking
 * 4. Pagination support
 * 
 * Status: ✅ NEW IMPLEMENTATION
 */

import { Hono } from 'hono';
import { cors } from "hono/cors";
import * as kv from './kv_store';

const app = new Hono();
app.use('*', cors());

// ==========================================================================
// FIX 1: DATA VALIDATION BETWEEN LIFECYCLE STEPS
// ==========================================================================

/**
 * POST /vendor/setup/availability-validated
 * Enhanced availability setup with service validation
 */
app.post('/vendor/setup/availability-validated', async (c) => {
  try {
    const { vendorId, availability } = await c.req.json();
    
    if (!vendorId || !availability) {
      return c.json({
        error: 'Missing required fields',
        required: ['vendorId', 'availability']
      }, 400);
    }
    
    // ✅ FIX 1.1: Validate vendor exists and is approved
    const vendor = await kv.get(`vendor:${vendorId}`);
    if (!vendor) {
      return c.json({
        error: 'Vendor not found',
        vendorId
      }, 404);
    }
    
    if (vendor.status !== 'approved') {
      return c.json({
        error: 'Vendor must be approved before setting availability',
        currentStatus: vendor.status,
        hint: 'Wait for admin approval'
      }, 403);
    }
    
    // ✅ FIX 1.2: Validate services are configured first
    if (!vendor.servicesConfigured) {
      return c.json({
        error: 'Services must be configured before setting availability',
        requiredStep: 'service_setup',
        currentStage: vendor.setupStage || 'unknown',
        hint: 'Complete service setup first'
      }, 400);
    }
    
    // ✅ FIX 1.3: Validate availability matches service styles
    const vendorServices = await kv.get(`vendor:${vendorId}:services`) || [];
    
    if (vendorServices.length === 0) {
      return c.json({
        error: 'No services configured',
        hint: 'Add at least one service before setting availability'
      }, 400);
    }
    
    // Extract all service styles vendor offers
    const configuredStyles = new Set<string>();
    vendorServices.forEach((service: any) => {
      if (service.serviceStyles && Array.isArray(service.serviceStyles)) {
        service.serviceStyles.forEach((style: string) => configuredStyles.add(style));
      }
    });
    
    console.log(`✅ Vendor configured service styles:`, Array.from(configuredStyles));
    
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
    
    console.log(`📅 Availability includes styles:`, Array.from(availabilityStyles));
    
    // Check for styles in availability that don't have services
    const invalidStyles: string[] = [];
    availabilityStyles.forEach(style => {
      if (!configuredStyles.has(style)) {
        invalidStyles.push(style);
      }
    });
    
    if (invalidStyles.length > 0) {
      return c.json({
        error: 'Availability includes service styles not configured',
        invalidStyles,
        configuredStyles: Array.from(configuredStyles),
        hint: 'Configure services for these styles first, or remove them from availability'
      }, 400);
    }
    
    // ✅ FIX 1.4: Validate time format and logic
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
                    return c.json({
                      error: 'Invalid time slot format',
                      day,
                      style,
                      invalidSlot: slot,
                      expectedFormat: 'HH:MM-HH:MM (e.g., 09:00-17:00)'
                    }, 400);
                  }
                  
                  // Validate start < end
                  const [start, end] = slot.split('-');
                  const [startH, startM] = start.split(':').map(Number);
                  const [endH, endM] = end.split(':').map(Number);
                  const startMinutes = startH * 60 + startM;
                  const endMinutes = endH * 60 + endM;
                  
                  if (startMinutes >= endMinutes) {
                    return c.json({
                      error: 'Invalid time slot: start time must be before end time',
                      day,
                      style,
                      invalidSlot: slot
                    }, 400);
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Save availability
    await kv.set(`vendor:${vendorId}:availability:v2`, availability);
    
    // Update vendor status
    vendor.availabilityConfigured = true;
    vendor.setupStage = 'completed';
    vendor.setupCompleted = true;
    vendor.isActive = true;
    vendor.updatedAt = new Date().toISOString();
    
    await kv.set(`vendor:${vendorId}`, vendor);
    
    console.log(`✅ Availability configured for vendor ${vendorId}`);
    
    return c.json({
      success: true,
      message: 'Availability configured successfully',
      vendor: {
        id: vendorId,
        setupCompleted: true,
        isActive: true
      }
    });
    
  } catch (error) {
    console.error('Error in availability setup:', error);
    return c.json({ error: String(error) }, 500);
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
  // Get all vendor bookings
  const allBookings = await kv.getByPrefix(`booking:`) || [];
  
  // Filter to this vendor's bookings on same date
  const vendorBookings = allBookings.filter((booking: any) => 
    booking.vendorId === vendorId &&
    booking.scheduledDate === scheduledDate &&
    booking.serviceStyle === serviceStyle &&
    (booking.status === 'confirmed' || booking.status === 'pending' || booking.status === 'in_progress')
  );
  
  if (vendorBookings.length === 0) {
    return { hasConflict: false };
  }
  
  // Convert scheduled time to minutes
  const [reqHour, reqMin] = scheduledTime.split(':').map(Number);
  const requestedStart = reqHour * 60 + reqMin;
  const requestedEnd = requestedStart + duration;
  
  // Check for overlaps
  const conflicts: any[] = [];
  
  for (const booking of vendorBookings) {
    const [bookHour, bookMin] = booking.scheduledTime.split(':').map(Number);
    const bookingStart = bookHour * 60 + bookMin;
    const bookingEnd = bookingStart + (booking.duration || 60);
    
    // Check overlap: (Start1 < End2) AND (Start2 < End1)
    if (requestedStart < bookingEnd && bookingStart < requestedEnd) {
      conflicts.push({
        bookingId: booking.id,
        scheduledTime: booking.scheduledTime,
        duration: booking.duration,
        serviceName: booking.serviceName,
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
 * Helper: Find alternative time slots
 */
async function findAlternativeSlots(
  vendorId: string,
  date: string,
  serviceStyle: string,
  duration: number
) {
  // Get vendor availability
  const availability = await kv.get(`vendor:${vendorId}:availability:v2`);
  if (!availability) {
    return [];
  }
  
  // Get day of week
  const dateObj = new Date(date);
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dateObj.getDay()];
  
  const dayConfig = availability[dayName];
  if (!dayConfig || !dayConfig[serviceStyle]) {
    return [];
  }
  
  const slots = dayConfig[serviceStyle].slots || [];
  const alternatives: string[] = [];
  
  // Check each slot for conflicts
  for (const slot of slots) {
    if (typeof slot === 'string' && slot.includes('-')) {
      const [start] = slot.split('-');
      const conflict = await checkBookingConflicts(vendorId, date, start, duration, serviceStyle);
      if (!conflict.hasConflict) {
        alternatives.push(start);
      }
    }
  }
  
  return alternatives.slice(0, 5); // Return top 5 alternatives
}

/**
 * POST /bookings/validate-slot
 * Validate time slot availability before booking
 */
app.post('/bookings/validate-slot', async (c) => {
  try {
    const { vendorId, scheduledDate, scheduledTime, duration, serviceStyle, serviceType, tableId, date, time } = await c.req.json();
    
    // ✅ FIX: Support cafe table bookings
    if (serviceType === 'pet_cafe' || serviceStyle === 'pet_cafe') {
      const cafeDate = date || scheduledDate;
      const cafeTime = time || scheduledTime;
      
      if (!vendorId || !cafeDate || !cafeTime || !tableId) {
        return c.json({
          valid: false,
          error: 'Missing required fields for cafe booking',
          required: ['vendorId', 'date', 'time', 'tableId']
        }, 400);
      }
      
      // Check if table is available
      const reservationKey = `cafe:${vendorId}:reservations:${cafeDate}:${cafeTime}`;
      const existingReservations = await kv.get(reservationKey) || [];
      
      // Check if table is already booked
      for (const r of existingReservations) {
        const reservation = typeof r === 'string' ? await kv.get(`reservation:${r}`) : r;
        if (reservation && reservation.tableId === tableId && 
            (reservation.status === 'confirmed' || reservation.status === 'pending')) {
          return c.json({
            valid: false,
            error: 'Table is already booked for this time slot',
            message: 'This table is no longer available. Please select another table.'
          }, 409);
        }
      }
      
      return c.json({
        valid: true,
        message: 'Table is available',
        tableId,
        date: cafeDate,
        time: cafeTime
      });
    }
    
    // Standard slot validation for other services
    if (!vendorId || !scheduledDate || !scheduledTime || !duration || !serviceStyle) {
      return c.json({
        valid: false,
        error: 'Missing required fields',
        required: ['vendorId', 'scheduledDate', 'scheduledTime', 'duration', 'serviceStyle']
      }, 400);
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
      // Find alternative slots
      const alternatives = await findAlternativeSlots(
        vendorId,
        scheduledDate,
        serviceStyle,
        duration
      );
      
      return c.json({
        valid: false,
        error: 'Time slot not available',
        conflicts: conflictCheck.conflicts,
        alternatives,
        message: alternatives.length > 0 
          ? `This slot is booked. ${alternatives.length} alternative slots available.`
          : 'This slot is booked. No alternatives available for this date.'
      }, 409); // 409 Conflict
    }
    
    return c.json({
      valid: true,
      message: 'Time slot available',
      scheduledTime,
      scheduledDate
    });
    
  } catch (error) {
    console.error('Error validating slot:', error);
    return c.json({ valid: false, error: String(error) }, 500);
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
app.post('/bookings/:bookingId/verify-otp-enhanced', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { otp, otpType = 'end' } = await c.req.json(); // 'start' or 'end'
    
    if (!otp) {
      return c.json({
        error: 'OTP required',
        field: 'otp'
      }, 400);
    }
    
    // Get booking
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({
        error: 'Booking not found',
        bookingId
      }, 404);
    }
    
    // Get OTP data
    const otpField = otpType === 'start' ? 'startOtpData' : 'endOtpData';
    const otpData = booking[otpField];
    
    if (!otpData) {
      return c.json({
        error: 'OTP not generated for this booking',
        hint: 'OTP is generated when booking is created or session starts'
      }, 400);
    }
    
    // ✅ FIX 3.1: Check expiry
    const now = new Date();
    const expiresAt = new Date(otpData.expiresAt);
    
    if (now > expiresAt) {
      return c.json({
        error: 'OTP expired',
        expiredAt: otpData.expiresAt,
        hint: 'Request a new OTP',
        canResend: true
      }, 400);
    }
    
    // ✅ FIX 3.2: Check attempt limit
    if (otpData.attempts >= otpData.maxAttempts) {
      return c.json({
        error: 'Maximum OTP attempts exceeded',
        maxAttempts: otpData.maxAttempts,
        hint: 'Request a new OTP or contact support',
        locked: true
      }, 403);
    }
    
    // ✅ FIX 3.3: Verify OTP
    if (otp !== otpData.otp) {
      // Increment attempt counter
      otpData.attempts += 1;
      booking[otpField] = otpData;
      await kv.set(`booking:${bookingId}`, booking);
      
      const remainingAttempts = otpData.maxAttempts - otpData.attempts;
      
      return c.json({
        error: 'Invalid OTP',
        attempts: otpData.attempts,
        maxAttempts: otpData.maxAttempts,
        remainingAttempts,
        hint: remainingAttempts > 0 
          ? `${remainingAttempts} attempts remaining`
          : 'No attempts remaining. Request new OTP.'
      }, 400);
    }
    
    // ✅ OTP verified successfully
    
    // Update booking based on OTP type
    if (otpType === 'start') {
      booking.sessionStatus = 'active';
      booking.actualStartTime = new Date().toISOString();
      booking.startOtpVerified = true;
    } else {
      booking.status = 'completed';
      booking.actualEndTime = new Date().toISOString();
      booking.endOtpVerified = true;
      
      // Calculate actual duration
      if (booking.actualStartTime) {
        const start = new Date(booking.actualStartTime);
        const end = new Date(booking.actualEndTime);
        booking.actualDuration = Math.round((end.getTime() - start.getTime()) / 60000); // minutes
      }
    }
    
    booking.updatedAt = new Date().toISOString();
    await kv.set(`booking:${bookingId}`, booking);
    
    console.log(`✅ ${otpType.toUpperCase()} OTP verified for booking ${bookingId}`);
    
    return c.json({
      success: true,
      message: `${otpType === 'start' ? 'Service started' : 'Service completed'} successfully`,
      booking: {
        id: bookingId,
        status: booking.status,
        sessionStatus: booking.sessionStatus,
        actualDuration: booking.actualDuration
      }
    });
    
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /bookings/:bookingId/resend-otp
 * Resend OTP with new expiry
 */
app.post('/bookings/:bookingId/resend-otp', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { otpType = 'end' } = await c.req.json();
    
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // Generate new OTP
    const newOtpData = generateOTPWithExpiry();
    
    const otpField = otpType === 'start' ? 'startOtpData' : 'endOtpData';
    booking[otpField] = newOtpData;
    booking.updatedAt = new Date().toISOString();
    
    await kv.set(`booking:${bookingId}`, booking);
    
    console.log(`📱 ${otpType.toUpperCase()} OTP resent for booking ${bookingId}: ${newOtpData.otp}`);
    
    return c.json({
      success: true,
      message: 'OTP resent successfully',
      otp: newOtpData.otp, // In production, send via SMS
      expiresAt: newOtpData.expiresAt,
      expiresIn: '30 minutes'
    });
    
  } catch (error) {
    console.error('Error resending OTP:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// FIX 4: PAGINATION SUPPORT
// ==========================================================================

/**
 * GET /customer/:customerId/bookings-paginated
 * Get customer bookings with pagination
 */
app.get('/customer/:customerId/bookings-paginated', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const status = c.req.query('status'); // Optional filter
    const sortBy = c.req.query('sortBy') || 'date'; // date, amount
    const sortOrder = c.req.query('sortOrder') || 'desc'; // asc, desc
    
    // Validate pagination params
    if (page < 1 || limit < 1 || limit > 100) {
      return c.json({
        error: 'Invalid pagination parameters',
        hint: 'page must be >= 1, limit must be between 1 and 100'
      }, 400);
    }
    
    // Get all customer bookings
    const allBookingIds = await kv.get(`booking:customer:${customerId}`) || [];
    
    // Fetch full booking objects
    let allBookings: any[] = [];
    for (const bookingId of allBookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking) {
        allBookings.push(booking);
      }
    }
    
    // Filter by status if provided
    if (status) {
      allBookings = allBookings.filter(b => b.status === status);
    }
    
    // Sort bookings
    allBookings.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.scheduledDate).getTime();
        const dateB = new Date(b.scheduledDate).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortBy === 'amount') {
        return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      }
      return 0;
    });
    
    // Calculate pagination
    const totalCount = allBookings.length;
    const totalPages = Math.ceil(totalCount / limit);
    const offset = (page - 1) * limit;
    const hasMore = offset + limit < totalCount;
    
    // Get paginated results
    const paginatedBookings = allBookings.slice(offset, offset + limit);
    
    return c.json({
      success: true,
      bookings: paginatedBookings,
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
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /vendor/:vendorId/bookings-paginated
 * Get vendor bookings with pagination
 */
app.get('/vendor/:vendorId/bookings-paginated', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const status = c.req.query('status');
    const dateFrom = c.req.query('dateFrom');
    const dateTo = c.req.query('dateTo');
    
    // Get all vendor bookings
    const allBookingIds = await kv.get(`vendor:bookings:${vendorId}`) || [];
    
    // Fetch full booking objects
    let allBookings: any[] = [];
    for (const bookingId of allBookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking) {
        allBookings.push(booking);
      }
    }
    
    // Apply filters
    if (status) {
      allBookings = allBookings.filter(b => b.status === status);
    }
    
    if (dateFrom) {
      allBookings = allBookings.filter(b => b.scheduledDate >= dateFrom);
    }
    
    if (dateTo) {
      allBookings = allBookings.filter(b => b.scheduledDate <= dateTo);
    }
    
    // Sort by date (newest first)
    allBookings.sort((a, b) => {
      const dateA = new Date(a.scheduledDate).getTime();
      const dateB = new Date(b.scheduledDate).getTime();
      return dateB - dateA;
    });
    
    // Pagination
    const totalCount = allBookings.length;
    const totalPages = Math.ceil(totalCount / limit);
    const offset = (page - 1) * limit;
    const paginatedBookings = allBookings.slice(offset, offset + limit);
    
    return c.json({
      success: true,
      bookings: paginatedBookings,
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
    return c.json({ error: String(error) }, 500);
  }
});

// Export helper functions for use in other endpoints
export { checkBookingConflicts, findAlternativeSlots, generateOTPWithExpiry };

export default app;
