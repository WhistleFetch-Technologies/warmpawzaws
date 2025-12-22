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
  payout_status: string;
  bank_account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  razorpay_payout_id?: string | null;
  settlement_id?: string | null;
  payment_ids: string[];
  created_at: string;
  processed_at?: string | null;
  completed_at?: string | null;
  failure_reason?: string | null;
}

export interface CreatePayoutInput {
  vendor_id: string;
  amount: number;
  bank_account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  payment_ids: string[];
  razorpay_payout_id?: string;
  settlement_id?: string;
}

export class PayoutsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(payoutId: string): Promise<Payout | null> {
    const results = await selectQuery<Payout>("payouts", { id: payoutId }, { limit: 1 });
    return results[0] || null;
  }

  async findByVendor(vendorId: string, options?: { limit?: number; offset?: number }): Promise<Payout[]> {
    return selectQuery<Payout>("payouts", { vendor_id: vendorId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async findByStatus(status: string, options?: { limit?: number; offset?: number }): Promise<Payout[]> {
    return selectQuery<Payout>("payouts", { payout_status: status }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async create(input: CreatePayoutInput): Promise<Payout> {
    const results = await insertQuery<Payout>("payouts", {
      ...input,
      currency: "INR",
      payout_status: "pending",
    });
    
    if (!results[0]) {
      throw new Error("Failed to create payout");
    }
    
    return results[0];
  }

  async update(payoutId: string, input: Partial<CreatePayoutInput & { payout_status?: string; processed_at?: string; completed_at?: string; failure_reason?: string }>): Promise<Payout> {
    const updateData: any = { ...input };
    
    if (input.payout_status === "completed" && !input.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }
    if (input.payout_status && input.payout_status !== "pending" && !input.processed_at) {
      updateData.processed_at = new Date().toISOString();
    }
    
    const results = await updateQuery<Payout>(
      "payouts",
      { id: payoutId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Payout not found: ${payoutId}`);
    }
    
    return results[0];
  }

  async complete(payoutId: string): Promise<Payout> {
    return this.update(payoutId, {
      payout_status: "completed",
      completed_at: new Date().toISOString(),
    });
  }

  async fail(payoutId: string, reason: string): Promise<Payout> {
    return this.update(payoutId, {
      payout_status: "failed",
      failure_reason: reason,
    });
  }
}

let repositoryInstance: PayoutsRepository | null = null;

export function getPayoutsRepository(): PayoutsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new PayoutsRepository();
  }
  return repositoryInstance;
}

