// ✅ SQL-ONLY: Deliveries Repository
// NO KV STORE USAGE

import { getDbClient } from "../db.ts";

export interface Delivery {
  id: string;
  order_id: string;
  customer_id: string;
  vendor_id: string;
  nutritionist_id?: string;
  items: Array<{
    mealPlanId?: string;
    productId?: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_contact_name: string;
  dropoff_contact_phone: string;
  distance_km?: number;
  estimated_duration_minutes?: number;
  delivery_fee: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled';
  delivery_partner_id?: string;
  delivery_partner_name?: string;
  delivery_partner_phone?: string;
  current_lat?: number;
  current_lng?: number;
  current_location_timestamp?: string;
  ordered_at: string;
  confirmed_at?: string;
  prepared_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
  pickup_otp?: string;
  delivery_otp?: string;
  instructions?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export function getDeliveriesRepository() {
  const db = getDbClient();

  return {
    async findById(id: string): Promise<Delivery | null> {
      const result = await db.queryObject<Delivery>(
        `SELECT * FROM deliveries WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async findByCustomer(customerId: string): Promise<Delivery[]> {
      const result = await db.queryObject<Delivery>(
        `SELECT * FROM deliveries WHERE customer_id = $1 ORDER BY ordered_at DESC`,
        [customerId]
      );
      return result.rows;
    },

    async findByVendor(vendorId: string): Promise<Delivery[]> {
      const result = await db.queryObject<Delivery>(
        `SELECT * FROM deliveries WHERE vendor_id = $1 ORDER BY ordered_at DESC`,
        [vendorId]
      );
      return result.rows;
    },

    async findByDeliveryPartner(partnerId: string): Promise<Delivery[]> {
      const result = await db.queryObject<Delivery>(
        `SELECT * FROM deliveries WHERE delivery_partner_id = $1 AND status NOT IN ('delivered', 'cancelled') ORDER BY ordered_at DESC`,
        [partnerId]
      );
      return result.rows;
    },

    async findByStatus(status: string): Promise<Delivery[]> {
      const result = await db.queryObject<Delivery>(
        `SELECT * FROM deliveries WHERE status = $1 ORDER BY ordered_at DESC`,
        [status]
      );
      return result.rows;
    },

    async create(delivery: Omit<Delivery, 'id' | 'created_at' | 'updated_at'>): Promise<Delivery> {
      const result = await db.queryObject<Delivery>(
        `INSERT INTO deliveries (
          order_id, customer_id, vendor_id, nutritionist_id, items,
          pickup_address, pickup_lat, pickup_lng, pickup_contact_name, pickup_contact_phone,
          dropoff_address, dropoff_lat, dropoff_lng, dropoff_contact_name, dropoff_contact_phone,
          distance_km, estimated_duration_minutes, delivery_fee, status,
          delivery_partner_id, delivery_partner_name, delivery_partner_phone,
          current_lat, current_lng, current_location_timestamp,
          ordered_at, confirmed_at, prepared_at, picked_up_at, delivered_at,
          pickup_otp, delivery_otp, instructions, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
        ) RETURNING *`,
        [
          delivery.order_id,
          delivery.customer_id,
          delivery.vendor_id,
          delivery.nutritionist_id || null,
          JSON.stringify(delivery.items),
          delivery.pickup_address,
          delivery.pickup_lat,
          delivery.pickup_lng,
          delivery.pickup_contact_name,
          delivery.pickup_contact_phone,
          delivery.dropoff_address,
          delivery.dropoff_lat,
          delivery.dropoff_lng,
          delivery.dropoff_contact_name,
          delivery.dropoff_contact_phone,
          delivery.distance_km || null,
          delivery.estimated_duration_minutes || null,
          delivery.delivery_fee || 0,
          delivery.status || 'pending',
          delivery.delivery_partner_id || null,
          delivery.delivery_partner_name || null,
          delivery.delivery_partner_phone || null,
          delivery.current_lat || null,
          delivery.current_lng || null,
          delivery.current_location_timestamp || null,
          delivery.ordered_at || new Date().toISOString(),
          delivery.confirmed_at || null,
          delivery.prepared_at || null,
          delivery.picked_up_at || null,
          delivery.delivered_at || null,
          delivery.pickup_otp || null,
          delivery.delivery_otp || null,
          delivery.instructions || null,
          delivery.notes || null
        ]
      );
      return result.rows[0];
    },

    async update(id: string, updates: Partial<Omit<Delivery, 'id' | 'created_at'>>): Promise<Delivery> {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      if (updates.delivery_partner_id !== undefined) {
        setClauses.push(`delivery_partner_id = $${paramIndex++}`);
        values.push(updates.delivery_partner_id);
      }
      if (updates.delivery_partner_name !== undefined) {
        setClauses.push(`delivery_partner_name = $${paramIndex++}`);
        values.push(updates.delivery_partner_name);
      }
      if (updates.delivery_partner_phone !== undefined) {
        setClauses.push(`delivery_partner_phone = $${paramIndex++}`);
        values.push(updates.delivery_partner_phone);
      }
      if (updates.current_lat !== undefined) {
        setClauses.push(`current_lat = $${paramIndex++}`);
        values.push(updates.current_lat);
      }
      if (updates.current_lng !== undefined) {
        setClauses.push(`current_lng = $${paramIndex++}`);
        values.push(updates.current_lng);
      }
      if (updates.current_location_timestamp !== undefined) {
        setClauses.push(`current_location_timestamp = $${paramIndex++}`);
        values.push(updates.current_location_timestamp);
      }
      if (updates.confirmed_at !== undefined) {
        setClauses.push(`confirmed_at = $${paramIndex++}`);
        values.push(updates.confirmed_at);
      }
      if (updates.prepared_at !== undefined) {
        setClauses.push(`prepared_at = $${paramIndex++}`);
        values.push(updates.prepared_at);
      }
      if (updates.picked_up_at !== undefined) {
        setClauses.push(`picked_up_at = $${paramIndex++}`);
        values.push(updates.picked_up_at);
      }
      if (updates.delivered_at !== undefined) {
        setClauses.push(`delivered_at = $${paramIndex++}`);
        values.push(updates.delivered_at);
      }
      if (updates.pickup_otp !== undefined) {
        setClauses.push(`pickup_otp = $${paramIndex++}`);
        values.push(updates.pickup_otp);
      }
      if (updates.delivery_otp !== undefined) {
        setClauses.push(`delivery_otp = $${paramIndex++}`);
        values.push(updates.delivery_otp);
      }
      if (updates.instructions !== undefined) {
        setClauses.push(`instructions = $${paramIndex++}`);
        values.push(updates.instructions);
      }
      if (updates.notes !== undefined) {
        setClauses.push(`notes = $${paramIndex++}`);
        values.push(updates.notes);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const result = await db.queryObject<Delivery>(
        `UPDATE deliveries SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      return result.rows[0];
    },

    async findAll(): Promise<Delivery[]> {
      const result = await db.queryObject<Delivery>(
        `SELECT * FROM deliveries ORDER BY ordered_at DESC`
      );
      return result.rows;
    }
  };
}

