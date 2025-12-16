/**
 * TELE-CONSULTATION ENDPOINTS
 * Video call and chat integration for remote consultations
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

export function teleConsultationEndpoints(app: Hono) {
  
  /**
   * Start video call (customer initiates)
   * POST /make-server-3dd53475/booking/:bookingId/start-video-call
   */
  app.post('/make-server-3dd53475/booking/:bookingId/start-video-call', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { customerId } = await c.req.json();
      
      console.log(`📱 [TELE] Customer ${customerId} starting video call for booking ${bookingId}`);
      
      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.serviceStyle !== 'tele') {
        return c.json({ error: 'Only tele consultation bookings can have video calls' }, 400);
      }
      
      if (booking.status !== 'accepted' && booking.status !== 'pending' && booking.status !== 'assigned') {
        return c.json({ error: 'Booking must be accepted to start call' }, 400);
      }
      
      // Check if call time is appropriate (within 10 minutes of appointment time)
      const appointmentTime = new Date(booking.appointmentDate).getTime();
      const currentTime = new Date().getTime();
      const timeDiff = Math.abs(appointmentTime - currentTime) / 60000; // minutes
      
      if (timeDiff > 10) {
        return c.json({ 
          error: 'Call can only be started within 10 minutes of appointment time',
          minutesUntilAppointment: Math.floor((appointmentTime - currentTime) / 60000)
        }, 400);
      }
      
      // Create tele session
      const teleSessionId = `tele_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      const teleSession = {
        id: teleSessionId,
        bookingId,
        customerId: booking.customerId,
        staffId: booking.assignedStaffId || booking.staffId,
        
        // Call details
        callStatus: 'ringing', // ringing, active, ended
        initiatedBy: 'customer',
        initiatedAt: new Date().toISOString(),
        acceptedAt: null,
        endedAt: null,
        
        // Duration
        duration: 0, // seconds
        
        // Chat
        chatEnabled: true,
        messages: [],
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`tele_session:${teleSessionId}`, teleSession);
      
      // Update booking
      booking.teleSessionId = teleSessionId;
      booking.teleCallInitiatedAt = new Date().toISOString();
      booking.status = 'call_ringing';
      booking.updatedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);
      
      console.log(`✅ [TELE] Video call initiated: ${teleSessionId}`);
      
      // TODO: Send push notification to staff
      
      return c.json({
        success: true,
        teleSession,
        booking,
        message: 'Call initiated. Waiting for staff to accept.'
      });
      
    } catch (error) {
      console.error('❌ [TELE] Error starting video call:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Accept video call (staff accepts)
   * POST /make-server-3dd53475/tele-session/:sessionId/accept
   */
  app.post('/make-server-3dd53475/tele-session/:sessionId/accept', async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { staffId } = await c.req.json();
      
      console.log(`📱 [TELE] Staff ${staffId} accepting call ${sessionId}`);
      
      const session = await kv.get(`tele_session:${sessionId}`);
      
      if (!session) {
        return c.json({ error: 'Tele session not found' }, 404);
      }
      
      if (session.callStatus !== 'ringing') {
        return c.json({ error: 'Call is not in ringing state' }, 400);
      }
      
      if (session.staffId !== staffId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      // Accept call
      session.callStatus = 'active';
      session.acceptedAt = new Date().toISOString();
      session.updatedAt = new Date().toISOString();
      
      await kv.set(`tele_session:${sessionId}`, session);
      
      // Update booking
      const booking = await kv.get(`booking:${session.bookingId}`);
      if (booking) {
        booking.status = 'in_progress';
        booking.teleCallStartedAt = new Date().toISOString();
        booking.updatedAt = new Date().toISOString();
        await kv.set(`booking:${session.bookingId}`, booking);
      }
      
      console.log(`✅ [TELE] Call accepted and started: ${sessionId}`);
      
      return c.json({
        success: true,
        session,
        message: 'Call accepted. Consultation started.'
      });
      
    } catch (error) {
      console.error('❌ [TELE] Error accepting call:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Reject video call (staff rejects)
   * POST /make-server-3dd53475/tele-session/:sessionId/reject
   */
  app.post('/make-server-3dd53475/tele-session/:sessionId/reject', async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { staffId, reason } = await c.req.json();
      
      console.log(`📱 [TELE] Staff ${staffId} rejecting call ${sessionId}`);
      
      const session = await kv.get(`tele_session:${sessionId}`);
      
      if (!session) {
        return c.json({ error: 'Tele session not found' }, 404);
      }
      
      if (session.staffId !== staffId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      // Reject call
      session.callStatus = 'rejected';
      session.rejectedAt = new Date().toISOString();
      session.rejectionReason = reason || 'Staff declined';
      session.updatedAt = new Date().toISOString();
      
      await kv.set(`tele_session:${sessionId}`, session);
      
      // Update booking
      const booking = await kv.get(`booking:${session.bookingId}`);
      if (booking) {
        booking.status = 'cancelled';
        booking.cancellationReason = reason || 'Staff declined video call';
        booking.cancelledAt = new Date().toISOString();
        booking.refundInitiated = true;
        booking.updatedAt = new Date().toISOString();
        await kv.set(`booking:${session.bookingId}`, booking);
      }
      
      console.log(`✅ [TELE] Call rejected: ${sessionId}`);
      
      return c.json({
        success: true,
        session,
        message: 'Call rejected. Booking cancelled and refund initiated.'
      });
      
    } catch (error) {
      console.error('❌ [TELE] Error rejecting call:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * End video call
   * POST /make-server-3dd53475/tele-session/:sessionId/end
   */
  app.post('/make-server-3dd53475/tele-session/:sessionId/end', async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { endedBy } = await c.req.json(); // 'customer' or 'staff'
      
      console.log(`📱 [TELE] Ending call ${sessionId} by ${endedBy}`);
      
      const session = await kv.get(`tele_session:${sessionId}`);
      
      if (!session) {
        return c.json({ error: 'Tele session not found' }, 404);
      }
      
      if (session.callStatus !== 'active') {
        return c.json({ error: 'Call is not active' }, 400);
      }
      
      // Calculate duration
      const startTime = new Date(session.acceptedAt).getTime();
      const endTime = new Date().getTime();
      const duration = Math.floor((endTime - startTime) / 1000); // seconds
      
      // End call
      session.callStatus = 'ended';
      session.endedAt = new Date().toISOString();
      session.endedBy = endedBy;
      session.duration = duration;
      session.updatedAt = new Date().toISOString();
      
      await kv.set(`tele_session:${sessionId}`, session);
      
      // Update booking - but don't complete yet, need OTP
      const booking = await kv.get(`booking:${session.bookingId}`);
      if (booking) {
        booking.teleCallEndedAt = new Date().toISOString();
        booking.teleCallDuration = duration;
        booking.status = 'awaiting_otp'; // Need OTP to complete
        booking.updatedAt = new Date().toISOString();
        await kv.set(`booking:${session.bookingId}`, booking);
      }
      
      console.log(`✅ [TELE] Call ended: ${sessionId}, duration: ${duration}s`);
      
      return c.json({
        success: true,
        session,
        duration,
        message: 'Call ended. Provide OTP to complete consultation.'
      });
      
    } catch (error) {
      console.error('❌ [TELE] Error ending call:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Send chat message during call
   * POST /make-server-3dd53475/tele-session/:sessionId/chat
   */
  app.post('/make-server-3dd53475/tele-session/:sessionId/chat', async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { senderId, senderType, message } = await c.req.json(); // senderType: 'customer' or 'staff'
      
      const session = await kv.get(`tele_session:${sessionId}`);
      
      if (!session) {
        return c.json({ error: 'Tele session not found' }, 404);
      }
      
      if (session.callStatus !== 'active') {
        return c.json({ error: 'Chat only available during active call' }, 400);
      }
      
      if (!session.chatEnabled) {
        return c.json({ error: 'Chat is disabled for this session' }, 400);
      }
      
      // Add message
      const chatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        senderId,
        senderType,
        message,
        timestamp: new Date().toISOString()
      };
      
      session.messages.push(chatMessage);
      session.updatedAt = new Date().toISOString();
      
      await kv.set(`tele_session:${sessionId}`, session);
      
      return c.json({
        success: true,
        message: chatMessage
      });
      
    } catch (error) {
      console.error('❌ [TELE] Error sending chat message:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Get tele session details
   * GET /make-server-3dd53475/tele-session/:sessionId
   */
  app.get('/make-server-3dd53475/tele-session/:sessionId', async (c) => {
    try {
      const { sessionId } = c.req.param();
      
      const session = await kv.get(`tele_session:${sessionId}`);
      
      if (!session) {
        return c.json({ error: 'Tele session not found' }, 404);
      }
      
      // Get staff and customer details
      const staff = await kv.get(`staff:${session.staffId}`);
      const customer = await kv.get(`customer:${session.customerId}`);
      
      return c.json({
        success: true,
        session,
        staff: staff ? {
          id: staff.id,
          fullName: staff.fullName,
          photo: staff.photo,
          specialization: staff.specialization
        } : null,
        customer: customer ? {
          id: customer.id,
          name: customer.name || customer.fullName,
          photo: customer.photo
        } : null
      });
      
    } catch (error) {
      console.error('❌ [TELE] Error fetching session:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Get chat history for session
   * GET /make-server-3dd53475/tele-session/:sessionId/chat
   */
  app.get('/make-server-3dd53475/tele-session/:sessionId/chat', async (c) => {
    try {
      const { sessionId } = c.req.param();
      
      const session = await kv.get(`tele_session:${sessionId}`);
      
      if (!session) {
        return c.json({ error: 'Tele session not found' }, 404);
      }
      
      return c.json({
        success: true,
        messages: session.messages || []
      });
      
    } catch (error) {
      console.error('❌ [TELE] Error fetching chat:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Update call duration (heartbeat)
   * PUT /make-server-3dd53475/tele-session/:sessionId/heartbeat
   */
  app.put('/make-server-3dd53475/tele-session/:sessionId/heartbeat', async (c) => {
    try {
      const { sessionId } = c.req.param();
      
      const session = await kv.get(`tele_session:${sessionId}`);
      
      if (!session) {
        return c.json({ error: 'Tele session not found' }, 404);
      }
      
      if (session.callStatus !== 'active') {
        return c.json({ error: 'Call not active' }, 400);
      }
      
      // Calculate current duration
      const startTime = new Date(session.acceptedAt).getTime();
      const currentTime = new Date().getTime();
      const duration = Math.floor((currentTime - startTime) / 1000); // seconds
      
      session.duration = duration;
      session.lastHeartbeat = new Date().toISOString();
      session.updatedAt = new Date().toISOString();
      
      await kv.set(`tele_session:${sessionId}`, session);
      
      return c.json({
        success: true,
        duration,
        callStatus: session.callStatus
      });
      
    } catch (error) {
      console.error('❌ [TELE] Error updating heartbeat:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

export default teleConsultationEndpoints;
