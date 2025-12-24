/**
 * ============================================================================
 * DELIVERY INTEGRATION REPOSITORY
 * ============================================================================
 * 
 * Repository for delivery partner management, deliveries, and route optimization.
 * Replaces: delivery:partner:{partnerId}, delivery:{deliveryId}, 
 *           delivery:route:{routeId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface DeliveryPartner {
  id: string;
  partner_id: string;
  vendor_id: string;
  name: string;
  phone: string;
  vehicle_type: 'bike' | 'scooter' | 'car' | 'van';
  vehicle_number: string;
  current_location: any;
  status: 'available' | 'on_delivery' | 'offline';
  rating: number;
  total_deliveries: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDeliveryPartnerInput {
  partner_id: string;
  vendor_id: string;
  name: string;
  phone: string;
  vehicle_type: 'bike' | 'scooter' | 'car' | 'van';
  vehicle_number: string;
  current_location?: any;
  status?: 'available' | 'on_delivery' | 'offline';
  rating?: number;
  total_deliveries?: number;
  is_active?: boolean;
}

export interface UpdateDeliveryPartnerInput {
  current_location?: any;
  status?: 'available' | 'on_delivery' | 'offline';
  rating?: number;
  total_deliveries?: number;
  is_active?: boolean;
}

export interface Delivery {
  id: string;
  delivery_id: string;
  order_id: string;
  order_type: 'meal_plan' | 'supplement' | 'product';
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  pickup_location: any;
  drop_location: any;
  partner_id?: string | null;
  partner_name?: string | null;
  partner_phone?: string | null;
  status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  scheduled_date: string;
  scheduled_time: string;
  assigned_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  estimated_distance?: number | null;
  estimated_time?: number | null;
  actual_distance?: number | null;
  actual_time?: number | null;
  delivery_fee: number;
  route?: any[] | null;
  proof_of_delivery?: any | null;
  failure_reason?: string | null;
  rating?: number | null;
  feedback?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDeliveryInput {
  delivery_id: string;
  order_id: string;
  order_type?: 'meal_plan' | 'supplement' | 'product';
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  pickup_location: any;
  drop_location: any;
  partner_id?: string;
  partner_name?: string;
  partner_phone?: string;
  status?: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  scheduled_date: string;
  scheduled_time: string;
  estimated_distance?: number;
  estimated_time?: number;
  delivery_fee?: number;
}

export interface UpdateDeliveryInput {
  status?: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  partner_id?: string;
  partner_name?: string;
  partner_phone?: string;
  assigned_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
  actual_distance?: number;
  actual_time?: number;
  route?: any[];
  proof_of_delivery?: any;
  failure_reason?: string;
  rating?: number;
  feedback?: string;
}

export interface DeliveryRoute {
  id: string;
  route_id: string;
  partner_id?: string | null;
  deliveries: string[];
  optimized_order: any[];
  total_distance: number;
  total_time: number;
  status: 'planned' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface CreateDeliveryRouteInput {
  route_id: string;
  partner_id?: string;
  deliveries: string[];
  optimized_order: any[];
  total_distance: number;
  total_time: number;
  status?: 'planned' | 'in_progress' | 'completed';
}

// ============================================================================
// REPOSITORY
// ============================================================================

export function getDeliveryIntegrationRepository() {
  const client = getDbClient();

  return {
    // ========================================================================
    // DELIVERY PARTNERS
    // ========================================================================

    async createDeliveryPartner(input: CreateDeliveryPartnerInput): Promise<DeliveryPartner> {
      const { data, error } = await client
        .from('delivery_partners')
        .insert({
          partner_id: input.partner_id,
          vendor_id: input.vendor_id,
          name: input.name,
          phone: input.phone,
          vehicle_type: input.vehicle_type,
          vehicle_number: input.vehicle_number,
          current_location: input.current_location || { lat: 0, lng: 0, lastUpdated: new Date().toISOString() },
          status: input.status || 'available',
          rating: input.rating || 5.0,
          total_deliveries: input.total_deliveries || 0,
          is_active: input.is_active !== undefined ? input.is_active : true
        })
        .select()
        .single();

      if (error) throw error;
      return data as DeliveryPartner;
    },

    async getDeliveryPartnerByPartnerId(partnerId: string): Promise<DeliveryPartner | null> {
      const { data, error } = await client
        .from('delivery_partners')
        .select('*')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (error) throw error;
      return data as DeliveryPartner | null;
    },

    async getAvailableDeliveryPartners(): Promise<DeliveryPartner[]> {
      const { data, error } = await client
        .from('delivery_partners')
        .select('*')
        .eq('status', 'available')
        .eq('is_active', true);

      if (error) throw error;
      return (data || []) as DeliveryPartner[];
    },

    async updateDeliveryPartner(partnerId: string, input: UpdateDeliveryPartnerInput): Promise<DeliveryPartner> {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (input.current_location !== undefined) updateData.current_location = input.current_location;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.rating !== undefined) updateData.rating = input.rating;
      if (input.total_deliveries !== undefined) updateData.total_deliveries = input.total_deliveries;
      if (input.is_active !== undefined) updateData.is_active = input.is_active;

      const { data, error } = await client
        .from('delivery_partners')
        .update(updateData)
        .eq('partner_id', partnerId)
        .select()
        .single();

      if (error) throw error;
      return data as DeliveryPartner;
    },

    // ========================================================================
    // DELIVERIES
    // ========================================================================

    async createDelivery(input: CreateDeliveryInput): Promise<Delivery> {
      const { data, error } = await client
        .from('deliveries')
        .insert({
          delivery_id: input.delivery_id,
          order_id: input.order_id,
          order_type: input.order_type || 'product',
          customer_id: input.customer_id,
          customer_name: input.customer_name,
          customer_phone: input.customer_phone,
          pickup_location: input.pickup_location || {},
          drop_location: input.drop_location || {},
          partner_id: input.partner_id,
          partner_name: input.partner_name,
          partner_phone: input.partner_phone,
          status: input.status || 'pending',
          scheduled_date: input.scheduled_date,
          scheduled_time: input.scheduled_time,
          estimated_distance: input.estimated_distance,
          estimated_time: input.estimated_time,
          delivery_fee: input.delivery_fee || 0
        })
        .select()
        .single();

      if (error) throw error;
      return data as Delivery;
    },

    async getDeliveryByDeliveryId(deliveryId: string): Promise<Delivery | null> {
      const { data, error } = await client
        .from('deliveries')
        .select('*')
        .eq('delivery_id', deliveryId)
        .maybeSingle();

      if (error) throw error;
      return data as Delivery | null;
    },

    async getDeliveriesByPartner(partnerId: string, status?: string): Promise<Delivery[]> {
      let query = client
        .from('deliveries')
        .select('*')
        .eq('partner_id', partnerId);

      if (status) {
        query = query.eq('status', status);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Delivery[];
    },

    async updateDelivery(deliveryId: string, input: UpdateDeliveryInput): Promise<Delivery> {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (input.status !== undefined) {
        updateData.status = input.status;
        // Set timestamp based on status
        if (input.status === 'assigned' && !input.assigned_at) {
          updateData.assigned_at = new Date().toISOString();
        }
        if (input.status === 'picked_up' && !input.picked_up_at) {
          updateData.picked_up_at = new Date().toISOString();
        }
        if (input.status === 'delivered' && !input.delivered_at) {
          updateData.delivered_at = new Date().toISOString();
        }
      }
      if (input.partner_id !== undefined) updateData.partner_id = input.partner_id;
      if (input.partner_name !== undefined) updateData.partner_name = input.partner_name;
      if (input.partner_phone !== undefined) updateData.partner_phone = input.partner_phone;
      if (input.assigned_at !== undefined) updateData.assigned_at = input.assigned_at;
      if (input.picked_up_at !== undefined) updateData.picked_up_at = input.picked_up_at;
      if (input.delivered_at !== undefined) updateData.delivered_at = input.delivered_at;
      if (input.actual_distance !== undefined) updateData.actual_distance = input.actual_distance;
      if (input.actual_time !== undefined) updateData.actual_time = input.actual_time;
      if (input.route !== undefined) updateData.route = input.route;
      if (input.proof_of_delivery !== undefined) updateData.proof_of_delivery = input.proof_of_delivery;
      if (input.failure_reason !== undefined) updateData.failure_reason = input.failure_reason;
      if (input.rating !== undefined) updateData.rating = input.rating;
      if (input.feedback !== undefined) updateData.feedback = input.feedback;

      const { data, error } = await client
        .from('deliveries')
        .update(updateData)
        .eq('delivery_id', deliveryId)
        .select()
        .single();

      if (error) throw error;
      return data as Delivery;
    },

    // ========================================================================
    // DELIVERY ROUTES
    // ========================================================================

    async createDeliveryRoute(input: CreateDeliveryRouteInput): Promise<DeliveryRoute> {
      const { data, error } = await client
        .from('delivery_routes')
        .insert({
          route_id: input.route_id,
          partner_id: input.partner_id,
          deliveries: input.deliveries,
          optimized_order: input.optimized_order,
          total_distance: input.total_distance,
          total_time: input.total_time,
          status: input.status || 'planned'
        })
        .select()
        .single();

      if (error) throw error;
      return data as DeliveryRoute;
    },

    async getDeliveryRouteByRouteId(routeId: string): Promise<DeliveryRoute | null> {
      const { data, error } = await client
        .from('delivery_routes')
        .select('*')
        .eq('route_id', routeId)
        .maybeSingle();

      if (error) throw error;
      return data as DeliveryRoute | null;
    }
  };
}

