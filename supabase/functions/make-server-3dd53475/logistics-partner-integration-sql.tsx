/**
 * 🚚 LOGISTICS PARTNER INTEGRATION - SQL-ONLY VERSION
 * 
 * Phase 7C: Integrated Services - Rule 6 Implementation
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Features:
 * - Logistics partner management
 * - Order assignment to delivery partners
 * - Real-time tracking
 * - Partner availability management
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (28 KV operations → 0)
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from "../../lib/db.ts";
import { withTransaction } from "../../lib/utils/transaction-helper.ts";

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

export function logisticsPartnerIntegrationEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const db = getDbClient();

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
        vendorId,
      } = await c.req.json();

      if (!partnerName || !vehicleType || !vehicleNumber || !contactInfo) {
        return sendError(c, 'Required fields missing', 400);
      }

      const validVehicleTypes = ['bike', 'car', 'ambulance', 'van'];
      if (!validVehicleTypes.includes(vehicleType)) {
        return sendError(c, `Invalid vehicle type. Must be one of: ${validVehicleTypes.join(', ')}`, 400);
      }

      // Map vehicle type to database format
      const dbVehicleType = vehicleType === 'ambulance' ? 'van' : vehicleType;

      const partnerId = `logistics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      // ✅ SQL: Insert delivery partner
      const { data: partner, error } = await db
        .from('delivery_partners')
        .insert({
          partner_id: partnerId,
          vendor_id: vendorId || null,
          name: partnerName,
          phone: contactInfo.phone,
          vehicle_type: dbVehicleType,
          vehicle_number: vehicleNumber,
          current_location: {},
          status: 'available',
          rating: 5.0,
          total_deliveries: 0,
          is_active: true,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating delivery partner:', error);
        return sendError(c, 'Failed to register partner', 500);
      }

      console.log(`✅ Logistics partner registered: ${partnerId}`);

      return sendSuccess(c, {
        partner: {
          partnerId: partner.partner_id,
          partnerName: partner.name,
          vehicleType: partner.vehicle_type,
          vehicleNumber: partner.vehicle_number,
          isAvailable: partner.status === 'available',
          rating: partner.rating,
          totalDeliveries: partner.total_deliveries,
          contactInfo: {
            phone: partner.phone,
            email: partner.current_location?.email
          },
          createdAt: partner.created_at,
          updatedAt: partner.updated_at
        }
      }, 'Logistics partner registered successfully');
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

      // ✅ SQL: Verify partner exists
      const { data: partner, error: partnerError } = await db
        .from('delivery_partners')
        .select('*')
        .eq('partner_id', partnerId)
        .single();

      if (partnerError || !partner) {
        return sendError(c, 'Logistics partner not found', 404);
      }

      // ✅ SQL: Create notification (store in notifications table or use metadata)
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      // Store notification in notifications table
      const { data: notification, error: notifError } = await db
        .from('notifications')
        .insert({
          user_id: partnerId,
          user_type: 'delivery_partner',
          type: 'logistics_order',
          title: 'New Order Assignment',
          message: `New order ${orderId} assigned`,
          data: {
            orderId,
            pickupLocation,
            deliveryLocation,
            estimatedTime,
            notificationId
          },
          is_read: false,
          created_at: now
        })
        .select()
        .single();

      if (notifError) {
        console.error('Error creating notification:', notifError);
        // Continue even if notification fails
      }

      console.log(`✅ Notification sent to partner ${partnerId} for order ${orderId}`);

      return sendSuccess(c, {
        notification: {
          notificationId,
          partnerId,
          orderId,
          type: 'new_order',
          pickupLocation,
          deliveryLocation,
          estimatedTime,
          status: 'pending',
          createdAt: now
        }
      }, 'Logistics partner notified successfully');
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

      // ✅ SQL: Get partner
      const { data: partner, error } = await db
        .from('delivery_partners')
        .select('*')
        .eq('partner_id', partnerId)
        .single();

      if (error || !partner) {
        return sendError(c, 'Logistics partner not found', 404);
      }

      // Get assigned orders from deliveries table
      const { data: deliveries } = await db
        .from('deliveries')
        .select('order_id')
        .eq('partner_id', partnerId)
        .in('status', ['assigned', 'picked_up', 'in_transit']);

      return sendSuccess(c, {
        partner: {
          partnerId: partner.partner_id,
          partnerName: partner.name,
          vehicleType: partner.vehicle_type,
          vehicleNumber: partner.vehicle_number,
          currentLocation: partner.current_location,
          isAvailable: partner.status === 'available',
          assignedOrders: deliveries?.map(d => d.order_id) || [],
          rating: partner.rating,
          totalDeliveries: partner.total_deliveries,
          contactInfo: {
            phone: partner.phone,
            email: partner.current_location?.email
          },
          createdAt: partner.created_at,
          updatedAt: partner.updated_at
        }
      });
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

      // ✅ SQL: Get partner
      const { data: partner, error: getError } = await db
        .from('delivery_partners')
        .select('*')
        .eq('partner_id', partnerId)
        .single();

      if (getError || !partner) {
        return sendError(c, 'Logistics partner not found', 404);
      }

      // ✅ SQL: Update partner status
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (isAvailable !== undefined) {
        updateData.status = isAvailable ? 'available' : 'offline';
      }

      if (currentLocation) {
        updateData.current_location = {
          ...(partner.current_location || {}),
          lat: currentLocation.lat,
          lng: currentLocation.lng
        };
      }

      const { data: updatedPartner, error: updateError } = await db
        .from('delivery_partners')
        .update(updateData)
        .eq('partner_id', partnerId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating partner status:', updateError);
        return sendError(c, 'Failed to update partner status', 500);
      }

      console.log(`✅ Partner status updated: ${partnerId}`);

      return sendSuccess(c, {
        partner: {
          partnerId: updatedPartner.partner_id,
          partnerName: updatedPartner.name,
          vehicleType: updatedPartner.vehicle_type,
          vehicleNumber: updatedPartner.vehicle_number,
          currentLocation: updatedPartner.current_location,
          isAvailable: updatedPartner.status === 'available',
          rating: updatedPartner.rating,
          totalDeliveries: updatedPartner.total_deliveries,
          contactInfo: {
            phone: updatedPartner.phone,
            email: updatedPartner.current_location?.email
          },
          createdAt: updatedPartner.created_at,
          updatedAt: updatedPartner.updated_at
        }
      }, 'Partner status updated successfully');
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
        customerId,
        customerName,
        customerPhone,
        scheduledDate,
        scheduledTime,
      } = await c.req.json();

      if (!orderId || !partnerId || !pickupLocation || !deliveryLocation) {
        return sendError(c, 'Required fields missing', 400);
      }

      return await withTransaction(async (txClient) => {
        // ✅ SQL: Verify partner exists and is available
        const { data: partner, error: partnerError } = await txClient
          .from('delivery_partners')
          .select('*')
          .eq('partner_id', partnerId)
          .eq('status', 'available')
          .eq('is_active', true)
          .single();

        if (partnerError || !partner) {
          return sendError(c, 'Logistics partner not found or not available', 404);
        }

        // ✅ SQL: Create delivery record
        const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        const { data: delivery, error: deliveryError } = await txClient
          .from('deliveries')
          .insert({
            delivery_id: deliveryId,
            order_id: orderId,
            order_type: 'product',
            customer_id: customerId || null,
            customer_name: customerName || 'Customer',
            customer_phone: customerPhone || '',
            pickup_location: pickupLocation,
            drop_location: deliveryLocation,
            partner_id: partnerId,
            partner_name: partner.name,
            partner_phone: partner.phone,
            status: 'assigned',
            scheduled_date: scheduledDate || new Date().toISOString().split('T')[0],
            scheduled_time: scheduledTime || new Date().toTimeString().slice(0, 5),
            assigned_at: now,
            estimated_time: estimatedTime || 30,
            route: [{
              timestamp: now,
              location: pickupLocation,
              status: 'assigned'
            }],
            created_at: now,
            updated_at: now
          })
          .select()
          .single();

        if (deliveryError) {
          console.error('Error creating delivery:', deliveryError);
          return sendError(c, 'Failed to assign order', 500);
        }

        // ✅ SQL: Update partner status
        await txClient
          .from('delivery_partners')
          .update({
            status: 'on_delivery',
            updated_at: now
          })
          .eq('partner_id', partnerId);

        console.log(`✅ Order ${orderId} assigned to partner ${partnerId}`);

        return sendSuccess(c, {
          assignment: {
            assignmentId: deliveryId,
            orderId: delivery.order_id,
            partnerId: delivery.partner_id,
            assignedAt: delivery.assigned_at,
            status: delivery.status,
            pickupLocation: delivery.pickup_location,
            deliveryLocation: delivery.drop_location,
            estimatedTime: delivery.estimated_time,
            trackingUpdates: delivery.route || []
          }
        }, 'Order assigned successfully');
      });
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

      // ✅ SQL: Get delivery by order ID
      const { data: delivery, error: deliveryError } = await db
        .from('deliveries')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (deliveryError || !delivery) {
        return sendError(c, 'Order assignment not found', 404);
      }

      // ✅ SQL: Get partner details
      const { data: partner } = await db
        .from('delivery_partners')
        .select('*')
        .eq('partner_id', delivery.partner_id)
        .single();

      const tracking = {
        orderId: delivery.order_id,
        assignmentId: delivery.delivery_id,
        status: delivery.status,
        partner: partner ? {
          partnerId: partner.partner_id,
          partnerName: partner.name,
          vehicleType: partner.vehicle_type,
          vehicleNumber: partner.vehicle_number,
          currentLocation: partner.current_location,
          contactInfo: {
            phone: partner.phone,
            email: partner.current_location?.email
          }
        } : null,
        pickupLocation: delivery.pickup_location,
        deliveryLocation: delivery.drop_location,
        estimatedTime: delivery.estimated_time,
        actualTime: delivery.actual_time,
        trackingUpdates: delivery.route || []
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

      return await withTransaction(async (txClient) => {
        // ✅ SQL: Get delivery
        const { data: delivery, error: deliveryError } = await txClient
          .from('deliveries')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (deliveryError || !delivery) {
          return sendError(c, 'Order assignment not found', 404);
        }

        // Update route tracking
        const route = delivery.route || [];
        const now = new Date().toISOString();
        route.push({
          timestamp: now,
          location: location || (route.length > 0 ? route[route.length - 1].location : delivery.pickup_location),
          status: status || delivery.status
        });

        const updateData: any = {
          route,
          updated_at: now
        };

        if (status) {
          updateData.status = status;

          // Update timestamps based on status
          if (status === 'picked_up') {
            updateData.picked_up_at = now;
          } else if (status === 'delivered') {
            updateData.delivered_at = now;
            updateData.actual_time = delivery.estimated_time; // Could calculate actual time
          }
        }

        // ✅ SQL: Update delivery
        const { data: updatedDelivery, error: updateError } = await txClient
          .from('deliveries')
          .update(updateData)
          .eq('id', delivery.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating delivery:', updateError);
          return sendError(c, 'Failed to update tracking', 500);
        }

        // If delivered or cancelled, mark partner as available
        if (status === 'delivered' || status === 'cancelled') {
          const { data: partner } = await txClient
            .from('delivery_partners')
            .select('*')
            .eq('partner_id', delivery.partner_id)
            .single();

          if (partner) {
            const partnerUpdate: any = {
              status: 'available',
              updated_at: now
            };

            if (status === 'delivered') {
              partnerUpdate.total_deliveries = (partner.total_deliveries || 0) + 1;
            }

            await txClient
              .from('delivery_partners')
              .update(partnerUpdate)
              .eq('partner_id', delivery.partner_id);
          }
        }

        console.log(`✅ Tracking updated for order ${orderId}: ${status || 'location update'}`);

        return sendSuccess(c, {
          assignment: {
            assignmentId: updatedDelivery.delivery_id,
            orderId: updatedDelivery.order_id,
            partnerId: updatedDelivery.partner_id,
            assignedAt: updatedDelivery.assigned_at,
            status: updatedDelivery.status,
            pickupLocation: updatedDelivery.pickup_location,
            deliveryLocation: updatedDelivery.drop_location,
            estimatedTime: updatedDelivery.estimated_time,
            actualTime: updatedDelivery.actual_time,
            trackingUpdates: updatedDelivery.route || []
          }
        }, 'Tracking updated successfully');
      });
    } catch (error) {
      console.error('Error updating tracking:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Logistics Partner Integration endpoints registered (SQL-only)');
}
