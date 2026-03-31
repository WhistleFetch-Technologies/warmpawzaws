/**
 * Loyalty Points Service
 * 
 * Handles loyalty points earning, auto-conversion to wallet, and action-based rules
 * AWS Serverless compatible (Lambda, RDS)
 */

import { query, select, insert, update, withTransaction } from '../../../database/rds-connection';
import { loyaltySegmentationService } from '../loyalty-segmentation-service';

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

      // Award points and auto-convert to wallet.
      // ✅ CRITICAL: ALL database operations MUST use `client.query()` (the transaction
      // client), NOT the pool-based helpers like `select()`, `insert()`, `update()`.
      // Using pool helpers inside withTransaction breaks atomicity — pool operations
      // commit immediately even if the transaction rolls back, causing orphaned records.
      const awardResult = await withTransaction(async (client) => {
        const userId = params.customerId || params.vendorId;
        if (!userId) {
          throw new Error('customerId or vendorId is required');
        }

        // 1. Upsert loyalty profile
        await client.query(
          `INSERT INTO customer_loyalty_points (customer_id, total_points, lifetime_points_earned, lifetime_points_redeemed)
           VALUES ($1, 0, 0, 0)
           ON CONFLICT (customer_id) DO NOTHING`,
          [userId]
        );

        // 2. Create loyalty transaction (MUST use client, not pool insert)
        const isVendor = !!(params.vendorId && !params.customerId);
        await client.query(
          `INSERT INTO loyalty_transactions
             (transaction_type, points, reference_type, reference_id, description, vendor_id, customer_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'earned',
            finalPoints,
            params.referenceType || params.actionName,
            params.referenceId || null,
            params.description || `Action ${params.actionName}`,
            isVendor ? params.vendorId! : null,
            isVendor ? null : (params.customerId || userId),
          ]
        );

        // 3. Update loyalty profile totals
        await client.query(
          `UPDATE customer_loyalty_points
           SET total_points = total_points + $1,
               lifetime_points_earned = lifetime_points_earned + $1,
               updated_at = NOW()
           WHERE customer_id = $2`,
          [finalPoints, userId]
        );

        // 4. Auto-convert to wallet (100 points = ₹1)
        const conversionRate = 100;
        const walletAmount = Math.round((finalPoints / conversionRate) * 100) / 100;

        // ---------- Vendor wallet flow ----------
        if (isVendor) {
          // Upsert vendor wallet — SAVEPOINT protects against column mismatch
          await client.query('SAVEPOINT vendor_wallet_upsert');
            try {
            await client.query(
              `INSERT INTO vendor_wallets (vendor_id, balance, currency)
               VALUES ($1, 0, 'INR')
               ON CONFLICT (vendor_id) DO NOTHING`,
              [userId]
            );
            await client.query('RELEASE SAVEPOINT vendor_wallet_upsert');
          } catch (walletCreateErr: any) {
            await client.query('ROLLBACK TO SAVEPOINT vendor_wallet_upsert');
            if (walletCreateErr.message?.includes('currency') || walletCreateErr.message?.includes('column')) {
              await client.query(
                `INSERT INTO vendor_wallets (vendor_id, balance)
                 VALUES ($1, 0)
                 ON CONFLICT (vendor_id) DO NOTHING`,
                [userId]
              );
              } else {
              throw walletCreateErr;
              }
            }

          // Read wallet (MUST use client to see uncommitted upsert)
          const walletRes = await client.query(
            `SELECT id, balance FROM vendor_wallets WHERE vendor_id = $1`,
            [userId]
          );
          const wallet = walletRes.rows[0];
          if (!wallet) throw new Error(`vendor_wallets row not found for vendor ${userId}`);

          // Credit wallet
          await client.query(
            `UPDATE vendor_wallets
             SET balance = balance + $1, updated_at = NOW()
             WHERE id = $2`,
            [walletAmount, wallet.id]
          );

          const balAfterRes = await client.query(
            `SELECT balance FROM vendor_wallets WHERE id = $1`,
            [wallet.id]
          );
          const newBalance = parseFloat(balAfterRes.rows[0]?.balance || '0');

          // Wallet transaction — SAVEPOINT for optional source column
          await client.query('SAVEPOINT vwt_insert');
          try {
            await client.query(
              `INSERT INTO vendor_wallet_transactions
                 (wallet_id, vendor_id, transaction_type, amount, balance_after,
                  reference_type, reference_id, description, source)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [
                wallet.id, userId, 'credit', walletAmount, newBalance,
                params.referenceType || params.actionName,
                params.referenceId || null,
                `Loyalty points converted: ${finalPoints} points = ₹${walletAmount.toFixed(2)} (100 points = ₹1)`,
                'loyalty_points',
              ]
            );
            await client.query('RELEASE SAVEPOINT vwt_insert');
          } catch (vwtErr: any) {
            await client.query('ROLLBACK TO SAVEPOINT vwt_insert');
            // Retry without source column
            if (vwtErr.message?.includes('source') || vwtErr.message?.includes('column')) {
              await client.query(
                `INSERT INTO vendor_wallet_transactions
                   (wallet_id, vendor_id, transaction_type, amount, balance_after,
                    reference_type, reference_id, description)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [
                  wallet.id, userId, 'credit', walletAmount, newBalance,
                  params.referenceType || params.actionName,
                  params.referenceId || null,
                  `Loyalty points converted: ${finalPoints} points = ₹${walletAmount.toFixed(2)} (100 points = ₹1)`,
                ]
              );
            } else {
              throw vwtErr;
            }
          }

          console.log(`✅ [LOYALTY] Awarded ${finalPoints} points (₹${walletAmount} to vendor wallet) for action: ${params.actionName}`);
          return { points: finalPoints, walletCredited: walletAmount };
        }

        // ---------- Customer wallet flow ----------
        await client.query('SAVEPOINT cust_wallet_upsert');
        try {
          await client.query(
            `INSERT INTO customer_wallets (customer_id, balance, currency)
             VALUES ($1, 0, 'INR')
             ON CONFLICT (customer_id) DO NOTHING`,
            [userId]
          );
          await client.query('RELEASE SAVEPOINT cust_wallet_upsert');
        } catch (walletCreateErr: any) {
          await client.query('ROLLBACK TO SAVEPOINT cust_wallet_upsert');
          if (walletCreateErr.message?.includes('currency') || walletCreateErr.message?.includes('column')) {
            await client.query(
              `INSERT INTO customer_wallets (customer_id, balance)
               VALUES ($1, 0)
               ON CONFLICT (customer_id) DO NOTHING`,
              [userId]
            );
            } else {
            throw walletCreateErr;
            }
          }

        const custWalletRes = await client.query(
          `SELECT id, balance FROM customer_wallets WHERE customer_id = $1`,
          [userId]
        );
        const wallet = custWalletRes.rows[0];
        if (!wallet) throw new Error(`customer_wallets row not found for customer ${userId}`);

        // Credit wallet
        await client.query(
          `UPDATE customer_wallets
           SET balance = balance + $1, updated_at = NOW()
           WHERE id = $2`,
          [walletAmount, wallet.id]
        );

        const balAfterRes = await client.query(
          `SELECT balance FROM customer_wallets WHERE id = $1`,
          [wallet.id]
        );
        const newBalance = parseFloat(balAfterRes.rows[0]?.balance || '0');

        const walletTxnDesc = `Loyalty points converted: ${finalPoints} points = ₹${walletAmount.toFixed(2)} (100 points = ₹1)`;
        // Dev/prod schemas differ: some wallet_transactions use wallet_id (FK to customer_wallets.id), others customer_id.
        await client.query('SAVEPOINT cwt_insert');
        try {
          const colMismatch = (e: any) =>
            e?.code === '42703' ||
            (typeof e?.message === 'string' &&
              (e.message.includes('column') || e.message.includes('does not exist')));
          const attempts: Array<{ sql: string; params: unknown[] }> = [
            {
              sql: `INSERT INTO wallet_transactions
                     (wallet_id, transaction_type, amount, balance_after, description, source)
                   VALUES ($1,$2,$3,$4,$5,$6)`,
              params: [wallet.id, 'credit', walletAmount, newBalance, walletTxnDesc, 'loyalty_points'],
            },
            {
              sql: `INSERT INTO wallet_transactions
                     (wallet_id, transaction_type, amount, balance_after, description)
                   VALUES ($1,$2,$3,$4,$5)`,
              params: [wallet.id, 'credit', walletAmount, newBalance, walletTxnDesc],
            },
            {
              sql: `INSERT INTO wallet_transactions
                     (customer_id, transaction_type, amount, balance_after, description, source)
                   VALUES ($1,$2,$3,$4,$5,$6)`,
              params: [userId, 'credit', walletAmount, newBalance, walletTxnDesc, 'loyalty_points'],
            },
            {
              sql: `INSERT INTO wallet_transactions
                     (customer_id, transaction_type, amount, balance_after, description)
                   VALUES ($1,$2,$3,$4,$5)`,
              params: [userId, 'credit', walletAmount, newBalance, walletTxnDesc],
            },
          ];
          let inserted = false;
          let lastErr: any;
          for (const a of attempts) {
            try {
              await client.query(a.sql, a.params);
              inserted = true;
              break;
            } catch (err: any) {
              await client.query('ROLLBACK TO SAVEPOINT cwt_insert');
              if (!colMismatch(err)) throw err;
              lastErr = err;
            }
          }
          if (!inserted) throw lastErr ?? new Error('wallet_transactions insert failed');
          await client.query('RELEASE SAVEPOINT cwt_insert');
        } catch (cwtErr: any) {
          await client.query('ROLLBACK TO SAVEPOINT cwt_insert');
          throw cwtErr;
        }

        console.log(`✅ [LOYALTY] Awarded ${finalPoints} points (₹${walletAmount} to wallet) for action: ${params.actionName}`);
        return { points: finalPoints, walletCredited: walletAmount };
      });

      // Send in-app notification after successful award (non-blocking).
      // This should never fail the loyalty transaction.
      if (awardResult.points > 0) {
        await this.createPointsEarnedNotification(params, awardResult.points);
      }

      return awardResult;
    } catch (error: any) {
      console.error('Error awarding loyalty points:', error);
      throw error;
    }
  }

  /**
   * Create in-app notification for points earned.
   * Runs outside award transaction and is intentionally non-blocking.
   */
  private async createPointsEarnedNotification(params: AwardPointsParams, points: number): Promise<void> {
    try {
      const recipientId = params.customerId || params.vendorId;
      if (!recipientId) return;

      const recipientType = params.vendorId && !params.customerId ? 'vendor' : 'customer';
      const title = 'Loyalty Points Credited';
      const message = `You received ${points} points for ${params.actionName}.`;

      await insert('notifications', {
        recipient_type: recipientType,
        recipient_id: recipientId,
        notification_type: 'loyalty_points_earned',
        title,
        message,
        channels: {
          inApp: true,
          push: true,
          email: false,
          sms: false,
        },
      });
    } catch (error: any) {
      console.warn('[LOYALTY] Notification failed (non-blocking):', error?.message || error);
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
          const belongsToSegments = await loyaltySegmentationService.vendorBelongsToSegments(
            params.vendorId,
            conditions.segment_ids
          );
          if (!belongsToSegments) {
            console.log(`[Rule Engine] Segment mismatch: rule requires segments ${conditions.segment_ids}, vendor does not belong`);
            return false;
          }
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
   *
   * Uses description pattern to reliably match by actionName since
   * reference_type may differ from actionName (e.g., 'diagnostic' vs 'test_xyz').
   * The description is always set to "Earned N points for <actionName>" at insert.
   */
  private async checkFrequencyLimit(rule: LoyaltyActionRule, params: AwardPointsParams): Promise<boolean> {
    try {
      if (!rule.frequency_type || rule.frequency_type === 'unlimited') {
        return true;
      }

      const userId = params.customerId || params.vendorId;
      if (!userId) return false;
      const isVendorContext = !!params.vendorId && !params.customerId;
      const primaryEntityColumn = isVendorContext ? 'vendor_id' : 'customer_id';
      const fallbackEntityColumn = isVendorContext ? 'customer_id' : 'vendor_id';

      // Match on description which always ends with the actionName
      // Handles both "Action <name>" (consumer) and "Earned N points for <name>" (direct)
      const descPattern = `% ${params.actionName}`;

      const queryFrequencyCount = async (entityColumn: string, periodSql?: string): Promise<number> => {
        const periodClause = periodSql ? ` AND created_at >= ${periodSql}` : '';
        const result = await query(
          `SELECT COUNT(*) as count FROM loyalty_transactions
           WHERE ${entityColumn} = $1
             AND transaction_type = 'earned'
             AND description LIKE $2${periodClause}`,
          [userId, descPattern]
        );
        return parseInt(result.rows[0]?.count || '0', 10);
      };

      const getFrequencyCount = async (periodSql?: string): Promise<number> => {
        try {
          return await queryFrequencyCount(primaryEntityColumn, periodSql);
        } catch (error: any) {
          const message = String(error?.message || '');
          const missingPrimaryColumn =
            message.includes(`column "${primaryEntityColumn}" does not exist`) ||
            message.includes(`column ${primaryEntityColumn} does not exist`);
          if (!missingPrimaryColumn) {
            throw error;
          }
          // Some environments still store vendor rewards against customer_id.
          // Fallback keeps old data readable while supporting vendor_id-first schemas.
          return await queryFrequencyCount(fallbackEntityColumn, periodSql);
        }
      };

      if (rule.frequency_type === 'one_time') {
        const alreadyEarned = (await getFrequencyCount()) > 0;
        if (alreadyEarned) {
          console.log(`[Frequency] one_time: user ${userId} already earned for action ${params.actionName}`);
        }
        return !alreadyEarned;
      }

      if (rule.frequency_type === 'monthly_limit' && rule.frequency_limit) {
        const count = await getFrequencyCount(`DATE_TRUNC('month', CURRENT_DATE)`);
        return count < rule.frequency_limit;
      }

      if (rule.frequency_type === 'yearly_limit' && rule.frequency_limit) {
        const count = await getFrequencyCount(`DATE_TRUNC('year', CURRENT_DATE)`);
        return count < rule.frequency_limit;
      }

      if (rule.frequency_type === 'recurring') {
        // If recurring has an explicit limit+period, enforce it as a rolling period cap.
        if (rule.frequency_limit && rule.frequency_period) {
          const periodSqlMap: Record<string, string> = {
            day: `DATE_TRUNC('day', CURRENT_DATE)`,
            week: `DATE_TRUNC('week', CURRENT_DATE)`,
            month: `DATE_TRUNC('month', CURRENT_DATE)`,
            year: `DATE_TRUNC('year', CURRENT_DATE)`,
          };
          const periodSql = periodSqlMap[rule.frequency_period];
          if (periodSql) {
            const count = await getFrequencyCount(periodSql);
            return count < rule.frequency_limit;
          }
        }
        // Backward-compatible default recurring behavior: allow.
        return true;
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

