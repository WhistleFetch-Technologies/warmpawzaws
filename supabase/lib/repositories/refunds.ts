/**
 * ============================================================================
 * REFUNDS REPOSITORY
 * ============================================================================
 * 
 * Repository for refund data access.
 * Replaces: refund:{refundId} KV keys
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

export interface Refund {
  id: string;
  payment_id: string;
  booking_id: string | null;
  customer_id: string;
  vendor_id: string | null;
  refund_amount: number;
  refund_reason: string;
  refund_status: string;
  razorpay_refund_id: string | null;
  requested_at: string;
  processed_at: string | null;
  completed_at: string | null;
  rejection_reason: string | null;
}

export interface CreateRefundInput {
  payment_id: string;
  booking_id?: string | null;
  customer_id: string;
  vendor_id?: string | null;
  refund_amount: number;
  refund_reason: string;
  refund_status?: string;
  razorpay_refund_id?: string | null;
}

export interface UpdateRefundInput {
  refund_status?: string;
  razorpay_refund_id?: string | null;
  processed_at?: string | null;
  completed_at?: string | null;
  rejection_reason?: string | null;
}

export class RefundsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(refundId: string): Promise<Refund | null> {
    const results = await selectQuery<Refund>("refunds", { id: refundId }, { limit: 1 });
    return results[0] || null;
  }

  async findByPaymentId(paymentId: string): Promise<Refund[]> {
    return selectQuery<Refund>("refunds", { payment_id: paymentId }, {
      orderBy: "requested_at",
      orderDirection: "desc"
    });
  }

  async findByCustomerId(customerId: string, options?: { limit?: number; offset?: number }): Promise<Refund[]> {
    return selectQuery<Refund>("refunds", { customer_id: customerId }, {
      limit: options?.limit || 50,
      offset: options?.offset,
      orderBy: "requested_at",
      orderDirection: "desc"
    });
  }

  async findByVendorId(vendorId: string, options?: { limit?: number; offset?: number; status?: string }): Promise<Refund[]> {
    const filters: any = { vendor_id: vendorId };
    if (options?.status) {
      filters.refund_status = options.status;
    }
    return selectQuery<Refund>("refunds", filters, {
      limit: options?.limit || 50,
      offset: options?.offset,
      orderBy: "requested_at",
      orderDirection: "desc"
    });
  }

  async create(input: CreateRefundInput): Promise<Refund> {
    const results = await insertQuery<Refund>("refunds", {
      payment_id: input.payment_id,
      booking_id: input.booking_id || null,
      customer_id: input.customer_id,
      vendor_id: input.vendor_id || null,
      refund_amount: input.refund_amount,
      refund_reason: input.refund_reason,
      refund_status: input.refund_status || 'pending',
      razorpay_refund_id: input.razorpay_refund_id || null,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create refund");
    }
    
    return results[0];
  }

  async update(refundId: string, input: UpdateRefundInput): Promise<Refund> {
    const updateData: any = {};
    
    if (input.refund_status !== undefined) updateData.refund_status = input.refund_status;
    if (input.razorpay_refund_id !== undefined) updateData.razorpay_refund_id = input.razorpay_refund_id;
    if (input.processed_at !== undefined) updateData.processed_at = input.processed_at;
    if (input.completed_at !== undefined) updateData.completed_at = input.completed_at;
    if (input.rejection_reason !== undefined) updateData.rejection_reason = input.rejection_reason;
    
    const results = await updateQuery<Refund>("refunds", { id: refundId }, updateData);
    
    if (!results[0]) {
      throw new Error(`Refund not found: ${refundId}`);
    }
    
    return results[0];
  }
}

let repositoryInstance: RefundsRepository | null = null;

export function getRefundsRepository(): RefundsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new RefundsRepository();
  }
  return repositoryInstance;
}
