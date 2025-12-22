/**
 * ============================================================================
 * COMMISSIONS REPOSITORY
 * ============================================================================
 * 
 * Repository for commission/earnings data access.
 * Replaces: earnings:{earningsId} KV keys
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

export interface Commission {
  id: string;
  booking_id?: string | null;
  payment_id?: string | null;
  vendor_id: string;
  customer_id: string;
  total_amount: number;
  commission_percentage: number;
  commission_amount: number;
  vendor_amount: number;
  status: string;
  realized_at?: string | null;
  created_at: string;
}

export interface CreateCommissionInput {
  booking_id?: string;
  payment_id?: string;
  vendor_id: string;
  customer_id: string;
  total_amount: number;
  commission_percentage: number;
  commission_amount: number;
  vendor_amount: number;
}

export class CommissionsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(commissionId: string): Promise<Commission | null> {
    const results = await selectQuery<Commission>("commissions", { id: commissionId }, { limit: 1 });
    return results[0] || null;
  }

  async findByVendor(vendorId: string, options?: { limit?: number; offset?: number }): Promise<Commission[]> {
    return selectQuery<Commission>("commissions", { vendor_id: vendorId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async findByBooking(bookingId: string): Promise<Commission | null> {
    const results = await selectQuery<Commission>("commissions", { booking_id: bookingId }, { limit: 1 });
    return results[0] || null;
  }

  async create(input: CreateCommissionInput): Promise<Commission> {
    const results = await insertQuery<Commission>("commissions", {
      ...input,
      status: "realized",
      realized_at: new Date().toISOString(),
    });
    
    if (!results[0]) {
      throw new Error("Failed to create commission");
    }
    
    return results[0];
  }

  async update(commissionId: string, input: Partial<CreateCommissionInput & { status?: string }>): Promise<Commission> {
    const results = await updateQuery<Commission>(
      "commissions",
      { id: commissionId },
      input
    );
    
    if (!results[0]) {
      throw new Error(`Commission not found: ${commissionId}`);
    }
    
    return results[0];
  }
}

let repositoryInstance: CommissionsRepository | null = null;

export function getCommissionsRepository(): CommissionsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new CommissionsRepository();
  }
  return repositoryInstance;
}

