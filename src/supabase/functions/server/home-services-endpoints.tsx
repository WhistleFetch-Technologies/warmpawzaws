/**
 * HOME SERVICES ENDPOINTS
 * Complete framework for home service bookings, tracking, and completion
 * Supports: Regular home services, walker sessions, emergency reassignment
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// Generate OTP
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function homeServicesEndpoints(app: Hono) {
  
  /**
   * Accept booking (staff accepts assigned booking)
   * POST /make-server-3dd53475/booking/:bookingId/accept
   */
  app.post('/make-server-3dd53475/booking/:bookingId/accept', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { staffId, estimatedArrivalTime } = await c.req.json();
      
      console.log(`✅ [HOME] Staff ${staffId} accepting booking ${bookingId}`);
      
      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.status !== 'pending') {
        return c.json({ error: `Cannot accept booking with status: ${booking.status}` }, 400);
      }
      
      // Update booking status
      booking.status = 'accepted';
      booking.acceptedAt = new Date().toISOString();
      booking.acceptedBy = staffId;
      booking.estimatedArrivalTime = estimatedArrivalTime || null;
      booking.updatedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);
      
      console.log(`✅ [HOME] Booking ${bookingId} accepted by staff ${staffId}`);
      
      // TODO: Send notification to customer
      
      return c.json({
        success: true,
        booking,
        message: 'Booking accepted successfully'
      });
      
    } catch (error) {
      console.error('❌ [HOME] Error accepting booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Start travel to customer location
   * POST /make-server-3dd53475/booking/:bookingId/start-travel
   */
  app.post('/make-server-3dd53475/booking/:bookingId/start-travel', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { staffId, currentLocation } = await c.req.json();
      
      console.log(`🚗 [HOME] Staff ${staffId} starting travel for booking ${bookingId}`);
      
      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.status !== 'accepted') {
        return c.json({ error: 'Booking must be accepted first' }, 400);
      }
      
      if (booking.serviceStyle !== 'at_home') {
        return c.json({ error: 'Only home service bookings can have travel tracking' }, 400);
      }
      
      // Create tracking session
      const trackingSessionId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      const trackingSession = {
        id: trackingSessionId,
        bookingId,
        staffId,
        customerId: booking.customerId,
        
        // Journey details
        startLocation: currentLocation,
        destinationLocation: booking.customerAddress,
        
        // Tracking
        currentLocation: currentLocation,
        locationHistory: [
          {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            timestamp: new Date().toISOString()
          }
        ],
        
        // Status
        status: 'traveling',
        startedAt: new Date().toISOString(),
        arrivedAt: null,
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`tracking:${trackingSessionId}`, trackingSession);
      
      // Update booking
      booking.status = 'traveling';
      booking.trackingSessionId = trackingSessionId;
      booking.travelStartedAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);
      
      console.log(`✅ [HOME] Travel started for booking ${bookingId}, tracking: ${trackingSessionId}`);
      
      // TODO: Send notification to customer with tracking link
      
      return c.json({
        success: true,
        booking,
        trackingSession,
        message: 'Travel started. Customer can now track your location.'
      });
      
    } catch (error) {
      console.error('❌ [HOME] Error starting travel:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Update staff location during travel
   * PUT /make-server-3dd53475/tracking/:trackingSessionId/location
   */
  app.put('/make-server-3dd53475/tracking/:trackingSessionId/location', async (c) => {
    try {
      const { trackingSessionId } = c.req.param();
      const { latitude, longitude } = await c.req.json();
      
      const session = await kv.get(`tracking:${trackingSessionId}`);
      
      if (!session) {
        return c.json({ error: 'Tracking session not found' }, 404);
      }
      
      if (session.status !== 'traveling') {
        return c.json({ error: 'Tracking session not active' }, 400);
      }
      
      // Update location
      session.currentLocation = { latitude, longitude };
      session.locationHistory.push({
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      });
      session.updatedAt = new Date().toISOString();
      
      // Calculate ETA based on distance
      if (session.destinationLocation) {
        const distance = calculateDistance(
          latitude,
          longitude,
          session.destinationLocation.latitude,
          session.destinationLocation.longitude
        );
        
        // Estimate: 30 km/h average speed in city
        const estimatedMinutes = Math.ceil((distance / 30) * 60);
        session.estimatedTimeToArrival = estimatedMinutes;
        session.distanceToDestination = distance;
      }
      
      await kv.set(`tracking:${trackingSessionId}`, session);
      
      return c.json({
        success: true,
        currentLocation: { latitude, longitude },
        estimatedTimeToArrival: session.estimatedTimeToArrival,
        distanceToDestination: session.distanceToDestination
      });
      
    } catch (error) {
      console.error('❌ [HOME] Error updating location:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Mark arrival at customer location
   * POST /make-server-3dd53475/booking/:bookingId/mark-arrived
   */
  app.post('/make-server-3dd53475/booking/:bookingId/mark-arrived', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { staffId } = await c.req.json();
      
      console.log(`📍 [HOME] Staff ${staffId} arrived at booking ${bookingId}`);
      
      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.status !== 'traveling') {
        return c.json({ error: 'Booking must be in traveling status' }, 400);
      }
      
      // Update tracking session
      if (booking.trackingSessionId) {
        const session = await kv.get(`tracking:${booking.trackingSessionId}`);
        if (session) {
          session.status = 'arrived';
          session.arrivedAt = new Date().toISOString();
          session.updatedAt = new Date().toISOString();
          await kv.set(`tracking:${booking.trackingSessionId}`, session);
        }
      }
      
      // Update booking
      booking.status = 'in_progress';
      booking.arrivedAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);
      
      console.log(`✅ [HOME] Staff arrived, booking ${bookingId} now in progress`);
      
      // TODO: Send notification to customer
      
      return c.json({
        success: true,
        booking,
        message: 'Arrival confirmed. Service can begin.'
      });
      
    } catch (error) {
      console.error('❌ [HOME] Error marking arrival:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Start service with OTP (for walker sessions)
   * POST /make-server-3dd53475/booking/:bookingId/start-session-with-otp
   */
  app.post('/make-server-3dd53475/booking/:bookingId/start-session-with-otp', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { staffId, otp } = await c.req.json();
      
      console.log(`🐕 [WALKER] Starting session for booking ${bookingId} with OTP`);
      
      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.status !== 'in_progress') {
        return c.json({ error: 'Booking must be in progress' }, 400);
      }
      
      // Verify START OTP
      if (!booking.startOtp) {
        return c.json({ error: 'START OTP not set for this booking' }, 400);
      }
      
      if (booking.startOtp !== otp) {
        return c.json({ error: 'Invalid OTP' }, 401);
      }
      
      // Create walker session
      const sessionId = `walker_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      const walkerSession = {
        id: sessionId,
        bookingId,
        staffId,
        customerId: booking.customerId,
        petId: booking.petId,
        
        // Session tracking
        startLocation: booking.customerAddress,
        startTime: new Date().toISOString(),
        endTime: null,
        
        // Route tracking
        route: [{
          latitude: booking.customerAddress.latitude,
          longitude: booking.customerAddress.longitude,
          timestamp: new Date().toISOString()
        }],
        
        // Metrics
        distanceWalked: 0, // km
        duration: 0, // minutes
        
        // Status
        status: 'active',
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`walker_session:${sessionId}`, walkerSession);
      
      // Update booking
      booking.walkerSessionId = sessionId;
      booking.sessionStartedAt = new Date().toISOString();
      booking.startOtpVerifiedAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);
      
      console.log(`✅ [WALKER] Session started: ${sessionId}`);
      
      return c.json({
        success: true,
        booking,
        walkerSession,
        message: 'Walking session started. Route tracking active.'
      });
      
    } catch (error) {
      console.error('❌ [WALKER] Error starting session:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Update walker session location
   * PUT /make-server-3dd53475/walker-session/:sessionId/location
   */
  app.put('/make-server-3dd53475/walker-session/:sessionId/location', async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { latitude, longitude } = await c.req.json();
      
      const session = await kv.get(`walker_session:${sessionId}`);
      
      if (!session) {
        return c.json({ error: 'Walker session not found' }, 404);
      }
      
      if (session.status !== 'active') {
        return c.json({ error: 'Session not active' }, 400);
      }
      
      // Add to route
      session.route.push({
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      });
      
      // Calculate distance walked
      if (session.route.length >= 2) {
        const lastPoint = session.route[session.route.length - 2];
        const distance = calculateDistance(
          lastPoint.latitude,
          lastPoint.longitude,
          latitude,
          longitude
        );
        session.distanceWalked += distance;
      }
      
      // Calculate duration
      const startTime = new Date(session.startTime).getTime();
      const currentTime = new Date().getTime();
      session.duration = Math.floor((currentTime - startTime) / 60000); // minutes
      
      session.updatedAt = new Date().toISOString();
      
      await kv.set(`walker_session:${sessionId}`, session);
      
      return c.json({
        success: true,
        distanceWalked: session.distanceWalked.toFixed(2),
        duration: session.duration
      });
      
    } catch (error) {
      console.error('❌ [WALKER] Error updating session location:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Complete service with END OTP
   * POST /make-server-3dd53475/booking/:bookingId/complete-with-otp
   */
  app.post('/make-server-3dd53475/booking/:bookingId/complete-with-otp', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { staffId, otp, notes, prescriptionNotes } = await c.req.json();
      
      console.log(`✅ [HOME] Completing booking ${bookingId} with OTP`);
      
      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (!['in_progress', 'traveling'].includes(booking.status)) {
        return c.json({ error: 'Booking must be in progress' }, 400);
      }
      
      // Verify END OTP
      if (!booking.endOtp) {
        return c.json({ error: 'END OTP not set for this booking' }, 400);
      }
      
      if (booking.endOtp !== otp) {
        return c.json({ error: 'Invalid OTP. Please check and try again.' }, 401);
      }
      
      // Complete walker session if exists
      if (booking.walkerSessionId) {
        const session = await kv.get(`walker_session:${booking.walkerSessionId}`);
        if (session && session.status === 'active') {
          session.status = 'completed';
          session.endTime = new Date().toISOString();
          
          // Final duration calculation
          const startTime = new Date(session.startTime).getTime();
          const endTime = new Date().getTime();
          session.duration = Math.floor((endTime - startTime) / 60000);
          
          await kv.set(`walker_session:${booking.walkerSessionId}`, session);
        }
      }
      
      // Complete tracking session if exists
      if (booking.trackingSessionId) {
        const session = await kv.get(`tracking:${booking.trackingSessionId}`);
        if (session) {
          session.status = 'completed';
          session.completedAt = new Date().toISOString();
          await kv.set(`tracking:${booking.trackingSessionId}`, session);
        }
      }
      
      // Update booking
      booking.status = 'completed';
      booking.completedAt = new Date().toISOString();
      booking.endOtpVerifiedAt = new Date().toISOString();
      booking.completedBy = staffId;
      booking.serviceNotes = notes || null;
      booking.prescriptionNotes = prescriptionNotes || null;
      booking.updatedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);
      
      // Release earnings
      await releaseEarnings(bookingId, booking, staffId);
      
      console.log(`✅ [HOME] Booking ${bookingId} completed successfully`);
      
      // TODO: Send completion notification to customer
      
      return c.json({
        success: true,
        booking,
        message: 'Service completed successfully. Earnings released.'
      });
      
    } catch (error) {
      console.error('❌ [HOME] Error completing booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Reject booking and broadcast to nearby staff
   * POST /make-server-3dd53475/booking/:bookingId/reject-and-reassign
   */
  app.post('/make-server-3dd53475/booking/:bookingId/reject-and-reassign', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { staffId, reason } = await c.req.json();
      
      console.log(`🚨 [REASSIGN] Staff ${staffId} rejecting booking ${bookingId}: ${reason}`);
      
      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Record rejection
      if (!booking.rejections) booking.rejections = [];
      booking.rejections.push({
        staffId,
        reason,
        timestamp: new Date().toISOString()
      });
      
      // Find nearby eligible staff
      const nearbyStaff = await findNearbyEligibleStaff(
        booking.customerAddress,
        booking.services,
        staffId, // Exclude rejecting staff
        booking.serviceStyle
      );
      
      if (nearbyStaff.length === 0) {
        // No nearby staff, cancel and refund
        booking.status = 'cancelled';
        booking.cancellationReason = 'No nearby staff available';
        booking.cancelledAt = new Date().toISOString();
        booking.refundInitiated = true;
        await kv.set(`booking:${bookingId}`, booking);
        
        return c.json({
          success: true,
          booking,
          message: 'No nearby staff available. Booking cancelled and refund initiated.'
        });
      }
      
      // Broadcast to nearby staff
      booking.status = 'pending_reassignment';
      booking.broadcastedTo = nearbyStaff.map(s => s.id);
      booking.broadcastedAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);
      
      console.log(`✅ [REASSIGN] Broadcasted to ${nearbyStaff.length} nearby staff`);
      
      // TODO: Send push notifications to nearby staff
      
      return c.json({
        success: true,
        booking,
        nearbyStaffCount: nearbyStaff.length,
        message: `Broadcasted to ${nearbyStaff.length} nearby staff`
      });
      
    } catch (error) {
      console.error('❌ [REASSIGN] Error rejecting and reassigning:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Accept reassigned booking
   * POST /make-server-3dd53475/booking/:bookingId/accept-reassignment
   */
  app.post('/make-server-3dd53475/booking/:bookingId/accept-reassignment', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { staffId } = await c.req.json();
      
      console.log(`✅ [REASSIGN] Staff ${staffId} accepting reassigned booking ${bookingId}`);
      
      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.status !== 'pending_reassignment') {
        return c.json({ error: 'Booking not available for reassignment' }, 400);
      }
      
      // Check if staff is in broadcast list
      if (!booking.broadcastedTo || !booking.broadcastedTo.includes(staffId)) {
        return c.json({ error: 'You are not eligible to accept this booking' }, 403);
      }
      
      // Assign to new staff
      booking.assignedStaffId = staffId;
      booking.staffId = staffId;
      booking.status = 'accepted';
      booking.acceptedAt = new Date().toISOString();
      booking.acceptedBy = staffId;
      booking.reassigned = true;
      booking.updatedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);
      
      console.log(`✅ [REASSIGN] Booking ${bookingId} reassigned to staff ${staffId}`);
      
      // TODO: Notify customer about new staff assignment
      
      return c.json({
        success: true,
        booking,
        message: 'Booking reassigned successfully'
      });
      
    } catch (error) {
      console.error('❌ [REASSIGN] Error accepting reassignment:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Emergency Reassignment (Triggered by Customer/Admin)
   * POST /make-server-3dd53475/booking/:bookingId/emergency-reassign
   */
  app.post('/make-server-3dd53475/booking/:bookingId/emergency-reassign', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { requestedBy, reason } = await c.req.json();
      
      console.log(`🚨 [EMERGENCY] Emergency reassignment requested for booking ${bookingId} by ${requestedBy}`);
      
      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Allow reassignment if accepted, traveling, or even in_progress (if staff abandoned)
      if (!['accepted', 'traveling', 'in_progress'].includes(booking.status)) {
        return c.json({ error: `Cannot reassign booking with status: ${booking.status}` }, 400);
      }
      
      const currentStaffId = booking.staffId || booking.assignedStaffId;
      
      // Record the incident
      if (!booking.incidents) booking.incidents = [];
      booking.incidents.push({
        type: 'emergency_reassignment',
        requestedBy,
        reason,
        previousStaffId: currentStaffId,
        timestamp: new Date().toISOString()
      });
      
      // Find nearby eligible staff (excluding current staff)
      const nearbyStaff = await findNearbyEligibleStaff(
        booking.customerAddress,
        booking.services || [],
        currentStaffId,
        booking.serviceStyle
      );
      
      if (nearbyStaff.length === 0) {
        // No nearby staff - Admin intervention needed
        booking.status = 'admin_attention_required'; // New status
        booking.adminAlert = 'Emergency reassignment failed - No nearby staff';
        await kv.set(`booking:${bookingId}`, booking);
        
        return c.json({
          success: false,
          booking,
          message: 'No nearby staff found. Admin has been alerted.'
        });
      }
      
      // Broadcast to nearby staff
      booking.status = 'pending_reassignment';
      booking.broadcastedTo = nearbyStaff.map(s => s.id);
      booking.broadcastedAt = new Date().toISOString();
      booking.previousStaffId = currentStaffId;
      booking.reassignedFrom = currentStaffId;
      booking.staffId = null; // Clear current staff
      booking.assignedStaffId = null;
      booking.updatedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);
      
      console.log(`✅ [EMERGENCY] Broadcasted to ${nearbyStaff.length} nearby staff`);
      
      return c.json({
        success: true,
        booking,
        nearbyStaffCount: nearbyStaff.length,
        message: `Emergency reassignment initiated. Broadcasted to ${nearbyStaff.length} providers.`
      });
      
    } catch (error) {
      console.error('❌ [EMERGENCY] Error during emergency reassignment:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Get tracking session details (for customer to track staff)
   * GET /make-server-3dd53475/tracking/:trackingSessionId
   */
  app.get('/make-server-3dd53475/tracking/:trackingSessionId', async (c) => {
    try {
      const { trackingSessionId } = c.req.param();
      
      const session = await kv.get(`tracking:${trackingSessionId}`);
      
      if (!session) {
        return c.json({ error: 'Tracking session not found' }, 404);
      }
      
      // Get staff details
      const staff = await kv.get(`staff:${session.staffId}`);
      
      return c.json({
        success: true,
        session,
        staff: staff ? {
          id: staff.id,
          fullName: staff.fullName,
          photo: staff.photo,
          phone: staff.phone,
          rating: staff.rating
        } : null
      });
      
    } catch (error) {
      console.error('❌ [HOME] Error fetching tracking session:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Get walker session details
   * GET /make-server-3dd53475/walker-session/:sessionId
   */
  app.get('/make-server-3dd53475/walker-session/:sessionId', async (c) => {
    try {
      const { sessionId } = c.req.param();
      
      const session = await kv.get(`walker_session:${sessionId}`);
      
      if (!session) {
        return c.json({ error: 'Walker session not found' }, 404);
      }
      
      return c.json({
        success: true,
        session
      });
      
    } catch (error) {
      console.error('❌ [WALKER] Error fetching session:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

// Helper function to release earnings
async function releaseEarnings(bookingId: string, booking: any, staffId: string) {
  try {
    console.log(`💰 [EARNINGS] Releasing earnings for booking ${bookingId}`);
    
    // Calculate staff earnings (80% of total, platform takes 20%)
    const platformFee = booking.totalAmount * 0.20;
    const staffEarnings = booking.totalAmount - platformFee;
    
    const earningRecord = {
      id: `earning_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      bookingId,
      staffId,
      customerId: booking.customerId,
      vendorId: booking.vendorId,
      
      // Amounts
      totalAmount: booking.totalAmount,
      platformFee,
      staffEarnings,
      
      // Status
      status: 'released',
      releasedAt: new Date().toISOString(),
      
      // Metadata
      serviceStyle: booking.serviceStyle,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`earnings:${staffId}:${bookingId}`, earningRecord);
    
    // Update booking
    booking.earningsReleased = true;
    booking.staffEarnings = staffEarnings;
    booking.platformFee = platformFee;
    
    console.log(`✅ [EARNINGS] Released ₹${staffEarnings} to staff ${staffId}`);
    
  } catch (error) {
    console.error('❌ [EARNINGS] Error releasing earnings:', error);
  }
}

// Helper function to find nearby eligible staff
async function findNearbyEligibleStaff(
  customerAddress: any,
  services: any[],
  excludeStaffId: string,
  serviceStyle: string
): Promise<any[]> {
  try {
    console.log(`🔍 [NEARBY] Finding eligible staff within 5km`);
    
    // Get all staff
    const allStaffKeys = await kv.getByPrefix('staff:');
    const eligibleStaff: any[] = [];
    
    for (const staff of allStaffKeys) {
      // Skip excluded staff
      if (staff.id === excludeStaffId) continue;
      
      // Must be active and online
      if (!staff.isActive || !staff.isOnline) continue;
      
      // Check service style preferences
      const preferences = await kv.get(`staff:${staff.id}:style_preferences`);
      if (!preferences || !preferences[serviceStyle]?.enabled) continue;
      
      // Check location
      if (!staff.lastKnownLocation) continue;
      
      const distance = calculateDistance(
        customerAddress.latitude,
        customerAddress.longitude,
        staff.lastKnownLocation.latitude,
        staff.lastKnownLocation.longitude
      );
      
      // Within 5km for emergency reassignment
      if (distance > 5) continue;
      
      // Check if staff has the required services
      const staffServices = await kv.getByPrefix(`staff:${staff.id}:service:`);
      const hasRequiredServices = services.every(bookingService => 
        staffServices.some(staffService => 
          staffService.serviceId === bookingService.serviceId && staffService.isActive
        )
      );
      
      if (!hasRequiredServices) continue;
      
      eligibleStaff.push({
        ...staff,
        distance
      });
    }
    
    // Sort by distance
    eligibleStaff.sort((a, b) => a.distance - b.distance);
    
    console.log(`✅ [NEARBY] Found ${eligibleStaff.length} eligible staff`);
    
    return eligibleStaff.slice(0, 10); // Max 10 staff
    
  } catch (error) {
    console.error('❌ [NEARBY] Error finding nearby staff:', error);
    return [];
  }
}

export default homeServicesEndpoints;
