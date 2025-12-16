import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

export function registerVideoCallEndpoints(app: Hono) {

/**
 * POST /make-server-3dd53475/video/room/create
 * Create or join a video call room
 */
app.post('/make-server-3dd53475/video/room/create', async (c) => {
  try {
    const { bookingId, customerPhone, customerName, participantType } = await c.req.json();

    console.log(`🎥 [VIDEO] Creating/joining room for booking: ${bookingId}`);

    // Check if room already exists for this booking
    let room = await kv.get(`video:room:${bookingId}`);

    if (!room) {
      // Create new room
      const roomId = `ROOM_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      room = {
        id: roomId,
        bookingId,
        createdAt: new Date().toISOString(),
        participants: [],
        status: 'active',
        offer: null,
        answer: null,
        iceCandidates: []
      };
    }

    // Add participant if not already in room
    const participantExists = room.participants.some(
      (p: any) => p.type === participantType
    );

    if (!participantExists) {
      room.participants.push({
        type: participantType,
        name: participantType === 'customer' ? customerName : 'Vendor',
        phone: customerPhone,
        joinedAt: new Date().toISOString()
      });
    }

    // Save room
    await kv.set(`video:room:${bookingId}`, room);
    await kv.set(`video:room:${room.id}`, room);

    console.log(`✅ [VIDEO] Room created/joined: ${room.id}`);

    return c.json({
      success: true,
      roomId: room.id,
      room
    });
  } catch (error) {
    console.error('❌ [VIDEO] Error creating room:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/video/signal/offer
 * Store WebRTC offer
 */
app.post('/make-server-3dd53475/video/signal/offer', async (c) => {
  try {
    const { roomId, offer, participantType } = await c.req.json();

    console.log(`📡 [VIDEO-SIGNAL] Storing offer for room: ${roomId}`);

    const room = await kv.get(`video:room:${roomId}`);
    if (!room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    room.offer = {
      sdp: offer,
      type: participantType,
      createdAt: new Date().toISOString()
    };

    await kv.set(`video:room:${roomId}`, room);

    console.log(`✅ [VIDEO-SIGNAL] Offer stored for room: ${roomId}`);

    return c.json({
      success: true
    });
  } catch (error) {
    console.error('❌ [VIDEO-SIGNAL] Error storing offer:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/video/signal/answer
 * Store WebRTC answer
 */
app.post('/make-server-3dd53475/video/signal/answer', async (c) => {
  try {
    const { roomId, answer, participantType } = await c.req.json();

    console.log(`📡 [VIDEO-SIGNAL] Storing answer for room: ${roomId}`);

    const room = await kv.get(`video:room:${roomId}`);
    if (!room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    room.answer = {
      sdp: answer,
      type: participantType,
      createdAt: new Date().toISOString()
    };

    await kv.set(`video:room:${roomId}`, room);

    console.log(`✅ [VIDEO-SIGNAL] Answer stored for room: ${roomId}`);

    return c.json({
      success: true
    });
  } catch (error) {
    console.error('❌ [VIDEO-SIGNAL] Error storing answer:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/video/signal/answer/:roomId
 * Get WebRTC answer
 */
app.get('/make-server-3dd53475/video/signal/answer/:roomId', async (c) => {
  try {
    const { roomId } = c.req.param();

    const room = await kv.get(`video:room:${roomId}`);
    if (!room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    return c.json({
      success: true,
      answer: room.answer?.sdp || null
    });
  } catch (error) {
    console.error('❌ [VIDEO-SIGNAL] Error getting answer:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/video/signal/offer/:roomId
 * Get WebRTC offer
 */
app.get('/make-server-3dd53475/video/signal/offer/:roomId', async (c) => {
  try {
    const { roomId } = c.req.param();

    const room = await kv.get(`video:room:${roomId}`);
    if (!room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    return c.json({
      success: true,
      offer: room.offer?.sdp || null
    });
  } catch (error) {
    console.error('❌ [VIDEO-SIGNAL] Error getting offer:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/video/signal/ice-candidate
 * Store ICE candidate
 */
app.post('/make-server-3dd53475/video/signal/ice-candidate', async (c) => {
  try {
    const { roomId, candidate, participantType } = await c.req.json();

    const room = await kv.get(`video:room:${roomId}`);
    if (!room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    if (!room.iceCandidates) {
      room.iceCandidates = [];
    }

    room.iceCandidates.push({
      candidate,
      type: participantType,
      createdAt: new Date().toISOString()
    });

    await kv.set(`video:room:${roomId}`, room);

    return c.json({
      success: true
    });
  } catch (error) {
    console.error('❌ [VIDEO-SIGNAL] Error storing ICE candidate:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/video/signal/ice-candidates/:roomId/:participantType
 * Get ICE candidates for other participant
 */
app.get('/make-server-3dd53475/video/signal/ice-candidates/:roomId/:participantType', async (c) => {
  try {
    const { roomId, participantType } = c.req.param();

    const room = await kv.get(`video:room:${roomId}`);
    if (!room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    // Get candidates from the other participant
    const otherType = participantType === 'customer' ? 'vendor' : 'customer';
    const candidates = (room.iceCandidates || []).filter(
      (ic: any) => ic.type === otherType
    );

    return c.json({
      success: true,
      candidates
    });
  } catch (error) {
    console.error('❌ [VIDEO-SIGNAL] Error getting ICE candidates:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/video/room/:roomId/end
 * End a video call
 */
app.post('/make-server-3dd53475/video/room/:roomId/end', async (c) => {
  try {
    const { roomId } = c.req.param();
    const { participantType, duration } = await c.req.json();

    console.log(`🎥 [VIDEO] Ending room: ${roomId}`);

    const room = await kv.get(`video:room:${roomId}`);
    if (!room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    room.status = 'ended';
    room.endedAt = new Date().toISOString();
    room.endedBy = participantType;
    room.duration = duration;

    await kv.set(`video:room:${roomId}`, room);

    // Also create call history record
    const callRecord = {
      id: `CALL_${Date.now()}`,
      roomId: room.id,
      bookingId: room.bookingId,
      startedAt: room.createdAt,
      endedAt: room.endedAt,
      duration: duration,
      participants: room.participants,
      callType: 'video'
    };

    await kv.set(`call:${callRecord.id}`, callRecord);

    // Add to booking's call history
    if (room.bookingId) {
      const bookingCalls = await kv.get(`booking:${room.bookingId}:calls`) || [];
      bookingCalls.push(callRecord.id);
      await kv.set(`booking:${room.bookingId}:calls`, bookingCalls);
    }

    console.log(`✅ [VIDEO] Room ended: ${roomId}`);

    return c.json({
      success: true,
      callRecord
    });
  } catch (error) {
    console.error('❌ [VIDEO] Error ending room:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/video/room/:roomId/status
 * Get room status
 */
app.get('/make-server-3dd53475/video/room/:roomId/status', async (c) => {
  try {
    const { roomId } = c.req.param();

    const room = await kv.get(`video:room:${roomId}`);
    if (!room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    return c.json({
      success: true,
      room: {
        id: room.id,
        status: room.status,
        participants: room.participants,
        createdAt: room.createdAt,
        endedAt: room.endedAt
      }
    });
  } catch (error) {
    console.error('❌ [VIDEO] Error getting room status:', error);
    return c.json({ error: String(error) }, 500);
  }
});

}
