/**
 * ============================================================================
 * REFUND POLICY ENGINE
 * ============================================================================
 * 
 * Centralized refund policy engine that calculates refund amounts
 * based on refund rules and tiers stored in SQL database
 * 
 * Date: 2025-01-27
 * Phase 2: Task 2.4
 * ============================================================================
 */

import { getDbClient, selectQuery } from '../db.ts';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface RefundRule {
  id: string;
  name: string;
  description?: string | null;
  rule_type: 'time_based' | 'status_based' | 'amount_based' | 'custom';
  rule_config: {
    // Time-based rules
    fullRefundHours?: number;
    partialRefundHours?: number;
    noRefundHours?: number;
    partialPercentage?: number;
    processingFee?: number;
    
    // Status-based rules
    allowedStatuses?: string[];
    deniedStatuses?: string[];
    
    // Amount-based rules
    minAmount?: number;
    maxAmount?: number;
    
    // Custom rules
    conditions?: Record<string, any>;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RefundTier {
  id: string;
  tier_name: string;
  min_hours_before_booking: number;
  refund_percentage: number;
  is_active: boolean;
  created_at: string;
}

export interface RefundCalculationInput {
  booking_amount: number;
  booking_date?: string;
  booking_time?: string;
  cancellation_time?: string; // Defaults to now if not provided
  booking_status?: string;
  service_type?: string;
  vendor_id?: string;
  custom_rule_id?: string;
}

export interface RefundCalculationResult {
  refundable_amount: number;
  refund_percentage: number;
  processing_fee: number;
  net_refund: number;
  applied_rule?: string;
  applied_tier?: string;
  reason: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// REFUND POLICY ENGINE CLASS
// ============================================================================

export class RefundPolicyEngine {
  private client: SupabaseClient;
  private refundRulesCache: RefundRule[] | null = null;
  private refundTiersCache: RefundTier[] | null = null;
  private cacheExpiry: number | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Calculate refund amount based on policy rules and tiers
   */
  async calculateRefundAmount(
    input: RefundCalculationInput
  ): Promise<RefundCalculationResult> {
    try {
      // Get active refund rules and tiers
      const [rules, tiers] = await Promise.all([
        this.getActiveRefundRules(),
        this.getActiveRefundTiers(),
      ]);

      // Calculate hours until booking
      const hoursUntilBooking = this.calculateHoursUntilBooking(
        input.booking_date,
        input.booking_time,
        input.cancellation_time
      );

      // Find applicable tier (tiers are checked first as they're more specific)
      const applicableTier = this.findApplicableTier(tiers, hoursUntilBooking);

      // Find applicable rule
      const applicableRule = this.findApplicableRule(
        rules,
        input,
        hoursUntilBooking,
        applicableTier
      );

      // Calculate refund based on rule or tier
      if (applicableTier) {
        return this.calculateRefundFromTier(
          input.booking_amount,
          applicableTier,
          hoursUntilBooking
        );
      } else if (applicableRule) {
        return this.calculateRefundFromRule(
          input.booking_amount,
          applicableRule,
          hoursUntilBooking,
          input
        );
      } else {
        // Default: no refund
        return {
          refundable_amount: 0,
          refund_percentage: 0,
          processing_fee: 0,
          net_refund: 0,
          reason: 'No applicable refund policy found. No refund available.',
        };
      }
    } catch (error) {
      console.error('[REFUND_POLICY] Error calculating refund:', error);
      throw new Error(
        `Failed to calculate refund: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all active refund rules
   */
  async getActiveRefundRules(): Promise<RefundRule[]> {
    // Check cache
    if (
      this.refundRulesCache &&
      this.cacheExpiry &&
      Date.now() < this.cacheExpiry
    ) {
      return this.refundRulesCache;
    }

    const rules = await selectQuery<RefundRule>('refund_rules', {
      is_active: true,
    });

    // Update cache
    this.refundRulesCache = rules;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;

    return rules;
  }

  /**
   * Get all active refund tiers
   */
  async getActiveRefundTiers(): Promise<RefundTier[]> {
    // Check cache
    if (
      this.refundTiersCache &&
      this.cacheExpiry &&
      Date.now() < this.cacheExpiry
    ) {
      return this.refundTiersCache;
    }

    const tiers = await selectQuery<RefundTier>(
      'refund_tiers',
      {
        is_active: true,
      },
      {
        orderBy: 'min_hours_before_booking',
        orderDirection: 'desc', // Highest hours first (most permissive)
      }
    );

    // Update cache
    this.refundTiersCache = tiers;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;

    return tiers;
  }

  /**
   * Clear cache (useful for testing or after policy updates)
   */
  clearCache(): void {
    this.refundRulesCache = null;
    this.refundTiersCache = null;
    this.cacheExpiry = null;
  }

  /**
   * Calculate hours until booking
   */
  private calculateHoursUntilBooking(
    bookingDate?: string,
    bookingTime?: string,
    cancellationTime?: string
  ): number | null {
    if (!bookingDate || !bookingTime) {
      return null;
    }

    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
    const cancellationDateTime = cancellationTime
      ? new Date(cancellationTime)
      : new Date();

    const diffMs = bookingDateTime.getTime() - cancellationDateTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    return Math.max(0, diffHours); // Return 0 if cancellation is after booking time
  }

  /**
   * Find applicable refund tier based on hours until booking
   */
  private findApplicableTier(
    tiers: RefundTier[],
    hoursUntilBooking: number | null
  ): RefundTier | null {
    if (hoursUntilBooking === null) {
      return null;
    }

    // Tiers are sorted by min_hours_before_booking DESC
    // Find the first tier where hoursUntilBooking >= min_hours_before_booking
    return (
      tiers.find((tier) => hoursUntilBooking >= tier.min_hours_before_booking) ||
      null
    );
  }

  /**
   * Find applicable refund rule
   */
  private findApplicableRule(
    rules: RefundRule[],
    input: RefundCalculationInput,
    hoursUntilBooking: number | null,
    applicableTier: RefundTier | null
  ): RefundRule | null {
    // If custom rule ID is provided, use it
    if (input.custom_rule_id) {
      return rules.find((r) => r.id === input.custom_rule_id) || null;
    }

    // Filter rules by type and conditions
    for (const rule of rules) {
      if (this.isRuleApplicable(rule, input, hoursUntilBooking, applicableTier)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Check if a rule is applicable to the given input
   */
  private isRuleApplicable(
    rule: RefundRule,
    input: RefundCalculationInput,
    hoursUntilBooking: number | null,
    applicableTier: RefundTier | null
  ): boolean {
    const config = rule.rule_config;

    switch (rule.rule_type) {
      case 'time_based':
        if (hoursUntilBooking === null) {
          return false;
        }
        // Check if hours until booking falls within rule's time windows
        if (config.fullRefundHours && hoursUntilBooking >= config.fullRefundHours) {
          return true;
        }
        if (
          config.partialRefundHours &&
          hoursUntilBooking >= config.partialRefundHours &&
          hoursUntilBooking < (config.fullRefundHours || Infinity)
        ) {
          return true;
        }
        if (
          config.noRefundHours &&
          hoursUntilBooking >= config.noRefundHours &&
          hoursUntilBooking < (config.partialRefundHours || Infinity)
        ) {
          return true;
        }
        return false;

      case 'status_based':
        if (!input.booking_status) {
          return false;
        }
        if (config.allowedStatuses && !config.allowedStatuses.includes(input.booking_status)) {
          return false;
        }
        if (config.deniedStatuses && config.deniedStatuses.includes(input.booking_status)) {
          return false;
        }
        return true;

      case 'amount_based':
        if (config.minAmount && input.booking_amount < config.minAmount) {
          return false;
        }
        if (config.maxAmount && input.booking_amount > config.maxAmount) {
          return false;
        }
        return true;

      case 'custom':
        // Custom rules can have arbitrary conditions
        // This is a simplified implementation
        return true;

      default:
        return false;
    }
  }

  /**
   * Calculate refund from tier
   */
  private calculateRefundFromTier(
    bookingAmount: number,
    tier: RefundTier,
    hoursUntilBooking: number | null
  ): RefundCalculationResult {
    const refundPercentage = tier.refund_percentage;
    const refundableAmount = (bookingAmount * refundPercentage) / 100;
    const processingFee = 0; // Tiers don't specify processing fees
    const netRefund = Math.max(0, refundableAmount - processingFee);

    return {
      refundable_amount: refundableAmount,
      refund_percentage: refundPercentage,
      processing_fee: processingFee,
      net_refund: netRefund,
      applied_tier: tier.tier_name,
      reason: `Refund calculated based on tier '${tier.tier_name}': ${refundPercentage}% refund (${hoursUntilBooking?.toFixed(1) || 'N/A'} hours before booking)`,
      metadata: {
        tier_id: tier.id,
        tier_name: tier.tier_name,
        min_hours_before_booking: tier.min_hours_before_booking,
        hours_until_booking: hoursUntilBooking,
      },
    };
  }

  /**
   * Calculate refund from rule
   */
  private calculateRefundFromRule(
    bookingAmount: number,
    rule: RefundRule,
    hoursUntilBooking: number | null,
    input: RefundCalculationInput
  ): RefundCalculationResult {
    const config = rule.rule_config;
    let refundPercentage = 0;
    let reason = '';

    if (rule.rule_type === 'time_based' && hoursUntilBooking !== null) {
      if (config.fullRefundHours && hoursUntilBooking >= config.fullRefundHours) {
        refundPercentage = 100;
        reason = `Full refund: Cancelled ${hoursUntilBooking.toFixed(1)} hours before booking (minimum: ${config.fullRefundHours} hours)`;
      } else if (
        config.partialRefundHours &&
        hoursUntilBooking >= config.partialRefundHours
      ) {
        refundPercentage = config.partialPercentage || 50;
        reason = `Partial refund: Cancelled ${hoursUntilBooking.toFixed(1)} hours before booking (${refundPercentage}% refund)`;
      } else if (config.noRefundHours && hoursUntilBooking >= config.noRefundHours) {
        refundPercentage = 0;
        reason = `No refund: Cancelled ${hoursUntilBooking.toFixed(1)} hours before booking (below ${config.noRefundHours} hour threshold)`;
      } else {
        refundPercentage = 0;
        reason = `No refund: Cancelled too close to booking time (${hoursUntilBooking.toFixed(1)} hours)`;
      }
    } else {
      // For non-time-based rules, default to 100% or use rule config
      refundPercentage = config.partialPercentage || 100;
      reason = `Refund calculated based on rule '${rule.name}'`;
    }

    const refundableAmount = (bookingAmount * refundPercentage) / 100;
    const processingFee = (config.processingFee || 0) * (refundPercentage > 0 ? 1 : 0);
    const netRefund = Math.max(0, refundableAmount - processingFee);

    return {
      refundable_amount: refundableAmount,
      refund_percentage: refundPercentage,
      processing_fee: processingFee,
      net_refund: netRefund,
      applied_rule: rule.name,
      reason,
      metadata: {
        rule_id: rule.id,
        rule_name: rule.name,
        rule_type: rule.rule_type,
        hours_until_booking: hoursUntilBooking,
      },
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let engineInstance: RefundPolicyEngine | null = null;

/**
 * Get the global Refund Policy Engine instance
 */
export function getRefundPolicyEngine(client?: SupabaseClient): RefundPolicyEngine {
  if (!engineInstance) {
    engineInstance = new RefundPolicyEngine(client);
  }
  return engineInstance;
}

/**
 * Reset the global instance (useful for testing)
 */
export function resetRefundPolicyEngine(): void {
  engineInstance = null;
}

