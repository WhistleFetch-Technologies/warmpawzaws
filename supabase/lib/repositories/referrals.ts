/**
 * ============================================================================
 * REFERRALS REPOSITORY
 * ============================================================================
 * 
 * Repository for referral system management.
 * Replaces: referral:{id}, referral:customer:{id}, referral:code:{code} KV keys
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

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id?: string | null;
  referral_code: string;
  status: 'pending' | 'completed' | 'expired';
  reward_points: number;
  completed_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface CreateReferralInput {
  referrer_id: string;
  referral_code: string;
  expires_at?: string;
}

export interface ApplyReferralInput {
  referral_code: string;
  referred_id: string;
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class ReferralsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Create referral code for customer
   */
  async create(input: CreateReferralInput): Promise<Referral> {
    const { data, error } = await this.client
      .from('referrals')
      .insert({
        referrer_id: input.referrer_id,
        referral_code: input.referral_code.toUpperCase(),
        status: 'pending',
        reward_points: 0,
        expires_at: input.expires_at || null
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Referral code already exists');
      }
      throw new Error(`Failed to create referral: ${error.message}`);
    }

    return this.mapReferral(data);
  }

  /**
   * Find referral by code
   */
  async findByCode(code: string): Promise<Referral | null> {
    const results = await selectQuery<any>("referrals", 
      { referral_code: code.toUpperCase() }, 
      { limit: 1 }
    );
    if (results.length === 0) return null;
    return this.mapReferral(results[0]);
  }

  /**
   * Find referral by referrer ID
   */
  async findByReferrer(referrerId: string): Promise<Referral | null> {
    const results = await selectQuery<any>("referrals", 
      { referrer_id: referrerId, status: 'pending' }, 
      { limit: 1, orderBy: "created_at", orderDirection: "desc" }
    );
    if (results.length === 0) return null;
    return this.mapReferral(results[0]);
  }

  /**
   * Find referral by referred ID
   */
  async findByReferred(referredId: string): Promise<Referral | null> {
    const results = await selectQuery<any>("referrals", 
      { referred_id: referredId }, 
      { limit: 1 }
    );
    if (results.length === 0) return null;
    return this.mapReferral(results[0]);
  }

  /**
   * Generate unique referral code
   */
  async generateUniqueCode(prefix: string = 'REF'): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const code = `${prefix}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const existing = await this.findByCode(code);
      
      if (!existing) {
        return code;
      }
      
      attempts++;
    }

    throw new Error('Failed to generate unique referral code');
  }

  /**
   * Apply referral code (when new customer signs up)
   */
  async applyReferral(input: ApplyReferralInput): Promise<Referral> {
    return await withTransaction(async (client) => {
      // Find referral by code
      const referral = await this.findByCode(input.referral_code);
      if (!referral) {
        throw new Error('Invalid referral code');
      }

      if (referral.status !== 'pending') {
        throw new Error('Referral code already used or expired');
      }

      if (referral.referrer_id === input.referred_id) {
        throw new Error('Cannot use your own referral code');
      }

      // Check if referred customer already used a referral
      const existingReferral = await this.findByReferred(input.referred_id);
      if (existingReferral) {
        throw new Error('Customer has already used a referral code');
      }

      // Check expiration
      if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
        throw new Error('Referral code has expired');
      }

      // Update referral
      const { data: updated, error } = await client
        .from('referrals')
        .update({
          referred_id: input.referred_id,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', referral.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to apply referral: ${error.message}`);
      }

      return this.mapReferral(updated);
    });
  }

  /**
   * Award referral rewards
   */
  async awardRewards(referralId: string, rewardPoints: number): Promise<Referral> {
    const { data, error } = await this.client
      .from('referrals')
      .update({
        reward_points: rewardPoints,
        updated_at: new Date().toISOString()
      })
      .eq('id', referralId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to award referral rewards: ${error.message}`);
    }

    return this.mapReferral(data);
  }

  /**
   * Get referrals by referrer
   */
  async getByReferrer(referrerId: string, options?: { limit?: number; offset?: number }): Promise<Referral[]> {
    const results = await selectQuery<any>("referrals", 
      { referrer_id: referrerId }, 
      { 
        limit: options?.limit,
        offset: options?.offset,
        orderBy: "created_at",
        orderDirection: "desc"
      }
    );
    return results.map(this.mapReferral);
  }

  /**
   * Get completed referrals count for referrer
   */
  async getCompletedCount(referrerId: string, month?: string): Promise<number> {
    let query = this.client
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .eq('status', 'completed');

    if (month) {
      query = query.gte('completed_at', `${month}-01`)
                   .lt('completed_at', `${month}-32`);
    }

    const { count, error } = await query;
    if (error) {
      throw new Error(`Failed to get completed referrals count: ${error.message}`);
    }

    return count || 0;
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  private mapReferral(data: any): Referral {
    return {
      id: data.id,
      referrer_id: data.referrer_id,
      referred_id: data.referred_id,
      referral_code: data.referral_code,
      status: data.status,
      reward_points: parseInt(data.reward_points || '0'),
      completed_at: data.completed_at,
      expires_at: data.expires_at,
      created_at: data.created_at
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: ReferralsRepository | null = null;

export function getReferralsRepository(client?: SupabaseClient): ReferralsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new ReferralsRepository(client);
  }
  return repositoryInstance;
}

