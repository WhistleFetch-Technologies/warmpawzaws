/**
 * ============================================================================
 * TIER UPGRADE ENDPOINTS - SQL ONLY
 * ============================================================================
 * 
 * Vendor tier upgrade with payment options:
 * - Upfront payment (full amount)
 * - Split payment (3-4 installments, configurable)
 * - Discounts for 6/12 months upfront
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { getDbClient } from "../../lib/db";
import { createRazorpayOrder, verifyRazorpaySignature } from "./razorpay-integration";
import { v4 as uuidv4 } from "uuid";

export function tierUpgradeEndpoints(app: Hono) {
  const client = getDbClient();
  const BASE_PATH = '/make-server-3dd53475';

  /**
   * Get vendor current tier
   * GET /make-server-3dd53475/vendor/:vendorId/payment-tier
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/payment-tier`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const { data: vendor, error: vendorError } = await client
        .from('vendors')
        .select(`
          id,
          current_tier_id,
          tier_subscription_id,
          vendor_tiers (
            id,
            tier_name,
            display_name,
            commission_rate,
            monthly_cost,
            yearly_cost,
            is_free_tier
          )
        `)
        .eq('id', vendorId)
        .single();

      if (vendorError || !vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Get active subscription if exists
      let subscription = null;
      if (vendor.tier_subscription_id) {
        const { data: sub } = await client
          .from('vendor_tier_subscriptions')
          .select('*')
          .eq('id', vendor.tier_subscription_id)
          .single();
        subscription = sub;
      }

      return sendSuccess(c, {
        tier: vendor.vendor_tiers,
        subscription: subscription
      });
    } catch (error) {
      return sendError(c, error instanceof Error ? error.message : 'Failed to get tier', 500);
    }
  });

  /**
   * Get available tiers for upgrade
   * GET /make-server-3dd53475/vendor/:vendorId/available-tiers
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/available-tiers`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get vendor's role
      const { data: vendor } = await client
        .from('vendors')
        .select('role_id')
        .eq('id', vendorId)
        .single();

      // Get all active tiers
      let query = client
        .from('vendor_tiers')
        .select('*')
        .eq('is_active', true)
        .order('tier_level', { ascending: true });

      const { data: tiers, error } = await query;

      if (error) {
        throw error;
      }

      // Filter tiers applicable to vendor's role
      const applicableTiers = (tiers || []).filter((tier: any) => {
        if (!tier.applicable_roles || tier.applicable_roles.length === 0) {
          return true; // Applies to all roles
        }
        return vendor?.role_id && tier.applicable_roles.includes(vendor.role_id);
      });

      return sendSuccess(c, { tiers: applicableTiers });
    } catch (error) {
      return sendError(c, error instanceof Error ? error.message : 'Failed to get tiers', 500);
    }
  });

  /**
   * Calculate tier upgrade pricing
   * POST /make-server-3dd53475/vendor/:vendorId/calculate-tier-upgrade
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/calculate-tier-upgrade`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { tierId, subscriptionType, paymentType } = await c.req.json();

      // Get tier details
      const { data: tier, error: tierError } = await client
        .from('vendor_tiers')
        .select('*')
        .eq('id', tierId)
        .single();

      if (tierError || !tier) {
        return sendError(c, 'Tier not found', 404);
      }

      // Calculate pricing based on subscription type
      let baseAmount = 0;
      let discountAmount = 0;
      let finalAmount = 0;

      if (subscriptionType === 'monthly') {
        baseAmount = tier.monthly_cost || 0;
        finalAmount = baseAmount;
      } else if (subscriptionType === 'six_month') {
        baseAmount = (tier.monthly_cost || 0) * 6;
        discountAmount = (baseAmount * (tier.six_month_discount_percentage || 0)) / 100;
        finalAmount = baseAmount - discountAmount;
      } else if (subscriptionType === 'twelve_month' || subscriptionType === 'yearly') {
        baseAmount = tier.yearly_cost || tier.monthly_cost * 12 || 0;
        discountAmount = (baseAmount * (tier.twelve_month_discount_percentage || 0)) / 100;
        finalAmount = baseAmount - discountAmount;
      }

      // Calculate split payment details
      let splitDetails = null;
      if (paymentType === 'split' && tier.allow_split_payment) {
        const installments = tier.split_payment_installments || 3;
        const installmentAmount = finalAmount / installments;
        const intervalDays = tier.split_payment_interval_days || 30;

        splitDetails = {
          installments: installments,
          installmentAmount: Math.round(installmentAmount * 100) / 100,
          intervalDays: intervalDays,
          firstPaymentDate: new Date(),
          nextPaymentDates: Array.from({ length: installments - 1 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() + (intervalDays * (i + 1)));
            return date.toISOString().split('T')[0];
          })
        };
      }

      return sendSuccess(c, {
        tier: {
          id: tier.id,
          name: tier.tier_name,
          displayName: tier.display_name
        },
        pricing: {
          baseAmount: Math.round(baseAmount * 100) / 100,
          discountAmount: Math.round(discountAmount * 100) / 100,
          finalAmount: Math.round(finalAmount * 100) / 100,
          subscriptionType,
          paymentType
        },
        splitDetails
      });
    } catch (error) {
      return sendError(c, error instanceof Error ? error.message : 'Failed to calculate pricing', 500);
    }
  });

  /**
   * Initiate tier upgrade payment
   * POST /make-server-3dd53475/vendor/:vendorId/payment-tier/upgrade-payment
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/payment-tier/upgrade-payment`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const {
        targetTierId,
        subscriptionType,
        paymentType,
        billingCycle
      } = await c.req.json();

      // Get tier and calculate pricing
      const calcResponse = await fetch(
        `${BASE_PATH}/vendor/${vendorId}/calculate-tier-upgrade`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tierId: targetTierId,
            subscriptionType,
            paymentType
          })
        }
      );

      if (!calcResponse.ok) {
        return sendError(c, 'Failed to calculate pricing', 500);
      }

      const { pricing, splitDetails } = await calcResponse.json();

      // Create subscription record
      const subscriptionId = uuidv4();
      const startDate = new Date();
      const endDate = new Date();

      if (subscriptionType === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (subscriptionType === 'six_month') {
        endDate.setMonth(endDate.getMonth() + 6);
      } else if (subscriptionType === 'twelve_month' || subscriptionType === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      const { data: subscription, error: subError } = await client
        .from('vendor_tier_subscriptions')
        .insert({
          id: subscriptionId,
          vendor_id: vendorId,
          tier_id: targetTierId,
          subscription_type: subscriptionType,
          payment_type: paymentType,
          total_amount: pricing.baseAmount,
          discount_amount: pricing.discountAmount,
          final_amount: pricing.finalAmount,
          split_installments: paymentType === 'split' ? splitDetails?.installments : null,
          split_interval_days: paymentType === 'split' ? splitDetails?.intervalDays : null,
          next_payment_date: paymentType === 'split' ? splitDetails?.nextPaymentDates[0] : null,
          next_payment_amount: paymentType === 'split' ? splitDetails?.installmentAmount : null,
          status: 'pending_payment',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        })
        .select()
        .single();

      if (subError) {
        return sendError(c, 'Failed to create subscription', 500);
      }

      // Create payment(s)
      if (paymentType === 'upfront') {
        // Single upfront payment
        const razorpayOrder = await createRazorpayOrder(
          pricing.finalAmount,
          null,
          null,
          `Tier upgrade: ${targetTierId}`
        );

        const paymentId = uuidv4();
        await client
          .from('tier_upgrade_payments')
          .insert({
            id: paymentId,
            vendor_id: vendorId,
            subscription_id: subscriptionId,
            tier_id: targetTierId,
            payment_type: 'upfront',
            amount: pricing.finalAmount,
            payment_status: 'pending',
            razorpay_order_id: razorpayOrder.id,
            due_date: startDate.toISOString().split('T')[0]
          });

        return sendSuccess(c, {
        subscriptionId,
          paymentId,
          razorpayOrderId: razorpayOrder.id,
          amount: pricing.finalAmount,
          message: 'Tier upgrade payment initiated'
        });
      } else {
        // Split payment - create first installment
        const firstAmount = splitDetails.installmentAmount;
        const razorpayOrder = await createRazorpayOrder(
          firstAmount,
          null,
          null,
          `Tier upgrade (1/${splitDetails.installments}): ${targetTierId}`
        );

        const paymentId = uuidv4();
        await client
          .from('tier_upgrade_payments')
          .insert({
            id: paymentId,
            vendor_id: vendorId,
            subscription_id: subscriptionId,
            tier_id: targetTierId,
            payment_type: 'split_installment',
            installment_number: 1,
            amount: firstAmount,
            payment_status: 'pending',
            razorpay_order_id: razorpayOrder.id,
            due_date: startDate.toISOString().split('T')[0]
          });

        // Create future installments (pending)
        const futurePayments = [];
        for (let i = 2; i <= splitDetails.installments; i++) {
          const futurePaymentId = uuidv4();
          const dueDate = new Date(splitDetails.nextPaymentDates[i - 2]);
          
          await client
            .from('tier_upgrade_payments')
            .insert({
              id: futurePaymentId,
              vendor_id: vendorId,
              subscription_id: subscriptionId,
              tier_id: targetTierId,
              payment_type: 'split_installment',
              installment_number: i,
              amount: splitDetails.installmentAmount,
              payment_status: 'pending',
              due_date: dueDate.toISOString().split('T')[0]
            });

          futurePayments.push({
            id: futurePaymentId,
            installmentNumber: i,
            amount: splitDetails.installmentAmount,
            dueDate: dueDate.toISOString().split('T')[0]
          });
        }

      return sendSuccess(c, {
        subscriptionId,
          paymentId,
          razorpayOrderId: razorpayOrder.id,
          amount: firstAmount,
          totalAmount: pricing.finalAmount,
          installments: splitDetails.installments,
          futurePayments,
          message: 'Tier upgrade payment initiated (split)'
        });
      }
    } catch (error) {
      console.error('Tier upgrade payment error:', error);
      return sendError(c, error instanceof Error ? error.message : 'Failed to initiate upgrade', 500);
    }
  });

  /**
   * Verify tier upgrade payment
   * POST /make-server-3dd53475/vendor/:vendorId/tier-upgrade/verify-payment
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/tier-upgrade/verify-payment`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const {
        paymentId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      } = await c.req.json();

      // Verify Razorpay signature
      const isSignatureValid = await verifyRazorpaySignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );

      if (!isSignatureValid) {
        return sendError(c, 'Invalid payment signature', 400);
      }

      // Get payment
      const { data: payment, error: paymentError } = await client
        .from('tier_upgrade_payments')
        .select('*, vendor_tier_subscriptions(*), vendor_tiers(*)')
        .eq('id', paymentId)
        .eq('vendor_id', vendorId)
        .single();

      if (paymentError || !payment) {
        return sendError(c, 'Payment not found', 404);
      }

      // Update payment status
      await client
        .from('tier_upgrade_payments')
        .update({
          payment_status: 'completed',
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: razorpaySignature,
          payment_date: new Date().toISOString()
        })
        .eq('id', paymentId);

      const subscription = payment.vendor_tier_subscriptions;

      // If this is the first payment or upfront, activate subscription
      if (payment.payment_type === 'upfront' || payment.installment_number === 1) {
        await client
          .from('vendor_tier_subscriptions')
          .update({
            status: 'active',
            payment_ids: [paymentId]
          })
          .eq('id', subscription.id);

        // Update vendor tier
        await client
          .from('vendors')
          .update({
            current_tier_id: payment.tier_id,
            tier_subscription_id: subscription.id,
            tier_upgraded_at: new Date().toISOString()
          })
          .eq('id', vendorId);
      } else {
        // Update subscription with payment ID
        const existingPaymentIds = subscription.payment_ids || [];
        await client
          .from('vendor_tier_subscriptions')
          .update({
            payment_ids: [...existingPaymentIds, paymentId],
            next_payment_date: payment.installment_number < (subscription.split_installments || 0)
              ? subscription.next_payment_date
              : null,
            next_payment_amount: payment.installment_number < (subscription.split_installments || 0)
              ? subscription.next_payment_amount
              : null
          })
          .eq('id', subscription.id);
      }

      return sendSuccess(c, {
        success: true,
        paymentId,
        message: 'Tier upgrade payment verified successfully'
      });
    } catch (error) {
      console.error('Tier upgrade verification error:', error);
      return sendError(c, error instanceof Error ? error.message : 'Failed to verify payment', 500);
    }
  });

  /**
   * Get tier upgrade payment history
   * GET /make-server-3dd53475/vendor/:vendorId/tier-upgrade/payments
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/tier-upgrade/payments`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const { data: payments, error } = await client
        .from('tier_upgrade_payments')
        .select('*, vendor_tiers(tier_name, display_name)')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return sendSuccess(c, { payments: payments || [] });
    } catch (error) {
      return sendError(c, error instanceof Error ? error.message : 'Failed to get payments', 500);
    }
  });

  console.log('✅ Tier upgrade endpoints registered');
}
