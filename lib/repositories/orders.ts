/**
 * ============================================================================
 * ORDERS REPOSITORY
 * ============================================================================
 * 
 * Repository for order data access.
 * Replaces: order:{orderId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Order {
  id: string;
  customer_id: string;
  vendor_id?: string | null;
  order_number: string;
  order_status: string;
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
}

export class OrdersRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(orderId: string): Promise<Order | null> {
    const results = await selectQuery<Order>("orders", { id: orderId }, { limit: 1 });
    return results[0] || null;
  }

  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    const results = await selectQuery<Order>("orders", { order_number: orderNumber }, { limit: 1 });
    return results[0] || null;
  }

  async findByCustomer(customerId: string, options?: { limit?: number; offset?: number }): Promise<Order[]> {
    return selectQuery<Order>("orders", { customer_id: customerId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const results = await insertQuery<Order>("orders", {
      ...input,
      order_status: "pending",
      payment_status: "pending",
      tax_amount: input.tax_amount || 0,
      shipping_amount: input.shipping_amount || 0,
      discount_amount: input.discount_amount || 0,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create order");
    }
    
    return results[0];
  }

  async update(orderId: string, input: Partial<CreateOrderInput & { order_status?: string; payment_status?: string }>): Promise<Order> {
    const results = await updateQuery<Order>(
      "orders",
      { id: orderId },
      {
        ...input,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Order not found: ${orderId}`);
    }
    
    return results[0];
  }
}

let repositoryInstance: OrdersRepository | null = null;

export function getOrdersRepository(): OrdersRepository {
  if (!repositoryInstance) {
    repositoryInstance = new OrdersRepository();
  }
  return repositoryInstance;
}

