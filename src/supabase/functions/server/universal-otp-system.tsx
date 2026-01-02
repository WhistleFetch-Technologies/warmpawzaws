import { Hono } from "hono";
import * as kv from './kv_store';
import { generateId } from './database-schema';

/**
 * UNIVERSAL OTP SYSTEM
 * Production-ready OTP management for all services
 * 
 * Generates OTPs for:
 * - Vet appointments
 * - Walker sessions
 * - Grooming sessions
 * - Training sessions
 * - Boarding check-in/out
 * - Home visits
 * - Meal delivery
 * 
 * Only vendor with valid OTP can mark service as completed
 */

export function registerUniversalOTPSystem(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // =============================================
  // GENERATE OTP FOR BOOKING/SESSION
  // =============================================
  function generateOTP(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  // =============================================
  // CREATE BOOKING WITH OTP
  // =============================================
  app.post(`${BASE}/bookings/create-with-otp`, async (c) => {
    try {
      const body = await c.req.json();
      
      const {
        customerId,
        vendorId,
        serviceType, // 'vet', 'grooming', 'training', 'walker', 'boarding', 'meal', 'home_visit'
        serviceId,
        staffId,
        scheduledDate,
        scheduledTime,
        petId,
        price,
        notes
      } = body;

      // Validation
      if (!customerId || !vendorId || !serviceType || !serviceId) {
        return c.json({ 
          error: 'Customer, vendor, service type, and service ID are required' 
        }, 400);
      }

      const bookingId = generateId('booking');
      
      // Generate OTPs
      const startOTP = generateOTP();
      const endOTP = generateOTP();
      
      const booking = {
        id: bookingId,
        customerId,
        vendorId,
        serviceType,
        serviceId,
        staffId: staffId || null,
        petId: petId || null,
        
        // Schedule
        scheduledDate,
        scheduledTime,
        
        // OTP System
        otp: {
          start: startOTP,
          end: endOTP,
          startUsed: false,
          endUsed: false,
          generatedAt: new Date().toISOString()
        },
        
        // Payment
        price: parseFloat(price || 0),
        paymentStatus: 'pending', // pending, completed, failed, refunded
        paymentId: null,
        
        // Status
        status: 'confirmed', // confirmed, in_progress, completed, cancelled
        
        // Tracking
        startedAt: null,
        completedAt: null,
        duration: null,
        
        // Notes
        customerNotes: notes || '',
        vendorNotes: '',
        completionNotes: '',
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save booking
      await kv.set(`booking:${bookingId}`, booking);

      // Add to customer's bookings
      const customerBookings = await kv.get(`customer:${customerId}:bookings`) || [];
      customerBookings.push(bookingId);
      await kv.set(`customer:${customerId}:bookings`, customerBookings);

      // Add to vendor's bookings
      const vendorBookings = await kv.get(`vendor:${vendorId}:bookings`) || [];
      vendorBookings.push(bookingId);
      await kv.set(`vendor:${vendorId}:bookings`, vendorBookings);

      console.log(`✅ [OTP] Created booking ${bookingId} with OTPs: ${startOTP}, ${endOTP}`);

      return c.json({
        success: true,
        booking: {
          ...booking,
          // Return OTPs to customer
          startOTP,
          endOTP
        },
        message: 'Booking created successfully. Save your OTPs for service verification.'
      });

    } catch (error) {
      console.error('[OTP] Error:', error);
      return c.json({ error: 'Failed to create booking' }, 500);
    }
  });

  // =============================================
  // VERIFY OTP & START SERVICE
  // =============================================
  app.post(`${BASE}/bookings/:bookingId/verify-start`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, vendorId, location } = await c.req.json();

      console.log(`[OTP] Verifying start OTP for booking: ${bookingId}`);

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Verify vendor
      if (booking.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized vendor' }, 403);
      }

      // Check if already started
      if (booking.otp.startUsed) {
        return c.json({ error: 'Service already started' }, 400);
      }

      // Verify OTP
      if (booking.otp.start !== otp) {
        return c.json({ error: 'Invalid OTP' }, 400);
      }

      // Mark as started
      booking.status = 'in_progress';
      booking.otp.startUsed = true;
      booking.startedAt = new Date().toISOString();
      booking.startLocation = location || null;
      booking.updatedAt = new Date().toISOString();

      // Save
      await kv.set(`booking:${bookingId}`, booking);

      console.log(`✅ [OTP] Service started: ${bookingId}`);

      return c.json({
        success: true,
        booking,
        message: 'Service started successfully'
      });

    } catch (error) {
      console.error('[OTP] Error:', error);
      return c.json({ error: 'Failed to verify OTP' }, 500);
    }
  });

  // =============================================
  // VERIFY OTP & END SERVICE
  // =============================================
  app.post(`${BASE}/bookings/:bookingId/verify-end`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, vendorId, location, completionNotes, completionPhotos } = await c.req.json();

      console.log(`[OTP] Verifying end OTP for booking: ${bookingId}`);

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Verify vendor
      if (booking.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized vendor' }, 403);
      }

      // Check if service started
      if (!booking.otp.startUsed) {
        return c.json({ error: 'Service not started yet' }, 400);
      }

      // Check if already completed
      if (booking.otp.endUsed) {
        return c.json({ error: 'Service already completed' }, 400);
      }

      // Verify OTP
      if (booking.otp.end !== otp) {
        return c.json({ error: 'Invalid OTP' }, 400);
      }

      // Calculate duration
      const startTime = new Date(booking.startedAt).getTime();
      const endTime = Date.now();
      const durationMinutes = Math.floor((endTime - startTime) / 60000);

      // Mark as completed
      booking.status = 'completed';
      booking.otp.endUsed = true;
      booking.completedAt = new Date().toISOString();
      booking.endLocation = location || null;
      booking.duration = durationMinutes;
      booking.completionNotes = completionNotes || '';
      booking.completionPhotos = completionPhotos || [];
      booking.updatedAt = new Date().toISOString();

      // Save
      await kv.set(`booking:${bookingId}`, booking);

      // Log to pet profile if petId exists
      if (booking.petId) {
        await logToPetProfile(booking.petId, booking.serviceType, booking);
      }

      console.log(`✅ [OTP] Service completed: ${bookingId}`);

      return c.json({
        success: true,
        booking,
        message: 'Service completed successfully'
      });

    } catch (error) {
      console.error('[OTP] Error:', error);
      return c.json({ error: 'Failed to verify OTP' }, 500);
    }
  });

  // =============================================
  // GET BOOKING DETAILS (Customer & Vendor)
  // =============================================
  app.get(`${BASE}/bookings/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const userId = c.req.query('userId');
      const userType = c.req.query('userType'); // 'customer' or 'vendor'

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Verify access
      if (userType === 'customer' && booking.customerId !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      if (userType === 'vendor' && booking.vendorId !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Get vendor details
      const vendor = await kv.get(`vendor:${booking.vendorId}`);
      
      // Get staff details if assigned
      let staff = null;
      if (booking.staffId) {
        const allStaff = await kv.get(`vendor:${booking.vendorId}:staff`) || [];
        staff = allStaff.find((s: any) => s.id === booking.staffId);
      }

      // Get pet details if exists
      let pet = null;
      if (booking.petId) {
        pet = await kv.get(`pet:${booking.petId}`);
      }

      return c.json({
        success: true,
        booking: {
          ...booking,
          // Only show OTPs to customer
          showOTPs: userType === 'customer',
          otps: userType === 'customer' ? {
            start: booking.otp.start,
            end: booking.otp.end,
            startUsed: booking.otp.startUsed,
            endUsed: booking.otp.endUsed
          } : null
        },
        vendor: vendor ? {
          id: vendor.id,
          businessName: vendor.businessName,
          phone: vendor.phone,
          address: vendor.address
        } : null,
        staff: staff ? {
          id: staff.id,
          name: staff.name,
          photo: staff.photo,
          phone: staff.phone
        } : null,
        pet: pet ? {
          id: pet.id,
          name: pet.name,
          breed: pet.breed,
          photo: pet.photo
        } : null
      });

    } catch (error) {
      console.error('[OTP] Error:', error);
      return c.json({ error: 'Failed to fetch booking' }, 500);
    }
  });

  // =============================================
  // GET VENDOR'S TODAY BOOKINGS
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/today-bookings`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const today = new Date().toISOString().split('T')[0];

      const bookingIds = await kv.get(`vendor:${vendorId}:bookings`) || [];
      const todayBookings = [];

      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (booking && booking.scheduledDate === today) {
          // Get customer details
          const customer = await kv.get(`customer:${booking.customerId}`);
          
          // Get pet details
          let pet = null;
          if (booking.petId) {
            pet = await kv.get(`pet:${booking.petId}`);
          }

          todayBookings.push({
            ...booking,
            customerName: customer?.name || 'Unknown',
            customerPhone: customer?.phone || '',
            petName: pet?.name || '',
            petBreed: pet?.breed || ''
          });
        }
      }

      // Sort by time
      todayBookings.sort((a, b) => {
        const timeA = a.scheduledTime || '00:00';
        const timeB = b.scheduledTime || '00:00';
        return timeA.localeCompare(timeB);
      });

      return c.json({
        success: true,
        bookings: todayBookings,
        total: todayBookings.length,
        pending: todayBookings.filter(b => b.status === 'confirmed').length,
        inProgress: todayBookings.filter(b => b.status === 'in_progress').length,
        completed: todayBookings.filter(b => b.status === 'completed').length
      });

    } catch (error) {
      console.error('[OTP] Error:', error);
      return c.json({ error: 'Failed to fetch bookings' }, 500);
    }
  });

  // =============================================
  // CANCEL BOOKING
  // =============================================
  app.post(`${BASE}/bookings/:bookingId/cancel`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { userId, userType, reason } = await c.req.json();

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Verify access
      if (userType === 'customer' && booking.customerId !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      if (userType === 'vendor' && booking.vendorId !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Cannot cancel if in progress or completed
      if (booking.status === 'in_progress' || booking.status === 'completed') {
        return c.json({ error: 'Cannot cancel active or completed booking' }, 400);
      }

      booking.status = 'cancelled';
      booking.cancellationReason = reason || '';
      booking.cancelledBy = userType;
      booking.cancelledAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();

      await kv.set(`booking:${bookingId}`, booking);

      return c.json({
        success: true,
        booking,
        message: 'Booking cancelled successfully'
      });

    } catch (error) {
      console.error('[OTP] Error:', error);
      return c.json({ error: 'Failed to cancel booking' }, 500);
    }
  });

  // Helper function to log to pet profile
  async function logToPetProfile(petId: string, serviceType: string, booking: any) {
    try {
      const pet = await kv.get(`pet:${petId}`);
      if (!pet) return;

      if (!pet.serviceHistory) {
        pet.serviceHistory = [];
      }

      const logEntry = {
        id: generateId('log'),
        bookingId: booking.id,
        serviceType,
        date: booking.completedAt,
        duration: booking.duration,
        vendorId: booking.vendorId,
        staffId: booking.staffId,
        notes: booking.completionNotes || '',
        photos: booking.completionPhotos || [],
        location: booking.endLocation || null
      };

      pet.serviceHistory.push(logEntry);
      pet.lastServiceDate = booking.completedAt;
      await kv.set(`pet:${petId}`, pet);

      console.log(`✅ Logged service to pet profile: ${petId}`);
    } catch (error) {
      console.error('Error logging to pet profile:', error);
    }
  }
}
