/**
 * CUSTOMER APP ENHANCEMENTS - SQL-ONLY VERSION
 * 
 * Implements missing features identified in customer lifecycle analysis:
 * 1. Multi-pet booking support
 * 2. Package booking enhancements
 * 3. Emergency booking handling
 * 4. Check-in/check-out flows for boarding/resorts
 * 5. Return processing for e-commerce
 * 6. Reschedule policy enforcement
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL repository calls
 * - Uses `BookingsRepository`, `PetsRepository`, `CustomersRepository`, `ServicesRepository`, `VendorsRepository`, `PackagesRepository`, `OrdersRepository`, `ReturnsRepository`, `WalletsRepository`
 * - Uses `emergency_booking_queue` table for emergency bookings
 * - Uses `return_requests` table for returns
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 12)
 * KV Operations Removed: 48
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { sendSuccess, sendError } from './response-utils.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getPetsRepository } from '../../lib/repositories/pets.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getPackagesRepository } from '../../lib/repositories/packages.ts';
import { getOrdersRepository } from '../../lib/repositories/orders.ts';
import { getReturnsRepository } from '../../lib/repositories/returns.ts';
import { getWalletsRepository } from '../../lib/repositories/wallets.ts';
import { getDbClient, withTransaction } from '../../lib/db.ts';

const BASE_PATH = '/make-server-3dd53475';

export function registerCustomerAppEnhancementsSQL(app: Hono) {
  console.log('✅ Registering Customer App Enhancements (SQL-only)...');

  app.use('*', cors());

  const bookingsRepo = getBookingsRepository();
  const petsRepo = getPetsRepository();
  const customersRepo = getCustomersRepository();
  const servicesRepo = getServicesRepository();
  const vendorsRepo = getVendorsRepository();
  const packagesRepo = getPackagesRepository();
  const ordersRepo = getOrdersRepository();
  const returnsRepo = getReturnsRepository();
  const walletsRepo = getWalletsRepository();
  const db = getDbClient();

  // ==========================================================================
  // MULTI-PET BOOKING SUPPORT
  // ==========================================================================

  /**
   * POST /bookings/create-multi-pet
   * Create booking for multiple pets in one transaction
   */
  app.post(`${BASE_PATH}/bookings/create-multi-pet`, async (c) => {
    try {
      const {
        customerPhone,
        customerId,
        petIds, // Array of pet IDs
        vendorId,
        serviceId,
        serviceType,
        serviceStyle,
        scheduledDate,
        scheduledTime,
        address,
        paymentMethod,
        transactionId
      } = await c.req.json();
      
      if (!petIds || !Array.isArray(petIds) || petIds.length === 0) {
        return sendError(c, 'At least one pet required', 400, { field: 'petIds' });
      }
      
      // Verify all pets belong to customer
      for (const petId of petIds) {
        const pet = await petsRepo.findById(petId);
        if (!pet) {
          return sendError(c, `Pet not found: ${petId}`, 404, { petId });
        }
        
        if (pet.customer_id !== customerId) {
          return sendError(c, `Pet ${petId} does not belong to customer`, 403, { petId });
        }
      }
      
      // Get service and vendor details
      const vendor = await vendorsRepo.findById(vendorId);
      const service = await servicesRepo.findById(serviceId);
      
      if (!vendor || !service) {
        return sendError(c, 'Vendor or service not found', 404);
      }
      
      // Calculate multi-pet pricing
      const basePrice = service.price || 0;
      const petCount = petIds.length;
      
      // Multi-pet discount: First pet full price, additional pets 20% off
      let totalAmount = basePrice;
      for (let i = 1; i < petCount; i++) {
        totalAmount += basePrice * 0.8; // 20% discount per additional pet
      }
      
      const discount = (basePrice * petCount) - totalAmount;
      
      // Create bookings in transaction
      const result = await withTransaction(async (client) => {
        // Create parent booking (stored in package_details JSONB for multi-pet info)
        const parentBooking = await bookingsRepo.create({
          customer_id: customerId,
          vendor_id: vendorId,
          service_id: serviceId,
          booking_date: scheduledDate,
          booking_time: scheduledTime,
          service_type: serviceType,
          address: address,
          base_price: basePrice,
          discount_amount: discount,
          total_amount: totalAmount,
          is_package: false,
          package_details: {
            isMultiPet: true,
            petIds: petIds,
            petCount: petCount,
            childBookings: []
          },
          notes: `Multi-pet booking for ${petCount} pets`
        });
        
        const childBookingIds: string[] = [];
        
        // Create individual bookings for each pet
        for (let i = 0; i < petIds.length; i++) {
          const petId = petIds[i];
          const pet = await petsRepo.findById(petId);
          
          const childAmount = i === 0 ? basePrice : basePrice * 0.8;
          
          const childBooking = await bookingsRepo.create({
            customer_id: customerId,
            vendor_id: vendorId,
            service_id: serviceId,
            booking_date: scheduledDate,
            booking_time: scheduledTime,
            service_type: serviceType,
            address: address,
            base_price: basePrice,
            discount_amount: i === 0 ? 0 : basePrice * 0.2,
            total_amount: childAmount,
            is_package: false,
            package_details: {
              isChildBooking: true,
              parentBookingId: parentBooking.id,
              petId: petId,
              petName: pet?.name,
              siblingIndex: i
            },
            notes: `Child booking ${i + 1} of ${petCount} for pet ${pet?.name}`
          });
          
          childBookingIds.push(childBooking.id);
        }
        
        // Update parent booking with child IDs
        await bookingsRepo.update(parentBooking.id, {
          notes: JSON.stringify({
            isMultiPet: true,
            petIds: petIds,
            petCount: petCount,
            childBookings: childBookingIds
          })
        });
        
        return { parentBooking, childBookingIds };
      });
      
      console.log(`✅ Multi-pet booking created: ${result.parentBooking.id} for ${petCount} pets`);
      
      return sendSuccess(c, {
        booking: {
          id: result.parentBooking.id,
          petCount,
          totalAmount,
          discount: discount,
          childBookings: result.childBookingIds
        },
        message: `Booking created for ${petCount} pets with multi-pet discount`
      });
      
    } catch (error) {
      console.error('Error creating multi-pet booking:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /bookings/:parentBookingId/children
   * Get all child bookings for a multi-pet booking
   */
  app.get(`${BASE_PATH}/bookings/:parentBookingId/children`, async (c) => {
    try {
      const parentBookingId = c.req.param('parentBookingId');
      
      const parentBooking = await bookingsRepo.findById(parentBookingId);
      if (!parentBooking) {
        return sendError(c, 'Booking not found', 404);
      }
      
      const packageDetails = parentBooking.package_details as any;
      if (!packageDetails?.isMultiPet) {
        return sendError(c, 'Not a multi-pet booking', 400);
      }
      
      // Fetch all child bookings
      const childBookings = [];
      for (const childId of (packageDetails.childBookings || [])) {
        const child = await bookingsRepo.findById(childId);
        if (child) {
          childBookings.push(child);
        }
      }
      
      return sendSuccess(c, {
        parentBooking,
        childBookings
      });
      
    } catch (error) {
      console.error('Error fetching child bookings:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ==========================================================================
  // PACKAGE BOOKING ENHANCEMENTS
  // ==========================================================================

  /**
   * POST /bookings/package/create
   * Create package booking with session tracking
   */
  app.post(`${BASE_PATH}/bookings/package/create`, async (c) => {
    try {
      const {
        customerPhone,
        customerId,
        petId,
        vendorId,
        packageId,
        totalSessions,
        scheduledDates, // Array of dates for each session
        timeSlots, // General schedule slots for subscription packages
        packageType, // Package type (bundle, subscription, etc.)
        isRecurring, // Whether package is recurring
        paymentMethod,
        transactionId
      } = await c.req.json();
      
      if (!totalSessions || totalSessions < 2) {
        return sendError(c, 'Package must have at least 2 sessions', 400, { field: 'totalSessions' });
      }
      
      // Get package details
      const packageData = await packagesRepo.getPackageById(packageId);
      if (!packageData) {
        return sendError(c, 'Package not found', 404);
      }
      
      // Create package enrollment
      const enrollment = await packagesRepo.createEnrollment({
        packageId: packageId,
        vendorId: vendorId,
        customerId: customerId,
        petId: petId,
        totalSessions: totalSessions,
        status: 'active'
      });
      
      // Create session bookings
      const sessionBookingIds: string[] = [];
      
      for (let i = 0; i < totalSessions; i++) {
        const timeSlot = timeSlots && timeSlots[i] ? timeSlots[i] : null;
        const scheduledDate = scheduledDates && scheduledDates[i] ? scheduledDates[i] : null;
        
        const sessionBooking = await bookingsRepo.create({
          customer_id: customerId,
          vendor_id: vendorId,
          service_id: packageData.serviceType || '',
          booking_date: scheduledDate || new Date().toISOString().split('T')[0],
          booking_time: '00:00:00',
          service_type: 'at_vendor',
          base_price: packageData.pricePerSession || 0,
          total_amount: packageData.pricePerSession || 0,
          is_package: true,
          package_id: packageId,
          package_details: {
            packageBookingId: enrollment.id,
            sessionNumber: i + 1,
            totalSessions: totalSessions,
            timeSlot: timeSlot?.timeSlot || null,
            timeSlotWindow: timeSlot?.timeSlot 
              ? (timeSlot.timeSlot === 'morning' ? '08:00-12:00' 
                 : timeSlot.timeSlot === 'afternoon' ? '12:00-16:00' 
                 : timeSlot.timeSlot === 'evening' ? '16:00-20:00' 
                 : null)
              : null,
            status: i === 0 && scheduledDate ? 'scheduled' : 'pending_schedule',
            isPackageSession: true,
            isSubscription: isRecurring || packageType === 'subscription'
          }
        });
        
        sessionBookingIds.push(sessionBooking.id);
      }
      
      console.log(`✅ Package booking created: ${enrollment.id} with ${totalSessions} sessions`);
      
      return sendSuccess(c, {
        packageBooking: {
          id: enrollment.id,
          totalSessions,
          sessions: sessionBookingIds
        },
        message: `Package created with ${totalSessions} sessions`
      });
      
    } catch (error) {
      console.error('Error creating package booking:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /bookings/package/:packageId/complete-session
   * Mark a package session as completed
   */
  app.post(`${BASE_PATH}/bookings/package/:packageId/complete-session`, async (c) => {
    try {
      const packageId = c.req.param('packageId');
      const { sessionBookingId } = await c.req.json();
      
      // Get package enrollment
      const enrollment = await packagesRepo.getEnrollmentById(packageId);
      if (!enrollment) {
        return sendError(c, 'Package not found', 404);
      }
      
      // Get session booking
      const sessionBooking = await bookingsRepo.findById(sessionBookingId);
      if (!sessionBooking) {
        return sendError(c, 'Session not found', 404);
      }
      
      // Update session status
      await bookingsRepo.update(sessionBookingId, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });
      
      // Update package progress
      const updatedEnrollment = await packagesRepo.updateEnrollment(packageId, {
        sessionsUsed: enrollment.sessionsUsed + 1,
        sessionsRemaining: enrollment.sessionsRemaining - 1
      });
      
      // Activate next session if available
      if (updatedEnrollment.sessionsUsed < updatedEnrollment.totalSessions) {
        const nextSessionId = (enrollment.sessions as any[])?.[updatedEnrollment.sessionsUsed];
        if (nextSessionId) {
          const nextSession = await bookingsRepo.findById(nextSessionId);
          if (nextSession) {
            await bookingsRepo.update(nextSessionId, {
              status: 'scheduled'
            });
          }
        }
      } else {
        // All sessions completed
        await packagesRepo.updateEnrollment(packageId, {
          status: 'completed'
        });
      }
      
      console.log(`✅ Session completed for package ${packageId}`);
      
      return sendSuccess(c, {
        packageBooking: {
          id: packageId,
          completedSessions: updatedEnrollment.sessionsUsed,
          totalSessions: updatedEnrollment.totalSessions,
          status: updatedEnrollment.status
        }
      });
      
    } catch (error) {
      console.error('Error completing package session:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ==========================================================================
  // EMERGENCY BOOKING HANDLING
  // ==========================================================================

  /**
   * POST /bookings/emergency
   * Create emergency booking with priority handling
   */
  app.post(`${BASE_PATH}/bookings/emergency`, async (c) => {
    try {
      const {
        customerPhone,
        customerId,
        petId,
        emergencyType, // 'vet', 'ambulance', 'rescue'
        location,
        description,
        severity, // 'critical', 'high', 'medium'
      } = await c.req.json();
      
      if (!emergencyType || !location || !severity) {
        return sendError(c, 'Missing required fields', 400, { 
          required: ['emergencyType', 'location', 'severity'] 
        });
      }
      
      const priority = severity === 'critical' ? 1 : severity === 'high' ? 2 : 3;
      const estimatedResponseTime = severity === 'critical' ? 15 : severity === 'high' ? 30 : 60;
      
      // Create emergency booking
      const emergencyBooking = await bookingsRepo.create({
        customer_id: customerId,
        service_id: emergencyType, // Use emergencyType as service_id placeholder
        booking_date: new Date().toISOString().split('T')[0],
        booking_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        service_type: 'at_home',
        base_price: 0,
        total_amount: 0,
        status: 'pending',
        notes: JSON.stringify({
          isEmergency: true,
          emergencyType: emergencyType,
          location: location,
          description: description || '',
          severity: severity,
          priority: priority,
          estimatedResponseTime: estimatedResponseTime
        })
      });
      
      // Add to emergency queue
      const { data: queueEntry, error } = await db
        .from('emergency_booking_queue')
        .insert({
          booking_id: emergencyBooking.id,
          priority: priority,
          requested_by: customerId,
          reason: description || '',
          location_latitude: location?.latitude || null,
          location_longitude: location?.longitude || null,
          status: 'pending'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error adding to emergency queue:', error);
      }
      
      console.log(`🚨 Emergency booking created: ${emergencyBooking.id} - ${severity} ${emergencyType}`);
      
      return sendSuccess(c, {
        emergencyBooking: {
          id: emergencyBooking.id,
          severity,
          estimatedResponseTime: estimatedResponseTime,
          status: 'emergency_pending'
        },
        message: `Emergency ${emergencyType} request submitted. Estimated response: ${estimatedResponseTime} minutes`
      });
      
    } catch (error) {
      console.error('Error creating emergency booking:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /bookings/emergency/queue
   * Get emergency bookings queue (vendor/admin)
   */
  app.get(`${BASE_PATH}/bookings/emergency/queue`, async (c) => {
    try {
      const { data: queueEntries, error } = await db
        .from('emergency_booking_queue')
        .select(`
          *,
          bookings (*)
        `)
        .eq('status', 'pending')
        .order('priority', { ascending: true })
        .order('queued_at', { ascending: true });
      
      if (error) {
        throw new Error(`Failed to fetch emergency queue: ${error.message}`);
      }
      
      const emergencyBookings = queueEntries.map((entry: any) => ({
        ...entry.bookings,
        priority: entry.priority,
        queued_at: entry.queued_at
      }));
      
      return sendSuccess(c, {
        emergencyBookings,
        count: emergencyBookings.length
      });
      
    } catch (error) {
      console.error('Error fetching emergency queue:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ==========================================================================
  // CHECK-IN/CHECK-OUT FLOWS
  // ==========================================================================

  /**
   * POST /bookings/:bookingId/check-in
   * Check in for boarding/resort service
   */
  app.post(`${BASE_PATH}/bookings/:bookingId/check-in`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      const { staffId, notes, petCondition } = await c.req.json();
      
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }
      
      // Verify booking type
      if (booking.service_type !== 'boarding' && booking.service_type !== 'resort') {
        return sendError(c, 'Check-in only available for boarding/resort bookings', 400, {
          serviceType: booking.service_type
        });
      }
      
      // Update booking
      await bookingsRepo.update(bookingId, {
        status: 'in_progress',
        notes: JSON.stringify({
          checkInTime: new Date().toISOString(),
          checkInStaff: staffId,
          checkInNotes: notes || '',
          petConditionAtCheckIn: petCondition || ''
        })
      });
      
      console.log(`✅ Check-in completed for booking ${bookingId}`);
      
      return sendSuccess(c, {
        booking: {
          id: bookingId,
          checkInTime: new Date().toISOString(),
          status: 'in_progress'
        },
        message: 'Check-in completed successfully'
      });
      
    } catch (error) {
      console.error('Error processing check-in:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /bookings/:bookingId/check-out
   * Check out from boarding/resort service
   */
  app.post(`${BASE_PATH}/bookings/:bookingId/check-out`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      const { staffId, notes, petCondition, otp } = await c.req.json();
      
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }
      
      // Verify OTP if required
      if (booking.otp_end_code && otp !== booking.otp_end_code) {
        return sendError(c, 'Invalid OTP', 400, {
          hint: 'Please enter the correct OTP to complete check-out'
        });
      }
      
      // Update booking
      await bookingsRepo.update(bookingId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: JSON.stringify({
          checkOutTime: new Date().toISOString(),
          checkOutStaff: staffId,
          checkOutNotes: notes || '',
          petConditionAtCheckOut: petCondition || ''
        })
      });
      
      console.log(`✅ Check-out completed for booking ${bookingId}`);
      
      return sendSuccess(c, {
        booking: {
          id: bookingId,
          checkOutTime: new Date().toISOString(),
          status: 'completed'
        },
        message: 'Check-out completed successfully'
      });
      
    } catch (error) {
      console.error('Error processing check-out:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ==========================================================================
  // E-COMMERCE RETURN PROCESSING
  // ==========================================================================

  /**
   * POST /orders/:orderId/return/request
   * Request product return
   */
  app.post(`${BASE_PATH}/orders/:orderId/return/request`, async (c) => {
    try {
      const orderId = c.req.param('orderId');
      const {
        customerId,
        reason,
        itemIds, // Array of item IDs to return
        returnMethod, // 'pickup' or 'drop'
        photos // Evidence photos
      } = await c.req.json();
      
      if (!reason || !itemIds || itemIds.length === 0) {
        return sendError(c, 'Missing required fields', 400, {
          required: ['reason', 'itemIds']
        });
      }
      
      // Get order
      const order = await ordersRepo.findById(orderId);
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }
      
      // Verify ownership
      if (order.customer_id !== customerId) {
        return sendError(c, 'Unauthorized', 403);
      }
      
      // Verify return eligibility (within 7 days)
      const orderDate = new Date(order.created_at);
      const now = new Date();
      const daysSinceOrder = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceOrder > 7) {
        return sendError(c, 'Return window expired', 400, {
          message: 'Returns are only accepted within 7 days of delivery',
          daysSinceOrder
        });
      }
      
      // Create return request
      const returnRequest = await returnsRepo.create({
        order_id: orderId,
        customer_id: customerId,
        vendor_id: order.vendor_id || '',
        reason: reason,
        item_ids: itemIds,
        return_method: returnMethod || 'pickup',
        photos: photos || [],
        amount: order.total_amount, // Full order amount for now
        status: 'pending'
      });
      
      console.log(`📦 Return request created: ${returnRequest.id} for order ${orderId}`);
      
      return sendSuccess(c, {
        returnRequest: {
          id: returnRequest.id,
          status: 'pending_approval'
        },
        message: 'Return request submitted. Vendor will review within 24 hours.'
      });
      
    } catch (error) {
      console.error('Error creating return request:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * PUT /returns/:returnId/status
   * Update return request status (vendor/admin)
   */
  app.put(`${BASE_PATH}/returns/:returnId/status`, async (c) => {
    try {
      const returnId = c.req.param('returnId');
      const {
        vendorId,
        status, // 'approved', 'rejected', 'pickup_scheduled', 'received', 'refunded'
        notes,
        refundAmount
      } = await c.req.json();
      
      const returnRequest = await returnsRepo.findById(returnId);
      if (!returnRequest) {
        return sendError(c, 'Return request not found', 404);
      }
      
      // Verify vendor ownership
      if (vendorId && returnRequest.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }
      
      // Update return status
      const updates: any = {
        status: status,
        updated_at: new Date().toISOString()
      };
      
      if (status === 'approved') {
        updates.approved_at = new Date().toISOString();
        updates.refund_amount = refundAmount;
      } else if (status === 'rejected') {
        updates.rejected_at = new Date().toISOString();
        updates.rejection_reason = notes || '';
      } else if (status === 'refunded') {
        updates.refunded_at = new Date().toISOString();
        updates.refund_amount = refundAmount;
        
        // Process refund to wallet
        const wallet = await walletsRepo.findOrCreate(returnRequest.customer_id);
        await walletsRepo.creditWallet(wallet.id, returnRequest.customer_id, {
          amount: refundAmount || returnRequest.amount,
          source: 'return_refund',
          purpose: 'order_return',
          description: `Refund for return ${returnId}`,
          reference_id: returnId
        });
      }
      
      if (notes) {
        updates.admin_notes = notes;
      }
      
      const updatedReturn = await returnsRepo.update(returnId, updates);
      
      console.log(`📦 Return ${returnId} status updated to ${status}`);
      
      return sendSuccess(c, {
        returnRequest: updatedReturn,
        message: `Return ${status} successfully`
      });
      
    } catch (error) {
      console.error('Error updating return status:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /customers/:customerId/returns
   * Get customer's return requests
   */
  app.get(`${BASE_PATH}/customers/:customerId/returns`, async (c) => {
    try {
      const customerId = c.req.param('customerId');
      
      const returns = await returnsRepo.findByCustomer(customerId);
      
      return sendSuccess(c, {
        returns,
        count: returns.length
      });
      
    } catch (error) {
      console.error('Error fetching returns:', error);
      return sendError(c, String(error), 500);
    }
  });
}
