/**
 * ============================================================================
 * PAYOUTS REPOSITORY
 * ============================================================================
 * 
 * Repository for payout data access.
 * Replaces: payout:{payoutId} KV keys
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

export interface Payout {
  id: string;
  vendor_id: string;
  amount: number;
  currency: string;
  status: string; // 'scheduled', 'processing', 'completed', 'failed', 'cancelled'
  scheduled_at: string;
  processed_at?: string | null;
  razorpay_payout_id?: string | null;
  bank_account_id?: string | null;
  settlement_ids: string[]; // Array of settlement IDs
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePayoutInput {
  vendor_id: string;
  amount: number;
  scheduled_at?: string;
  settlement_ids?: string[];
  razorpay_payout_id?: string;
  bank_account_id?: string;
}

export class PayoutsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(payoutId: string): Promise<Payout | null> {
    const results = await selectQuery<any>("payouts", { id: payoutId }, { limit: 1 });
    if (!results[0]) return null;
    return this.mapPayout(results[0]);
  }

  async findByVendor(vendorId: string, options?: { 
    limit?: number; 
    offset?: number;
    status?: string;
  }): Promise<Payout[]> {
    const filters: any = { vendor_id: vendorId };
    if (options?.status) {
      filters.status = options.status;
    }
    
    const results = await selectQuery<any>("payouts", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "scheduled_at",
      orderDirection: "desc",
    });
    
    return results.map(r => this.mapPayout(r));
  }

  async findByStatus(status: string, options?: { limit?: number; offset?: number }): Promise<Payout[]> {
    const results = await selectQuery<any>("payouts", { status }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "scheduled_at",
      orderDirection: "asc", // Process oldest first
    });
    
    return results.map(r => this.mapPayout(r));
  }

  async findScheduledDue(now: Date): Promise<Payout[]> {
    // Find payouts scheduled for today or earlier
    const client = getDbClient();
    const { data, error } = await client
      .from("payouts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true });
    
    if (error) throw error;
    return (data || []).map(r => this.mapPayout(r));
  }

  async create(input: CreatePayoutInput): Promise<Payout> {
    const insertData: any = {
      vendor_id: input.vendor_id,
      amount: input.amount,
      currency: "INR",
      status: "scheduled",
      scheduled_at: input.scheduled_at || new Date().toISOString(),
      settlement_ids: input.settlement_ids || [],
      razorpay_payout_id: input.razorpay_payout_id || null,
      bank_account_id: input.bank_account_id || null,
    };
    
    const results = await insertQuery<any>("payouts", insertData);
    
    if (!results[0]) {
      throw new Error("Failed to create payout");
    }
    
    return this.mapPayout(results[0]);
  }

  async update(payoutId: string, input: Partial<CreatePayoutInput & { 
    status?: string; 
    processed_at?: string; 
    razorpay_payout_id?: string;
    failure_reason?: string;
    settlement_ids?: string[];
  }>): Promise<Payout> {
    const updateData: any = { ...input };
    
    if (input.status === "completed" && !input.processed_at) {
      updateData.processed_at = new Date().toISOString();
    }
    if (input.status && input.status !== "scheduled" && !input.processed_at) {
      updateData.processed_at = new Date().toISOString();
    }
    
    const results = await updateQuery<any>(
      "payouts",
      { id: payoutId },
      {
        ...updateData,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Payout not found: ${payoutId}`);
    }
    
    return this.mapPayout(results[0]);
  }

  async complete(payoutId: string, razorpayPayoutId?: string): Promise<Payout> {
    return this.update(payoutId, {
      status: "completed",
      razorpay_payout_id: razorpayPayoutId,
      processed_at: new Date().toISOString(),
    });
  }

  async fail(payoutId: string, reason: string): Promise<Payout> {
    return this.update(payoutId, {
      status: "failed",
      failure_reason: reason,
    });
  }

  /**
   * Map database row to Payout interface
   */
  private mapPayout(data: any): Payout {
    return {
      id: data.id,
      vendor_id: data.vendor_id,
      amount: parseFloat(data.amount || '0'),
      currency: data.currency || 'INR',
      status: data.status || 'scheduled',
      scheduled_at: data.scheduled_at,
      processed_at: data.processed_at || null,
      razorpay_payout_id: data.razorpay_payout_id || null,
      bank_account_id: data.bank_account_id || null,
      settlement_ids: data.settlement_ids || [],
      failure_reason: data.failure_reason || null,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }
}

let repositoryInstance: PayoutsRepository | null = null;

export function getPayoutsRepository(): PayoutsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new PayoutsRepository();
  }
  return repositoryInstance;
}

