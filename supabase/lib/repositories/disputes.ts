/**
 * ============================================================================
 * DISPUTES REPOSITORY
 * ============================================================================
 * 
 * Repository for dispute data access.
 * Replaces: dispute:{id} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Dispute {
  id: string;
  booking_id?: string | null;
  order_id?: string | null;
  customer_id: string;
  vendor_id: string;
  dispute_type: string;
  status: 'open' | 'in_review' | 'resolved' | 'closed';
  resolution?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

export interface CreateDisputeInput {
  booking_id?: string;
  order_id?: string;
  customer_id: string;
  vendor_id: string;
  dispute_type: string;
  status?: 'open' | 'in_review' | 'resolved' | 'closed';
  resolution?: string;
}

export class DisputesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findAll(options?: { 
    status?: string;
    customer_id?: string;
    vendor_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<Dispute[]> {
    const filters: any = {};
    if (options?.status) filters.status = options.status;
    if (options?.customer_id) filters.customer_id = options.customer_id;
    if (options?.vendor_id) filters.vendor_id = options.vendor_id;
    
    return selectQuery<Dispute>("disputes", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async findById(disputeId: string): Promise<Dispute | null> {
    const results = await selectQuery<Dispute>("disputes", { id: disputeId }, { limit: 1 });
    return results[0] || null;
  }

  async create(input: CreateDisputeInput): Promise<Dispute> {
    const results = await insertQuery<Dispute>("disputes", {
      booking_id: input.booking_id || null,
      order_id: input.order_id || null,
      customer_id: input.customer_id,
      vendor_id: input.vendor_id,
      dispute_type: input.dispute_type,
      status: input.status || 'open',
      resolution: input.resolution || null,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create dispute");
    }
    
    return results[0];
  }

  async update(disputeId: string, input: Partial<CreateDisputeInput & {
    status?: 'open' | 'in_review' | 'resolved' | 'closed';
    resolution?: string;
    resolved_at?: string;
  }>): Promise<Dispute> {
    const updateData: any = { ...input };
    
    if (input.status === 'resolved' && !input.resolved_at) {
      updateData.resolved_at = new Date().toISOString();
    }
    
    const results = await updateQuery<Dispute>(
      "disputes",
      { id: disputeId },
      {
        ...updateData,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }
    
    return results[0];
  }

  async resolve(disputeId: string, resolution: string): Promise<Dispute> {
    return this.update(disputeId, {
      status: 'resolved',
      resolution,
      resolved_at: new Date().toISOString(),
    });
  }
}

let repositoryInstance: DisputesRepository | null = null;

export function getDisputesRepository(): DisputesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new DisputesRepository();
  }
  return repositoryInstance;
}

