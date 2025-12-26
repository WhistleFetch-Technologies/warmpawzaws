/**
 * ============================================================================
 * PAYOUT POLICIES REPOSITORY
 * ============================================================================
 * 
 * Repository for payout policy configuration.
 * Replaces: admin:payout:policies KV key
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Singleton pattern - only one active policy
 * 
 * Date: 2024-12-23
 * ============================================================================
 */

import { getDbClient, selectQuery, updateQuery, insertQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface PayoutPolicy {
  id: string;
  policy_key: string;
  hold_period_days: number;
  auto_payout: boolean;
  min_payout_amount: number;
  payout_period: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  created_at: string;
  updated_at: string;
}

export interface UpdatePayoutPolicyInput {
  hold_period_days?: number;
  auto_payout?: boolean;
  min_payout_amount?: number;
  payout_period?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
}

export class PayoutPoliciesRepository {
  private client: SupabaseClient;
  private readonly POLICY_KEY = 'default';

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get payout policy (singleton)
   */
  async getPolicy(): Promise<PayoutPolicy> {
    const results = await selectQuery<any>("payout_policies", { policy_key: this.POLICY_KEY }, { limit: 1 });
    
    if (!results[0]) {
      // Create default policy if not exists
      return await this.createDefault();
    }
    
    return this.mapPolicy(results[0]);
  }

  /**
   * Update payout policy
   */
  async updatePolicy(input: UpdatePayoutPolicyInput): Promise<PayoutPolicy> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.hold_period_days !== undefined) updateData.hold_period_days = input.hold_period_days;
    if (input.auto_payout !== undefined) updateData.auto_payout = input.auto_payout;
    if (input.min_payout_amount !== undefined) updateData.min_payout_amount = input.min_payout_amount;
    if (input.payout_period !== undefined) updateData.payout_period = input.payout_period;
    
    const results = await updateQuery<any>(
      "payout_policies",
      { policy_key: this.POLICY_KEY },
      updateData
    );
    
    if (!results[0]) {
      // If update failed, create default and try again
      await this.createDefault();
      return this.updatePolicy(input);
    }
    
    return this.mapPolicy(results[0]);
  }

  /**
   * Create default policy
   */
  private async createDefault(): Promise<PayoutPolicy> {
    const results = await insertQuery<any>("payout_policies", {
      policy_key: this.POLICY_KEY,
      hold_period_days: 7,
      auto_payout: false,
      min_payout_amount: 1000.00,
      payout_period: 'weekly',
    });
    
    if (!results[0]) {
      throw new Error("Failed to create default payout policy");
    }
    
    return this.mapPolicy(results[0]);
  }

  /**
   * Map database row to interface
   */
  private mapPolicy(data: any): PayoutPolicy {
    return {
      id: data.id,
      policy_key: data.policy_key,
      hold_period_days: parseInt(data.hold_period_days || '7'),
      auto_payout: data.auto_payout === true || data.auto_payout === 'true',
      min_payout_amount: parseFloat(data.min_payout_amount || '1000.00'),
      payout_period: data.payout_period || 'weekly',
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }
}

let repositoryInstance: PayoutPoliciesRepository | null = null;

export function getPayoutPoliciesRepository(): PayoutPoliciesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new PayoutPoliciesRepository();
  }
  return repositoryInstance;
}

