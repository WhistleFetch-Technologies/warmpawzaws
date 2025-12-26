/**
 * ============================================================================
 * VENDOR TIERS REPOSITORY
 * ============================================================================
 * 
 * Repository for vendor tier and subscription data access.
 * Replaces: payment:tiers, vendor:{id}:tier_id KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface VendorTier {
  id: string;
  tier_name: string;
  tier_level: number;
  display_name: string;
  description?: string | null;
  commission_rate: number;
  payout_period_days: number;
  monthly_cost: number;
  yearly_cost: number;
  six_month_cost?: number | null;
  six_month_discount_percentage?: number | null;
  twelve_month_cost?: number | null;
  twelve_month_discount_percentage?: number | null;
  allow_split_payment: boolean;
  split_payment_installments?: number | null;
  split_payment_interval_days?: number | null;
  features?: any | null;
  applicable_roles?: string[] | null;
  is_default: boolean;
  is_active: boolean;
  is_free_tier: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorTierSubscription {
  id: string;
  vendor_id: string;
  tier_id: string;
  subscription_type: 'monthly' | 'six_month' | 'twelve_month' | 'yearly';
  payment_type: 'upfront' | 'split';
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  split_installments?: number | null;
  split_interval_days?: number | null;
  next_payment_date?: string | null;
  next_payment_amount?: number | null;
  status: 'active' | 'expired' | 'cancelled' | 'pending_payment';
  start_date: string;
  end_date: string;
  payment_ids?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface TierUpgradePayment {
  id: string;
  vendor_id: string;
  current_tier_id?: string | null;
  target_tier_id: string;
  subscription_type: 'monthly' | 'six_month' | 'twelve_month' | 'yearly';
  payment_type: 'upfront' | 'split';
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  payment_status: 'pending' | 'processing' | 'completed' | 'failed';
  subscription_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTierInput {
  tier_name: string;
  tier_level: number;
  display_name: string;
  description?: string;
  commission_rate: number;
  payout_period_days?: number;
  monthly_cost: number;
  yearly_cost: number;
  six_month_cost?: number;
  six_month_discount_percentage?: number;
  twelve_month_cost?: number;
  twelve_month_discount_percentage?: number;
  allow_split_payment?: boolean;
  split_payment_installments?: number;
  split_payment_interval_days?: number;
  features?: any;
  applicable_roles?: string[];
  is_default?: boolean;
  is_active?: boolean;
  is_free_tier?: boolean;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export function getVendorTiersRepository() {
  return {
    /**
     * Create a new tier
     */
    async create(input: CreateTierInput): Promise<VendorTier> {
      // If setting as default, unset other default tiers
      if (input.is_default) {
        const db = getDbClient();
        await db
          .from('vendor_tiers')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('is_default', true);
      }

      const result = await insertQuery<VendorTier>(
        'vendor_tiers',
        {
          ...input,
          payout_period_days: input.payout_period_days || 7,
          allow_split_payment: input.allow_split_payment || false,
          is_default: input.is_default || false,
          is_active: input.is_active !== false,
          is_free_tier: input.is_free_tier || false,
          features: input.features || [],
          applicable_roles: input.applicable_roles || []
        }
      );

      return result[0];
    },

    /**
     * Find tier by ID
     */
    async findById(tierId: string): Promise<VendorTier | null> {
      const result = await selectQuery<VendorTier>(
        'vendor_tiers',
        { id: tierId },
        { limit: 1 }
      );
      return result[0] || null;
    },

    /**
     * Find tier by name
     */
    async findByName(tierName: string): Promise<VendorTier | null> {
      const result = await selectQuery<VendorTier>(
        'vendor_tiers',
        { tier_name: tierName },
        { limit: 1 }
      );
      return result[0] || null;
    },

    /**
     * Find all active tiers
     */
    async findAllActive(): Promise<VendorTier[]> {
      return await selectQuery<VendorTier>(
        'vendor_tiers',
        { is_active: true },
        { orderBy: 'tier_level', orderDirection: 'asc' }
      );
    },

    /**
     * Find default tier
     */
    async findDefault(): Promise<VendorTier | null> {
      const result = await selectQuery<VendorTier>(
        'vendor_tiers',
        { is_default: true, is_active: true },
        { limit: 1 }
      );
      return result[0] || null;
    },

    /**
     * Find free tier
     */
    async findFreeTier(): Promise<VendorTier | null> {
      const result = await selectQuery<VendorTier>(
        'vendor_tiers',
        { is_free_tier: true, is_active: true },
        { limit: 1 }
      );
      return result[0] || null;
    },

    /**
     * Find available tiers for vendor (excluding current tier)
     */
    async findAvailableForVendor(vendorId: string): Promise<VendorTier[]> {
      // Get vendor's current tier
      const currentSubscription = await this.findActiveSubscriptionByVendor(vendorId);
      const currentTierId = currentSubscription?.tier_id;

      const tiers = await this.findAllActive();
      
      // Filter out current tier and return tiers with higher level
      if (currentTierId) {
        const currentTier = tiers.find(t => t.id === currentTierId);
        if (currentTier) {
          return tiers.filter(t => t.tier_level > currentTier.tier_level);
        }
      }

      return tiers;
    },

    /**
     * Update tier
     */
    async update(tierId: string, input: Partial<CreateTierInput>): Promise<VendorTier> {
      // If setting as default, unset other default tiers
      if (input.is_default) {
        const db = getDbClient();
        await db
          .from('vendor_tiers')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .neq('id', tierId)
          .eq('is_default', true);
      }

      const result = await updateQuery<VendorTier>(
        'vendor_tiers',
        { id: tierId },
        { ...input, updated_at: new Date().toISOString() }
      );

      return result[0];
    },

    /**
     * Create subscription
     */
    async createSubscription(input: {
      vendor_id: string;
      tier_id: string;
      subscription_type: 'monthly' | 'six_month' | 'twelve_month' | 'yearly';
      payment_type: 'upfront' | 'split';
      total_amount: number;
      discount_amount: number;
      final_amount: number;
      split_installments?: number;
      split_interval_days?: number;
      next_payment_date?: string;
      next_payment_amount?: number;
      start_date: string;
      end_date: string;
      payment_ids?: string[];
    }): Promise<VendorTierSubscription> {
      // Cancel existing active subscriptions
      const db = getDbClient();
      await db
        .from('vendor_tier_subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('vendor_id', input.vendor_id)
        .eq('status', 'active');

      const result = await insertQuery<VendorTierSubscription>(
        'vendor_tier_subscriptions',
        {
          ...input,
          status: 'active',
          payment_ids: input.payment_ids || []
        }
      );

      return result[0];
    },

    /**
     * Find active subscription for vendor
     */
    async findActiveSubscriptionByVendor(vendorId: string): Promise<VendorTierSubscription | null> {
      const result = await selectQuery<VendorTierSubscription>(
        'vendor_tier_subscriptions',
        { vendor_id: vendorId, status: 'active' },
        { orderBy: 'created_at', orderDirection: 'desc', limit: 1 }
      );
      return result[0] || null;
    },

    /**
     * Find subscription by ID
     */
    async findSubscriptionById(subscriptionId: string): Promise<VendorTierSubscription | null> {
      const result = await selectQuery<VendorTierSubscription>(
        'vendor_tier_subscriptions',
        { id: subscriptionId },
        { limit: 1 }
      );
      return result[0] || null;
    },

    /**
     * Update subscription
     */
    async updateSubscription(
      subscriptionId: string,
      input: Partial<VendorTierSubscription>
    ): Promise<VendorTierSubscription> {
      const result = await updateQuery<VendorTierSubscription>(
        'vendor_tier_subscriptions',
        { id: subscriptionId },
        { ...input, updated_at: new Date().toISOString() }
      );

      return result[0];
    },

    /**
     * Create tier upgrade payment record
     */
    async createUpgradePayment(input: {
      vendor_id: string;
      current_tier_id?: string;
      target_tier_id: string;
      subscription_type: 'monthly' | 'six_month' | 'twelve_month' | 'yearly';
      payment_type: 'upfront' | 'split';
      total_amount: number;
      discount_amount: number;
      final_amount: number;
      razorpay_order_id?: string;
    }): Promise<TierUpgradePayment> {
      const result = await insertQuery<TierUpgradePayment>(
        'tier_upgrade_payments',
        {
          ...input,
          payment_status: 'pending'
        }
      );

      return result[0];
    },

    /**
     * Update upgrade payment
     */
    async updateUpgradePayment(
      paymentId: string,
      input: {
        razorpay_payment_id?: string;
        payment_status?: 'pending' | 'processing' | 'completed' | 'failed';
        subscription_id?: string;
      }
    ): Promise<TierUpgradePayment> {
      const result = await updateQuery<TierUpgradePayment>(
        'tier_upgrade_payments',
        { id: paymentId },
        { ...input, updated_at: new Date().toISOString() }
      );

      return result[0];
    },

    /**
     * Find upgrade payment by ID
     */
    async findUpgradePaymentById(paymentId: string): Promise<TierUpgradePayment | null> {
      const result = await selectQuery<TierUpgradePayment>(
        'tier_upgrade_payments',
        { id: paymentId },
        { limit: 1 }
      );
      return result[0] || null;
    }
  };
}

