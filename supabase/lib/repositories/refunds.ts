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
 * Date: 2024-12-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Refund {
  id: string;
  payment_id: string;
  booking_id?: string | null;
  customer_id: string;
  vendor_id?: string | null;
  refund_amount: number;
  refund_reason: string;
  refund_status: string;
  razorpay_refund_id?: string | null;
  requested_at: string;
  processed_at?: string | null;
  completed_at?: string | null;
  rejection_reason?: string | null;
}

export interface CreateRefundInput {
  payment_id: string;
  booking_id?: string;
  customer_id: string;
  vendor_id?: string;
  refund_amount: number;
  refund_reason: string;
  razorpay_refund_id?: string;
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

  async findByPayment(paymentId: string): Promise<Refund[]> {
    return selectQuery<Refund>("refunds", { payment_id: paymentId }, {
      orderBy: "requested_at",
      orderDirection: "desc",
    });
  }

  async findByCustomer(customerId: string, options?: { limit?: number; offset?: number }): Promise<Refund[]> {
    return selectQuery<Refund>("refunds", { customer_id: customerId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "requested_at",
      orderDirection: "desc",
    });
  }

  async create(input: CreateRefundInput): Promise<Refund> {
    const results = await insertQuery<Refund>("refunds", {
      ...input,
      refund_status: "pending",
    });
    
    if (!results[0]) {
      throw new Error("Failed to create refund");
    }
    
    return results[0];
  }

  async update(refundId: string, input: Partial<CreateRefundInput & { refund_status?: string; processed_at?: string; completed_at?: string; rejection_reason?: string }>): Promise<Refund> {
    const updateData: any = { ...input };
    
    if (input.refund_status === "completed" && !input.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }
    if (input.refund_status && !input.processed_at) {
      updateData.processed_at = new Date().toISOString();
    }
    
    const results = await updateQuery<Refund>(
      "refunds",
      { id: refundId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Refund not found: ${refundId}`);
    }
    
    return results[0];
  }

  async approve(refundId: string): Promise<Refund> {
    return this.update(refundId, {
      refund_status: "approved",
    });
  }

  async complete(refundId: string, razorpayRefundId?: string): Promise<Refund> {
    return this.update(refundId, {
      refund_status: "completed",
      razorpay_refund_id: razorpayRefundId,
      completed_at: new Date().toISOString(),
    });
  }

  async reject(refundId: string, reason: string): Promise<Refund> {
    return this.update(refundId, {
      refund_status: "rejected",
      rejection_reason: reason,
    });
  }
}

let repositoryInstance: RefundsRepository | null = null;

export function getRefundsRepository(): RefundsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new RefundsRepository();
  }
  return repositoryInstance;
}

