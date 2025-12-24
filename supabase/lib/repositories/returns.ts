/**
 * ============================================================================
 * RETURNS REPOSITORY
 * ============================================================================
 * 
 * Repository for e-commerce order returns management.
 * Replaces: return:{id} KV keys
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

export interface ReturnRequest {
  id: string;
  order_id: string;
  customer_id: string;
  vendor_id: string;
  reason: string;
  reason_category?: 'damaged' | 'wrong_item' | 'not_as_described' | 'defective' | 'other';
  description?: string;
  request_type: 'return' | 'exchange';
  exchange_product_id?: string;
  item_ids: string[];
  quantity: number;
  amount: number;
  images: string[];
  photos: string[];
  status: 'pending' | 'approved' | 'rejected' | 'picked_up' | 'refunded' | 'exchanged';
  return_method: 'pickup' | 'drop';
  created_at: string;
  updated_at: string;
  approved_at?: string;
  rejected_at?: string;
  refunded_at?: string;
  refund_amount?: number;
  refund_method?: string;
  rejection_reason?: string;
  admin_notes?: string;
}

export interface CreateReturnRequestInput {
  order_id: string;
  customer_id: string;
  vendor_id: string;
  reason: string;
  reason_category?: 'damaged' | 'wrong_item' | 'not_as_described' | 'defective' | 'other';
  description?: string;
  request_type?: 'return' | 'exchange';
  exchange_product_id?: string;
  item_ids: string[];
  quantity: number;
  amount: number;
  images?: string[];
  photos?: string[];
  return_method?: 'pickup' | 'drop';
}

export class ReturnsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async create(input: CreateReturnRequestInput): Promise<ReturnRequest> {
    const results = await insertQuery<ReturnRequest>("return_requests", {
      ...input,
      status: 'pending',
      request_type: input.request_type || 'return',
      return_method: input.return_method || 'pickup',
      images: input.images || [],
      photos: input.photos || [],
      item_ids: input.item_ids || [],
    });
    
    if (!results[0]) {
      throw new Error("Failed to create return request");
    }
    
    return this.mapReturnRequest(results[0]);
  }

  async findById(returnId: string): Promise<ReturnRequest | null> {
    const results = await selectQuery<any>("return_requests", { id: returnId }, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapReturnRequest(results[0]);
  }

  async findByOrder(orderId: string): Promise<ReturnRequest[]> {
    const results = await selectQuery<any>("return_requests", 
      { order_id: orderId }, 
      { orderBy: "created_at", orderDirection: "desc" }
    );
    return results.map(this.mapReturnRequest);
  }

  async findByCustomer(customerId: string, options?: { limit?: number; offset?: number }): Promise<ReturnRequest[]> {
    const results = await selectQuery<any>("return_requests", 
      { customer_id: customerId }, 
      { 
        limit: options?.limit,
        offset: options?.offset,
        orderBy: "created_at",
        orderDirection: "desc"
      }
    );
    return results.map(this.mapReturnRequest);
  }

  async findByVendor(vendorId: string, options?: { limit?: number; offset?: number }): Promise<ReturnRequest[]> {
    const results = await selectQuery<any>("return_requests", 
      { vendor_id: vendorId }, 
      { 
        limit: options?.limit,
        offset: options?.offset,
        orderBy: "created_at",
        orderDirection: "desc"
      }
    );
    return results.map(this.mapReturnRequest);
  }

  async findAll(options?: { limit?: number; offset?: number; status?: string }): Promise<ReturnRequest[]> {
    const filters: any = {};
    if (options?.status) {
      filters.status = options.status;
    }
    const results = await selectQuery<any>("return_requests", 
      filters, 
      { 
        limit: options?.limit,
        offset: options?.offset,
        orderBy: "created_at",
        orderDirection: "desc"
      }
    );
    return results.map(this.mapReturnRequest);
  }

  async update(returnId: string, updates: Partial<ReturnRequest>): Promise<ReturnRequest> {
    const updateData: any = { ...updates };
    
    // Handle status-specific timestamps
    if (updates.status === 'approved' && !updates.approved_at) {
      updateData.approved_at = new Date().toISOString();
    }
    if (updates.status === 'rejected' && !updates.rejected_at) {
      updateData.rejected_at = new Date().toISOString();
    }
    if (updates.status === 'refunded' && !updates.refunded_at) {
      updateData.refunded_at = new Date().toISOString();
    }
    
    const results = await updateQuery<any>("return_requests", { id: returnId }, updateData);
    
    if (!results[0]) {
      throw new Error(`Return request not found: ${returnId}`);
    }
    
    return this.mapReturnRequest(results[0]);
  }

  private mapReturnRequest(data: any): ReturnRequest {
    return {
      id: data.id,
      order_id: data.order_id,
      customer_id: data.customer_id,
      vendor_id: data.vendor_id,
      reason: data.reason,
      reason_category: data.reason_category,
      description: data.description,
      request_type: data.request_type || 'return',
      exchange_product_id: data.exchange_product_id,
      item_ids: data.item_ids || [],
      quantity: parseInt(data.quantity || '1'),
      amount: parseFloat(data.amount || '0'),
      images: data.images || [],
      photos: data.photos || [],
      status: data.status,
      return_method: data.return_method || 'pickup',
      created_at: data.created_at,
      updated_at: data.updated_at,
      approved_at: data.approved_at,
      rejected_at: data.rejected_at,
      refunded_at: data.refunded_at,
      refund_amount: data.refund_amount ? parseFloat(data.refund_amount) : undefined,
      refund_method: data.refund_method,
      rejection_reason: data.rejection_reason,
      admin_notes: data.admin_notes
    };
  }
}

let repositoryInstance: ReturnsRepository | null = null;

export function getReturnsRepository(client?: SupabaseClient): ReturnsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new ReturnsRepository(client);
  }
  return repositoryInstance;
}

