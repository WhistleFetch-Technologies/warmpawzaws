/**
 * Loyalty Points Service
 * 
 * Handles loyalty points earning, auto-conversion to wallet, and action-based rules
 * AWS Serverless compatible (Lambda, RDS)
 */

import { query, select, insert, update, withTransaction } from '../../database/rds-connection';

export interface AwardPointsParams {
  customerId?: string;
  vendorId?: string;
  actionName: string;
  amount?: number; // Transaction amount for percentage/per_amount calculations
  referenceType?: string;
  referenceId?: string;
  description?: string;
  metadata?: any; // Additional metadata (e.g., birthday_month, first_purchase, etc.)
}

export interface LoyaltyActionRule {
  id: string;
  action_name: string;
  action_category: string;
  user_type: string;
  points_type: 'fixed' | 'percentage' | 'per_amount';
  points_value: number;
  base_amount?: number;
  min_amount?: number;
  max_points_per_transaction?: number;
  frequency_type?: string;
  frequency_limit?: number;
  frequency_period?: string;
  conditions?: any;
  multiplier_conditions?: any;
  is_active: boolean;
  priority: number;
}

export class LoyaltyPointsService {
  /**
   * Award points for an action (with auto-conversion to wallet)
   */
  async awardPoints(params: AwardPointsParams): Promise<{ points: number; walletCredited: number }> {
    try {
      // Get applicable rule
      const rule = await this.getApplicableRule(params);
      if (!rule) {
        console.log(`No rule found for action: ${params.actionName}`);
        return { points: 0, walletCredited: 0 };
      }

      // Check frequency limits
      const canEarn = await this.checkFrequencyLimit(rule, params);
      if (!canEarn) {
        console.log(`Frequency limit reached for action: ${params.actionName}`);
        return { points: 0, walletCredited: 0 };
      }

      // Calculate points
      const points = await this.calculatePoints(rule, params);

      if (points <= 0) {
        return { points: 0, walletCredited: 0 };
      }

      // Apply multipliers (e.g., birthday month 2x)
      const finalPoints = await this.applyMultipliers(rule, points, params);

      // Award points and auto-convert to wallet
      return await withTransaction(async (client) => {
        // Get or create loyalty profile
        const userId = params.customerId || params.vendorId;
        if (!userId) {
          throw new Error('customerId or vendorId is required');
        }

        let profile = await select('customer_loyalty_points', { customer_id: userId });
        if (profile.length === 0) {
          await insert('customer_loyalty_points', {
            customer_id: userId,
            total_points: 0,
            lifetime_points_earned: 0,
            lifetime_points_redeemed: 0,
          });
          profile = await select('customer_loyalty_points', { customer_id: userId });
        }

        // Create loyalty transaction
        await insert('loyalty_transactions', {
          customer_id: userId,
          transaction_type: 'earned',
          points: finalPoints,
          reference_type: params.referenceType || params.actionName,
          reference_id: params.referenceId || null,
          description: params.description || `Earned ${finalPoints} points for ${params.actionName}`,
        });

        // Update loyalty profile
        await client.query(
          `UPDATE customer_loyalty_points
           SET total_points = total_points + $1,
               lifetime_points_earned = lifetime_points_earned + $1,
               updated_at = NOW()
           WHERE customer_id = $2`,
          [finalPoints, userId]
        );

        // Auto-convert to wallet (1 point = 1 rupee)
        const walletAmount = finalPoints; // 1 point = 1 rupee

        // Get or create wallet
        let wallets = await select('customer_wallets', { customer_id: userId });
        if (wallets.length === 0) {
          await insert('customer_wallets', {
            customer_id: userId,
            balance: 0,
            currency: 'INR',
          });
          wallets = await select('customer_wallets', { customer_id: userId });
        }

        const wallet = wallets[0];

        // Credit wallet
        await client.query(
          `UPDATE customer_wallets
           SET balance = balance + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [walletAmount, wallet.id]
        );

        // Create wallet transaction
        await insert('wallet_transactions', {
          wallet_id: wallet.id,
          customer_id: userId,
          transaction_type: 'credit',
          amount: walletAmount,
          source: 'loyalty_points',
          description: `Loyalty points converted: ${finalPoints} points = ₹${walletAmount}`,
          reference_id: null,
        });

        console.log(`✅ [LOYALTY] Awarded ${finalPoints} points (₹${walletAmount} to wallet) for action: ${params.actionName}`);

        return {
          points: finalPoints,
          walletCredited: walletAmount,
        };
      });
    } catch (error: any) {
      console.error('Error awarding loyalty points:', error);
      throw error;
    }
  }

  /**
   * Get applicable rule for action
   */
  private async getApplicableRule(params: AwardPointsParams): Promise<LoyaltyActionRule | null> {
    try {
      const userType = params.customerId ? 'customer' : 'vendor';
      
      const rules = await query(
        `SELECT * FROM loyalty_action_rules
         WHERE action_name = $1
           AND user_type IN ($2, 'both')
           AND is_active = true
         ORDER BY priority DESC
         LIMIT 1`,
        [params.actionName, userType]
      );

      if (rules.rows.length === 0) {
        return null;
      }

      return rules.rows[0] as LoyaltyActionRule;
    } catch (error: any) {
      console.error('Error getting applicable rule:', error);
      return null;
    }
  }

  /**
   * Check frequency limits
   */
  private async checkFrequencyLimit(rule: LoyaltyActionRule, params: AwardPointsParams): Promise<boolean> {
    try {
      if (!rule.frequency_type || rule.frequency_type === 'unlimited') {
        return true;
      }

      const userId = params.customerId || params.vendorId;
      if (!userId) return false;

      if (rule.frequency_type === 'one_time') {
        // Check if already earned
        const existing = await query(
          `SELECT COUNT(*) as count FROM loyalty_transactions
           WHERE customer_id = $1
             AND reference_type = $2
             AND transaction_type = 'earned'`,
          [userId, params.actionName]
        );
        return parseInt(existing.rows[0]?.count || '0', 10) === 0;
      }

      if (rule.frequency_type === 'monthly_limit' && rule.frequency_limit) {
        const count = await query(
          `SELECT COUNT(*) as count FROM loyalty_transactions
           WHERE customer_id = $1
             AND reference_type = $2
             AND transaction_type = 'earned'
             AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
          [userId, params.actionName]
        );
        return parseInt(count.rows[0]?.count || '0', 10) < rule.frequency_limit;
      }

      if (rule.frequency_type === 'yearly_limit' && rule.frequency_limit) {
        const count = await query(
          `SELECT COUNT(*) as count FROM loyalty_transactions
           WHERE customer_id = $1
             AND reference_type = $2
             AND transaction_type = 'earned'
             AND created_at >= DATE_TRUNC('year', CURRENT_DATE)`,
          [userId, params.actionName]
        );
        return parseInt(count.rows[0]?.count || '0', 10) < rule.frequency_limit;
      }

      return true;
    } catch (error: any) {
      console.error('Error checking frequency limit:', error);
      return false;
    }
  }

  /**
   * Calculate points based on rule
   */
  private async calculatePoints(rule: LoyaltyActionRule, params: AwardPointsParams): Promise<number> {
    if (rule.points_type === 'fixed') {
      return Math.floor(rule.points_value);
    }

    if (rule.points_type === 'percentage' && params.amount && rule.base_amount) {
      // Percentage of amount
      const percentage = rule.points_value / 100;
      return Math.floor(params.amount * percentage);
    }

    if (rule.points_type === 'per_amount' && params.amount && rule.base_amount) {
      // Points per base_amount (e.g., 10 points per ₹1000)
      const multiplier = Math.floor(params.amount / rule.base_amount);
      let points = multiplier * rule.points_value;

      // Apply max points per transaction
      if (rule.max_points_per_transaction && points > rule.max_points_per_transaction) {
        points = rule.max_points_per_transaction;
      }

      return Math.floor(points);
    }

    return 0;
  }

  /**
   * Apply multipliers (e.g., birthday month 2x)
   */
  private async applyMultipliers(rule: LoyaltyActionRule, points: number, params: AwardPointsParams): Promise<number> {
    if (!rule.multiplier_conditions || Object.keys(rule.multiplier_conditions).length === 0) {
      return points;
    }

    let multiplier = 1;

    // Check birthday month multiplier
    if (rule.multiplier_conditions.birthday_month && params.metadata?.is_birthday_month) {
      multiplier = rule.multiplier_conditions.birthday_month;
    }

    return Math.floor(points * multiplier);
  }

  /**
   * Get customer loyalty balance (points + wallet)
   */
  async getLoyaltyBalance(customerId: string): Promise<{ points: number; walletBalance: number; total: number }> {
    try {
      const profile = await select('customer_loyalty_points', { customer_id: customerId });
      const wallets = await select('customer_wallets', { customer_id: customerId });

      const points = profile.length > 0 ? (profile[0].total_points || 0) : 0;
      const walletBalance = wallets.length > 0 ? parseFloat(wallets[0].balance || '0') : 0;

      return {
        points,
        walletBalance,
        total: points + walletBalance, // Total usable balance
      };
    } catch (error: any) {
      console.error('Error getting loyalty balance:', error);
      return { points: 0, walletBalance: 0, total: 0 };
    }
  }
}

export const loyaltyPointsService = new LoyaltyPointsService();

