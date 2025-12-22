/**
 * ============================================================================
 * SETTLEMENTS REPOSITORY
 * ============================================================================
 * 
 * Repository for settlement data access.
 * Replaces: settlement:{settlementId} KV keys
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

export interface Settlement {
  id: string;
  vendor_id: string;
  booking_id?: string | null;
  payment_id?: string | null;
  settlement_amount: number;
  commission_amount: number;
  vendor_amount: number;
  currency: string;
  settlement_status: string;
  razorpay_settlement_id?: string | null;
  settlement_date: string;
  created_at: string;
  processed_at?: string | null;
  completed_at?: string | null;
}

export interface CreateSettlementInput {
  vendor_id: string;
  booking_id?: string;
  payment_id?: string;
  settlement_amount: number;
  commission_amount: number;
  vendor_amount: number;
  razorpay_settlement_id?: string;
  settlement_date?: string;
}

export class SettlementsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(settlementId: string): Promise<Settlement | null> {
    const results = await selectQuery<Settlement>("settlements", { id: settlementId }, { limit: 1 });
    return results[0] || null;
  }

  async findByVendor(vendorId: string, options?: { limit?: number; offset?: number }): Promise<Settlement[]> {
    return selectQuery<Settlement>("settlements", { vendor_id: vendorId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "settlement_date",
      orderDirection: "desc",
    });
  }

  async findByBooking(bookingId: string): Promise<Settlement | null> {
    const results = await selectQuery<Settlement>("settlements", { booking_id: bookingId }, { limit: 1 });
    return results[0] || null;
  }

  async create(input: CreateSettlementInput): Promise<Settlement> {
    const results = await insertQuery<Settlement>("settlements", {
      ...input,
      currency: "INR",
      settlement_status: "pending",
      settlement_date: input.settlement_date || new Date().toISOString().split('T')[0],
    });
    
    if (!results[0]) {
      throw new Error("Failed to create settlement");
    }
    
    return results[0];
  }

  async update(settlementId: string, input: Partial<CreateSettlementInput & { settlement_status?: string; processed_at?: string; completed_at?: string }>): Promise<Settlement> {
    const updateData: any = { ...input };
    
    if (input.settlement_status === "completed" && !input.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }
    if (input.settlement_status && input.settlement_status !== "pending" && !input.processed_at) {
      updateData.processed_at = new Date().toISOString();
    }
    
    const results = await updateQuery<Settlement>(
      "settlements",
      { id: settlementId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Settlement not found: ${settlementId}`);
    }
    
    return results[0];
  }

  async complete(settlementId: string): Promise<Settlement> {
    return this.update(settlementId, {
      settlement_status: "completed",
      completed_at: new Date().toISOString(),
    });
  }
}

let repositoryInstance: SettlementsRepository | null = null;

export function getSettlementsRepository(): SettlementsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new SettlementsRepository();
  }
  return repositoryInstance;
}

