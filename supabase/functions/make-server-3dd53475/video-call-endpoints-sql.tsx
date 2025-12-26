/**
 * Video Call Endpoints - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * WebRTC video call room management
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (18 KV operations → 0)
 * Endpoints: 9
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';

export function registerVideoCallEndpoints(app: Hono) {
  const db = getDbClient();

/**
 * POST /make-server-3dd53475/video/room/create
 * Create or join a video call room
 */
app.post('/make-server-3dd53475/video/room/create', async (c) => {
  try {
    const { bookingId, customerPhone, customerName, participantType } = await c.req.json();

    console.log(`🎥 [VIDEO] Creating/joining room for booking: ${bookingId}`);

    // ✅ SQL: Check if room already exists for this booking
    const { data: existingRoom } = await db
      .from('video_call_rooms')
      .select('*')
      .eq('booking_id', bookingId)
      .eq('status', 'active')
      .maybeSingle();

    let room: any;

    if (!existingRoom) {
      // Create new room
      const roomId = `ROOM_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const newRoom = {
        id: roomId,
        booking_id: bookingId,
        room_id: roomId,
        participants: [],
        status: 'active',
        offer: null,
        answer: null,
        ice_candidates: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: insertedRoom, error: insertError } = await db
        .from('video_call_rooms')
        .insert(newRoom)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      room = insertedRoom;
    } else {
      room = existingRoom;
    }

    // Add participant if not already in room
    const participants = (room.participants || []) as any[];
    const participantExists = participants.some(
      (p: any) => p.type === participantType
    );

    if (!participantExists) {
      participants.push({
        type: participantType,
        name: participantType === 'customer' ? customerName : 'Vendor',
        phone: customerPhone,
        joinedAt: new Date().toISOString()
      });

      // ✅ SQL: Update room with new participant
      const { data: updatedRoom, error: updateError } = await db
        .from('video_call_rooms')
        .update({
          participants,
          updated_at: new Date().toISOString()
        })
        .eq('room_id', room.room_id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      room = updatedRoom;
    }

    console.log(`✅ [VIDEO] Room created/joined: ${room.room_id}`);

    return c.json({
      success: true,
      roomId: room.room_id,
      room: {
        id: room.room_id,
        bookingId: room.booking_id,
        createdAt: room.created_at,
        participants: room.participants,
        status: room.status,
        offer: room.offer,
        answer: room.answer,
        iceCandidates: room.ice_candidates
      }
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

    // ✅ SQL: Get room
    const { data: room, error: fetchError } = await db
      .from('video_call_rooms')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (fetchError || !room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    const offerData = {
      sdp: offer,
      type: participantType,
      createdAt: new Date().toISOString()
    };

    // ✅ SQL: Update room with offer
    await db
      .from('video_call_rooms')
      .update({
        offer: offerData,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId);

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

    // ✅ SQL: Get room
    const { data: room, error: fetchError } = await db
      .from('video_call_rooms')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (fetchError || !room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    const answerData = {
      sdp: answer,
      type: participantType,
      createdAt: new Date().toISOString()
    };

    // ✅ SQL: Update room with answer
    await db
      .from('video_call_rooms')
      .update({
        answer: answerData,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId);

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

    // ✅ SQL: Get room
    const { data: room, error: fetchError } = await db
      .from('video_call_rooms')
      .select('answer')
      .eq('room_id', roomId)
      .single();

    if (fetchError || !room) {
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

    // ✅ SQL: Get room
    const { data: room, error: fetchError } = await db
      .from('video_call_rooms')
      .select('offer')
      .eq('room_id', roomId)
      .single();

    if (fetchError || !room) {
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

    // ✅ SQL: Get room
    const { data: room, error: fetchError } = await db
      .from('video_call_rooms')
      .select('ice_candidates')
      .eq('room_id', roomId)
      .single();

    if (fetchError || !room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    const iceCandidates = (room.ice_candidates || []) as any[];
    iceCandidates.push({
      candidate,
      type: participantType,
      createdAt: new Date().toISOString()
    });

    // ✅ SQL: Update room with new ICE candidate
    await db
      .from('video_call_rooms')
      .update({
        ice_candidates: iceCandidates,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId);

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

    // ✅ SQL: Get room
    const { data: room, error: fetchError } = await db
      .from('video_call_rooms')
      .select('ice_candidates')
      .eq('room_id', roomId)
      .single();

    if (fetchError || !room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    // Get candidates from the other participant
    const otherType = participantType === 'customer' ? 'vendor' : 'customer';
    const iceCandidates = (room.ice_candidates || []) as any[];
    const candidates = iceCandidates.filter(
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

    // ✅ SQL: Get room
    const { data: room, error: fetchError } = await db
      .from('video_call_rooms')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (fetchError || !room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    const endedAt = new Date().toISOString();

    // ✅ SQL: Update room status
    await db
      .from('video_call_rooms')
      .update({
        status: 'ended',
        ended_at: endedAt,
        ended_by: participantType,
        duration: duration,
        updated_at: endedAt
      })
      .eq('room_id', roomId);

    // ✅ SQL: Create call history record
    const callRecord = {
      id: `CALL_${Date.now()}`,
      room_id: room.room_id,
      booking_id: room.booking_id,
      started_at: room.created_at,
      ended_at: endedAt,
      duration: duration,
      participants: room.participants,
      call_type: 'video'
    };

    await db
      .from('video_call_history')
      .insert(callRecord);

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

    // ✅ SQL: Get room
    const { data: room, error: fetchError } = await db
      .from('video_call_rooms')
      .select('id, room_id, status, participants, created_at, ended_at')
      .eq('room_id', roomId)
      .single();

    if (fetchError || !room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    return c.json({
      success: true,
      room: {
        id: room.room_id,
        status: room.status,
        participants: room.participants,
        createdAt: room.created_at,
        endedAt: room.ended_at
      }
    });
  } catch (error) {
    console.error('❌ [VIDEO] Error getting room status:', error);
    return c.json({ error: String(error) }, 500);
  }
});

console.log('✅ Video call endpoints registered (SQL-only)');
}

