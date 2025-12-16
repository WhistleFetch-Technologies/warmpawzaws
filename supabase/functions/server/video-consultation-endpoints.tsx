import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

export function registerVideoConsultationEndpoints(app: Hono) {

  /**
   * POST /make-server-3dd53475/consultations/create
   * Initialize a video consultation
   */
  app.post("/make-server-3dd53475/consultations/create", async (c) => {
    try {
      const { vendorId, userId, serviceId, scheduledTime } = await c.req.json();
      
      const consultationId = `consult_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Generate a meeting link (Mock Jitsi for MVP)
      // In production, this would call 100ms, Agora, or Zoom API
      const roomName = `warmpawz-${consultationId}`;
      const meetingUrl = `https://meet.jit.si/${roomName}`;

      const consultation = {
        id: consultationId,
        vendorId,
        userId,
        serviceId,
        status: 'scheduled', // scheduled, active, completed, cancelled
        scheduledTime: scheduledTime || new Date().toISOString(),
        meetingUrl,
        roomName,
        createdAt: new Date().toISOString()
      };

      await kv.set(`consultation:${consultationId}`, consultation);
      
      // Notify Vendor (Add to their queue)
      const vendorQueueKey = `vendor:${vendorId}:consultations`;
      const vendorQueue = await kv.get(vendorQueueKey) || [];
      vendorQueue.push(consultationId);
      await kv.set(vendorQueueKey, vendorQueue);

      // Add to User History
      const userQueueKey = `user:${userId}:consultations`;
      const userQueue = await kv.get(userQueueKey) || [];
      userQueue.push(consultationId);
      await kv.set(userQueueKey, userQueue);

      return c.json({ success: true, consultation });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/consultations/:consultationId
   * Get details and join link
   */
  app.get("/make-server-3dd53475/consultations/:consultationId", async (c) => {
    try {
      const { consultationId } = c.req.param();
      const consultation = await kv.get(`consultation:${consultationId}`);
      
      if (!consultation) return c.json({ error: 'Consultation not found' }, 404);

      return c.json({ success: true, consultation });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/consultations/:consultationId/start
   * Vendor starts the call
   */
  app.post("/make-server-3dd53475/consultations/:consultationId/start", async (c) => {
    try {
      const { consultationId } = c.req.param();
      const consultation = await kv.get(`consultation:${consultationId}`);
      
      if (!consultation) return c.json({ error: 'Consultation not found' }, 404);

      consultation.status = 'active';
      consultation.startedAt = new Date().toISOString();
      
      await kv.set(`consultation:${consultationId}`, consultation);

      return c.json({ success: true, consultation });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/consultations/:consultationId/end
   * End the call
   */
  app.post("/make-server-3dd53475/consultations/:consultationId/end", async (c) => {
    try {
      const { consultationId } = c.req.param();
      const consultation = await kv.get(`consultation:${consultationId}`);
      
      if (!consultation) return c.json({ error: 'Consultation not found' }, 404);

      consultation.status = 'completed';
      consultation.endedAt = new Date().toISOString();
      
      // Calculate duration
      if (consultation.startedAt) {
        const start = new Date(consultation.startedAt).getTime();
        const end = new Date().getTime();
        consultation.durationSeconds = Math.floor((end - start) / 1000);
      }

      await kv.set(`consultation:${consultationId}`, consultation);

      return c.json({ success: true, consultation });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/consultations/instant-request
   * Request an immediate consultation
   */
  app.post("/make-server-3dd53475/consultations/instant-request", async (c) => {
    try {
      const { vendorId, userId, serviceId, petId } = await c.req.json();
      
      const consultationId = `consult_instant_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create instant consultation request
      const consultation = {
        id: consultationId,
        vendorId,
        userId,
        serviceId,
        petId,
        type: 'instant',
        status: 'pending_acceptance', // Waiting for vendor
        requestedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      await kv.set(`consultation:${consultationId}`, consultation);
      
      // Notify Vendor (High Priority)
      const notificationId = `notif_consult_${Date.now()}`;
      const notification = {
        type: 'instant_consultation_request',
        title: '🔥 Instant Video Consultation Request',
        message: 'A customer is requesting an immediate video call.',
        consultationId,
        vendorId,
        createdAt: new Date().toISOString(),
        read: false
      };
      
      await kv.set(`notification:${notificationId}`, notification);
      const vendorNotifications = await kv.get(`vendor:${vendorId}:notifications`) || [];
      vendorNotifications.unshift(notificationId);
      await kv.set(`vendor:${vendorId}:notifications`, vendorNotifications);

      return c.json({ success: true, consultation, message: 'Request sent to vendor' });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/consultations/:consultationId/accept
   * Vendor accepts instant request
   */
  app.post("/make-server-3dd53475/consultations/:consultationId/accept", async (c) => {
    try {
      const { consultationId } = c.req.param();
      const consultation = await kv.get(`consultation:${consultationId}`);
      
      if (!consultation) return c.json({ error: 'Consultation not found' }, 404);
      
      // Generate Meeting Link
      const roomName = `warmpawz-${consultationId}`;
      const meetingUrl = `https://meet.jit.si/${roomName}`;

      consultation.status = 'scheduled'; // Ready to start
      consultation.acceptedAt = new Date().toISOString();
      consultation.meetingUrl = meetingUrl;
      consultation.roomName = roomName;
      
      await kv.set(`consultation:${consultationId}`, consultation);
      
      // Notify Customer
      const notificationId = `notif_consult_accept_${Date.now()}`;
      const notification = {
        type: 'consultation_accepted',
        title: '✅ Consultation Accepted',
        message: 'Your video consultation request was accepted. Join now!',
        consultationId,
        meetingUrl,
        createdAt: new Date().toISOString(),
        read: false
      };
      
      // Assuming we can find customer notification list via userId (needs user lookup or passed in)
      // For now, we'll just log it. In real app, look up user phone/id
      console.log(`✅ Consultation accepted. Notify User: ${consultation.userId}`);

      return c.json({ success: true, consultation });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/consultations/:consultationId/reject
   * Vendor rejects instant request
   */
  app.post("/make-server-3dd53475/consultations/:consultationId/reject", async (c) => {
    try {
      const { consultationId } = c.req.param();
      const { reason } = await c.req.json();
      
      const consultation = await kv.get(`consultation:${consultationId}`);
      if (!consultation) return c.json({ error: 'Consultation not found' }, 404);
      
      consultation.status = 'rejected';
      consultation.rejectedAt = new Date().toISOString();
      consultation.rejectionReason = reason;
      
      await kv.set(`consultation:${consultationId}`, consultation);
      
      return c.json({ success: true, consultation });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
}