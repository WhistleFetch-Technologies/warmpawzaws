/**
 * ============================================================================
 * LOYALTY REPOSITORY
 * ============================================================================
 * 
 * Repository for loyalty points and rewards management.
 * Replaces: loyalty_profile:{userId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, withTransaction } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface LoyaltyProfile {
  id: string;
  customer_id: string;
  total_points: number;
  lifetime_points_earned: number;
  lifetime_points_redeemed: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  transaction_type: 'earned' | 'redeemed' | 'expired' | 'adjusted';
  points: number;
  reference_type?: string | null;
  reference_id?: string | null;
  description?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface LoyaltyRule {
  id: string;
  rule_name: string;
  points_per_rupee: number;
  redemption_rate: number;
  min_redemption_points: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateLoyaltyTransactionInput {
  customer_id: string;
  transaction_type: 'earned' | 'redeemed' | 'expired' | 'adjusted';
  points: number;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  expires_at?: string;
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class LoyaltyRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get or create loyalty profile for customer
   */
  async findOrCreate(customerId: string): Promise<LoyaltyProfile> {
    const existing = await this.findByCustomer(customerId);
    if (existing) {
      return existing;
    }

    // Create new profile
    const { data, error } = await this.client
      .from('customer_loyalty_points')
      .insert({
        customer_id: customerId,
        total_points: 0,
        lifetime_points_earned: 0,
        lifetime_points_redeemed: 0
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create loyalty profile: ${error.message}`);
    }

    return this.mapLoyaltyProfile(data);
  }

  /**
   * Get loyalty profile by customer ID
   */
  async findByCustomer(customerId: string): Promise<LoyaltyProfile | null> {
    const results = await selectQuery<any>("customer_loyalty_points", { customer_id: customerId }, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapLoyaltyProfile(results[0]);
  }

  /**
   * Add points to customer (earn)
   */
  async addPoints(customerId: string, points: number, referenceType?: string, referenceId?: string, description?: string): Promise<LoyaltyProfile> {
    return await withTransaction(async (client) => {
      // Get or create profile
      const profile = await this.findOrCreate(customerId);

      // Create transaction
      const { data: transaction, error: txError } = await client
        .from('loyalty_transactions')
        .insert({
          customer_id: customerId,
          transaction_type: 'earned',
          points,
          reference_type: referenceType || null,
          reference_id: referenceId || null,
          description: description || 'Points earned',
        })
        .select()
        .single();

      if (txError) {
        throw new Error(`Failed to create loyalty transaction: ${txError.message}`);
      }

      // Update profile
      const { data: updated, error: updateError } = await client
        .from('customer_loyalty_points')
        .update({
          total_points: profile.total_points + points,
          lifetime_points_earned: profile.lifetime_points_earned + points,
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', customerId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update loyalty profile: ${updateError.message}`);
      }

      return this.mapLoyaltyProfile(updated);
    });
  }

  /**
   * Redeem points (deduct)
   */
  async redeemPoints(customerId: string, points: number, description?: string): Promise<LoyaltyProfile> {
    return await withTransaction(async (client) => {
      const profile = await this.findByCustomer(customerId);
      if (!profile) {
        throw new Error('Loyalty profile not found');
      }

      if (profile.total_points < points) {
        throw new Error('Insufficient points balance');
      }

      // Create transaction
      await client
        .from('loyalty_transactions')
        .insert({
          customer_id: customerId,
          transaction_type: 'redeemed',
          points: -points,
          description: description || 'Points redeemed',
        });

      // Update profile
      const { data: updated, error } = await client
        .from('customer_loyalty_points')
        .update({
          total_points: profile.total_points - points,
          lifetime_points_redeemed: profile.lifetime_points_redeemed + points,
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', customerId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to redeem points: ${error.message}`);
      }

      return this.mapLoyaltyProfile(updated);
    });
  }

  /**
   * Get loyalty transactions for customer
   */
  async getTransactions(customerId: string, options?: { limit?: number; offset?: number }): Promise<LoyaltyTransaction[]> {
    const results = await selectQuery<any>("loyalty_transactions", 
      { customer_id: customerId }, 
      { 
        limit: options?.limit,
        offset: options?.offset,
        orderBy: "created_at",
        orderDirection: "desc"
      }
    );
    return results.map(this.mapLoyaltyTransaction);
  }

  /**
   * Get active loyalty rules
   */
  async getActiveRules(): Promise<LoyaltyRule[]> {
    const results = await selectQuery<any>("loyalty_rules", 
      { is_active: true }, 
      { orderBy: "created_at", orderDirection: "asc" }
    );
    return results.map(this.mapLoyaltyRule);
  }

  /**
   * Get default loyalty rule (first active rule or create default)
   */
  async getDefaultRule(): Promise<LoyaltyRule> {
    const rules = await this.getActiveRules();
    if (rules.length > 0) {
      return rules[0];
    }

    // Create default rule if none exists
    const { data, error } = await this.client
      .from('loyalty_rules')
      .insert({
        rule_name: 'default',
        points_per_rupee: 1.0,
        redemption_rate: 1.0,
        min_redemption_points: 100,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create default loyalty rule: ${error.message}`);
    }

    return this.mapLoyaltyRule(data);
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  private mapLoyaltyProfile(data: any): LoyaltyProfile {
    return {
      id: data.id,
      customer_id: data.customer_id,
      total_points: parseInt(data.total_points || '0'),
      lifetime_points_earned: parseInt(data.lifetime_points_earned || '0'),
      lifetime_points_redeemed: parseInt(data.lifetime_points_redeemed || '0'),
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  private mapLoyaltyTransaction(data: any): LoyaltyTransaction {
    return {
      id: data.id,
      customer_id: data.customer_id,
      transaction_type: data.transaction_type,
      points: parseInt(data.points || '0'),
      reference_type: data.reference_type,
      reference_id: data.reference_id,
      description: data.description,
      expires_at: data.expires_at,
      created_at: data.created_at
    };
  }

  private mapLoyaltyRule(data: any): LoyaltyRule {
    return {
      id: data.id,
      rule_name: data.rule_name,
      points_per_rupee: parseFloat(data.points_per_rupee || '0'),
      redemption_rate: parseFloat(data.redemption_rate || '0'),
      min_redemption_points: parseInt(data.min_redemption_points || '100'),
      is_active: data.is_active,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: LoyaltyRepository | null = null;

export function getLoyaltyRepository(client?: SupabaseClient): LoyaltyRepository {
  if (!repositoryInstance) {
    repositoryInstance = new LoyaltyRepository(client);
  }
  return repositoryInstance;
}

