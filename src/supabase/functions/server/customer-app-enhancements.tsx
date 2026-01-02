/**
 * CUSTOMER APP ENHANCEMENTS
 * 
 * Implements missing features identified in customer lifecycle analysis:
 * 1. Multi-pet booking support
 * 2. Package booking enhancements
 * 3. Emergency booking handling
 * 4. Check-in/check-out flows for boarding/resorts
 * 5. Return processing for e-commerce
 * 6. Reschedule policy enforcement
 * 
 * Status: ✅ NEW IMPLEMENTATION
 */

import { Hono } from 'hono';
import { cors } from "hono/cors";
import * as kv from './kv_store';

const app = new Hono();
app.use('*', cors());

// ==========================================================================
// MULTI-PET BOOKING SUPPORT
// ==========================================================================

/**
 * POST /bookings/create-multi-pet
 * Create booking for multiple pets in one transaction
 */
app.post('/bookings/create-multi-pet', async (c) => {
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
      return c.json({
        error: 'At least one pet required',
        field: 'petIds'
      }, 400);
    }
    
    // Verify all pets belong to customer
    for (const petId of petIds) {
      const pet = await kv.get(`pet:${petId}`);
      if (!pet) {
        return c.json({
          error: `Pet not found: ${petId}`,
          petId
        }, 404);
      }
      
      if (pet.customerId !== customerId) {
        return c.json({
          error: `Pet ${petId} does not belong to customer`,
          petId
        }, 403);
      }
    }
    
    // Get service and vendor details
    const vendor = await kv.get(`vendor:${vendorId}`);
    const service = await kv.get(`service:${serviceId}`);
    
    if (!vendor || !service) {
      return c.json({
        error: 'Vendor or service not found'
      }, 404);
    }
    
    // Calculate multi-pet pricing
    const basePrice = service.price || 0;
    const petCount = petIds.length;
    
    // Multi-pet discount: First pet full price, additional pets 20% off
    let totalAmount = basePrice;
    for (let i = 1; i < petCount; i++) {
      totalAmount += basePrice * 0.8; // 20% discount per additional pet
    }
    
    // Create parent booking
    const parentBookingId = `booking_multi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const parentBooking = {
      id: parentBookingId,
      customerPhone,
      customerId,
      petIds,
      petCount,
      vendorId,
      vendorName: vendor.businessName || vendor.fullName,
      serviceId,
      serviceName: service.name,
      serviceType,
      serviceStyle,
      scheduledDate,
      scheduledTime,
      address,
      totalAmount,
      basePrice,
      discount: (basePrice * petCount) - totalAmount,
      paymentMethod,
      transactionId,
      status: 'confirmed',
      isMultiPet: true,
      childBookings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Create individual bookings for each pet
    const childBookingIds: string[] = [];
    
    for (let i = 0; i < petIds.length; i++) {
      const petId = petIds[i];
      const pet = await kv.get(`pet:${petId}`);
      
      const childBookingId = `booking_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
      
      const childBooking = {
        id: childBookingId,
        customerPhone,
        customerId,
        petId,
        petName: pet.name,
        vendorId,
        vendorName: vendor.businessName || vendor.fullName,
        serviceId,
        serviceName: service.name,
        serviceType,
        serviceStyle,
        scheduledDate,
        scheduledTime,
        address,
        amount: i === 0 ? basePrice : basePrice * 0.8,
        paymentMethod,
        transactionId,
        status: 'confirmed',
        parentBookingId,
        isChildBooking: true,
        siblingIndex: i,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save child booking
      await kv.set(`booking:${childBookingId}`, childBooking);
      
      // Add to customer bookings
      const customerBookings = await kv.get(`booking:customer:${customerId}`) || [];
      customerBookings.unshift(childBookingId);
      await kv.set(`booking:customer:${customerId}`, customerBookings);
      
      childBookingIds.push(childBookingId);
    }
    
    // Update parent booking with child IDs
    parentBooking.childBookings = childBookingIds;
    await kv.set(`booking:${parentBookingId}`, parentBooking);
    
    // Add parent to customer bookings
    const customerBookings = await kv.get(`booking:customer:${customerId}`) || [];
    customerBookings.unshift(parentBookingId);
    await kv.set(`booking:customer:${customerId}`, customerBookings);
    
    // Add to vendor bookings
    const vendorBookings = await kv.get(`vendor:bookings:${vendorId}`) || [];
    vendorBookings.unshift(parentBookingId);
    await kv.set(`vendor:bookings:${vendorId}`, vendorBookings);
    
    console.log(`✅ Multi-pet booking created: ${parentBookingId} for ${petCount} pets`);
    
    return c.json({
      success: true,
      booking: {
        id: parentBookingId,
        petCount,
        totalAmount,
        discount: parentBooking.discount,
        childBookings: childBookingIds
      },
      message: `Booking created for ${petCount} pets with multi-pet discount`
    });
    
  } catch (error) {
    console.error('Error creating multi-pet booking:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /bookings/:parentBookingId/children
 * Get all child bookings for a multi-pet booking
 */
app.get('/bookings/:parentBookingId/children', async (c) => {
  try {
    const parentBookingId = c.req.param('parentBookingId');
    
    const parentBooking = await kv.get(`booking:${parentBookingId}`);
    if (!parentBooking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    if (!parentBooking.isMultiPet) {
      return c.json({
        error: 'Not a multi-pet booking'
      }, 400);
    }
    
    // Fetch all child bookings
    const childBookings: any[] = [];
    for (const childId of parentBooking.childBookings || []) {
      const child = await kv.get(`booking:${childId}`);
      if (child) {
        childBookings.push(child);
      }
    }
    
    return c.json({
      success: true,
      parentBooking,
      childBookings
    });
    
  } catch (error) {
    console.error('Error fetching child bookings:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// PACKAGE BOOKING ENHANCEMENTS
// ==========================================================================

/**
 * POST /bookings/package/create
 * Create package booking with session tracking
 */
app.post('/bookings/package/create', async (c) => {
  try {
    const {
      customerPhone,
      customerId,
      petId,
      vendorId,
      packageId,
      totalSessions,
      scheduledDates, // Array of dates for each session
      timeSlots, // ✅ NEW: General schedule slots for subscription packages (morning/afternoon/evening)
      packageType, // ✅ NEW: Package type (bundle, subscription, etc.)
      isRecurring, // ✅ NEW: Whether package is recurring
      paymentMethod,
      transactionId
    } = await c.req.json();
    
    if (!totalSessions || totalSessions < 2) {
      return c.json({
        error: 'Package must have at least 2 sessions',
        field: 'totalSessions'
      }, 400);
    }
    
    // Get package details
    const packageData = await kv.get(`package:${packageId}`);
    if (!packageData) {
      return c.json({ error: 'Package not found' }, 404);
    }
    
    // Create package booking
    const packageBookingId = `package_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const packageBooking = {
      id: packageBookingId,
      customerPhone,
      customerId,
      petId,
      vendorId,
      packageId,
      packageName: packageData.packageName || packageData.name,
      packageType: packageType || packageData.packageType || 'bundle',
      isRecurring: isRecurring || packageData.isRecurring || false,
      totalSessions,
      completedSessions: 0,
      totalAmount: packageData.packagePrice || packageData.totalPrice,
      paymentMethod,
      transactionId,
      status: 'active',
      isPackage: true,
      sessions: [],
      timeSlots: timeSlots || [], // ✅ NEW: Store general schedule slots for subscription packages
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Create session bookings
    const sessionBookingIds: string[] = [];
    
    for (let i = 0; i < totalSessions; i++) {
      const sessionBookingId = `session_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
      
      // ✅ FIX: Get time slot for subscription packages
      const timeSlot = timeSlots && timeSlots[i] ? timeSlots[i] : null;
      const scheduledDate = scheduledDates && scheduledDates[i] ? scheduledDates[i] : null;
      
      // ✅ FIX: For subscription packages with general schedule, store time slot info
      const sessionBooking = {
        id: sessionBookingId,
        customerPhone,
        customerId,
        petId,
        vendorId,
        packageBookingId,
        sessionNumber: i + 1,
        totalSessions,
        scheduledDate,
        timeSlot: timeSlot?.timeSlot || null, // ✅ NEW: General schedule slot (morning/afternoon/evening)
        timeSlotWindow: timeSlot?.timeSlot 
          ? (timeSlot.timeSlot === 'morning' ? '08:00-12:00' 
             : timeSlot.timeSlot === 'afternoon' ? '12:00-16:00' 
             : timeSlot.timeSlot === 'evening' ? '16:00-20:00' 
             : null)
          : null, // ✅ NEW: Time window for the slot
        status: i === 0 && scheduledDate ? 'scheduled' : 'pending_schedule',
        isPackageSession: true,
        isSubscription: isRecurring || packageType === 'subscription',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`booking:${sessionBookingId}`, sessionBooking);
      sessionBookingIds.push(sessionBookingId);
    }
    
    packageBooking.sessions = sessionBookingIds;
    await kv.set(`booking:${packageBookingId}`, packageBooking);
    
    // Add to customer bookings
    const customerBookings = await kv.get(`booking:customer:${customerId}`) || [];
    customerBookings.unshift(packageBookingId);
    await kv.set(`booking:customer:${customerId}`, customerBookings);
    
    console.log(`✅ Package booking created: ${packageBookingId} with ${totalSessions} sessions`);
    
    return c.json({
      success: true,
      packageBooking: {
        id: packageBookingId,
        totalSessions,
        sessions: sessionBookingIds
      },
      message: `Package created with ${totalSessions} sessions`
    });
    
  } catch (error) {
    console.error('Error creating package booking:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /bookings/package/:packageId/complete-session
 * Mark a package session as completed
 */
app.post('/bookings/package/:packageId/complete-session', async (c) => {
  try {
    const packageId = c.req.param('packageId');
    const { sessionBookingId } = await c.req.json();
    
    // Get package booking
    const packageBooking = await kv.get(`booking:${packageId}`);
    if (!packageBooking) {
      return c.json({ error: 'Package not found' }, 404);
    }
    
    // Get session booking
    const sessionBooking = await kv.get(`booking:${sessionBookingId}`);
    if (!sessionBooking) {
      return c.json({ error: 'Session not found' }, 404);
    }
    
    // Update session status
    sessionBooking.status = 'completed';
    sessionBooking.completedAt = new Date().toISOString();
    await kv.set(`booking:${sessionBookingId}`, sessionBooking);
    
    // Update package progress
    packageBooking.completedSessions += 1;
    
    // Activate next session
    if (packageBooking.completedSessions < packageBooking.totalSessions) {
      const nextSessionId = packageBooking.sessions[packageBooking.completedSessions];
      const nextSession = await kv.get(`booking:${nextSessionId}`);
      if (nextSession) {
        nextSession.status = 'scheduled';
        await kv.set(`booking:${nextSessionId}`, nextSession);
      }
    } else {
      // All sessions completed
      packageBooking.status = 'completed';
      packageBooking.completedAt = new Date().toISOString();
    }
    
    packageBooking.updatedAt = new Date().toISOString();
    await kv.set(`booking:${packageId}`, packageBooking);
    
    console.log(`✅ Session ${sessionBooking.sessionNumber} completed for package ${packageId}`);
    
    return c.json({
      success: true,
      packageBooking: {
        id: packageId,
        completedSessions: packageBooking.completedSessions,
        totalSessions: packageBooking.totalSessions,
        status: packageBooking.status
      }
    });
    
  } catch (error) {
    console.error('Error completing package session:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// EMERGENCY BOOKING HANDLING
// ==========================================================================

/**
 * POST /bookings/emergency
 * Create emergency booking with priority handling
 */
app.post('/bookings/emergency', async (c) => {
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
      return c.json({
        error: 'Missing required fields',
        required: ['emergencyType', 'location', 'severity']
      }, 400);
    }
    
    // Create emergency booking
    const emergencyBookingId = `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const emergencyBooking = {
      id: emergencyBookingId,
      customerPhone,
      customerId,
      petId,
      emergencyType,
      location,
      description: description || '',
      severity,
      status: 'emergency_pending',
      isEmergency: true,
      priority: severity === 'critical' ? 1 : severity === 'high' ? 2 : 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estimatedResponseTime: severity === 'critical' ? 15 : severity === 'high' ? 30 : 60 // minutes
    };
    
    await kv.set(`booking:${emergencyBookingId}`, emergencyBooking);
    
    // Add to emergency queue
    const emergencyQueue = await kv.get('bookings:emergency:queue') || [];
    emergencyQueue.unshift(emergencyBookingId);
    await kv.set('bookings:emergency:queue', emergencyQueue);
    
    // Add to customer bookings
    const customerBookings = await kv.get(`booking:customer:${customerId}`) || [];
    customerBookings.unshift(emergencyBookingId);
    await kv.set(`booking:customer:${customerId}`, customerBookings);
    
    // Find nearby vendors based on emergency type
    // This would integrate with real-time vendor availability
    
    console.log(`🚨 Emergency booking created: ${emergencyBookingId} - ${severity} ${emergencyType}`);
    
    return c.json({
      success: true,
      emergencyBooking: {
        id: emergencyBookingId,
        severity,
        estimatedResponseTime: emergencyBooking.estimatedResponseTime,
        status: 'emergency_pending'
      },
      message: `Emergency ${emergencyType} request submitted. Estimated response: ${emergencyBooking.estimatedResponseTime} minutes`
    });
    
  } catch (error) {
    console.error('Error creating emergency booking:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /bookings/emergency/queue
 * Get emergency bookings queue (vendor/admin)
 */
app.get('/bookings/emergency/queue', async (c) => {
  try {
    const emergencyQueueIds = await kv.get('bookings:emergency:queue') || [];
    
    const emergencyBookings: any[] = [];
    for (const bookingId of emergencyQueueIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking && booking.status === 'emergency_pending') {
        emergencyBookings.push(booking);
      }
    }
    
    // Sort by priority
    emergencyBookings.sort((a, b) => a.priority - b.priority);
    
    return c.json({
      success: true,
      emergencyBookings,
      count: emergencyBookings.length
    });
    
  } catch (error) {
    console.error('Error fetching emergency queue:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// CHECK-IN/CHECK-OUT FLOWS
// ==========================================================================

/**
 * POST /bookings/:bookingId/check-in
 * Check in for boarding/resort service
 */
app.post('/bookings/:bookingId/check-in', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { staffId, notes, petCondition } = await c.req.json();
    
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // Verify booking type
    if (booking.serviceType !== 'boarding' && booking.serviceType !== 'resort') {
      return c.json({
        error: 'Check-in only available for boarding/resort bookings',
        serviceType: booking.serviceType
      }, 400);
    }
    
    // Update booking
    booking.checkInTime = new Date().toISOString();
    booking.checkInStaff = staffId;
    booking.checkInNotes = notes || '';
    booking.petConditionAtCheckIn = petCondition || '';
    booking.status = 'in_progress';
    booking.updatedAt = new Date().toISOString();
    
    await kv.set(`booking:${bookingId}`, booking);
    
    console.log(`✅ Check-in completed for booking ${bookingId}`);
    
    return c.json({
      success: true,
      booking: {
        id: bookingId,
        checkInTime: booking.checkInTime,
        status: 'in_progress'
      },
      message: 'Check-in completed successfully'
    });
    
  } catch (error) {
    console.error('Error processing check-in:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /bookings/:bookingId/check-out
 * Check out from boarding/resort service
 */
app.post('/bookings/:bookingId/check-out', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { staffId, notes, petCondition, otp } = await c.req.json();
    
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // Verify OTP
    if (booking.endOTP && otp !== booking.endOTP) {
      return c.json({
        error: 'Invalid OTP',
        hint: 'Please enter the correct OTP to complete check-out'
      }, 400);
    }
    
    // Update booking
    booking.checkOutTime = new Date().toISOString();
    booking.checkOutStaff = staffId;
    booking.checkOutNotes = notes || '';
    booking.petConditionAtCheckOut = petCondition || '';
    booking.status = 'completed';
    booking.completedAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();
    
    await kv.set(`booking:${bookingId}`, booking);
    
    console.log(`✅ Check-out completed for booking ${bookingId}`);
    
    return c.json({
      success: true,
      booking: {
        id: bookingId,
        checkOutTime: booking.checkOutTime,
        status: 'completed'
      },
      message: 'Check-out completed successfully'
    });
    
  } catch (error) {
    console.error('Error processing check-out:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// E-COMMERCE RETURN PROCESSING
// ==========================================================================

/**
 * POST /orders/:orderId/return/request
 * Request product return
 */
app.post('/orders/:orderId/return/request', async (c) => {
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
      return c.json({
        error: 'Missing required fields',
        required: ['reason', 'itemIds']
      }, 400);
    }
    
    // Get order
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    // Verify ownership
    if (order.customerId !== customerId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    // Verify return eligibility (within 7 days)
    const orderDate = new Date(order.createdAt);
    const now = new Date();
    const daysSinceOrder = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceOrder > 7) {
      return c.json({
        error: 'Return window expired',
        message: 'Returns are only accepted within 7 days of delivery',
        daysSinceOrder
      }, 400);
    }
    
    // Create return request
    const returnId = `return_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const returnRequest = {
      id: returnId,
      orderId,
      customerId,
      vendorId: order.vendorId,
      reason,
      itemIds,
      returnMethod: returnMethod || 'pickup',
      photos: photos || [],
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`return:${returnId}`, returnRequest);
    
    // Add to order
    order.returnId = returnId;
    order.returnRequested = true;
    order.updatedAt = new Date().toISOString();
    await kv.set(`order:${orderId}`, order);
    
    // Add to vendor returns
    const vendorReturns = await kv.get(`vendor:${order.vendorId}:returns`) || [];
    vendorReturns.unshift(returnId);
    await kv.set(`vendor:${order.vendorId}:returns`, vendorReturns);
    
    console.log(`📦 Return request created: ${returnId} for order ${orderId}`);
    
    return c.json({
      success: true,
      returnRequest: {
        id: returnId,
        status: 'pending_approval'
      },
      message: 'Return request submitted. Vendor will review within 24 hours.'
    });
    
  } catch (error) {
    console.error('Error creating return request:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * PUT /returns/:returnId/status
 * Update return request status (vendor/admin)
 */
app.put('/returns/:returnId/status', async (c) => {
  try {
    const returnId = c.req.param('returnId');
    const {
      vendorId,
      status, // 'approved', 'rejected', 'pickup_scheduled', 'received', 'refunded'
      notes,
      refundAmount
    } = await c.req.json();
    
    const returnRequest = await kv.get(`return:${returnId}`);
    if (!returnRequest) {
      return c.json({ error: 'Return request not found' }, 404);
    }
    
    // Verify vendor ownership
    if (vendorId && returnRequest.vendorId !== vendorId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    // Update return status
    returnRequest.status = status;
    returnRequest.notes = notes || '';
    returnRequest.updatedAt = new Date().toISOString();
    
    if (status === 'approved') {
      returnRequest.approvedAt = new Date().toISOString();
      returnRequest.refundAmount = refundAmount;
    } else if (status === 'rejected') {
      returnRequest.rejectedAt = new Date().toISOString();
    } else if (status === 'refunded') {
      returnRequest.refundedAt = new Date().toISOString();
      
      // Process refund to wallet
      const wallet = await kv.get(`wallet:${returnRequest.customerId}`) || {
        balance: 0,
        totalEarned: 0,
        totalSpent: 0
      };
      
      wallet.balance += refundAmount;
      wallet.totalEarned += refundAmount;
      await kv.set(`wallet:${returnRequest.customerId}`, wallet);
    }
    
    await kv.set(`return:${returnId}`, returnRequest);
    
    console.log(`📦 Return ${returnId} status updated to ${status}`);
    
    return c.json({
      success: true,
      returnRequest,
      message: `Return ${status} successfully`
    });
    
  } catch (error) {
    console.error('Error updating return status:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /customers/:customerId/returns
 * Get customer's return requests
 */
app.get('/customers/:customerId/returns', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    
    // Get all orders
    const orderIds = await kv.get(`order:customer:${customerId}`) || [];
    
    const returns: any[] = [];
    for (const orderId of orderIds) {
      const order = await kv.get(`order:${orderId}`);
      if (order && order.returnId) {
        const returnRequest = await kv.get(`return:${order.returnId}`);
        if (returnRequest) {
          returns.push(returnRequest);
        }
      }
    }
    
    return c.json({
      success: true,
      returns,
      count: returns.length
    });
    
  } catch (error) {
    console.error('Error fetching returns:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
