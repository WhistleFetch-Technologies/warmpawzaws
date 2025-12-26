/**
 * ============================================================================
 * VENDOR EARNINGS REPOSITORY
 * ============================================================================
 * 
 * Repository for vendor earnings data access.
 * Replaces: earnings:{id} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, withTransaction } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface VendorEarning {
  id: string;
  vendor_id: string;
  booking_id: string;
  settlement_id?: string | null;
  payout_id?: string | null;
  amount: number;
  commission_amount: number;
  total_amount: number;
  commission_rate: number;
  status: string; // 'pending', 'settled', 'paid_out', 'cancelled'
  realized_at?: string | null;
  created_at: string;
  paid_out_at?: string | null;
}

export interface CreateVendorEarningInput {
  vendor_id: string;
  booking_id: string;
  amount: number;
  commission_amount: number;
  total_amount: number;
  commission_rate: number;
  settlement_id?: string;
}

export class VendorEarningsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get earnings by ID
   */
  async findById(earningId: string): Promise<VendorEarning | null> {
    const results = await selectQuery<any>("vendor_earnings", { id: earningId }, { limit: 1 });
    if (!results[0]) return null;
    return this.mapEarning(results[0]);
  }

  /**
   * Get earnings by booking
   */
  async findByBooking(bookingId: string): Promise<VendorEarning | null> {
    const results = await selectQuery<any>("vendor_earnings", { booking_id: bookingId }, { limit: 1 });
    if (!results[0]) return null;
    return this.mapEarning(results[0]);
  }

  /**
   * Get earnings by vendor
   */
  async findByVendor(vendorId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<VendorEarning[]> {
    const filters: any = { vendor_id: vendorId };
    if (options?.status) {
      filters.status = options.status;
    }
    
    const results = await selectQuery<any>("vendor_earnings", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
    
    return results.map(r => this.mapEarning(r));
  }

  /**
   * Get pending earnings for vendor (not yet paid out)
   */
  async findPendingByVendor(vendorId: string): Promise<VendorEarning[]> {
    return this.findByVendor(vendorId, { status: 'settled' });
  }

  /**
   * Create earnings record
   */
  async create(input: CreateVendorEarningInput): Promise<VendorEarning> {
    const insertData = {
      vendor_id: input.vendor_id,
      booking_id: input.booking_id,
      amount: input.amount,
      commission_amount: input.commission_amount,
      total_amount: input.total_amount,
      commission_rate: input.commission_rate,
      status: 'pending',
      settlement_id: input.settlement_id || null,
      realized_at: new Date().toISOString(),
    };
    
    const results = await insertQuery<any>("vendor_earnings", insertData);
    
    if (!results[0]) {
      throw new Error("Failed to create vendor earnings");
    }
    
    return this.mapEarning(results[0]);
  }

  /**
   * Update earnings
   */
  async update(earningId: string, input: Partial<CreateVendorEarningInput & {
    status?: string;
    settlement_id?: string;
    payout_id?: string;
    paid_out_at?: string;
  }>): Promise<VendorEarning> {
    const updateData: any = { ...input };
    
    if (input.status === 'paid_out' && !input.paid_out_at) {
      updateData.paid_out_at = new Date().toISOString();
    }
    
    const results = await updateQuery<any>(
      "vendor_earnings",
      { id: earningId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Vendor earnings not found: ${earningId}`);
    }
    
    return this.mapEarning(results[0]);
  }

  /**
   * Mark earnings as settled
   */
  async markSettled(earningId: string, settlementId: string): Promise<VendorEarning> {
    return this.update(earningId, {
      status: 'settled',
      settlement_id: settlementId,
    });
  }

  /**
   * Link earnings to payout
   */
  async linkToPayout(earningIds: string[], payoutId: string): Promise<void> {
    await withTransaction(async (client) => {
      for (const earningId of earningIds) {
        await updateQuery<any>(
          "vendor_earnings",
          { id: earningId },
          {
            payout_id: payoutId,
            status: 'paid_out',
            paid_out_at: new Date().toISOString(),
          },
          client
        );
      }
    });
  }

  /**
   * Map database row to VendorEarning interface
   */
  private mapEarning(data: any): VendorEarning {
    return {
      id: data.id,
      vendor_id: data.vendor_id,
      booking_id: data.booking_id,
      settlement_id: data.settlement_id || null,
      payout_id: data.payout_id || null,
      amount: parseFloat(data.amount || '0'),
      commission_amount: parseFloat(data.commission_amount || '0'),
      total_amount: parseFloat(data.total_amount || '0'),
      commission_rate: parseFloat(data.commission_rate || '0'),
      status: data.status || 'pending',
      realized_at: data.realized_at || null,
      created_at: data.created_at,
      paid_out_at: data.paid_out_at || null,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: VendorEarningsRepository | null = null;

export function getVendorEarningsRepository(): VendorEarningsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new VendorEarningsRepository();
  }
  return repositoryInstance;
}

