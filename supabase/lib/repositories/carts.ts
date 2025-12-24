/**
 * ============================================================================
 * CARTS REPOSITORY
 * ============================================================================
 * 
 * Repository for shopping cart management.
 * Replaces: cart:{customerId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, upsertQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Cart {
  id: string;
  customer_id: string;
  items: any[];
  subtotal: number;
  tax: number;
  gst: number;
  shipping: number;
  discount: number;
  total: number;
  coupon_code?: string | null;
  created_at: string;
  updated_at: string;
}

export class CartsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findOrCreate(customerId: string): Promise<Cart> {
    const existing = await this.findByCustomer(customerId);
    if (existing) {
      return existing;
    }

    // Create new cart
    const { data, error } = await this.client
      .from('shopping_carts')
      .insert({
        customer_id: customerId,
        items: [],
        subtotal: 0,
        tax: 0,
        gst: 0,
        shipping: 0,
        discount: 0,
        total: 0
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create cart: ${error.message}`);
    }

    return this.mapCart(data);
  }

  async findByCustomer(customerId: string): Promise<Cart | null> {
    const results = await selectQuery<any>("shopping_carts", { customer_id: customerId }, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapCart(results[0]);
  }

  async update(customerId: string, updates: Partial<Cart>): Promise<Cart> {
    const results = await updateQuery<any>("shopping_carts", 
      { customer_id: customerId }, 
      {
        ...updates,
        updated_at: new Date().toISOString()
      }
    );
    
    if (!results[0]) {
      throw new Error(`Cart not found for customer: ${customerId}`);
    }
    
    return this.mapCart(results[0]);
  }

  async clear(customerId: string): Promise<void> {
    await this.update(customerId, {
      items: [],
      subtotal: 0,
      tax: 0,
      gst: 0,
      shipping: 0,
      discount: 0,
      total: 0,
      coupon_code: null
    });
  }

  private mapCart(data: any): Cart {
    return {
      id: data.id,
      customer_id: data.customer_id,
      items: data.items || [],
      subtotal: parseFloat(data.subtotal || '0'),
      tax: parseFloat(data.tax || '0'),
      gst: parseFloat(data.gst || '0'),
      shipping: parseFloat(data.shipping || '0'),
      discount: parseFloat(data.discount || '0'),
      total: parseFloat(data.total || '0'),
      coupon_code: data.coupon_code,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }
}

let repositoryInstance: CartsRepository | null = null;

export function getCartsRepository(client?: SupabaseClient): CartsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new CartsRepository(client);
  }
  return repositoryInstance;
}

