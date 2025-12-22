// Video and Voice Call System for Teleconsultation
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

interface CallSession {
  id: string;
  bookingId: string;
  conversationId?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vendorId: string;
  vendorName: string;
  petId: string;
  petName: string;
  callType: 'video' | 'voice';
  status: 'initiated' | 'ringing' | 'active' | 'ended' | 'missed' | 'rejected';
  initiatedBy: 'customer' | 'vendor';
  startedAt?: string;
  endedAt?: string;
  duration?: number; // in seconds
  recordingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /make-server-3dd53475/call/initiate
 * Initiate a video or voice call
 */
app.post("/make-server-3dd53475/call/initiate", async (c) => {
  try {
    const { bookingId, callType, initiatedBy } = await c.req.json();

    console.log('📞 [CALL] Initiating call:', { bookingId, callType, initiatedBy });

    // Get booking details
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ 
        success: false, 
        error: 'Booking not found' 
      }, 404);
    }

    // Verify this is a teleconsultation booking
    if (booking.serviceType !== 'tele' && booking.serviceType !== 'teleconsultation') {
      return c.json({ 
        success: false, 
        error: 'Calls are only available for teleconsultation bookings' 
      }, 400);
    }

    // Create call session ID
    const callId = `CALL_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Get conversation if exists
    const conversation = await kv.get(`conversation:booking:${bookingId}`);

    const callSession: CallSession = {
      id: callId,
      bookingId,
      conversationId: conversation?.id,
      customerId: booking.customerId,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      vendorId: booking.vendorId,
      vendorName: booking.vendorName,
      petId: booking.petId,
      petName: booking.petName,
      callType,
      status: 'ringing',
      initiatedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save call session
    await kv.set(`call:${callId}`, callSession);

    // Add to booking's call history
    const bookingCalls = await kv.get(`booking:${bookingId}:calls`) || [];
    bookingCalls.push(callId);
    await kv.set(`booking:${bookingId}:calls`, bookingCalls);

    // Add to customer's call history
    const customerCalls = await kv.get(`customer:${booking.customerPhone}:calls`) || [];
    customerCalls.push(callId);
    await kv.set(`customer:${booking.customerPhone}:calls`, customerCalls);

    // Add to vendor's call history
    const vendorCalls = await kv.get(`vendor:${booking.vendorId}:calls`) || [];
    vendorCalls.push(callId);
    await kv.set(`vendor:${booking.vendorId}:calls`, vendorCalls);

    console.log('✅ [CALL] Call initiated:', callId);

    return c.json({
      success: true,
      call: callSession,
      message: 'Call initiated successfully'
    });
  } catch (error) {
    console.error('❌ [CALL] Error initiating call:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to initiate call' 
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/call/:callId/answer
 * Answer an incoming call
 */
app.post("/make-server-3dd53475/call/:callId/answer", async (c) => {
  try {
    const { callId } = c.req.param();

    console.log('📞 [CALL] Answering call:', callId);

    const call = await kv.get(`call:${callId}`);
    if (!call) {
      return c.json({ 
        success: false, 
        error: 'Call not found' 
      }, 404);
    }

    if (call.status !== 'ringing') {
      return c.json({ 
        success: false, 
        error: 'Call is not in ringing state' 
      }, 400);
    }

    // Update call to active
    call.status = 'active';
    call.startedAt = new Date().toISOString();
    call.updatedAt = new Date().toISOString();

    await kv.set(`call:${callId}`, call);

    console.log('✅ [CALL] Call answered:', callId);

    return c.json({
      success: true,
      call,
      message: 'Call answered successfully'
    });
  } catch (error) {
    console.error('❌ [CALL] Error answering call:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to answer call' 
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/call/:callId/end
 * End an active call
 */
app.post("/make-server-3dd53475/call/:callId/end", async (c) => {
  try {
    const { callId } = c.req.param();
    const { recordingUrl } = await c.req.json();

    console.log('📞 [CALL] Ending call:', callId);

    const call = await kv.get(`call:${callId}`);
    if (!call) {
      return c.json({ 
        success: false, 
        error: 'Call not found' 
      }, 404);
    }

    const endTime = new Date().toISOString();

    // Calculate duration
    let duration = 0;
    if (call.startedAt) {
      duration = Math.floor(
        (new Date(endTime).getTime() - new Date(call.startedAt).getTime()) / 1000
      );
    }

    // Update call
    call.status = 'ended';
    call.endedAt = endTime;
    call.duration = duration;
    call.recordingUrl = recordingUrl;
    call.updatedAt = endTime;

    await kv.set(`call:${callId}`, call);

    console.log(`✅ [CALL] Call ended: ${callId}, duration: ${duration}s`);

    return c.json({
      success: true,
      call,
      message: 'Call ended successfully'
    });
  } catch (error) {
    console.error('❌ [CALL] Error ending call:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to end call' 
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/call/:callId/reject
 * Reject an incoming call
 */
app.post("/make-server-3dd53475/call/:callId/reject", async (c) => {
  try {
    const { callId } = c.req.param();

    console.log('📞 [CALL] Rejecting call:', callId);

    const call = await kv.get(`call:${callId}`);
    if (!call) {
      return c.json({ 
        success: false, 
        error: 'Call not found' 
      }, 404);
    }

    // Update call
    call.status = 'rejected';
    call.endedAt = new Date().toISOString();
    call.updatedAt = new Date().toISOString();

    await kv.set(`call:${callId}`, call);

    console.log('✅ [CALL] Call rejected:', callId);

    return c.json({
      success: true,
      call,
      message: 'Call rejected'
    });
  } catch (error) {
    console.error('❌ [CALL] Error rejecting call:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to reject call' 
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/call/:callId
 * Get call details
 */
app.get("/make-server-3dd53475/call/:callId", async (c) => {
  try {
    const { callId } = c.req.param();

    const call = await kv.get(`call:${callId}`);
    
    if (!call) {
      return c.json({ 
        success: false, 
        error: 'Call not found' 
      }, 404);
    }

    return c.json({
      success: true,
      call
    });
  } catch (error) {
    console.error('❌ [CALL] Error fetching call:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch call' 
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/call/booking/:bookingId/history
 * Get call history for a booking
 */
app.get("/make-server-3dd53475/call/booking/:bookingId/history", async (c) => {
  try {
    const { bookingId } = c.req.param();

    const callIds = await kv.get(`booking:${bookingId}:calls`) || [];

    const calls = [];
    for (const callId of callIds) {
      const call = await kv.get(`call:${callId}`);
      if (call) {
        calls.push(call);
      }
    }

    // Sort by creation time (newest first)
    calls.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return c.json({
      success: true,
      calls,
      total: calls.length
    });
  } catch (error) {
    console.error('❌ [CALL] Error fetching call history:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch call history' 
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/call/customer/:customerPhone/history
 * Get all calls for a customer
 */
app.get("/make-server-3dd53475/call/customer/:customerPhone/history", async (c) => {
  try {
    const { customerPhone } = c.req.param();

    const callIds = await kv.get(`customer:${customerPhone}:calls`) || [];

    const calls = [];
    for (const callId of callIds) {
      const call = await kv.get(`call:${callId}`);
      if (call) {
        calls.push(call);
      }
    }

    // Sort by creation time (newest first)
    calls.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return c.json({
      success: true,
      calls,
      total: calls.length
    });
  } catch (error) {
    console.error('❌ [CALL] Error fetching customer call history:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch call history' 
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/call/vendor/:vendorId/history
 * Get all calls for a vendor
 */
app.get("/make-server-3dd53475/call/vendor/:vendorId/history", async (c) => {
  try {
    const { vendorId } = c.req.param();

    const callIds = await kv.get(`vendor:${vendorId}:calls`) || [];

    const calls = [];
    for (const callId of callIds) {
      const call = await kv.get(`call:${callId}`);
      if (call) {
        calls.push(call);
      }
    }

    // Sort by creation time (newest first)
    calls.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return c.json({
      success: true,
      calls,
      total: calls.length
    });
  } catch (error) {
    console.error('❌ [CALL] Error fetching vendor call history:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch call history' 
    }, 500);
  }
});

export default app;
