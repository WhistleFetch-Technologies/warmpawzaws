/**
 * ============================================================================
 * TIER UPGRADE ENDPOINTS - SQL VERSION
 * ============================================================================
 * 
 * Complete vendor tier system with upgrade flow
 * 
 * MIGRATED: All KV operations replaced with SQL repositories
 * 
 * Features:
 * - Multiple tier levels (Free, Basic, Pro, Enterprise)
 * - Feature-based restrictions
 * - Upgrade/downgrade flow
 * - Payment integration (Razorpay)
 * - Trial periods
 * - Usage tracking
 * - Benefits visualization
 * - Auto-renewal
 * 
 * Date: 2025-01-27
 * Migration: Phase 6 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getVendorTiersRepository } from "../../lib/repositories/vendor-tiers.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";

// ============================================================================
// ENDPOINTS
// ============================================================================

export function tierUpgradeEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const tiersRepo = getVendorTiersRepository();
  const vendorsRepo = getVendorsRepository();

  /**
   * GET /vendor/:vendorId/available-tiers
   * Get available tiers for vendor (excluding current tier)
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/available-tiers`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get available tiers
      const tiers = await tiersRepo.findAvailableForVendor(vendorId);

      return sendSuccess(c, {
        vendorId,
        tiers: tiers.map(tier => ({
          id: tier.id,
          tier_name: tier.tier_name,
          tier_level: tier.tier_level,
          display_name: tier.display_name,
          description: tier.description,
          commission_rate: tier.commission_rate,
          payout_period_days: tier.payout_period_days,
          monthly_cost: tier.monthly_cost,
          yearly_cost: tier.yearly_cost,
          six_month_cost: tier.six_month_cost,
          six_month_discount_percentage: tier.six_month_discount_percentage,
          twelve_month_cost: tier.twelve_month_cost,
          twelve_month_discount_percentage: tier.twelve_month_discount_percentage,
          allow_split_payment: tier.allow_split_payment,
          split_payment_installments: tier.split_payment_installments,
          split_payment_interval_days: tier.split_payment_interval_days,
          features: tier.features,
          is_free_tier: tier.is_free_tier
        }))
      });

    } catch (error) {
      console.error('❌ Error fetching available tiers:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /vendor/:vendorId/calculate-tier-upgrade
   * Calculate pricing for tier upgrade
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/calculate-tier-upgrade`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { tierId, subscriptionType, paymentType } = body;

      if (!tierId || !subscriptionType || !paymentType) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get tier details
      const tier = await tiersRepo.findById(tierId);
      if (!tier) {
        return sendError(c, 'Tier not found', 404);
      }

      // ✅ SQL: Get current subscription
      const currentSubscription = await tiersRepo.findActiveSubscriptionByVendor(vendorId);
      const currentTier = currentSubscription 
        ? await tiersRepo.findById(currentSubscription.tier_id)
        : await tiersRepo.findFreeTier();

      // Calculate base amount
      let baseAmount = 0;
      let discountAmount = 0;
      let discountPercentage = 0;

      switch (subscriptionType) {
        case 'monthly':
          baseAmount = tier.monthly_cost;
          break;
        case 'six_month':
          baseAmount = tier.six_month_cost || (tier.monthly_cost * 6);
          discountPercentage = tier.six_month_discount_percentage || 0;
          discountAmount = (baseAmount * discountPercentage) / 100;
          break;
        case 'twelve_month':
        case 'yearly':
          baseAmount = tier.twelve_month_cost || tier.yearly_cost || (tier.monthly_cost * 12);
          discountPercentage = tier.twelve_month_discount_percentage || 0;
          discountAmount = (baseAmount * discountPercentage) / 100;
          break;
      }

      const finalAmount = baseAmount - discountAmount;

      // Calculate split payment details if applicable
      let splitDetails = null;
      if (paymentType === 'split' && tier.allow_split_payment) {
        const installments = tier.split_payment_installments || 3;
        const installmentAmount = finalAmount / installments;
        const intervalDays = tier.split_payment_interval_days || 30;

        splitDetails = {
          installments,
          installmentAmount,
          intervalDays,
          totalAmount: finalAmount
        };
      }

      return sendSuccess(c, {
        tier: {
          id: tier.id,
          displayName: tier.display_name,
          tierLevel: tier.tier_level
        },
        pricing: {
          baseAmount,
          discountAmount,
          discountPercentage,
          finalAmount
        },
        splitDetails,
        currentTier: currentTier ? {
          id: currentTier.id,
          displayName: currentTier.display_name,
          tierLevel: currentTier.tier_level
        } : null
      });

    } catch (error) {
      console.error('❌ Error calculating tier upgrade:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /vendor/:vendorId/payment-tier/upgrade-payment
   * Initiate tier upgrade payment
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/payment-tier/upgrade-payment`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { targetTierId, subscriptionType, paymentType } = body;

      if (!targetTierId || !subscriptionType || !paymentType) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get tier
      const tier = await tiersRepo.findById(targetTierId);
      if (!tier) {
        return sendError(c, 'Tier not found', 404);
      }

      // ✅ SQL: Get current subscription
      const currentSubscription = await tiersRepo.findActiveSubscriptionByVendor(vendorId);
      const currentTierId = currentSubscription?.tier_id;

      // Calculate pricing
      let baseAmount = 0;
      let discountAmount = 0;

      switch (subscriptionType) {
        case 'monthly':
          baseAmount = tier.monthly_cost;
          break;
        case 'six_month':
          baseAmount = tier.six_month_cost || (tier.monthly_cost * 6);
          discountAmount = (baseAmount * (tier.six_month_discount_percentage || 0)) / 100;
          break;
        case 'twelve_month':
        case 'yearly':
          baseAmount = tier.twelve_month_cost || tier.yearly_cost || (tier.monthly_cost * 12);
          discountAmount = (baseAmount * (tier.twelve_month_discount_percentage || 0)) / 100;
          break;
      }

      const finalAmount = baseAmount - discountAmount;

      // Calculate subscription dates
      const startDate = new Date();
      const endDate = new Date(startDate);
      
      switch (subscriptionType) {
        case 'monthly':
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case 'six_month':
          endDate.setMonth(endDate.getMonth() + 6);
          break;
        case 'twelve_month':
        case 'yearly':
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
      }

      // Calculate split payment details
      let splitInstallments = null;
      let splitIntervalDays = null;
      let nextPaymentDate = null;
      let nextPaymentAmount = null;

      if (paymentType === 'split' && tier.allow_split_payment) {
        splitInstallments = tier.split_payment_installments || 3;
        splitIntervalDays = tier.split_payment_interval_days || 30;
        nextPaymentAmount = finalAmount / splitInstallments;
        nextPaymentDate = new Date(startDate);
        nextPaymentDate.setDate(nextPaymentDate.getDate() + splitIntervalDays);
      }

      // ✅ SQL: Create upgrade payment record
      const upgradePayment = await tiersRepo.createUpgradePayment({
        vendor_id: vendorId,
        current_tier_id: currentTierId || undefined,
        target_tier_id: targetTierId,
        subscription_type: subscriptionType,
        payment_type: paymentType,
        total_amount: baseAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount
      });

      // Create Razorpay order
      let razorpayOrderId = null;
      let razorpayPaymentId = null;

      try {
        const { createRazorpayOrder } = await import('./razorpay-payment-integration.tsx');
        const order = await createRazorpayOrder({
          amount: finalAmount * 100, // Convert to paise
          currency: 'INR',
          receipt: `tier-upgrade-${upgradePayment.id}`,
          notes: {
            vendorId,
            tierId: targetTierId,
            subscriptionType,
            paymentType
          }
        });

        razorpayOrderId = order.id;

        // ✅ SQL: Update upgrade payment with Razorpay order ID
        await tiersRepo.updateUpgradePayment(upgradePayment.id, {
          razorpay_order_id: razorpayOrderId,
          payment_status: 'processing'
        });

      } catch (error) {
        console.error('❌ Error creating Razorpay order:', error);
        // Continue without Razorpay for now (can be handled by frontend)
      }

      return sendSuccess(c, {
        paymentId: upgradePayment.id,
        razorpayOrderId,
        amount: finalAmount,
        currency: 'INR',
        tier: {
          id: tier.id,
          displayName: tier.display_name
        },
        subscriptionType,
        paymentType,
        splitDetails: splitInstallments ? {
          installments: splitInstallments,
          installmentAmount: nextPaymentAmount,
          intervalDays: splitIntervalDays,
          nextPaymentDate: nextPaymentDate?.toISOString()
        } : null
      });

    } catch (error) {
      console.error('❌ Error initiating tier upgrade payment:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /vendor/:vendorId/tier-upgrade/verify-payment
   * Verify tier upgrade payment and activate subscription
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/tier-upgrade/verify-payment`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

      if (!paymentId || !razorpayOrderId || !razorpayPaymentId) {
        return sendError(c, 'Missing required payment details', 400);
      }

      // ✅ SQL: Get upgrade payment
      const upgradePayment = await tiersRepo.findUpgradePaymentById(paymentId);
      if (!upgradePayment) {
        return sendError(c, 'Payment record not found', 404);
      }

      if (upgradePayment.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Verify Razorpay payment signature
      try {
        const { verifyRazorpayPayment } = await import('./razorpay-payment-integration.tsx');
        const isValid = await verifyRazorpayPayment({
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature
        });

        if (!isValid) {
          await tiersRepo.updateUpgradePayment(paymentId, {
            payment_status: 'failed'
          });
          return sendError(c, 'Payment verification failed', 400);
        }
      } catch (error) {
        console.error('❌ Payment verification error:', error);
        await tiersRepo.updateUpgradePayment(paymentId, {
          payment_status: 'failed'
        });
        return sendError(c, 'Payment verification failed', 400);
      }

      // ✅ SQL: Get tier details
      const tier = await tiersRepo.findById(upgradePayment.target_tier_id);
      if (!tier) {
        return sendError(c, 'Tier not found', 404);
      }

      // Calculate subscription dates
      const startDate = new Date();
      const endDate = new Date(startDate);
      
      switch (upgradePayment.subscription_type) {
        case 'monthly':
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case 'six_month':
          endDate.setMonth(endDate.getMonth() + 6);
          break;
        case 'twelve_month':
        case 'yearly':
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
      }

      // Calculate split payment details
      let splitInstallments = null;
      let splitIntervalDays = null;
      let nextPaymentDate = null;
      let nextPaymentAmount = null;

      if (upgradePayment.payment_type === 'split' && tier.allow_split_payment) {
        splitInstallments = tier.split_payment_installments || 3;
        splitIntervalDays = tier.split_payment_interval_days || 30;
        nextPaymentAmount = upgradePayment.final_amount / splitInstallments;
        nextPaymentDate = new Date(startDate);
        nextPaymentDate.setDate(nextPaymentDate.getDate() + splitIntervalDays);
      }

      // ✅ SQL: Create subscription
      const subscription = await tiersRepo.createSubscription({
        vendor_id: vendorId,
        tier_id: upgradePayment.target_tier_id,
        subscription_type: upgradePayment.subscription_type,
        payment_type: upgradePayment.payment_type,
        total_amount: upgradePayment.total_amount,
        discount_amount: upgradePayment.discount_amount,
        final_amount: upgradePayment.final_amount,
        split_installments: splitInstallments,
        split_interval_days: splitIntervalDays,
        next_payment_date: nextPaymentDate?.toISOString(),
        next_payment_amount: nextPaymentAmount,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        payment_ids: [paymentId]
      });

      // ✅ SQL: Update vendor tier
      await vendorsRepo.update(vendorId, {
        tier: tier.tier_name,
        commission_percentage: tier.commission_rate
      });

      // ✅ SQL: Update upgrade payment
      await tiersRepo.updateUpgradePayment(paymentId, {
        razorpay_payment_id: razorpayPaymentId,
        payment_status: 'completed',
        subscription_id: subscription.id
      });

      console.log(`✅ Tier upgrade completed: ${subscription.id}`);

      return sendSuccess(c, {
        subscriptionId: subscription.id,
        tierName: tier.display_name,
        status: subscription.status,
        endDate: subscription.end_date,
        nextPaymentDate: subscription.next_payment_date
      }, 'Tier upgraded successfully');

    } catch (error) {
      console.error('❌ Error verifying tier upgrade payment:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /vendor/:vendorId/tier/subscription
   * Get vendor's current subscription
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/tier/subscription`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get active subscription
      const subscription = await tiersRepo.findActiveSubscriptionByVendor(vendorId);
      
      if (!subscription) {
        // Return free tier
        const freeTier = await tiersRepo.findFreeTier();
        return sendSuccess(c, {
          vendorId,
          subscription: null,
          currentTier: freeTier ? {
            id: freeTier.id,
            tierName: freeTier.tier_name,
            displayName: freeTier.display_name,
            tierLevel: freeTier.tier_level,
            isFreeTier: true
          } : null
        });
      }

      // ✅ SQL: Get tier details
      const tier = await tiersRepo.findById(subscription.tier_id);

      return sendSuccess(c, {
        vendorId,
        subscription: {
          id: subscription.id,
          tierId: subscription.tier_id,
          subscriptionType: subscription.subscription_type,
          paymentType: subscription.payment_type,
          status: subscription.status,
          startDate: subscription.start_date,
          endDate: subscription.end_date,
          nextPaymentDate: subscription.next_payment_date,
          nextPaymentAmount: subscription.next_payment_amount
        },
        tier: tier ? {
          id: tier.id,
          tierName: tier.tier_name,
          displayName: tier.display_name,
          tierLevel: tier.tier_level,
          features: tier.features,
          commissionRate: tier.commission_rate,
          payoutPeriodDays: tier.payout_period_days
        } : null
      });

    } catch (error) {
      console.error('❌ Error fetching subscription:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /vendor/:vendorId/tier/subscription/:subscriptionId/cancel
   * Cancel subscription
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/tier/subscription/:subscriptionId/cancel`, async (c) => {
    try {
      const { vendorId, subscriptionId } = c.req.param();
      const { reason } = await c.req.json();

      // ✅ SQL: Get subscription
      const subscription = await tiersRepo.findSubscriptionById(subscriptionId);
      
      if (!subscription) {
        return sendError(c, 'Subscription not found', 404);
      }

      if (subscription.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Cancel subscription
      await tiersRepo.updateSubscription(subscriptionId, {
        status: 'cancelled'
      });

      // ✅ SQL: Revert vendor to free tier
      const freeTier = await tiersRepo.findFreeTier();
      if (freeTier) {
        await vendorsRepo.update(vendorId, {
          tier: freeTier.tier_name,
          commission_percentage: freeTier.commission_rate
        });
      }

      console.log(`✅ Subscription cancelled: ${subscriptionId}`);

      return sendSuccess(c, { subscriptionId }, 'Subscription cancelled successfully');

    } catch (error) {
      console.error('❌ Error cancelling subscription:', error);
      return sendError(c, String(error), 500);
    }
  });

  console.log('✅ Tier Upgrade Endpoints registered (SQL)');
}

