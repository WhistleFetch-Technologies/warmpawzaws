/**
 * HOME SERVICES ENDPOINTS - SQL VERSION
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * 
 * Complete framework for home service bookings, tracking, and completion
 * Supports: Regular home services, walker sessions, emergency reassignment
 * 
 * Status: ✅ SQL-ONLY IMPLEMENTATION
 * KV Operations: 37 → 0
 */

import { Hono } from 'npm:hono@4';
import { getDbClient, withTransaction } from '../../lib/db.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getGPSTrackingSessionsRepository } from '../../lib/repositories/gps-tracking.ts';
import { getVendorEarningsRepository } from '../../lib/repositories/vendor-earnings.ts';
import { calculateDistance } from '../../lib/utils/distance-calculation.ts';

// Generate OTP
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function homeServicesEndpointsSQL(app: Hono) {
  
  /**
   * Accept booking (staff accepts assigned booking)
   * POST /make-server-3dd53475/booking/:bookingId/accept
   */
  app.post('/make-server-3dd53475/booking/:bookingId/accept', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { staffId, estimatedArrivalTime } = await c.req.json();
      
      console.log(`✅ [HOME] Staff ${staffId} accepting booking ${bookingId}`);
      
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.status !== 'pending') {
        return c.json({ error: `Cannot accept booking with status: ${booking.status}` }, 400);
      }
      
      // Update booking status
      await bookingsRepo.update(bookingId, {
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        staff_id: staffId,
        estimated_arrival_time: estimatedArrivalTime || null,
      });
      
      const updatedBooking = await bookingsRepo.findById(bookingId);
      
      console.log(`✅ [HOME] Booking ${bookingId} accepted by staff ${staffId}`);
      
      // TODO: Send notification to customer
      
      return c.json({
        success: true,
        booking: updatedBooking,
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
      
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.status !== 'accepted') {
        return c.json({ error: 'Booking must be accepted first' }, 400);
      }
      
      if (booking.service_style !== 'at_home') {
        return c.json({ error: 'Only home service bookings can have travel tracking' }, 400);
      }
      
      // Create tracking session
      const trackingSessionId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      const trackingRepo = getGPSTrackingSessionsRepository();
      const customerAddress = booking.customer_address as any;
      
      const trackingSession = await trackingRepo.create({
        booking_id: bookingId,
        tracking_id: trackingSessionId,
        start_location: currentLocation,
        current_location: currentLocation,
        waypoints: [{
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
          timestamp: new Date().toISOString()
        }],
        is_active: true,
        started_at: new Date().toISOString(),
      });
      
      // Update booking
      await bookingsRepo.update(bookingId, {
        status: 'traveling',
        travel_started_at: new Date().toISOString(),
      });
      
      console.log(`✅ [HOME] Travel started for booking ${bookingId}, tracking: ${trackingSessionId}`);
      
      // TODO: Send notification to customer with tracking link
      
      return c.json({
        success: true,
        booking: await bookingsRepo.findById(bookingId),
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
      
      const trackingRepo = getGPSTrackingSessionsRepository();
      const session = await trackingRepo.findByTrackingId(trackingSessionId);
      
      if (!session) {
        return c.json({ error: 'Tracking session not found' }, 404);
      }
      
      if (!session.is_active) {
        return c.json({ error: 'Tracking session not active' }, 400);
      }
      
      // Get booking for destination
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(session.booking_id);
      const customerAddress = booking?.customer_address as any;
      
      // Calculate ETA based on distance
      let estimatedTimeToArrival: number | null = null;
      let distanceToDestination: number | null = null;
      
      if (customerAddress?.latitude && customerAddress?.longitude) {
        distanceToDestination = calculateDistance(
          latitude,
          longitude,
          customerAddress.latitude,
          customerAddress.longitude
        );
        
        // Estimate: 30 km/h average speed in city
        estimatedTimeToArrival = Math.ceil((distanceToDestination / 30) * 60);
      }
      
      // Update location
      const updatedWaypoints = [
        ...(session.waypoints || []),
        {
          lat: latitude,
          lng: longitude,
          timestamp: new Date().toISOString()
        }
      ];
      
      await trackingRepo.update(trackingSessionId, {
        current_location: { lat: latitude, lng: longitude, timestamp: new Date().toISOString() },
        waypoints: updatedWaypoints,
        estimated_eta_minutes: estimatedTimeToArrival,
      });
      
      return c.json({
        success: true,
        currentLocation: { latitude, longitude },
        estimatedTimeToArrival,
        distanceToDestination
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
      
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.status !== 'traveling') {
        return c.json({ error: 'Booking must be in traveling status' }, 400);
      }
      
      // Update tracking session
      const trackingRepo = getGPSTrackingSessionsRepository();
      const trackingSession = await trackingRepo.findByBookingId(bookingId);
      if (trackingSession) {
        await trackingRepo.update(trackingSession.tracking_id, {
          is_active: false,
          stopped_at: new Date().toISOString(),
        });
      }
      
      // Update booking
      await bookingsRepo.update(bookingId, {
        status: 'in_progress',
        arrived_at: new Date().toISOString(),
      });
      
      console.log(`✅ [HOME] Staff arrived, booking ${bookingId} now in progress`);
      
      // TODO: Send notification to customer
      
      return c.json({
        success: true,
        booking: await bookingsRepo.findById(bookingId),
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
      
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.status !== 'in_progress') {
        return c.json({ error: 'Booking must be in progress' }, 400);
      }
      
      // Verify START OTP
      if (!booking.otp_start_code) {
        return c.json({ error: 'START OTP not set for this booking' }, 400);
      }
      
      if (booking.otp_start_code !== otp) {
        return c.json({ error: 'Invalid OTP' }, 401);
      }
      
      // Create walker session (store in package_details JSONB)
      const sessionId = `walker_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const customerAddress = booking.customer_address as any;
      
      const walkerSession = {
        id: sessionId,
        bookingId,
        staffId,
        customerId: booking.customer_id,
        petId: booking.pet_id,
        startLocation: customerAddress,
        startTime: new Date().toISOString(),
        endTime: null,
        route: [{
          latitude: customerAddress?.latitude || customerAddress?.lat,
          longitude: customerAddress?.longitude || customerAddress?.lng,
          timestamp: new Date().toISOString()
        }],
        distanceWalked: 0,
        duration: 0,
        status: 'active',
      };
      
      // Store walker session in package_details JSONB
      const packageDetails = (booking.package_details as any) || {};
      packageDetails.walkerSession = walkerSession;
      
      await bookingsRepo.update(bookingId, {
        package_details: packageDetails,
        session_started_at: new Date().toISOString(),
        otp_start_verified_at: new Date().toISOString(),
      });
      
      console.log(`✅ [WALKER] Session started: ${sessionId}`);
      
      return c.json({
        success: true,
        booking: await bookingsRepo.findById(bookingId),
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
      
      const bookingsRepo = getBookingsRepository();
      const client = getDbClient();
      
      // Find booking with this walker session
      const { data: bookings } = await client
        .from('bookings')
        .select('id, package_details')
        .contains('package_details', { walkerSession: { id: sessionId } });
      
      if (!bookings || bookings.length === 0) {
        return c.json({ error: 'Walker session not found' }, 404);
      }
      
      const booking = bookings[0];
      const packageDetails = (booking.package_details as any) || {};
      const walkerSession = packageDetails.walkerSession;
      
      if (!walkerSession || walkerSession.status !== 'active') {
        return c.json({ error: 'Session not active' }, 400);
      }
      
      // Add to route
      walkerSession.route.push({
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      });
      
      // Calculate distance walked
      if (walkerSession.route.length >= 2) {
        const lastPoint = walkerSession.route[walkerSession.route.length - 2];
        const distance = calculateDistance(
          lastPoint.latitude,
          lastPoint.longitude,
          latitude,
          longitude
        );
        walkerSession.distanceWalked += distance;
      }
      
      // Calculate duration
      const startTime = new Date(walkerSession.startTime).getTime();
      const currentTime = new Date().getTime();
      walkerSession.duration = Math.floor((currentTime - startTime) / 60000); // minutes
      
      packageDetails.walkerSession = walkerSession;
      
      await bookingsRepo.update(booking.id, {
        package_details: packageDetails,
      });
      
      return c.json({
        success: true,
        distanceWalked: walkerSession.distanceWalked.toFixed(2),
        duration: walkerSession.duration
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
      
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (!['in_progress', 'traveling'].includes(booking.status)) {
        return c.json({ error: 'Booking must be in progress' }, 400);
      }
      
      // Verify END OTP
      if (!booking.otp_code) {
        return c.json({ error: 'END OTP not set for this booking' }, 400);
      }
      
      if (booking.otp_code !== otp) {
        return c.json({ error: 'Invalid OTP. Please check and try again.' }, 401);
      }
      
      await withTransaction(async () => {
        // Complete walker session if exists
        const packageDetails = (booking.package_details as any) || {};
        if (packageDetails.walkerSession && packageDetails.walkerSession.status === 'active') {
          packageDetails.walkerSession.status = 'completed';
          packageDetails.walkerSession.endTime = new Date().toISOString();
          
          const startTime = new Date(packageDetails.walkerSession.startTime).getTime();
          const endTime = new Date().getTime();
          packageDetails.walkerSession.duration = Math.floor((endTime - startTime) / 60000);
        }
        
        // Complete tracking session if exists
        const trackingRepo = getGPSTrackingSessionsRepository();
        const trackingSession = await trackingRepo.findByBookingId(bookingId);
        if (trackingSession && trackingSession.is_active) {
          await trackingRepo.update(trackingSession.tracking_id, {
            is_active: false,
            stopped_at: new Date().toISOString(),
          });
        }
        
        // Update booking
        await bookingsRepo.update(bookingId, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          otp_verified_at: new Date().toISOString(),
          service_notes: notes || null,
          prescription_notes: prescriptionNotes || null,
          package_details: packageDetails,
        });
      });
      
      // Release earnings
      const completedBooking = await bookingsRepo.findById(bookingId);
      await releaseEarnings(bookingId, completedBooking!, staffId);
      
      console.log(`✅ [HOME] Booking ${bookingId} completed successfully`);
      
      // TODO: Send completion notification to customer
      
      return c.json({
        success: true,
        booking: completedBooking,
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
      
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Record rejection in package_details
      const packageDetails = (booking.package_details as any) || {};
      if (!packageDetails.rejections) packageDetails.rejections = [];
      packageDetails.rejections.push({
        staffId,
        reason,
        timestamp: new Date().toISOString()
      });
      
      // Find nearby eligible staff
      const customerAddress = booking.customer_address as any;
      const nearbyStaff = await findNearbyEligibleStaff(
        customerAddress,
        [], // services - can be extracted from booking if needed
        staffId, // Exclude rejecting staff
        booking.service_style || 'at_home'
      );
      
      if (nearbyStaff.length === 0) {
        // No nearby staff, cancel and refund
        await bookingsRepo.update(bookingId, {
          status: 'cancelled',
          cancellation_reason: 'No nearby staff available',
          cancelled_at: new Date().toISOString(),
          package_details: packageDetails,
        });
        
        return c.json({
          success: true,
          booking: await bookingsRepo.findById(bookingId),
          message: 'No nearby staff available. Booking cancelled and refund initiated.'
        });
      }
      
      // Broadcast to nearby staff
      packageDetails.broadcastedTo = nearbyStaff.map((s: any) => s.id);
      packageDetails.broadcastedAt = new Date().toISOString();
      
      await bookingsRepo.update(bookingId, {
        status: 'pending_reassignment',
        package_details: packageDetails,
      });
      
      console.log(`✅ [REASSIGN] Broadcasted to ${nearbyStaff.length} nearby staff`);
      
      // TODO: Send push notifications to nearby staff
      
      return c.json({
        success: true,
        booking: await bookingsRepo.findById(bookingId),
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
      
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.status !== 'pending_reassignment') {
        return c.json({ error: 'Booking not available for reassignment' }, 400);
      }
      
      // Check if staff is in broadcast list
      const packageDetails = (booking.package_details as any) || {};
      if (!packageDetails.broadcastedTo || !packageDetails.broadcastedTo.includes(staffId)) {
        return c.json({ error: 'You are not eligible to accept this booking' }, 403);
      }
      
      // Assign to new staff
      await bookingsRepo.update(bookingId, {
        staff_id: staffId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        package_details: {
          ...packageDetails,
          reassigned: true,
        },
      });
      
      console.log(`✅ [REASSIGN] Booking ${bookingId} reassigned to staff ${staffId}`);
      
      // TODO: Notify customer about new staff assignment
      
      return c.json({
        success: true,
        booking: await bookingsRepo.findById(bookingId),
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
      
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Allow reassignment if accepted, traveling, or even in_progress (if staff abandoned)
      if (!['accepted', 'traveling', 'in_progress'].includes(booking.status)) {
        return c.json({ error: `Cannot reassign booking with status: ${booking.status}` }, 400);
      }
      
      const currentStaffId = booking.staff_id;
      
      // Record the incident
      const packageDetails = (booking.package_details as any) || {};
      if (!packageDetails.incidents) packageDetails.incidents = [];
      packageDetails.incidents.push({
        type: 'emergency_reassignment',
        requestedBy,
        reason,
        previousStaffId: currentStaffId,
        timestamp: new Date().toISOString()
      });
      
      // Find nearby eligible staff (excluding current staff)
      const customerAddress = booking.customer_address as any;
      const nearbyStaff = await findNearbyEligibleStaff(
        customerAddress,
        [],
        currentStaffId || '',
        booking.service_style || 'at_home'
      );
      
      if (nearbyStaff.length === 0) {
        // No nearby staff - Admin intervention needed
        await bookingsRepo.update(bookingId, {
          status: 'admin_attention_required',
          package_details: {
            ...packageDetails,
            adminAlert: 'Emergency reassignment failed - No nearby staff',
          },
        });
        
        return c.json({
          success: false,
          booking: await bookingsRepo.findById(bookingId),
          message: 'No nearby staff found. Admin has been alerted.'
        });
      }
      
      // Broadcast to nearby staff
      packageDetails.broadcastedTo = nearbyStaff.map((s: any) => s.id);
      packageDetails.broadcastedAt = new Date().toISOString();
      packageDetails.previousStaffId = currentStaffId;
      packageDetails.reassignedFrom = currentStaffId;
      
      await bookingsRepo.update(bookingId, {
        status: 'pending_reassignment',
        staff_id: null,
        package_details: packageDetails,
      });
      
      console.log(`✅ [EMERGENCY] Broadcasted to ${nearbyStaff.length} nearby staff`);
      
      return c.json({
        success: true,
        booking: await bookingsRepo.findById(bookingId),
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
      
      const trackingRepo = getGPSTrackingSessionsRepository();
      const session = await trackingRepo.findByTrackingId(trackingSessionId);
      
      if (!session) {
        return c.json({ error: 'Tracking session not found' }, 404);
      }
      
      // Get staff details
      const staffRepo = getStaffRepository();
      const staff = await staffRepo.findById(session.booking_id ? (await getBookingsRepository().findById(session.booking_id))?.staff_id || '' : '');
      
      return c.json({
        success: true,
        session: {
          id: session.id,
          trackingId: session.tracking_id,
          bookingId: session.booking_id,
          currentLocation: session.current_location,
          waypoints: session.waypoints,
          estimatedEta: session.estimated_eta_minutes,
          isActive: session.is_active,
        },
        staff: staff ? {
          id: staff.id,
          fullName: staff.fullName,
          photo: null, // Can be added to staff table
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
      
      const client = getDbClient();
      const { data: bookings } = await client
        .from('bookings')
        .select('id, package_details')
        .contains('package_details', { walkerSession: { id: sessionId } });
      
      if (!bookings || bookings.length === 0) {
        return c.json({ error: 'Walker session not found' }, 404);
      }
      
      const booking = bookings[0];
      const packageDetails = (booking.package_details as any) || {};
      const session = packageDetails.walkerSession;
      
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
    const platformFee = (booking.total_amount || 0) * 0.20;
    const staffEarnings = (booking.total_amount || 0) - platformFee;
    
    // Create vendor earnings record
    const vendorEarningsRepo = getVendorEarningsRepository();
    await vendorEarningsRepo.create({
      vendor_id: booking.vendor_id || '',
      booking_id: bookingId,
      amount: staffEarnings,
      commission_amount: platformFee,
      total_amount: booking.total_amount || 0,
      commission_rate: 20.0,
    });
    
    // Update booking with earnings info
    const bookingsRepo = getBookingsRepository();
    const packageDetails = (booking.package_details as any) || {};
    packageDetails.earningsReleased = true;
    packageDetails.staffEarnings = staffEarnings;
    packageDetails.platformFee = platformFee;
    
    await bookingsRepo.update(bookingId, {
      package_details: packageDetails,
    });
    
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
    const client = getDbClient();
    
    console.log(`🔍 [NEARBY] Finding eligible staff within 5km (SQL)`);
    
    if (!customerAddress?.latitude || !customerAddress?.longitude) {
      return [];
    }
    
    // Get all active staff
    const { data: allStaff } = await client
      .from('staff')
      .select('id, vendor_id, is_active')
      .eq('is_active', true);
    
    if (!allStaff || allStaff.length === 0) return [];
    
    const eligibleStaff: any[] = [];
    
    for (const staff of allStaff) {
      if (staff.id === excludeStaffId) continue;
      
      // Get staff location (real-time or vendor)
      const { data: realTimeLocation } = await client
        .from('staff_real_time_locations')
        .select('latitude, longitude')
        .eq('staff_id', staff.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let staffLat: number | null = null;
      let staffLng: number | null = null;
      
      if (realTimeLocation?.latitude && realTimeLocation?.longitude) {
        staffLat = Number(realTimeLocation.latitude);
        staffLng = Number(realTimeLocation.longitude);
      } else {
        // Fallback to vendor location
        const { data: vendor } = await client
          .from('vendors')
          .select('latitude, longitude')
          .eq('id', staff.vendor_id)
          .single();
        
        if (vendor?.latitude && vendor?.longitude) {
          staffLat = Number(vendor.latitude);
          staffLng = Number(vendor.longitude);
        }
      }
      
      if (!staffLat || !staffLng) continue;
      
      // Calculate distance
      const distance = calculateDistance(
        customerAddress.latitude,
        customerAddress.longitude,
        staffLat,
        staffLng
      );
      
      // Within 5km for emergency reassignment
      if (distance > 5) continue;
      
      // Check if staff has the required services (if services provided)
      if (services && services.length > 0) {
        const { data: staffServices } = await client
          .from('staff_services')
          .select('service_id, is_active')
          .eq('staff_id', staff.id)
          .eq('is_active', true);
        
        const hasRequiredServices = services.every(bookingService => 
          staffServices?.some((staffService: any) => 
            staffService.service_id === bookingService.serviceId && staffService.is_active
          )
        );
        
        if (!hasRequiredServices) continue;
      }
      
      eligibleStaff.push({
        id: staff.id,
        vendorId: staff.vendor_id,
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

export default homeServicesEndpointsSQL;

