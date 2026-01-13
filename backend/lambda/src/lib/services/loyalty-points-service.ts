/**
 * Loyalty Points Service
 * 
 * Handles loyalty points earning, auto-conversion to wallet, and action-based rules
 * AWS Serverless compatible (Lambda, RDS)
 */

import { query, select, insert, update, withTransaction } from '../../database/rds-connection';
import { loyaltySegmentationService } from './loyalty-segmentation-service';

export interface AwardPointsParams {
  customerId?: string;
  vendorId?: string;
  actionName: string;
  amount?: number; // Transaction amount for percentage/per_amount calculations
  referenceType?: string; // 'booking', 'order', 'payment', etc.
  referenceId?: string; // Booking ID, Order ID, etc.
  description?: string;
  metadata?: {
    // Transaction metadata
    serviceCategoryId?: string;
    serviceCategoryName?: string;
    serviceId?: string;
    vendorId?: string;
    bookingId?: string;
    orderId?: string;
    // Customer metadata
    isFirstPurchase?: boolean;
    isBirthdayMonth?: boolean;
    customerTier?: string;
    // Other metadata
    [key: string]: any;
  };
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
   * Get applicable rule for action using rule engine
   * Evaluates conditions against transaction metadata and database queries
   */
  private async getApplicableRule(params: AwardPointsParams): Promise<LoyaltyActionRule | null> {
    try {
      const userType = params.customerId ? 'customer' : 'vendor';
      
      // Get all candidate rules (matching action_name and user_type)
      const candidateRules = await query(
        `SELECT * FROM loyalty_action_rules
         WHERE action_name = $1
           AND user_type IN ($2, 'both')
           AND is_active = true
         ORDER BY priority DESC`,
        [params.actionName, userType]
      );

      if (candidateRules.rows.length === 0) {
        return null;
      }

      // Evaluate each rule's conditions using rule engine
      for (const rule of candidateRules.rows) {
        const ruleObj = rule as LoyaltyActionRule;
        const matches = await this.evaluateRuleConditions(ruleObj, params);
        
        if (matches) {
          console.log(`✅ [Rule Engine] Matched rule: ${ruleObj.action_name} (priority: ${ruleObj.priority})`);
          return ruleObj;
        }
      }

      // If no rule matches conditions, return null
      console.log(`⚠️ [Rule Engine] No rule matched conditions for action: ${params.actionName}`);
      return null;
    } catch (error: any) {
      console.error('Error getting applicable rule:', error);
      return null;
    }
  }

