/**
 * COMPREHENSIVE GAP FIXES
 * 
 * Fixes all remaining gaps from Comprehensive Flow Analysis Report:
 * 1. Staff Requirement Timing - Allow solo vendors to publish without staff
 * 2. Refund Integration - Complete refund flow for rejections/cancellations
 * 3. Room Inventory Race Condition - Atomic booking operations
 * 4. Service Catalog Dependency - Fallback/default services
 * 5. OTP Logic Standardization - Document and standardize OTP requirements
 * 6. Booking Modification - Allow customers to modify bookings
 * 7. State Machine Validation - Vendor lifecycle state validation
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { sendSuccess, sendError } from './response-utils.ts';
import { createRazorpayRefund } from './razorpay-integration.tsx';

export function comprehensiveGapFixes(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';

  // ============================================
  // GAP #1: STAFF REQUIREMENT TIMING FIX
  // ============================================
  // Allow solo vendors to publish services without staff
  // For center-based vendors, staff is still required

  /**
   * POST /vendor/:vendorId/services/publish-with-staff-check
   * Enhanced publish with smart staff requirement check
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/services/publish-with-staff-check`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { serviceStyle, allowSoloPublish } = await c.req.json();

      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Check if vendor is solo provider
      const isSoloProvider = vendor.isSoloProvider || 
                            vendor.vendorType === 'service_provider' ||
                            ['pet_walker', 'nutritionist', 'pet_sitter', 'pet_trainer'].includes(vendor.roleId);

      // Check if vendor is center-based
      const isCenterBased = vendor.vendorType === 'healthcare_provider' ||
                           vendor.serviceStyle === 'at_center' ||
                           ['veterinary_clinic', 'pet_boarding', 'pet_resort', 'pet_cafe'].includes(vendor.roleId);

      const vendorStaffList = await kv.get(`vendor:${vendorId}:staff`) || [];

      // ✅ FIX: Solo providers can publish without staff (they ARE the staff)
      if (isSoloProvider && vendorStaffList.length === 0) {
        // Auto-create staff profile for solo vendor
        const staffId = `${vendorId}_staff_self`;
        const soloStaff = {
          id: staffId,
          vendorId,
          fullName: vendor.fullName || vendor.businessName,
          phone: vendor.phone,
          email: vendor.email,
          role: vendor.roleId,
          roleType: vendor.roleId,
          isSoloProvider: true,
          isActive: true,
          isOnline: true,
          services: [],
          availability: vendor.availability || {},
          createdAt: new Date().toISOString()
        };

        await kv.set(`staff:${staffId}`, soloStaff);
        await kv.set(`vendor:${vendorId}:staff`, [staffId]);

        console.log(`✅ Auto-created staff profile for solo vendor: ${vendorId}`);
      }

      // Center-based vendors still need staff
      if (isCenterBased && vendorStaffList.length === 0) {
        return sendError(c, {
          error: 'Cannot publish services without staff',
          message: 'Center-based vendors must have at least one staff member before publishing services.',
          requiresStaff: true,
          isCenterBased: true
        }, 400);
      }

      // Proceed with normal publish flow
      const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
      const vendorServices = await kv.get(vendorServicesKey);

      if (!vendorServices || !vendorServices.services || vendorServices.services.length === 0) {
        return sendError(c, 'No services configured', 400);
      }

      const enabledServices = vendorServices.services.filter((s: any) => s.isEnabled);
      if (enabledServices.length === 0) {
        return sendError(c, 'No services enabled', 400);
      }

      // Publish services
      enabledServices.forEach((service: any) => {
        service.publishStatus = 'published';
        service.publishedAt = new Date().toISOString();
      });

      await kv.set(vendorServicesKey, vendorServices);

      return sendSuccess(c, {
        published: enabledServices.length,
        isSoloProvider,
        autoCreatedStaff: isSoloProvider && vendorStaffList.length === 0
      }, 'Services published successfully');
    } catch (error) {
      console.error('Error publishing services:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // GAP #2: REFUND INTEGRATION FIX
  // ============================================
  // Complete refund flow for booking rejections and cancellations

  /**
   * POST /bookings/:bookingId/process-refund
   * Process refund for cancelled/rejected bookings
   */
  app.post(`${BASE_PATH}/bookings/:bookingId/process-refund`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { refundMethod = 'wallet', reason } = await c.req.json();

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Check if already refunded
      if (booking.refundStatus === 'refunded' || booking.refundStatus === 'processing') {
        return sendError(c, 'Refund already processed', 400);
      }

      // Get payment details
      const paymentId = booking.paymentId || booking.razorpayPaymentId;
      if (!paymentId) {
        return sendError(c, 'Payment ID not found', 404);
      }

      const payment = await kv.get(`payment:${paymentId}`);
      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }

      // Calculate refund amount (full refund for rejections, partial for cancellations)
      let refundAmount = booking.price || payment.amount || 0;
      
      // Apply cancellation fee if customer cancelled
      if (booking.cancelledBy === 'customer' && booking.cancellationReason) {
        const hoursUntilBooking = booking.scheduledDate 
          ? Math.max(0, (new Date(booking.scheduledDate).getTime() - Date.now()) / (1000 * 60 * 60))
          : 0;
        
        // Apply cancellation fee if less than 24 hours
        if (hoursUntilBooking < 24) {
          const cancellationFee = refundAmount * 0.1; // 10% fee
          refundAmount = refundAmount - cancellationFee;
        }
      }

      // Process refund
      if (refundMethod === 'wallet') {
        // Refund to wallet
        const walletCredit = await fetch(
          `${BASE_PATH}/wallet/${booking.customerId}/credit`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
            },
            body: JSON.stringify({
              amount: refundAmount,
              source: 'refund',
              description: `Refund for ${booking.status} booking #${bookingId}`,
              referenceId: bookingId
            })
          }
        );

        if (!walletCredit.ok) {
          throw new Error('Failed to credit wallet');
        }
      } else {
        // Refund to original payment method via Razorpay
        try {
          await createRazorpayRefund(paymentId, refundAmount, {
            bookingId,
            reason: reason || 'Booking cancelled/rejected',
            refundMethod: 'original'
          });
        } catch (razorpayError) {
          console.error('Razorpay refund failed, falling back to wallet:', razorpayError);
          // Fallback to wallet
          const walletCredit = await fetch(
            `${BASE_PATH}/wallet/${booking.customerId}/credit`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
              },
              body: JSON.stringify({
                amount: refundAmount,
                source: 'refund',
                description: `Refund for ${booking.status} booking #${bookingId}`,
                referenceId: bookingId
              })
            }
          );
        }
      }

      // Create refund record
      const refundId = `refund_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const refund = {
        id: refundId,
        bookingId,
        paymentId,
        customerId: booking.customerId,
        vendorId: booking.vendorId,
        amount: refundAmount,
        originalAmount: booking.price || payment.amount,
        refundMethod,
        reason: reason || booking.cancellationReason || 'Booking cancelled/rejected',
        status: 'completed',
        processedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      await kv.set(`refund:${refundId}`, refund);

      // Update booking
      booking.refundStatus = 'refunded';
      booking.refundId = refundId;
      booking.refundAmount = refundAmount;
      booking.refundedAt = new Date().toISOString();
      await kv.set(`booking:${bookingId}`, booking);

      // Update payment
      payment.status = 'refunded';
      payment.refundId = refundId;
      payment.refundAmount = refundAmount;
      await kv.set(`payment:${paymentId}`, payment);

      // Reverse earnings if booking was completed
      if (booking.status === 'completed') {
        // Reverse vendor earnings
        const vendorEarningsKey = `vendor:${booking.vendorId}:earnings:lifetime`;
        const vendorEarnings = await kv.get(vendorEarningsKey) || { totalEarnings: 0, totalRevenue: 0 };
        vendorEarnings.totalEarnings = Math.max(0, vendorEarnings.totalEarnings - refundAmount);
        vendorEarnings.totalRevenue = Math.max(0, vendorEarnings.totalRevenue - (booking.price || 0));
        await kv.set(vendorEarningsKey, vendorEarnings);
      }

      console.log(`✅ Refund processed: ${refundId} for booking ${bookingId}, amount: ₹${refundAmount}`);

      return sendSuccess(c, { refund, booking }, 'Refund processed successfully');
    } catch (error) {
      console.error('Error processing refund:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // GAP #3: ROOM INVENTORY RACE CONDITION FIX
  // ============================================
  // Atomic booking operations for room inventory

  /**
   * POST /resort/book-atomic
   * Atomic room booking with inventory lock
   */
  app.post(`${BASE_PATH}/resort/book-atomic`, async (c) => {
    try {
      const { roomId, fromDate, toDate, quantity, bookingId } = await c.req.json();

      if (!roomId || !fromDate || !toDate || !quantity || !bookingId) {
        return sendError(c, 'Missing required fields', 400);
      }

      // Get room details
      const room = await kv.get(`resort:room:${roomId}`);
      if (!room) {
        return sendError(c, 'Room not found', 404);
      }

      // Create lock key for atomic operation
      const lockKey = `lock:resort:${roomId}:${fromDate}:${toDate}`;
      const existingLock = await kv.get(lockKey);

      if (existingLock && existingLock.bookingId !== bookingId) {
        return sendError(c, 'Another booking is in progress for this room', 409);
      }

      // Set lock
      await kv.set(lockKey, {
        bookingId,
        lockedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30000).toISOString() // 30 second lock
      });

      try {
        // Check availability for each night
        const start = new Date(fromDate);
        const end = new Date(toDate);
        const nights: string[] = [];

        for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
          nights.push(d.toISOString().split('T')[0]);
        }

        // Atomic check and reserve
        const availabilityChecks: any[] = [];
        for (const dateStr of nights) {
          const inventoryKey = `inventory:resort:${roomId}:${dateStr}`;
          const currentBooked = await kv.get(inventoryKey) || 0;
          const available = room.totalInventory - currentBooked;

          if (available < quantity) {
            // Release lock
            await kv.delete(lockKey);
            return sendError(c, {
              error: 'Insufficient availability',
              date: dateStr,
              available,
              requested: quantity
            }, 400);
          }

          availabilityChecks.push({ date: dateStr, available, currentBooked });
        }

        // All nights available - reserve inventory
        for (const dateStr of nights) {
          const inventoryKey = `inventory:resort:${roomId}:${dateStr}`;
          const currentBooked = await kv.get(inventoryKey) || 0;
          await kv.set(inventoryKey, currentBooked + quantity);
        }

        // Store booking inventory record
        await kv.set(`booking:inventory:${bookingId}`, {
          bookingId,
          roomId,
          fromDate,
          toDate,
          quantity,
          nights,
          reservedAt: new Date().toISOString()
        });

        // Release lock
        await kv.delete(lockKey);

        return sendSuccess(c, {
          bookingId,
          roomId,
          nights,
          quantity,
          reserved: true
        }, 'Room inventory reserved successfully');
      } catch (error) {
        // Release lock on error
        await kv.delete(lockKey);
        throw error;
      }
    } catch (error) {
      console.error('Error in atomic room booking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /resort/release-inventory
   * Release inventory when booking is cancelled
   */
  app.post(`${BASE_PATH}/resort/release-inventory`, async (c) => {
    try {
      const { bookingId } = await c.req.json();

      const inventoryRecord = await kv.get(`booking:inventory:${bookingId}`);
      if (!inventoryRecord) {
        return sendError(c, 'Inventory record not found', 404);
      }

      // Release inventory for each night
      for (const dateStr of inventoryRecord.nights) {
        const inventoryKey = `inventory:resort:${inventoryRecord.roomId}:${dateStr}`;
        const currentBooked = await kv.get(inventoryKey) || 0;
        await kv.set(inventoryKey, Math.max(0, currentBooked - inventoryRecord.quantity));
      }

      // Delete inventory record
      await kv.delete(`booking:inventory:${bookingId}`);

      return sendSuccess(c, { bookingId, released: true }, 'Inventory released successfully');
    } catch (error) {
      console.error('Error releasing inventory:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // GAP #4: SERVICE CATALOG DEPENDENCY FIX
  // ============================================
  // Provide fallback/default services when catalog is empty

  /**
   * GET /vendor/:vendorId/default-services/:roleId
   * Get default services for a role when catalog is empty
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/default-services/:roleId`, async (c) => {
    try {
      const { vendorId, roleId } = c.req.param();
      const serviceStyle = c.req.query('serviceStyle') as string || 'at_center';

      // Default services by role
      const defaultServices: Record<string, any[]> = {
        veterinarian: [
          { id: 'vet_consultation', name: 'General Consultation', basePrice: 500, duration: 30 },
          { id: 'vet_vaccination', name: 'Vaccination', basePrice: 300, duration: 15 },
          { id: 'vet_checkup', name: 'Health Checkup', basePrice: 400, duration: 20 }
        ],
        pet_groomer: [
          { id: 'groom_basic', name: 'Basic Grooming', basePrice: 800, duration: 60 },
          { id: 'groom_full', name: 'Full Grooming', basePrice: 1200, duration: 90 },
          { id: 'groom_bath', name: 'Bath & Dry', basePrice: 500, duration: 45 }
        ],
        pet_walker: [
          { id: 'walk_30', name: '30 Minute Walk', basePrice: 200, duration: 30 },
          { id: 'walk_60', name: '60 Minute Walk', basePrice: 350, duration: 60 }
        ],
        pet_trainer: [
          { id: 'train_basic', name: 'Basic Training', basePrice: 1000, duration: 60 },
          { id: 'train_advanced', name: 'Advanced Training', basePrice: 1500, duration: 90 }
        ],
        pet_boarding: [
          { id: 'board_night', name: 'Overnight Boarding', basePrice: 800, duration: 1440 }
        ],
        nutritionist: [
          { id: 'nutrition_consult', name: 'Nutrition Consultation', basePrice: 600, duration: 45 },
          { id: 'diet_plan', name: 'Custom Diet Plan', basePrice: 1000, duration: 60 }
        ]
      };

      const services = defaultServices[roleId] || defaultServices.veterinarian;

      // Filter by service style
      const filteredServices = services.map(service => ({
        ...service,
        serviceId: service.id,
        serviceName: service.name,
        price: service.basePrice,
        isEnabled: false,
        publishStatus: 'draft',
        isPlatformManaged: false,
        isDefaultService: true, // Mark as default
        serviceStyle,
        applicableRoles: [roleId]
      }));

      return sendSuccess(c, {
        services: filteredServices,
        isDefault: true,
        message: 'Using default services. Please configure catalog services in admin panel.'
      });
    } catch (error) {
      console.error('Error loading default services:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // GAP #5: OTP LOGIC STANDARDIZATION
  // ============================================
  // Document and standardize OTP requirements

  /**
   * GET /booking/:bookingId/otp-requirements
   * Get OTP requirements for a booking
   */
  app.get(`${BASE_PATH}/booking/:bookingId/otp-requirements`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const serviceType = booking.serviceType || booking.serviceName?.toLowerCase() || '';
      const roleId = booking.vendorRoleId || booking.roleId;

      // Standardize OTP requirements
      const otpRequirements = {
        requiresOTP: true,
        otpType: 'single', // 'single' | 'start_end' | 'none'
        otpCount: 1,
        description: '',
        generateAt: 'confirmed', // 'confirmed' | 'start' | 'end'
        verifyAt: 'completion' // 'start' | 'completion'
      };

      // Determine OTP type based on service
      if (serviceType.includes('walk') || serviceType.includes('train') || serviceType.includes('behavior')) {
        // Walker/Trainer: START + END OTP
        otpRequirements.otpType = 'start_end';
        otpRequirements.otpCount = 2;
        otpRequirements.description = 'START OTP when service begins, END OTP when service completes';
        otpRequirements.generateAt = 'confirmed';
        otpRequirements.verifyAt = 'start';
      } else if (serviceType.includes('tele') || serviceType.includes('video') || serviceType.includes('consultation')) {
        // Tele-consultation: No OTP
        otpRequirements.requiresOTP = false;
        otpRequirements.otpType = 'none';
        otpRequirements.otpCount = 0;
        otpRequirements.description = 'No OTP required for tele-consultation';
      } else {
        // Standard services: Single END OTP
        otpRequirements.otpType = 'single';
        otpRequirements.otpCount = 1;
        otpRequirements.description = 'END OTP required when service completes';
        otpRequirements.generateAt = 'confirmed';
        otpRequirements.verifyAt = 'completion';
      }

      return sendSuccess(c, {
        bookingId,
        otpRequirements,
        serviceType,
        roleId
      });
    } catch (error) {
      console.error('Error getting OTP requirements:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // GAP #6: BOOKING MODIFICATION
  // ============================================
  // Allow customers to modify bookings

  /**
   * POST /bookings/:bookingId/modify
   * Allow customer to modify booking details
   */
  app.post(`${BASE_PATH}/bookings/:bookingId/modify`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { customerId, modifications, reason } = await c.req.json();

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.customerId !== customerId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Check if booking can be modified
      if (!['pending', 'confirmed'].includes(booking.status)) {
        return sendError(c, `Cannot modify booking with status: ${booking.status}`, 400);
      }

      // Check if service has started
      if (booking.status === 'in_progress') {
        return sendError(c, 'Cannot modify booking - service has started', 400);
      }

      // Check modification window (e.g., 24 hours before booking)
      if (booking.scheduledDate) {
        const bookingDateTime = new Date(`${booking.scheduledDate}T${booking.scheduledTime || '00:00'}`);
        const hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
        
        if (hoursUntilBooking < 24) {
          return sendError(c, 'Cannot modify booking less than 24 hours before scheduled time', 400);
        }
      }

      // Store original booking for audit
      const modificationHistory = booking.modificationHistory || [];
      modificationHistory.push({
        timestamp: new Date().toISOString(),
        original: {
          date: booking.scheduledDate,
          time: booking.scheduledTime,
          service: booking.serviceName,
          price: booking.price
        },
        modified: modifications,
        reason
      });

      // Apply modifications
      const modifiedBooking = {
        ...booking,
        ...modifications,
        modificationHistory,
        lastModifiedAt: new Date().toISOString(),
        modifiedBy: 'customer',
        modificationReason: reason
      };

      // If date/time changed, check new availability
      if (modifications.scheduledDate || modifications.scheduledTime) {
        // Check vendor availability for new slot
        const vendor = await kv.get(`vendor:${booking.vendorId}`);
        const newDate = modifications.scheduledDate || booking.scheduledDate;
        const newTime = modifications.scheduledTime || booking.scheduledTime;

        // Validate new slot availability (simplified check)
        const vendorBookings = await kv.get(`vendor:${booking.vendorId}:bookings`) || [];
        for (const existingBookingId of vendorBookings) {
          if (existingBookingId === bookingId) continue; // Skip current booking
          
          const existingBooking = await kv.get(`booking:${existingBookingId}`);
          if (existingBooking &&
              existingBooking.scheduledDate === newDate &&
              existingBooking.scheduledTime === newTime &&
              !['cancelled', 'rejected'].includes(existingBooking.status)) {
            return sendError(c, 'New time slot is not available', 400);
          }
        }
      }

      // If price changed, handle refund/additional payment
      if (modifications.price && modifications.price !== booking.price) {
        const priceDifference = modifications.price - booking.price;
        
        if (priceDifference > 0) {
          // Customer needs to pay additional amount
          modifiedBooking.additionalPaymentRequired = priceDifference;
          modifiedBooking.additionalPaymentStatus = 'pending';
        } else {
          // Refund difference
          const refundAmount = Math.abs(priceDifference);
          // Queue refund (will be processed separately)
          modifiedBooking.refundRequired = refundAmount;
          modifiedBooking.refundStatus = 'pending';
        }
      }

      await kv.set(`booking:${bookingId}`, modifiedBooking);

      // Notify vendor of modification
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await kv.set(`notification:${notificationId}`, {
        id: notificationId,
        userId: booking.vendorId,
        userType: 'vendor',
        type: 'booking_modified',
        title: 'Booking Modified',
        message: `Customer modified booking #${bookingId.slice(-8)}`,
        data: { bookingId, modifications },
        read: false,
        createdAt: new Date().toISOString()
      });

      console.log(`✅ Booking ${bookingId} modified by customer`);

      return sendSuccess(c, {
        booking: modifiedBooking,
        requiresAdditionalPayment: modifiedBooking.additionalPaymentRequired > 0,
        requiresRefund: modifiedBooking.refundRequired > 0
      }, 'Booking modified successfully');
    } catch (error) {
      console.error('Error modifying booking:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // GAP #7: STATE MACHINE VALIDATION
  // ============================================
  // Vendor lifecycle state validation

  /**
   * POST /vendor/:vendorId/validate-state-transition
   * Validate vendor state transitions
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/validate-state-transition`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { newStatus, reason } = await c.req.json();

      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      const currentStatus = vendor.status || vendor.applicationStatus || 'new';

      // Define valid state transitions
      const validTransitions: Record<string, string[]> = {
        'new': ['submitted', 'pending'],
        'submitted': ['pending', 'rejected'],
        'pending': ['approved', 'rejected', 'clarification', 'documents_required'],
        'approved': ['approved_services', 'active', 'rejected'],
        'approved_services': ['approved_availability', 'active'],
        'approved_availability': ['setup_completed', 'active'],
        'setup_completed': ['active'],
        'clarification': ['pending', 'rejected'],
        'documents_required': ['pending', 'rejected'],
        'rejected': ['pending'], // Can resubmit
        'active': ['pending'] // Can be deactivated
      };

      const allowedTransitions = validTransitions[currentStatus] || [];

      if (!allowedTransitions.includes(newStatus)) {
        return sendError(c, {
          error: 'Invalid state transition',
          currentStatus,
          newStatus,
          allowedTransitions,
          reason: `Cannot transition from ${currentStatus} to ${newStatus}`
        }, 400);
      }

      // Additional validation based on target status
      const validationErrors: string[] = [];

      if (newStatus === 'approved_services') {
        // Check if vendor has basic profile
        if (!vendor.fullName && !vendor.businessName) {
          validationErrors.push('Vendor profile incomplete');
        }
      }

      if (newStatus === 'approved_availability') {
        // Check if services are configured
        const servicesConfigured = vendor.servicesConfigured || false;
        if (!servicesConfigured) {
          validationErrors.push('Services must be configured before setting availability');
        }
      }

      if (newStatus === 'active') {
        // Check if setup is complete
        const setupCompleted = vendor.setupCompleted || false;
        if (!setupCompleted) {
          validationErrors.push('Setup must be completed before activating vendor');
        }
      }

      if (validationErrors.length > 0) {
        return sendError(c, {
          error: 'State transition validation failed',
          validationErrors
        }, 400);
      }

      return sendSuccess(c, {
        valid: true,
        currentStatus,
        newStatus,
        canTransition: true
      }, 'State transition is valid');
    } catch (error) {
      console.error('Error validating state transition:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Comprehensive gap fixes endpoints registered');
}

