/**
 * Video and Voice Call System for Teleconsultation (SQL-ONLY VERSION)
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - All data now comes from SQL tables (video_call_rooms, video_call_history, bookings)
 * 
 * Date: 2025-01-27
 * Migration: Batch 9 - 500 KV Operations Migration
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getDbClient } from '../../lib/db.ts';

const BASE_PATH = '/make-server-3dd53475';

export function registerCallEndpointsSQL(app: Hono) {
  console.log('✅ Registering Call Endpoints (SQL-only)...');

  const bookingsRepo = getBookingsRepository();
  const client = getDbClient();

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
   * POST /call/initiate
   * Initiate a video or voice call
   */
  app.post(`${BASE_PATH}/call/initiate`, async (c) => {
    try {
      const { bookingId, callType, initiatedBy } = await c.req.json();

      console.log('📞 [CALL] Initiating call:', { bookingId, callType, initiatedBy });

      // ✅ SQL: Get booking details
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Verify this is a teleconsultation booking
      if (booking.service_type !== 'tele' && booking.service_type !== 'teleconsultation') {
        return sendError(c, 'Calls are only available for teleconsultation bookings', 400);
      }

      // Create call session ID
      const callId = `CALL_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const roomId = `ROOM_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // ✅ SQL: Get conversation if exists (from chat_endpoints)
      const { data: conversation } = await client
        .from('conversations')
        .select('id')
        .eq('booking_id', bookingId)
        .maybeSingle();

      // ✅ SQL: Create call session in video_call_rooms
      const now = new Date().toISOString();
      await client
        .from('video_call_rooms')
        .insert({
          id: callId,
          booking_id: bookingId,
          room_id: roomId,
          participants: [
            { id: booking.customer_id, name: booking.customer_name, role: 'customer' },
            { id: booking.vendor_id, name: booking.vendor_name, role: 'vendor' }
          ],
          status: 'active',
          created_at: now,
          updated_at: now
        });

      // ✅ SQL: Create call history entry
      await client
        .from('video_call_history')
        .insert({
          id: callId,
          room_id: roomId,
          booking_id: bookingId,
          started_at: now,
          participants: [
            { id: booking.customer_id, name: booking.customer_name, role: 'customer' },
            { id: booking.vendor_id, name: booking.vendor_name, role: 'vendor' }
          ],
          call_type: callType,
          created_at: now
        });

      const callSession: CallSession = {
        id: callId,
        bookingId,
        conversationId: conversation?.id,
        customerId: booking.customer_id,
        customerName: booking.customer_name,
        customerPhone: booking.customer_phone,
        vendorId: booking.vendor_id,
        vendorName: booking.vendor_name,
        petId: booking.pet_id,
        petName: booking.pet_name,
        callType,
        status: 'ringing',
        initiatedBy,
        createdAt: now,
        updatedAt: now
      };

      console.log('✅ [CALL] Call initiated:', callId);

      return sendSuccess(c, {
        call: callSession,
        message: 'Call initiated successfully'
      });
    } catch (error) {
      console.error('❌ [CALL] Error initiating call:', error);
      return sendError(c, 'Failed to initiate call', 500);
    }
  });

  /**
   * POST /call/:callId/answer
   * Answer an incoming call
   */
  app.post(`${BASE_PATH}/call/:callId/answer`, async (c) => {
    try {
      const { callId } = c.req.param();

      console.log('📞 [CALL] Answering call:', callId);

      // ✅ SQL: Get call session
      const { data: callRoom } = await client
        .from('video_call_rooms')
        .select('*')
        .eq('id', callId)
        .maybeSingle();

      if (!callRoom) {
        return sendError(c, 'Call not found', 404);
      }

      if (callRoom.status !== 'active') {
        return sendError(c, 'Call is not in active state', 400);
      }

      // ✅ SQL: Update call status (already active, just update timestamp)
      await client
        .from('video_call_rooms')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', callId);

      // ✅ SQL: Update call history
      await client
        .from('video_call_history')
        .update({
          started_at: new Date().toISOString()
        })
        .eq('id', callId);

      console.log('✅ [CALL] Call answered:', callId);

      return sendSuccess(c, {
        call: callRoom,
        message: 'Call answered successfully'
      });
    } catch (error) {
      console.error('❌ [CALL] Error answering call:', error);
      return sendError(c, 'Failed to answer call', 500);
    }
  });

  /**
   * POST /call/:callId/end
   * End an active call
   */
  app.post(`${BASE_PATH}/call/:callId/end`, async (c) => {
    try {
      const { callId } = c.req.param();
      const { recordingUrl } = await c.req.json();

      console.log('📞 [CALL] Ending call:', callId);

      // ✅ SQL: Get call session
      const { data: callRoom } = await client
        .from('video_call_rooms')
        .select('*')
        .eq('id', callId)
        .maybeSingle();

      if (!callRoom) {
        return sendError(c, 'Call not found', 404);
      }

      const endTime = new Date().toISOString();

      // Calculate duration
      let duration = 0;
      if (callRoom.created_at) {
        duration = Math.floor(
          (new Date(endTime).getTime() - new Date(callRoom.created_at).getTime()) / 1000
        );
      }

      // ✅ SQL: Update call room
      await client
        .from('video_call_rooms')
        .update({
          status: 'ended',
          ended_at: endTime,
          duration: duration,
          updated_at: endTime
        })
        .eq('id', callId);

      // ✅ SQL: Update call history
      await client
        .from('video_call_history')
        .update({
          ended_at: endTime,
          duration: duration
        })
        .eq('id', callId);

      console.log(`✅ [CALL] Call ended: ${callId}, duration: ${duration}s`);

      return sendSuccess(c, {
        call: {
          ...callRoom,
          status: 'ended',
          endedAt: endTime,
          duration: duration,
          recordingUrl: recordingUrl
        },
        message: 'Call ended successfully'
      });
    } catch (error) {
      console.error('❌ [CALL] Error ending call:', error);
      return sendError(c, 'Failed to end call', 500);
    }
  });

  /**
   * POST /call/:callId/reject
   * Reject an incoming call
   */
  app.post(`${BASE_PATH}/call/:callId/reject`, async (c) => {
    try {
      const { callId } = c.req.param();

      console.log('📞 [CALL] Rejecting call:', callId);

      // ✅ SQL: Update call status
      const { data: callRoom } = await client
        .from('video_call_rooms')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', callId)
        .select()
        .single();

      if (!callRoom) {
        return sendError(c, 'Call not found', 404);
      }

      console.log('✅ [CALL] Call rejected:', callId);

      return sendSuccess(c, {
        call: callRoom,
        message: 'Call rejected'
      });
    } catch (error) {
      console.error('❌ [CALL] Error rejecting call:', error);
      return sendError(c, 'Failed to reject call', 500);
    }
  });

  /**
   * GET /call/:callId
   * Get call details
   */
  app.get(`${BASE_PATH}/call/:callId`, async (c) => {
    try {
      const { callId } = c.req.param();

      // ✅ SQL: Get call session
      const { data: callRoom } = await client
        .from('video_call_rooms')
        .select('*')
        .eq('id', callId)
        .maybeSingle();

      if (!callRoom) {
        return sendError(c, 'Call not found', 404);
      }

      return sendSuccess(c, { call: callRoom });
    } catch (error) {
      console.error('❌ [CALL] Error fetching call:', error);
      return sendError(c, 'Failed to fetch call', 500);
    }
  });

  /**
   * GET /call/booking/:bookingId/history
   * Get call history for a booking
   */
  app.get(`${BASE_PATH}/call/booking/:bookingId/history`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      // ✅ SQL: Get call history for booking
      const { data: calls } = await client
        .from('video_call_history')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      return sendSuccess(c, {
        calls: calls || [],
        total: (calls || []).length
      });
    } catch (error) {
      console.error('❌ [CALL] Error fetching call history:', error);
      return sendError(c, 'Failed to fetch call history', 500);
    }
  });

  /**
   * GET /call/customer/:customerPhone/history
   * Get all calls for a customer
   */
  app.get(`${BASE_PATH}/call/customer/:customerPhone/history`, async (c) => {
    try {
      const { customerPhone } = c.req.param();

      // ✅ SQL: Get calls for customer via bookings
      const { data: calls } = await client
        .from('video_call_history')
        .select('*, bookings!inner(customer_phone)')
        .eq('bookings.customer_phone', customerPhone)
        .order('created_at', { ascending: false });

      return sendSuccess(c, {
        calls: calls || [],
        total: (calls || []).length
      });
    } catch (error) {
      console.error('❌ [CALL] Error fetching customer call history:', error);
      return sendError(c, 'Failed to fetch call history', 500);
    }
  });

  /**
   * GET /call/vendor/:vendorId/history
   * Get all calls for a vendor
   */
  app.get(`${BASE_PATH}/call/vendor/:vendorId/history`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get calls for vendor via bookings
      const { data: calls } = await client
        .from('video_call_history')
        .select('*, bookings!inner(vendor_id)')
        .eq('bookings.vendor_id', vendorId)
        .order('created_at', { ascending: false });

      return sendSuccess(c, {
        calls: calls || [],
        total: (calls || []).length
      });
    } catch (error) {
      console.error('❌ [CALL] Error fetching vendor call history:', error);
      return sendError(c, 'Failed to fetch call history', 500);
    }
  });

  console.log('✅ Call Endpoints registered (SQL-only)');
}
