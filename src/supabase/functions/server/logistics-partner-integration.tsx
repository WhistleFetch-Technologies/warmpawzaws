import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 🚚 LOGISTICS PARTNER INTEGRATION
 * 
 * Phase 7C: Integrated Services - Rule 6 Implementation
 * 
 * Features:
 * - Logistics partner management
 * - Order assignment to delivery partners
 * - Real-time tracking
 * - Partner availability management
 */

interface LogisticsPartner {
  partnerId: string;
  partnerName: string;
  vehicleType: 'bike' | 'car' | 'ambulance' | 'van';
  vehicleNumber: string;
  currentLocation?: { lat: number; lng: number };
  isAvailable: boolean;
  assignedOrders: string[];
  rating: number;
  totalDeliveries: number;
  contactInfo: {
    phone: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface OrderAssignment {
  assignmentId: string;
  orderId: string;
  partnerId: string;
  assignedAt: string;
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  pickupLocation: { lat: number; lng: number; address: string };
  deliveryLocation: { lat: number; lng: number; address: string };
  estimatedTime: number;
  actualTime?: number;
  trackingUpdates: Array<{
    timestamp: string;
    location: { lat: number; lng: number };
    status: string;
  }>;
}

export function logisticsPartnerIntegrationEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // REGISTER LOGISTICS PARTNER
  // ========================================
  app.post(`${BASE_PATH}/integrated-services/logistics/register`, async (c) => {
    try {
      const {
        partnerName,
        vehicleType,
        vehicleNumber,
        contactInfo,
      } = await c.req.json();

      if (!partnerName || !vehicleType || !vehicleNumber || !contactInfo) {
        return sendError(c, 'Required fields missing', 400);
      }

      const validVehicleTypes = ['bike', 'car', 'ambulance', 'van'];
      if (!validVehicleTypes.includes(vehicleType)) {
        return sendError(c, `Invalid vehicle type. Must be one of: ${validVehicleTypes.join(', ')}`, 400);
      }

      const partnerId = `logistics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const partner: LogisticsPartner = {
        partnerId,
        partnerName,
        vehicleType,
        vehicleNumber,
        isAvailable: true,
        assignedOrders: [],
        rating: 0,
        totalDeliveries: 0,
        contactInfo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`logistics_partner_${partnerId}`, partner);

      // Add to availability index
      const availablePartners = await kv.get('logistics_available_partners') || [];
      availablePartners.push(partnerId);
      await kv.set('logistics_available_partners', availablePartners);

      console.log(`✅ Logistics partner registered: ${partnerId}`);

      return sendSuccess(c, { partner }, 'Logistics partner registered successfully');
    } catch (error) {
      console.error('Error registering logistics partner:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // NOTIFY LOGISTICS PARTNER
  // ========================================
  app.post(`${BASE_PATH}/integrated-services/logistics/notify`, async (c) => {
    try {
      const {
        partnerId,
        orderId,
        pickupLocation,
        deliveryLocation,
        estimatedTime,
      } = await c.req.json();

      if (!partnerId || !orderId || !pickupLocation || !deliveryLocation) {
        return sendError(c, 'Required fields missing', 400);
      }

      const partner = await kv.get(`logistics_partner_${partnerId}`);

      if (!partner) {
        return sendError(c, 'Logistics partner not found', 404);
      }

      // Create notification
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const notification = {
        notificationId,
        partnerId,
        orderId,
        type: 'new_order',
        pickupLocation,
        deliveryLocation,
        estimatedTime,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await kv.set(`logistics_notification_${notificationId}`, notification);

      // Add to partner's notifications
      const partnerNotifications = await kv.get(`partner_notifications_${partnerId}`) || [];
      partnerNotifications.push(notificationId);
      await kv.set(`partner_notifications_${partnerId}`, partnerNotifications);

      console.log(`✅ Notification sent to partner ${partnerId} for order ${orderId}`);

      return sendSuccess(c, { notification }, 'Logistics partner notified successfully');
    } catch (error) {
      console.error('Error notifying logistics partner:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET LOGISTICS PARTNER
  // ========================================
  app.get(`${BASE_PATH}/integrated-services/logistics/partner/:partnerId`, async (c) => {
    try {
      const partnerId = c.req.param('partnerId');

      const partner = await kv.get(`logistics_partner_${partnerId}`);

      if (!partner) {
        return sendError(c, 'Logistics partner not found', 404);
      }

      return sendSuccess(c, { partner });
    } catch (error) {
      console.error('Error getting logistics partner:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // UPDATE PARTNER STATUS
  // ========================================
  app.put(`${BASE_PATH}/integrated-services/logistics/partner/:partnerId/status`, async (c) => {
    try {
      const partnerId = c.req.param('partnerId');
      const { isAvailable, currentLocation } = await c.req.json();

      const partner = await kv.get(`logistics_partner_${partnerId}`);

      if (!partner) {
        return sendError(c, 'Logistics partner not found', 404);
      }

      if (isAvailable !== undefined) {
        partner.isAvailable = isAvailable;

        // Update availability index
        const availablePartners = await kv.get('logistics_available_partners') || [];
        
        if (isAvailable && !availablePartners.includes(partnerId)) {
          availablePartners.push(partnerId);
        } else if (!isAvailable) {
          const index = availablePartners.indexOf(partnerId);
          if (index > -1) {
            availablePartners.splice(index, 1);
          }
        }
        
        await kv.set('logistics_available_partners', availablePartners);
      }

      if (currentLocation) {
        partner.currentLocation = currentLocation;
      }

      partner.updatedAt = new Date().toISOString();

      await kv.set(`logistics_partner_${partnerId}`, partner);

      console.log(`✅ Partner status updated: ${partnerId}`);

      return sendSuccess(c, { partner }, 'Partner status updated successfully');
    } catch (error) {
      console.error('Error updating partner status:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // ASSIGN ORDER TO PARTNER
  // ========================================
  app.post(`${BASE_PATH}/integrated-services/logistics/assign`, async (c) => {
    try {
      const {
        orderId,
        partnerId,
        pickupLocation,
        deliveryLocation,
        estimatedTime,
      } = await c.req.json();

      if (!orderId || !partnerId || !pickupLocation || !deliveryLocation) {
        return sendError(c, 'Required fields missing', 400);
      }

      const partner = await kv.get(`logistics_partner_${partnerId}`);

      if (!partner) {
        return sendError(c, 'Logistics partner not found', 404);
      }

      if (!partner.isAvailable) {
        return sendError(c, 'Partner is not available', 400);
      }

      const assignmentId = `assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const assignment: OrderAssignment = {
        assignmentId,
        orderId,
        partnerId,
        assignedAt: new Date().toISOString(),
        status: 'assigned',
        pickupLocation,
        deliveryLocation,
        estimatedTime: estimatedTime || 30,
        trackingUpdates: [{
          timestamp: new Date().toISOString(),
          location: partner.currentLocation || pickupLocation,
          status: 'assigned',
        }],
      };

      await kv.set(`order_assignment_${assignmentId}`, assignment);
      await kv.set(`order_assignment_by_order_${orderId}`, assignmentId);

      // Update partner
      partner.assignedOrders.push(orderId);
      partner.isAvailable = false; // Mark as busy
      partner.updatedAt = new Date().toISOString();

      await kv.set(`logistics_partner_${partnerId}`, partner);

      // Remove from available partners
      const availablePartners = await kv.get('logistics_available_partners') || [];
      const index = availablePartners.indexOf(partnerId);
      if (index > -1) {
        availablePartners.splice(index, 1);
        await kv.set('logistics_available_partners', availablePartners);
      }

      console.log(`✅ Order ${orderId} assigned to partner ${partnerId}`);

      return sendSuccess(c, { assignment }, 'Order assigned successfully');
    } catch (error) {
      console.error('Error assigning order:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // TRACK ORDER
  // ========================================
  app.get(`${BASE_PATH}/integrated-services/logistics/track/:orderId`, async (c) => {
    try {
      const orderId = c.req.param('orderId');

      const assignmentId = await kv.get(`order_assignment_by_order_${orderId}`);

      if (!assignmentId) {
        return sendError(c, 'Order assignment not found', 404);
      }

      const assignment = await kv.get(`order_assignment_${assignmentId}`);

      if (!assignment) {
        return sendError(c, 'Assignment details not found', 404);
      }

      // Get partner details
      const partner = await kv.get(`logistics_partner_${assignment.partnerId}`);

      const tracking = {
        orderId,
        assignmentId,
        status: assignment.status,
        partner: partner ? {
          partnerId: partner.partnerId,
          partnerName: partner.partnerName,
          vehicleType: partner.vehicleType,
          vehicleNumber: partner.vehicleNumber,
          currentLocation: partner.currentLocation,
          contactInfo: partner.contactInfo,
        } : null,
        pickupLocation: assignment.pickupLocation,
        deliveryLocation: assignment.deliveryLocation,
        estimatedTime: assignment.estimatedTime,
        actualTime: assignment.actualTime,
        trackingUpdates: assignment.trackingUpdates,
      };

      return sendSuccess(c, { tracking });
    } catch (error) {
      console.error('Error tracking order:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // UPDATE TRACKING
  // ========================================
  app.post(`${BASE_PATH}/integrated-services/logistics/track/:orderId/update`, async (c) => {
    try {
      const orderId = c.req.param('orderId');
      const { location, status } = await c.req.json();

      const assignmentId = await kv.get(`order_assignment_by_order_${orderId}`);

      if (!assignmentId) {
        return sendError(c, 'Order assignment not found', 404);
      }

      const assignment = await kv.get(`order_assignment_${assignmentId}`);

      if (!assignment) {
        return sendError(c, 'Assignment details not found', 404);
      }

      // Add tracking update
      assignment.trackingUpdates.push({
        timestamp: new Date().toISOString(),
        location: location || assignment.trackingUpdates[assignment.trackingUpdates.length - 1].location,
        status: status || assignment.status,
      });

      if (status) {
        assignment.status = status;

        // If delivered or cancelled, mark partner as available
        if (status === 'delivered' || status === 'cancelled') {
          const partner = await kv.get(`logistics_partner_${assignment.partnerId}`);
          if (partner) {
            partner.assignedOrders = partner.assignedOrders.filter((id: string) => id !== orderId);
            partner.isAvailable = true;
            
            if (status === 'delivered') {
              partner.totalDeliveries += 1;
            }
            
            partner.updatedAt = new Date().toISOString();
            await kv.set(`logistics_partner_${assignment.partnerId}`, partner);

            // Add back to available partners
            const availablePartners = await kv.get('logistics_available_partners') || [];
            if (!availablePartners.includes(assignment.partnerId)) {
              availablePartners.push(assignment.partnerId);
              await kv.set('logistics_available_partners', availablePartners);
            }
          }
        }
      }

      await kv.set(`order_assignment_${assignmentId}`, assignment);

      console.log(`✅ Tracking updated for order ${orderId}: ${status || 'location update'}`);

      return sendSuccess(c, { assignment }, 'Tracking updated successfully');
    } catch (error) {
      console.error('Error updating tracking:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Logistics Partner Integration endpoints registered');
}
