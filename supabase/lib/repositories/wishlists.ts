/**
 * ============================================================================
 * WISHLISTS REPOSITORY
 * ============================================================================
 * 
 * Repository for customer wishlist management.
 * Replaces: saved:{customerId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface WishlistItem {
  id: string;
  customer_id: string;
  product_id?: string | null;
  service_id?: string | null;
  created_at: string;
}

export interface CreateWishlistItemInput {
  customer_id: string;
  product_id?: string;
  service_id?: string;
}

export class WishlistsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async create(input: CreateWishlistItemInput): Promise<WishlistItem> {
    // Check if already exists
    const existing = await this.findByCustomerAndItem(
      input.customer_id,
      input.product_id,
      input.service_id
    );
    
    if (existing) {
      throw new Error('Item already in wishlist');
    }

    const { data, error } = await this.client
      .from('wishlists')
      .insert({
        customer_id: input.customer_id,
        product_id: input.product_id || null,
        service_id: input.service_id || null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create wishlist item: ${error.message}`);
    }

    return this.mapItem(data);
  }

  async findByCustomer(customerId: string): Promise<WishlistItem[]> {
    const results = await selectQuery<any>("wishlists", 
      { customer_id: customerId }, 
      { orderBy: "created_at", orderDirection: "desc" }
    );
    return results.map(this.mapItem);
  }

  async findByCustomerAndItem(
    customerId: string,
    productId?: string,
    serviceId?: string
  ): Promise<WishlistItem | null> {
    const filters: any = { customer_id: customerId };
    if (productId) {
      filters.product_id = productId;
    }
    if (serviceId) {
      filters.service_id = serviceId;
    }

    const results = await selectQuery<any>("wishlists", filters, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapItem(results[0]);
  }

  async delete(itemId: string): Promise<void> {
    await deleteQuery("wishlists", { id: itemId });
  }

  async deleteByCustomerAndItem(
    customerId: string,
    productId?: string,
    serviceId?: string
  ): Promise<void> {
    const filters: any = { customer_id: customerId };
    if (productId) {
      filters.product_id = productId;
    }
    if (serviceId) {
      filters.service_id = serviceId;
    }
    await deleteQuery("wishlists", filters);
  }

  private mapItem(data: any): WishlistItem {
    return {
      id: data.id,
      customer_id: data.customer_id,
      product_id: data.product_id,
      service_id: data.service_id,
      created_at: data.created_at
    };
  }
}

let repositoryInstance: WishlistsRepository | null = null;

export function getWishlistsRepository(client?: SupabaseClient): WishlistsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new WishlistsRepository(client);
  }
  return repositoryInstance;
}

