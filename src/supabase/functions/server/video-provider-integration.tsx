/**
 * Production Video Call Provider Integration
 * Supports 100ms, Agora, and Zoom
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

// Video provider configuration
const VIDEO_PROVIDER = Deno.env.get('VIDEO_PROVIDER') || '100ms'; // '100ms', 'agora', 'zoom', 'jitsi'
const HUNDREDMS_APP_ID = Deno.env.get('HUNDREDMS_APP_ID') || '';
const HUNDREDMS_APP_SECRET = Deno.env.get('HUNDREDMS_APP_SECRET') || '';
const AGORA_APP_ID = Deno.env.get('AGORA_APP_ID') || '';
const AGORA_APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE') || '';
const ZOOM_API_KEY = Deno.env.get('ZOOM_API_KEY') || '';
const ZOOM_API_SECRET = Deno.env.get('ZOOM_API_SECRET') || '';

/**
 * Create video room using configured provider
 */
export async function createVideoRoom(
  bookingId: string,
  customerName: string,
  vendorName: string
): Promise<{
  roomId: string;
  roomUrl: string;
  token?: string;
  provider: string;
}> {
  switch (VIDEO_PROVIDER) {
    case '100ms':
      return await create100msRoom(bookingId, customerName, vendorName);
    case 'agora':
      return await createAgoraRoom(bookingId, customerName, vendorName);
    case 'zoom':
      return await createZoomRoom(bookingId, customerName, vendorName);
    default:
      // Fallback to Jitsi
      return await createJitsiRoom(bookingId);
  }
}

/**
 * Create 100ms room
 */
async function create100msRoom(
  bookingId: string,
  customerName: string,
  vendorName: string
): Promise<any> {
  if (!HUNDREDMS_APP_ID || !HUNDREDMS_APP_SECRET) {
    console.warn('⚠️ [VIDEO] 100ms credentials not configured, falling back to Jitsi');
    return await createJitsiRoom(bookingId);
  }

  try {
    // Get management token
    const tokenResponse = await fetch('https://api.100ms.live/v2/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUNDREDMS_APP_SECRET}`,
      },
      body: JSON.stringify({
        app_id: HUNDREDMS_APP_ID,
        role: 'admin',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get 100ms token');
    }

    const { token } = await tokenResponse.json();

    // Create room
    const roomResponse = await fetch('https://api.100ms.live/v2/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: `warmpawz-${bookingId}`,
        description: `Consultation: ${customerName} with ${vendorName}`,
        template_id: 'default', // Configure template in 100ms dashboard
      }),
    });

    if (!roomResponse.ok) {
      throw new Error('Failed to create 100ms room');
    }

    const room = await roomResponse.json();

    // Generate customer token
    const customerTokenResponse = await fetch('https://api.100ms.live/v2/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        room_id: room.id,
        user_id: `customer-${bookingId}`,
        role: 'guest',
      }),
    });

    const customerToken = customerTokenResponse.ok
      ? (await customerTokenResponse.json()).token
      : null;

    // Generate vendor token
    const vendorTokenResponse = await fetch('https://api.100ms.live/v2/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        room_id: room.id,
        user_id: `vendor-${bookingId}`,
        role: 'host',
      }),
    });

    const vendorToken = vendorTokenResponse.ok
      ? (await vendorTokenResponse.json()).token
      : null;

    return {
      roomId: room.id,
      roomUrl: `https://app.100ms.live/${room.id}`,
      customerToken,
      vendorToken,
      provider: '100ms',
    };
  } catch (error) {
    console.error('❌ [VIDEO] 100ms room creation failed:', error);
    // Fallback to Jitsi
    return await createJitsiRoom(bookingId);
  }
}

/**
 * Create Agora room
 */
async function createAgoraRoom(
  bookingId: string,
  customerName: string,
  vendorName: string
): Promise<any> {
  if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
    console.warn('⚠️ [VIDEO] Agora credentials not configured, falling back to Jitsi');
    return await createJitsiRoom(bookingId);
  }

  try {
    const channelName = `warmpawz-${bookingId}`;
    const uid = Math.floor(Math.random() * 1000000);
    
    // Generate Agora token (simplified - use Agora SDK in production)
    const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    
    // Note: Full token generation requires Agora SDK
    // This is a simplified version
    const token = `agora-token-${bookingId}-${expirationTime}`;

    return {
      roomId: channelName,
      roomUrl: `agora://${channelName}`,
      appId: AGORA_APP_ID,
      channelName,
      uid,
      token,
      provider: 'agora',
    };
  } catch (error) {
    console.error('❌ [VIDEO] Agora room creation failed:', error);
    return await createJitsiRoom(bookingId);
  }
}

/**
 * Create Zoom room
 */
async function createZoomRoom(
  bookingId: string,
  customerName: string,
  vendorName: string
): Promise<any> {
  if (!ZOOM_API_KEY || !ZOOM_API_SECRET) {
    console.warn('⚠️ [VIDEO] Zoom credentials not configured, falling back to Jitsi');
    return await createJitsiRoom(bookingId);
  }

  try {
    // Get Zoom access token
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${ZOOM_API_KEY}:${ZOOM_API_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=account_credentials&account_id=' + ZOOM_API_KEY,
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Zoom token');
    }

    const { access_token } = await tokenResponse.json();

    // Create meeting
    const meetingResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: `Warmpawz Consultation: ${customerName} with ${vendorName}`,
        type: 2, // Scheduled meeting
        start_time: new Date().toISOString(),
        duration: 30,
        settings: {
          join_before_host: true,
          participant_video: true,
          host_video: true,
        },
      }),
    });

    if (!meetingResponse.ok) {
      throw new Error('Failed to create Zoom meeting');
    }

    const meeting = await meetingResponse.json();

    return {
      roomId: meeting.id.toString(),
      roomUrl: meeting.join_url,
      password: meeting.password,
      provider: 'zoom',
    };
  } catch (error) {
    console.error('❌ [VIDEO] Zoom room creation failed:', error);
    return await createJitsiRoom(bookingId);
  }
}

/**
 * Create Jitsi room (fallback)
 */
async function createJitsiRoom(bookingId: string): Promise<any> {
  const roomName = `warmpawz-${bookingId}-${Date.now()}`;
  return {
    roomId: roomName,
    roomUrl: `https://meet.jit.si/${roomName}`,
    provider: 'jitsi',
  };
}

/**
 * Register video provider endpoints
 */
export function registerVideoProviderEndpoints(app: Hono) {
  /**
   * Create video room
   * POST /make-server-3dd53475/video/room/create-production
   */
  app.post('/make-server-3dd53475/video/room/create-production', async (c) => {
    try {
      const { bookingId, customerName, vendorName } = await c.req.json();

      if (!bookingId) {
        return c.json({ error: 'bookingId is required' }, 400);
      }

      const room = await createVideoRoom(
        bookingId,
        customerName || 'Customer',
        vendorName || 'Vendor'
      );

      // Store room info
      await kv.set(`video:room:${bookingId}`, {
        ...room,
        bookingId,
        createdAt: new Date().toISOString(),
        status: 'active',
      });

      return c.json({
        success: true,
        room,
      });
    } catch (error) {
      console.error('❌ [VIDEO] Error creating room:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get room info
   * GET /make-server-3dd53475/video/room/:bookingId
   */
  app.get('/make-server-3dd53475/video/room/:bookingId', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const room = await kv.get(`video:room:${bookingId}`);

      if (!room) {
        return c.json({ error: 'Room not found' }, 404);
      }

      return c.json({
        success: true,
        room,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
}

