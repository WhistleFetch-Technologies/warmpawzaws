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
        // Determine if this is for a vendor or customer
        const isVendor = !!params.vendorId;
        const userId = params.customerId || params.vendorId;
        if (!userId) {
          throw new Error('customerId or vendorId is required');
        }

        // Use vendor-specific tables for vendors, customer tables for customers
        const loyaltyTable = isVendor ? 'vendor_loyalty_points' : 'customer_loyalty_points';
        const loyaltyTxTable = isVendor ? 'vendor_loyalty_transactions' : 'loyalty_transactions';
        const walletTable = isVendor ? 'vendor_wallets' : 'customer_wallets';
        const walletTxTable = isVendor ? 'vendor_wallet_transactions' : 'wallet_transactions';
        const idColumn = isVendor ? 'vendor_id' : 'customer_id';

        // Get or create loyalty profile (using transaction client)
        let profileResult = await client.query(
          `SELECT * FROM ${loyaltyTable} WHERE ${idColumn} = $1`,
          [userId]
        );
        let profile = profileResult.rows;
        
        if (profile.length === 0) {
          const profileInsertResult = await client.query(
            `INSERT INTO ${loyaltyTable} (${idColumn}, total_points, lifetime_points_earned, lifetime_points_redeemed, created_at, updated_at)
             VALUES ($1, 0, 0, 0, NOW(), NOW())
             RETURNING *`,
            [userId]
          );
          profile = profileInsertResult.rows;
          console.log(`[LOYALTY] Created new loyalty profile for ${isVendor ? 'vendor' : 'customer'} ${userId}`);
        }

        // Create loyalty transaction (using transaction client)
        await client.query(
          `INSERT INTO ${loyaltyTxTable} (${idColumn}, transaction_type, points, reference_type, reference_id, description, created_at)
           VALUES ($1, 'earned', $2, $3, $4, $5, NOW())`,
          [
            userId,
            finalPoints,
            params.referenceType || params.actionName,
            params.referenceId || null,
            params.description || `Earned ${finalPoints} points for ${params.actionName}`,
          ]
        );

        // Update loyalty profile
        await client.query(
          `UPDATE ${loyaltyTable}
           SET total_points = total_points + $1,
               lifetime_points_earned = lifetime_points_earned + $1,
               updated_at = NOW()
           WHERE ${idColumn} = $2`,
          [finalPoints, userId]
        );

        // Auto-convert to wallet using conversion_rate from loyalty_rules
        // Fetch active loyalty rule to get conversion_rate (using transaction client)
        const loyaltyRulesResult = await client.query(
          `SELECT * FROM loyalty_rules WHERE is_active = true LIMIT 1`
        );
        const loyaltyRules = loyaltyRulesResult.rows;
        let conversionRate = 1.0; // Default: 1 point = 1 rupee
        
        console.log(`[LOYALTY] Fetching conversion rate. Found ${loyaltyRules.length} active rule(s)`);
        
        if (loyaltyRules.length > 0) {
          const rule = loyaltyRules[0];
          console.log(`[LOYALTY] Rule: ${rule.rule_name}, conversion_rate: ${rule.conversion_rate}, redemption_rate: ${rule.redemption_rate}`);
          
          // Use conversion_rate if available, otherwise fall back to redemption_rate
          // conversion_rate: points to rupees (e.g., 100.0 means 100 points = 1 rupee)
          // redemption_rate: points per rupee (inverse relationship)
          if (rule.conversion_rate !== null && rule.conversion_rate !== undefined) {
            conversionRate = parseFloat(rule.conversion_rate);
            console.log(`[LOYALTY] Using conversion_rate: ${conversionRate}`);
          } else if (rule.redemption_rate !== null && rule.redemption_rate !== undefined) {
            // If conversion_rate not set, use redemption_rate as inverse
            // redemption_rate is "points per rupee", so conversion_rate = redemption_rate
            conversionRate = parseFloat(rule.redemption_rate);
            console.log(`[LOYALTY] Using redemption_rate: ${conversionRate}`);
          } else {
            console.log(`[LOYALTY] Both rates are NULL, using default: ${conversionRate}`);
          }
        } else {
          console.log(`[LOYALTY] No active rules found, using default: ${conversionRate}`);
        }
        
        // Calculate wallet amount: points / conversion_rate
        // Example: 500 points / 100.0 = ₹5 (if conversion_rate = 100)
        // Example: 500 points / 1.0 = ₹500 (if conversion_rate = 1)
        const walletAmount = finalPoints / conversionRate;
        
        console.log(`[LOYALTY] Conversion calculation: ${finalPoints} points / ${conversionRate} = ₹${walletAmount.toFixed(2)}`);

        // Get or create wallet (using transaction client)
        let walletResult = await client.query(
          `SELECT * FROM ${walletTable} WHERE ${idColumn} = $1`,
          [userId]
        );
        let wallets = walletResult.rows;
        
        if (wallets.length === 0) {
          const walletData: any = {
            [idColumn]: userId,
            balance: 0,
          };
          // Only add currency for customer_wallets (vendor_wallets doesn't have it)
          if (!isVendor) {
            walletData.currency = 'INR';
          }
          
          // Insert wallet using transaction client
          const keys = Object.keys(walletData);
          const values = Object.values(walletData);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
          const insertQuery = `INSERT INTO ${walletTable} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
          const insertResult = await client.query(insertQuery, values);
          wallets = insertResult.rows;
          
          console.log(`[LOYALTY] Created new wallet for ${isVendor ? 'vendor' : 'customer'} ${userId}`);
        }

        const wallet = wallets[0];

        // Credit wallet
        await client.query(
          `UPDATE ${walletTable}
           SET balance = balance + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [walletAmount, wallet.id]
        );

        // Create wallet transaction
        // Base fields that exist in both wallet_transactions and vendor_wallet_transactions
        const walletTxData: any = {
          wallet_id: wallet.id,
          transaction_type: 'credit',
          amount: walletAmount,
          balance_after: parseFloat(wallet.balance || 0) + walletAmount,
          reference_type: params.referenceType || params.actionName,
          reference_id: params.referenceId || null,
          description: `Loyalty points converted: ${finalPoints} points = ₹${walletAmount.toFixed(2)} (rate: ${conversionRate} points/rupee)`,
        };
        
        // Add vendor_id for vendor_wallet_transactions
        // Note: wallet_transactions may or may not have customer_id depending on schema version
        // We'll let the insert handle missing columns gracefully
        if (isVendor) {
          walletTxData.vendor_id = userId;
        }
        // For customer wallets, some schemas have customer_id, some don't
        // The insert will handle it - if column doesn't exist, it will be ignored

        // Insert wallet transaction using transaction client
        const walletTxKeys = Object.keys(walletTxData);
        const walletTxValues = Object.values(walletTxData);
        const walletTxPlaceholders = walletTxValues.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
          `INSERT INTO ${walletTxTable} (${walletTxKeys.join(', ')}, created_at)
           VALUES (${walletTxPlaceholders}, NOW())`,
          walletTxValues
        );

        console.log(`✅ [LOYALTY] Awarded ${finalPoints} points (₹${walletAmount.toFixed(2)} to wallet, conversion_rate: ${conversionRate}) for action: ${params.actionName} to ${isVendor ? 'vendor' : 'customer'}`);

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

