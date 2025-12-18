/**
 * Complete Ambulance Service
 * Full booking flow with tracking
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { autoAssignDeliveryPartner } from './delivery-assignment-utils.tsx';
import { calculateDistance } from './schedule-utils.tsx';

export function registerAmbulanceServiceComplete(app: Hono) {
  /**
   * Create ambulance booking
   * POST /make-server-3dd53475/ambulance/booking
   */
  app.post('/make-server-3dd53475/ambulance/booking', async (c) => {
    try {
      const {
        customerId,
        customerPhone,
        petId,
        petName,
        emergencyType,
        location,
        destination,
        urgency,
        notes,
      } = await c.req.json();

      if (!customerPhone || !location) {
        return c.json({ error: 'Customer phone and location are required' }, 400);
      }

      // Find nearest available ambulance
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      const ambulances = allVendors.filter((v: any) => {
        if (v.status !== 'approved' || !v.isActive) return false;
        if (v.roleId !== 'pet_ambulance' && v.role !== 'pet_ambulance') return false;
        return true;
      });

      if (ambulances.length === 0) {
        return c.json({ error: 'No ambulance available' }, 404);
      }

      // Find nearest ambulance
      let nearestAmbulance = null;
      let minDistance = Infinity;

      for (const ambulance of ambulances) {
        if (ambulance.latitude && ambulance.longitude && location.lat && location.lng) {
          const distance = calculateDistance(
            location.lat,
            location.lng,
            ambulance.latitude,
            ambulance.longitude
          );

          if (distance < minDistance) {
            minDistance = distance;
            nearestAmbulance = ambulance;
          }
        }
      }

      if (!nearestAmbulance) {
        // Fallback to first available
        nearestAmbulance = ambulances[0];
      }

      // Create booking
      const bookingId = `ambulance_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const booking = {
        id: bookingId,
        customerId: customerId || null,
        customerPhone,
        petId: petId || null,
        petName: petName || null,
        vendorId: nearestAmbulance.id,
        vendorName: nearestAmbulance.businessName || nearestAmbulance.name,
        serviceType: 'ambulance',
        serviceName: 'Pet Ambulance',
        emergencyType: emergencyType || 'general',
        urgency: urgency || 'high',
        pickupLocation: location,
        destinationLocation: destination || null,
        notes: notes || '',
        status: 'pending',
        paymentStatus: 'pending',
        amount: 0, // To be determined
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`booking:${bookingId}`, booking);

      // Create GPS tracking session
      const trackingSessionId = `track_${bookingId}`;
      const trackingSession = {
        id: trackingSessionId,
        bookingId,
        ambulanceId: nearestAmbulance.id,
        customerId: customerId || customerPhone,
        status: 'dispatched',
        pickupLocation: location,
        destinationLocation: destination,
        currentLocation: nearestAmbulance.latitude && nearestAmbulance.longitude
          ? { lat: nearestAmbulance.latitude, lng: nearestAmbulance.longitude }
          : location,
        route: [],
        distance: 0,
        startTime: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
      };

      await kv.set(`session:tracking:${trackingSessionId}`, trackingSession);
      booking.trackingSessionId = trackingSessionId;
      booking.trackingActive = true;
      await kv.set(`booking:${bookingId}`, booking);

      // Send notifications
      try {
        const { triggerBookingNotification } = await import('./sms-notification-service-enhanced.tsx');
        const customer = await kv.get(`customer:${customerPhone}`);
        if (triggerBookingNotification && customer) {
          await triggerBookingNotification(kv, 'ambulance.dispatched', {
            booking,
            customer,
            ambulanceName: nearestAmbulance.businessName,
            estimatedArrival: '15-20 minutes',
          });
        }
      } catch (notifError) {
        console.error('Failed to send ambulance notification:', notifError);
      }

      return c.json({
        success: true,
        booking,
        trackingSessionId,
        ambulance: {
          id: nearestAmbulance.id,
          name: nearestAmbulance.businessName || nearestAmbulance.name,
          phone: nearestAmbulance.phone,
        },
      });
    } catch (error) {
      console.error('❌ [AMBULANCE] Error creating booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get ambulance tracking
   * GET /make-server-3dd53475/ambulance/booking/:bookingId/tracking
   */
  app.get('/make-server-3dd53475/ambulance/booking/:bookingId/tracking', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const booking = await kv.get(`booking:${bookingId}`);

      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (!booking.trackingSessionId) {
        return c.json({ error: 'Tracking not available' }, 404);
      }

      const trackingSession = await kv.get(`session:tracking:${booking.trackingSessionId}`);

      if (!trackingSession) {
        return c.json({ error: 'Tracking session not found' }, 404);
      }

      return c.json({
        success: true,
        tracking: trackingSession,
        booking,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
}

