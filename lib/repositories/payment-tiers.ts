/**
 * Payment Tiers Repository
 * SQL-only data access for payment/subscription tiers
 * Maps from payment:tiers KV key to subscription_tiers table
 */

import { getDbClient } from '../db.ts';

export interface PaymentTier {
  id: string;
  tier_name: string;
  tier_level: number;
  monthly_price: number;
  features: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Additional fields from KV store
  name?: string;
  displayName?: string;
  description?: string;
  commissionRate?: number;
  payoutPeriod?: number;
  monthlyCost?: number;
  yearlyCost?: number;
  isDefault?: boolean;
}

export function getPaymentTiersRepository() {
  const client = getDbClient();

  return {
    /**
     * Find all tiers
     */
    async findAll(): Promise<PaymentTier[]> {
      const { data, error } = await client
        .from('subscription_tiers')
        .select('*')
        .order('tier_level', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    /**
     * Find tier by ID
     */
    async findById(tierId: string): Promise<PaymentTier | null> {
      const { data, error } = await client
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    /**
     * Find tier by name
     */
    async findByName(tierName: string): Promise<PaymentTier | null> {
      const { data, error } = await client
        .from('subscription_tiers')
        .select('*')
        .eq('tier_name', tierName)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    /**
     * Find default tier
     */
    async findDefault(): Promise<PaymentTier | null> {
      // Default tier is typically tier_level 1
      const { data, error } = await client
        .from('subscription_tiers')
        .select('*')
        .eq('tier_level', 1)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    /**
     * Create a new tier
     */
    async create(tierData: Partial<PaymentTier>): Promise<PaymentTier> {
      const { data, error } = await client
        .from('subscription_tiers')
        .insert({
          tier_name: tierData.tier_name || tierData.name!,
          tier_level: tierData.tier_level || 1,
          monthly_price: tierData.monthly_price || tierData.monthlyCost || 0,
          features: tierData.features || {},
          is_active: tierData.is_active ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Update a tier
     */
    async update(tierId: string, updates: Partial<PaymentTier>): Promise<PaymentTier> {
      const { data, error } = await client
        .from('subscription_tiers')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tierId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Delete a tier
     */
    async delete(tierId: string): Promise<void> {
      const { error } = await client
        .from('subscription_tiers')
        .delete()
        .eq('id', tierId);

      if (error) throw error;
    },
  };
}

