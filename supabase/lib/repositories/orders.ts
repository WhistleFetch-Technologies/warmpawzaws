/**
 * ============================================================================
 * ORDERS REPOSITORY
 * ============================================================================
 * 
 * Repository for ecommerce orders management.
 * Replaces: order:{id} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Order {
  id: string;
  customer_id: string;
  vendor_id?: string | null;
  order_number: string;
  order_status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  shipping_phone: string;
  payment_id?: string | null;
  payment_status: string;
  created_at: string;
  updated_at: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  service_id?: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface CreateOrderInput {
  customer_id: string;
  vendor_id?: string;
  order_number: string;
  subtotal: number;
  tax_amount?: number;
  shipping_amount?: number;
  discount_amount?: number;
  total_amount: number;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  shipping_phone: string;
  payment_id?: string;
  payment_status?: string;
  items: Array<{
    product_id?: string;
    service_id?: string;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export class OrdersRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const { items, ...orderData } = input;
    
    // Create order
    const { data: order, error: orderError } = await this.client
      .from('orders')
      .insert({
        ...orderData,
        order_status: 'pending',
        payment_status: orderData.payment_status || 'pending',
        tax_amount: orderData.tax_amount || 0,
        shipping_amount: orderData.shipping_amount || 0,
        discount_amount: orderData.discount_amount || 0,
      })
      .select()
      .single();

    if (orderError) {
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    // Create order items
    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id || null,
        service_id: item.service_id || null,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }));

      const { error: itemsError } = await this.client
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        throw new Error(`Failed to create order items: ${itemsError.message}`);
      }
    }

    return this.mapOrder(order);
  }

  async findById(orderId: string): Promise<Order | null> {
    const results = await selectQuery<any>("orders", { id: orderId }, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapOrder(results[0]);
  }

  async findByCustomer(customerId: string, options?: { limit?: number; offset?: number }): Promise<Order[]> {
    const results = await selectQuery<any>("orders", 
      { customer_id: customerId }, 
      { 
        limit: options?.limit,
        offset: options?.offset,
        orderBy: "created_at",
        orderDirection: "desc"
      }
    );
    return results.map(this.mapOrder);
  }

  async findByVendor(vendorId: string, options?: { limit?: number; offset?: number }): Promise<Order[]> {
    const results = await selectQuery<any>("orders", 
      { vendor_id: vendorId }, 
      { 
        limit: options?.limit,
        offset: options?.offset,
        orderBy: "created_at",
        orderDirection: "desc"
      }
    );
    return results.map(this.mapOrder);
  }

  async findAll(options?: { limit?: number; offset?: number; status?: string }): Promise<Order[]> {
    const filters: any = {};
    if (options?.status) {
      filters.order_status = options.status;
    }
    const results = await selectQuery<any>("orders", 
      filters, 
      { 
        limit: options?.limit,
        offset: options?.offset,
        orderBy: "created_at",
        orderDirection: "desc"
      }
    );
    return results.map(this.mapOrder);
  }

  async update(orderId: string, updates: Partial<Order>): Promise<Order> {
    const results = await updateQuery<any>("orders", { id: orderId }, {
      ...updates,
      updated_at: new Date().toISOString()
    });
    
    if (!results[0]) {
      throw new Error(`Order not found: ${orderId}`);
    }
    
    return this.mapOrder(results[0]);
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const results = await selectQuery<any>("order_items", 
      { order_id: orderId }, 
      { orderBy: "created_at", orderDirection: "asc" }
    );
    return results.map(this.mapOrderItem);
  }

  private mapOrder(data: any): Order {
    return {
      id: data.id,
      customer_id: data.customer_id,
      vendor_id: data.vendor_id,
      order_number: data.order_number,
      order_status: data.order_status,
      subtotal: parseFloat(data.subtotal || '0'),
      tax_amount: parseFloat(data.tax_amount || '0'),
      shipping_amount: parseFloat(data.shipping_amount || '0'),
      discount_amount: parseFloat(data.discount_amount || '0'),
      total_amount: parseFloat(data.total_amount || '0'),
      shipping_address: data.shipping_address,
      shipping_city: data.shipping_city,
      shipping_state: data.shipping_state,
      shipping_pincode: data.shipping_pincode,
      shipping_phone: data.shipping_phone,
      payment_id: data.payment_id,
      payment_status: data.payment_status,
      created_at: data.created_at,
      updated_at: data.updated_at,
      shipped_at: data.shipped_at,
      delivered_at: data.delivered_at,
      cancelled_at: data.cancelled_at
    };
  }

  private mapOrderItem(data: any): OrderItem {
    return {
      id: data.id,
      order_id: data.order_id,
      product_id: data.product_id,
      service_id: data.service_id,
      name: data.name,
      quantity: parseInt(data.quantity || '1'),
      unit_price: parseFloat(data.unit_price || '0'),
      total_price: parseFloat(data.total_price || '0'),
      created_at: data.created_at
    };
  }
}

let repositoryInstance: OrdersRepository | null = null;

export function getOrdersRepository(client?: SupabaseClient): OrdersRepository {
  if (!repositoryInstance) {
    repositoryInstance = new OrdersRepository(client);
  }
  return repositoryInstance;
}
