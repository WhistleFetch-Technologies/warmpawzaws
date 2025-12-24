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
    const results = await selectQuery<any>("settlements", { id: settlementId }, { limit: 1 });
    if (!results[0]) return null;
    return this.mapSettlement(results[0]);
  }
  
  private mapSettlement(row: any): Settlement {
    return {
      id: row.id,
      vendor_id: row.vendor_id,
      booking_id: row.booking_id || null,
      payment_id: row.payment_id || null,
      settlement_amount: row.total_amount || row.settlement_amount || 0,
      commission_amount: row.commission_amount || 0,
      vendor_amount: row.net_amount || row.vendor_amount || 0,
      currency: row.currency || 'INR',
      settlement_status: row.settlement_status || 'pending',
      razorpay_settlement_id: row.razorpay_settlement_id || null,
      settlement_date: row.settlement_date || row.settlement_period_start || new Date().toISOString().split('T')[0],
      created_at: row.created_at,
      processed_at: row.processed_at || null,
      completed_at: row.completed_at || null,
    };
  }

  async findByVendor(vendorId: string, options?: { limit?: number; offset?: number }): Promise<Settlement[]> {
    const results = await selectQuery<any>("settlements", { vendor_id: vendorId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
    return results.map(r => this.mapSettlement(r));
  }

  async findByBooking(bookingId: string): Promise<Settlement | null> {
    const results = await selectQuery<any>("settlements", { booking_id: bookingId }, { limit: 1 });
    if (!results[0]) return null;
    return this.mapSettlement(results[0]);
  }

  async create(input: CreateSettlementInput): Promise<Settlement> {
    // Map interface fields to table fields
    const insertData: any = {
      vendor_id: input.vendor_id,
      booking_id: input.booking_id || null,
      payment_id: input.payment_id || null,
      total_amount: input.settlement_amount, // Map settlement_amount to total_amount
      commission_amount: input.commission_amount,
      net_amount: input.vendor_amount, // Map vendor_amount to net_amount
      currency: input.currency || "INR",
      settlement_status: "pending",
      settlement_date: input.settlement_date || new Date().toISOString().split('T')[0],
      razorpay_settlement_id: input.razorpay_settlement_id || null,
    };
    
    const results = await insertQuery<any>("settlements", insertData);
    
    if (!results[0]) {
      throw new Error("Failed to create settlement");
    }
    
    return this.mapSettlement(results[0]);
  }

  async update(settlementId: string, input: Partial<CreateSettlementInput & { settlement_status?: string; processed_at?: string; completed_at?: string; razorpay_settlement_id?: string; failure_reason?: string }>): Promise<Settlement> {
    const updateData: any = {};
    
    // Map interface fields to table fields
    if (input.vendor_id !== undefined) updateData.vendor_id = input.vendor_id;
    if (input.booking_id !== undefined) updateData.booking_id = input.booking_id;
    if (input.payment_id !== undefined) updateData.payment_id = input.payment_id;
    if (input.settlement_amount !== undefined) updateData.total_amount = input.settlement_amount;
    if (input.commission_amount !== undefined) updateData.commission_amount = input.commission_amount;
    if (input.vendor_amount !== undefined) updateData.net_amount = input.vendor_amount;
    if (input.settlement_date !== undefined) updateData.settlement_date = input.settlement_date;
    if (input.razorpay_settlement_id !== undefined) updateData.razorpay_settlement_id = input.razorpay_settlement_id;
    if (input.settlement_status !== undefined) updateData.settlement_status = input.settlement_status;
    if (input.processed_at !== undefined) updateData.processed_at = input.processed_at;
    if (input.completed_at !== undefined) updateData.completed_at = input.completed_at;
    if ((input as any).failure_reason !== undefined) updateData.failure_reason = (input as any).failure_reason;
    
    if (input.settlement_status === "completed" && !input.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }
    if (input.settlement_status && input.settlement_status !== "pending" && !input.processed_at) {
      updateData.processed_at = new Date().toISOString();
    }
    
    const results = await updateQuery<any>(
      "settlements",
      { id: settlementId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Settlement not found: ${settlementId}`);
    }
    
    return this.mapSettlement(results[0]);
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