  /**
   * Rule Engine: Evaluate rule conditions against transaction metadata and database
   */
  private async evaluateRuleConditions(rule: LoyaltyActionRule, params: AwardPointsParams): Promise<boolean> {
    try {
      // If no conditions, rule matches by default
      if (!rule.conditions || Object.keys(rule.conditions).length === 0) {
        return true;
      }

      const conditions = rule.conditions;
      let allConditionsMet = true;

      // 1. Service Category Matching
      if (conditions.service_categories && Array.isArray(conditions.service_categories)) {
        if (params.metadata?.serviceCategoryId) {
          const matchesCategory = conditions.service_categories.includes(params.metadata.serviceCategoryId);
          if (!matchesCategory) {
            // Try to match by category name if ID doesn't match
            const matchesByName = conditions.service_categories.some((cat: any) => {
              if (typeof cat === 'string') {
                return cat.toLowerCase() === params.metadata?.serviceCategoryName?.toLowerCase();
              }
              return false;
            });
            if (!matchesByName) {
              console.log(`[Rule Engine] Category mismatch: rule requires ${conditions.service_categories}, got ${params.metadata.serviceCategoryId}`);
              return false;
            }
          }
        } else {
          // If rule requires categories but transaction doesn't have one, try to fetch from reference
          if (params.referenceType === 'booking' && params.referenceId) {
            const categoryMatch = await this.checkServiceCategoryFromBooking(params.referenceId, conditions.service_categories);
            if (!categoryMatch) {
              console.log(`[Rule Engine] Category mismatch from booking: ${params.referenceId}`);
              return false;
            }
          } else {
            console.log(`[Rule Engine] Rule requires service categories but transaction has none`);
            return false;
          }
        }
      }

      // 2. Vendor ID Matching
      if (conditions.vendor_ids && Array.isArray(conditions.vendor_ids)) {
        const transactionVendorId = params.metadata?.vendorId || params.vendorId;
        if (!transactionVendorId || !conditions.vendor_ids.includes(transactionVendorId)) {
          // Try to fetch from booking/order if not in metadata
          if (params.referenceType === 'booking' && params.referenceId) {
            const bookingVendor = await this.getVendorFromBooking(params.referenceId);
            if (!bookingVendor || !conditions.vendor_ids.includes(bookingVendor)) {
              console.log(`[Rule Engine] Vendor mismatch: rule requires ${conditions.vendor_ids}, got ${transactionVendorId || bookingVendor}`);
              return false;
            }
          } else {
            console.log(`[Rule Engine] Vendor mismatch: rule requires ${conditions.vendor_ids}, got ${transactionVendorId}`);
            return false;
          }
        }
      }

      // 3. Amount Range Matching
      if (conditions.amount_min !== undefined && params.amount !== undefined) {
        if (params.amount < conditions.amount_min) {
          console.log(`[Rule Engine] Amount too low: rule requires min ${conditions.amount_min}, got ${params.amount}`);
          return false;
        }
      }
      if (conditions.amount_max !== undefined && params.amount !== undefined) {
        if (params.amount > conditions.amount_max) {
          console.log(`[Rule Engine] Amount too high: rule requires max ${conditions.amount_max}, got ${params.amount}`);
          return false;
        }
      }

      // 4. Segment-based Matching (NEW - uses segmentation service)
      if (conditions.segment_ids && Array.isArray(conditions.segment_ids)) {
        if (params.customerId) {
          const belongsToSegments = await loyaltySegmentationService.customerBelongsToSegments(
            params.customerId,
            conditions.segment_ids
          );
          if (!belongsToSegments) {
            console.log(`[Rule Engine] Segment mismatch: rule requires segments ${conditions.segment_ids}, customer does not belong`);
            return false;
          }
        } else if (params.vendorId) {
          // Vendor segment matching (if needed)
          console.log(`[Rule Engine] Vendor segment matching not yet implemented`);
          return false;
        } else {
          console.log(`[Rule Engine] Rule requires segments but no customer/vendor ID provided`);
          return false;
        }
      }

      // 5. Customer Tier Matching (legacy - still supported)
      if (conditions.customer_tiers && Array.isArray(conditions.customer_tiers)) {
        if (params.metadata?.customerTier) {
          if (!conditions.customer_tiers.includes(params.metadata.customerTier)) {
            console.log(`[Rule Engine] Customer tier mismatch: rule requires ${conditions.customer_tiers}, got ${params.metadata.customerTier}`);
            return false;
          }
        } else if (params.customerId) {
          // Fetch customer tier from database
          const customerTier = await this.getCustomerTier(params.customerId);
          if (!customerTier || !conditions.customer_tiers.includes(customerTier)) {
            console.log(`[Rule Engine] Customer tier mismatch from DB: rule requires ${conditions.customer_tiers}, got ${customerTier}`);
            return false;
          }
        } else {
          console.log(`[Rule Engine] Rule requires customer tiers but no customer ID provided`);
          return false;
        }
      }

      // 6. First Purchase Check
      if (conditions.first_purchase === true && params.customerId) {
        const isFirstPurchase = await this.isFirstPurchase(params.customerId, params.referenceType);
        if (!isFirstPurchase) {
          console.log(`[Rule Engine] First purchase required but customer has previous purchases`);
          return false;
        }
      }

      // 7. Birthday Month Check
      if (conditions.birthday_month === true && params.customerId) {
        const isBirthdayMonth = await this.isCustomerBirthdayMonth(params.customerId);
        if (!isBirthdayMonth) {
          console.log(`[Rule Engine] Birthday month required but not in birthday month`);
          return false;
        }
      }

      // 8. Service Type Matching (at_vendor, at_home, online)
      if (conditions.service_types && Array.isArray(conditions.service_types)) {
        if (params.referenceType === 'booking' && params.referenceId) {
          const serviceType = await this.getServiceTypeFromBooking(params.referenceId);
          if (!serviceType || !conditions.service_types.includes(serviceType)) {
            console.log(`[Rule Engine] Service type mismatch: rule requires ${conditions.service_types}, got ${serviceType}`);
            return false;
          }
        } else {
          console.log(`[Rule Engine] Rule requires service types but no booking reference provided`);
          return false;
        }
      }

      return allConditionsMet;
    } catch (error: any) {
      console.error('Error evaluating rule conditions:', error);
      // On error, default to matching (fail open) to avoid blocking legitimate transactions
      return true;
    }
  }

