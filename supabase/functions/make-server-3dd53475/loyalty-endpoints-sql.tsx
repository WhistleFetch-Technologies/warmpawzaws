/**
 * ============================================================================
 * LOYALTY & REWARDS ENDPOINTS (SQL-ONLY)
 * ============================================================================
 * 
 * Complete loyalty and rewards management with SQL persistence.
 * Replaces: rewards-loyalty-system.tsx KV-based operations
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Full lifecycle: rules, profiles, transactions, earnings, redemptions
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getLoyaltyRepository } from '../../lib/repositories/loyalty.ts';
import { sendSuccess, sendError } from "./response-utils.ts";

export function registerLoyaltyEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const loyaltyRepo = getLoyaltyRepository();

  /**
   * GET /loyalty/rules
   * Get all loyalty rules (Admin)
   */
  app.get(`${BASE_PATH}/loyalty/rules`, async (c) => {
    try {
      const rules = await loyaltyRepo.getActiveRules();
      
      return sendSuccess(c, {
        rules: rules.map(rule => ({
          id: rule.id,
          ruleName: rule.rule_name,
          pointsPerRupee: rule.points_per_rupee,
          redemptionRate: rule.redemption_rate,
          minRedemptionPoints: rule.min_redemption_points,
          isActive: rule.is_active,
          createdAt: rule.created_at,
          updatedAt: rule.updated_at
        }))
      });
    } catch (error) {
      console.error('Error fetching loyalty rules:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /loyalty/earn
   * Earn loyalty points (e.g., after booking/purchase)
   */
  app.post(`${BASE_PATH}/loyalty/earn`, async (c) => {
    try {
      const body = await c.req.json();
      const { customerId, amount, referenceType, referenceId, description } = body;

      if (!customerId || amount === undefined) {
        return sendError(c, 'Missing required fields: customerId, amount', 400);
      }

      // Get default rule for earning (typically 1 point per rupee)
      const earnRule = await loyaltyRepo.getDefaultRule();
      if (!earnRule || !earnRule.is_active) {
        return sendError(c, 'Loyalty points earning is not configured', 400);
      }

      // Calculate points (amount * points_per_rupee)
      const points = Math.floor(amount * earnRule.points_per_rupee);

      if (points <= 0) {
        return sendError(c, 'Amount too low to earn points', 400);
      }

      // Create transaction and update profile
      const descriptionText = description || `Earned ${points} points`;
      await loyaltyRepo.addPoints(customerId, points, referenceType, referenceId, descriptionText);

      const profile = await loyaltyRepo.findOrCreate(customerId);

      return sendSuccess(c, {
        pointsEarned: points,
        totalPoints: profile.total_points
      }, 'Points earned successfully');
    } catch (error) {
      console.error('Error earning loyalty points:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /loyalty/redeem
   * Redeem loyalty points
   */
  app.post(`${BASE_PATH}/loyalty/redeem`, async (c) => {
    try {
      const body = await c.req.json();
      const { customerId, points, referenceType, referenceId, description } = body;

      if (!customerId || points === undefined) {
        return sendError(c, 'Missing required fields: customerId, points', 400);
      }

      // Get default rule for redemption
      const redeemRule = await loyaltyRepo.getDefaultRule();
      if (!redeemRule || !redeemRule.is_active) {
        return sendError(c, 'Loyalty points redemption is not configured', 400);
      }

      // Check minimum redemption points
      if (points < redeemRule.min_redemption_points) {
        return sendError(c, `Minimum ${redeemRule.min_redemption_points} points required for redemption`, 400);
      }

      // Check if customer has enough points
      const profile = await loyaltyRepo.findOrCreate(customerId);
      if (profile.total_points < points) {
        return sendError(c, 'Insufficient loyalty points', 400);
      }

      // Redeem points
      const descriptionText = description || `Redeemed ${points} points`;
      await loyaltyRepo.redeemPoints(customerId, points, descriptionText);

      const updatedProfile = await loyaltyRepo.findOrCreate(customerId);

      // Calculate cash value (points / redemption_rate)
      const cashValue = points / redeemRule.redemption_rate;

      return sendSuccess(c, {
        pointsRedeemed: points,
        cashValue,
        remainingPoints: updatedProfile.total_points
      }, 'Points redeemed successfully');
    } catch (error) {
      console.error('Error redeeming loyalty points:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/loyalty/transactions
   * Get customer loyalty transaction history
   */
  app.get(`${BASE_PATH}/customer/loyalty/transactions`, async (c) => {
    try {
      const customerId = c.req.query('customerId');
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = (page - 1) * limit;
      
      if (!customerId) {
        return sendError(c, 'customerId query parameter is required', 400);
      }

      const transactions = await loyaltyRepo.getTransactions(customerId, { limit, offset });

      return sendSuccess(c, {
        transactions: transactions.map(tx => ({
          id: tx.id,
          type: tx.transaction_type,
          points: tx.points,
          description: tx.description,
          referenceType: tx.reference_type,
          referenceId: tx.reference_id,
          expiresAt: tx.expires_at,
          createdAt: tx.created_at
        })),
        page,
        limit,
        total: transactions.length
      });
    } catch (error) {
      console.error('Error fetching loyalty transactions:', error);
      return sendError(c, error, 500);
    }
  });
}