  /**
   * Helper: Check if booking's service category matches required categories
   */
  private async checkServiceCategoryFromBooking(bookingId: string, requiredCategories: string[]): Promise<boolean> {
    try {
      const booking = await query(
        `SELECT s.category_id, sc.category_name
         FROM bookings b
         JOIN services s ON b.service_id = s.id
         LEFT JOIN service_categories sc ON s.category_id = sc.id
         WHERE b.id = $1`,
        [bookingId]
      );

      if (booking.rows.length === 0) {
        return false;
      }

      const categoryId = booking.rows[0].category_id;
      const categoryName = booking.rows[0].category_name;

      return requiredCategories.some(cat => {
        if (cat === categoryId) return true;
        if (typeof cat === 'string' && categoryName && cat.toLowerCase() === categoryName.toLowerCase()) return true;
        return false;
      });
    } catch (error: any) {
      console.error('Error checking service category from booking:', error);
      return false;
    }
  }

  /**
   * Helper: Get vendor ID from booking
   */
  private async getVendorFromBooking(bookingId: string): Promise<string | null> {
    try {
      const booking = await query(
        `SELECT vendor_id FROM bookings WHERE id = $1`,
        [bookingId]
      );
      return booking.rows[0]?.vendor_id || null;
    } catch (error: any) {
      console.error('Error getting vendor from booking:', error);
      return null;
    }
  }

  /**
   * Helper: Get customer tier from database
   */
  private async getCustomerTier(customerId: string): Promise<string | null> {
    try {
      // Check if customer_tiers table exists, otherwise use loyalty profile
      const tier = await query(
        `SELECT tier FROM customer_tiers WHERE customer_id = $1`,
        [customerId]
      ).catch(async () => {
        // Fallback: check loyalty profile for tier
        const profile = await query(
          `SELECT tier FROM customer_loyalty_points WHERE customer_id = $1`,
          [customerId]
        );
        return profile;
      });

      return tier.rows[0]?.tier || null;
    } catch (error: any) {
      console.error('Error getting customer tier:', error);
      return null;
    }
  }

  /**
   * Helper: Check if this is customer's first purchase
   */
  private async isFirstPurchase(customerId: string, referenceType?: string): Promise<boolean> {
    try {
      const count = await query(
        `SELECT COUNT(*) as count FROM loyalty_transactions
         WHERE customer_id = $1
           AND transaction_type = 'earned'
           AND reference_type = $2`,
        [customerId, referenceType || 'booking']
      );
      return parseInt(count.rows[0]?.count || '0', 10) === 0;
    } catch (error: any) {
      console.error('Error checking first purchase:', error);
      return false;
    }
  }

  /**
   * Helper: Check if customer is in birthday month
   */
  private async isCustomerBirthdayMonth(customerId: string): Promise<boolean> {
    try {
      // Check customer's pets' birthdays
      const pets = await query(
        `SELECT date_of_birth FROM pets WHERE owner_id = $1 AND date_of_birth IS NOT NULL`,
        [customerId]
      );

      const currentMonth = new Date().getMonth() + 1; // 1-12

      return pets.rows.some(pet => {
        if (!pet.date_of_birth) return false;
        const birthDate = new Date(pet.date_of_birth);
        return birthDate.getMonth() + 1 === currentMonth;
      });
    } catch (error: any) {
      console.error('Error checking birthday month:', error);
      return false;
    }
  }

  /**
   * Helper: Get service type from booking (at_vendor, at_home, online)
   */
  private async getServiceTypeFromBooking(bookingId: string): Promise<string | null> {
    try {
      const booking = await query(
        `SELECT service_type FROM bookings WHERE id = $1`,
        [bookingId]
      );
      return booking.rows[0]?.service_type || null;
    } catch (error: any) {
      console.error('Error getting service type from booking:', error);
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

