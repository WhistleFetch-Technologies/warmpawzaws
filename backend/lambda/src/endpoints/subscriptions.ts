/**
 * ============================================================================
 * SUBSCRIPTION ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor subscription plans:
 * - Create subscription plans
 * - Subscribe to plans
 * - Cancel subscriptions
 * - Process renewals
 * 
 * Migrated from: supabase/functions/server/subscription-endpoints.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';

export function registerSubscriptionEndpoints(app: Hono) {
  /**
   * POST /subscriptions/plans
   * Create a subscription plan
   */
  app.post("/subscriptions/plans", async (c) => {
    try {
      const { vendorId, name, price, interval, features, description } = await c.req.json();

      if (!vendorId || !name || !price || !interval) {
        return c.json({ error: 'vendorId, name, price, and interval are required' }, 400);
      }

      if (!['monthly', 'yearly'].includes(interval)) {
        return c.json({ error: 'interval must be monthly or yearly' }, 400);
      }

      const plan = await insert('subscription_plans', {
        vendor_id: vendorId,
        name,
        description: description || null,
        price: price,
        interval: interval,
        features: features || [],
        is_active: true,
      });

      return c.json({
        success: true,
        plan: plan[0],
        message: 'Subscription plan created successfully',
      });
    } catch (error: any) {
      console.error('Error creating subscription plan:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /subscriptions/plans/vendor/:vendorId
   * Get subscription plans for a vendor
   */
  app.get("/subscriptions/plans/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const plans = await select('subscription_plans',
        { vendor_id: vendorId, is_active: true },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );

      return c.json({
        success: true,
        plans,
        total: plans.length,
      });
    } catch (error: any) {
      console.error('Error fetching subscription plans:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /subscriptions/plans/:planId
   * Get subscription plan details
   */
  app.get("/subscriptions/plans/:planId", async (c) => {
    try {
      const { planId } = c.req.param();

      const plans = await select('subscription_plans', { id: planId });
      if (plans.length === 0) {
        return c.json({ error: 'Subscription plan not found' }, 404);
      }

      return c.json({
        success: true,
        plan: plans[0],
      });
    } catch (error: any) {
      console.error('Error fetching subscription plan:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /subscriptions/subscribe
   * Subscribe to a plan
   */
  app.post("/subscriptions/subscribe", async (c) => {
    try {
      const { customerId, planId, paymentMethodId } = await c.req.json();

      if (!customerId || !planId) {
        return c.json({ error: 'customerId and planId are required' }, 400);
      }

      // Get plan
      const plans = await select('subscription_plans', { id: planId, is_active: true });
      if (plans.length === 0) {
        return c.json({ error: 'Subscription plan not found or inactive' }, 404);
      }

      const plan = plans[0];

      // Calculate next billing date
      const now = new Date();
      const nextBilling = new Date(now);
      if (plan.interval === 'monthly') {
        nextBilling.setMonth(nextBilling.getMonth() + 1);
      } else if (plan.interval === 'yearly') {
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
      }

      // Create subscription
      const subscription = await insert('customer_subscriptions', {
        customer_id: customerId,
        plan_id: planId,
        vendor_id: plan.vendor_id,
        status: 'active',
        start_date: now.toISOString().split('T')[0],
        next_billing_date: nextBilling.toISOString().split('T')[0],
        payment_method_id: paymentMethodId || null,
      });

      return c.json({
        success: true,
        subscription: subscription[0],
        message: 'Subscribed successfully',
      });
    } catch (error: any) {
      console.error('Error subscribing:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /subscriptions/customer/:customerId
   * Get customer subscriptions
   */
  app.get("/subscriptions/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      const subscriptions = await query(
        `SELECT s.*, p.name as plan_name, p.price, p.interval, v.business_name as vendor_name
         FROM customer_subscriptions s
         INNER JOIN subscription_plans p ON s.plan_id = p.id
         LEFT JOIN vendors v ON s.vendor_id = v.id
         WHERE s.customer_id = $1
         ORDER BY s.created_at DESC`,
        [customerId]
      );

      return c.json({
        success: true,
        subscriptions: subscriptions.rows,
        total: subscriptions.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching subscriptions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /subscriptions/cancel
   * Cancel a subscription
   */
  app.post("/subscriptions/cancel", async (c) => {
    try {
      const { subscriptionId, reason } = await c.req.json();

      if (!subscriptionId) {
        return c.json({ error: 'subscriptionId is required' }, 400);
      }

      const subscriptions = await select('customer_subscriptions', { id: subscriptionId });
      if (subscriptions.length === 0) {
        return c.json({ error: 'Subscription not found' }, 404);
      }

      const updated = await update('customer_subscriptions',
        { id: subscriptionId },
        {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || 'User request',
        }
      );

      return c.json({
        success: true,
        subscription: updated[0],
        message: 'Subscription cancelled successfully',
      });
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/subscriptions
   * Get customer subscriptions (Phase 1 - Mobile Improvements)
   */
  app.get("/customer/:customerId/subscriptions", async (c) => {
    try {
      const { customerId } = c.req.param();

      const subscriptions = await query(
        `SELECT s.*, p.name as plan_name, p.price, p.interval, v.business_name as vendor_name
         FROM customer_subscriptions s
         INNER JOIN subscription_plans p ON s.plan_id = p.id
         LEFT JOIN vendors v ON s.vendor_id = v.id
         WHERE s.customer_id = $1
         ORDER BY s.created_at DESC`,
        [customerId]
      );

      return c.json({
        success: true,
        subscriptions: subscriptions.rows,
        total: subscriptions.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer subscriptions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /subscriptions/:subscriptionId
   * Get subscription details (Phase 1 - Mobile Improvements)
   */
  app.get("/subscriptions/:subscriptionId", async (c) => {
    try {
      const { subscriptionId } = c.req.param();

      const subscriptions = await query(
        `SELECT s.*, p.name as plan_name, p.price, p.interval, v.business_name as vendor_name
         FROM customer_subscriptions s
         INNER JOIN subscription_plans p ON s.plan_id = p.id
         LEFT JOIN vendors v ON s.vendor_id = v.id
         WHERE s.id = $1`,
        [subscriptionId]
      );

      if (subscriptions.rows.length === 0) {
        return c.json({ error: 'Subscription not found' }, 404);
      }

      return c.json({
        success: true,
        subscription: subscriptions.rows[0],
      });
    } catch (error: any) {
      console.error('Error fetching subscription details:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /subscriptions/:subscriptionId/pause
   * Pause a subscription (Phase 1 - Mobile Improvements)
   */
  app.post("/subscriptions/:subscriptionId/pause", async (c) => {
    try {
      const { subscriptionId } = c.req.param();
      const { pauseUntil } = await c.req.json();

      const subscriptions = await select('customer_subscriptions', { id: subscriptionId });
      if (subscriptions.length === 0) {
        return c.json({ error: 'Subscription not found' }, 404);
      }

      const pauseDate = pauseUntil ? new Date(pauseUntil) : null;

      const updated = await update('customer_subscriptions',
        { id: subscriptionId },
        {
          status: 'paused',
          paused_at: new Date().toISOString(),
          pause_until: pauseDate ? pauseDate.toISOString() : null,
        }
      );

      return c.json({
        success: true,
        subscription: updated[0],
        message: 'Subscription paused successfully',
      });
    } catch (error: any) {
      console.error('Error pausing subscription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /subscriptions/:subscriptionId/resume
   * Resume a paused subscription (Phase 1 - Mobile Improvements)
   */
  app.post("/subscriptions/:subscriptionId/resume", async (c) => {
    try {
      const { subscriptionId } = c.req.param();

      const subscriptions = await select('customer_subscriptions', { id: subscriptionId });
      if (subscriptions.length === 0) {
        return c.json({ error: 'Subscription not found' }, 404);
      }

      if (subscriptions[0].status !== 'paused') {
        return c.json({ error: 'Subscription is not paused' }, 400);
      }

      const updated = await update('customer_subscriptions',
        { id: subscriptionId },
        {
          status: 'active',
          resumed_at: new Date().toISOString(),
          pause_until: null,
        }
      );

      return c.json({
        success: true,
        subscription: updated[0],
        message: 'Subscription resumed successfully',
      });
    } catch (error: any) {
      console.error('Error resuming subscription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /subscriptions/:subscriptionId/usage
   * Get subscription usage (Phase 1 - Mobile Improvements)
   */
  app.get("/subscriptions/:subscriptionId/usage", async (c) => {
    try {
      const { subscriptionId } = c.req.param();
      const period = c.req.query('period') || 'month';

      // Get subscription
      const subscriptions = await select('customer_subscriptions', { id: subscriptionId });
      if (subscriptions.length === 0) {
        return c.json({ error: 'Subscription not found' }, 404);
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      if (period === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (period === 'year') {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }

      // Get usage data (bookings/services used)
      const usage = await query(
        `SELECT COUNT(*) as sessions_used, 
                SUM(COALESCE(b.total_amount, 0)) as total_spent
         FROM bookings b
         WHERE b.customer_id = $1
         AND b.created_at >= $2
         AND b.created_at <= $3
         AND b.status IN ('completed', 'confirmed')`,
        [subscriptions[0].customer_id, startDate.toISOString(), endDate.toISOString()]
      );

      return c.json({
        success: true,
        usage: {
          sessionsUsed: parseInt(usage.rows[0]?.sessions_used || '0', 10),
          totalSpent: parseFloat(usage.rows[0]?.total_spent || '0'),
          period,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });
    } catch (error: any) {
      console.error('Error fetching subscription usage:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /subscriptions/process-renewals
   * Process subscription renewals (cron job)
   */
  app.post("/subscriptions/process-renewals", async (c) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get subscriptions due for renewal
      const dueSubscriptions = await query(
        `SELECT s.*, p.price, p.interval
         FROM customer_subscriptions s
         INNER JOIN subscription_plans p ON s.plan_id = p.id
         WHERE s.status = 'active'
         AND s.next_billing_date <= $1
         AND s.next_billing_date >= CURRENT_DATE - INTERVAL '1 day'`,
        [today]
      );

      const processed = [];

      for (const subscription of dueSubscriptions.rows) {
        // Calculate new next billing date
        const nextBilling = new Date(subscription.next_billing_date);
        if (subscription.interval === 'monthly') {
          nextBilling.setMonth(nextBilling.getMonth() + 1);
        } else if (subscription.interval === 'yearly') {
          nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        }

        // Update subscription
        await update('customer_subscriptions',
          { id: subscription.id },
          {
            next_billing_date: nextBilling.toISOString().split('T')[0],
            last_billed_at: new Date().toISOString(),
          }
        );

        // Process payment via Razorpay
        try {
          const { getRazorpayClient } = require('../utils/razorpay-client');
          const razorpay = getRazorpayClient();
          
          // Get customer payment method (default or saved)
          const paymentMethods = await select('payment_methods', {
            customer_id: subscription.customer_id,
            is_default: true,
          });
          
          if (paymentMethods.length > 0 && paymentMethods[0].razorpay_payment_id) {
            // Create payment using saved payment method
            const payment = await razorpay.request('/payments/create/recurring', 'POST', {
              amount: Math.round(subscription.amount * 100), // Convert to paise
              currency: 'INR',
              customer_id: paymentMethods[0].razorpay_customer_id,
              token: paymentMethods[0].razorpay_token_id,
              recurring: true,
              description: `Subscription renewal: ${subscription.plan_name}`,
            });
            
            // Create payment record
            await insert('payments', {
              customer_id: subscription.customer_id,
              vendor_id: subscription.vendor_id,
              amount: subscription.amount,
              currency: 'INR',
              payment_method: 'razorpay',
              payment_status: payment.status === 'captured' ? 'completed' : 'pending',
              razorpay_payment_id: payment.id,
              subscription_id: subscription.id,
              booking_id: null,
            });
            
            console.log(`✅ Subscription payment processed: ${payment.id}`);
          } else {
            console.warn(`⚠️ No payment method found for customer ${subscription.customer_id}`);
            // Mark subscription as payment_failed
            await update('subscriptions', { id: subscription.id }, {
              status: 'payment_failed',
              last_payment_error: 'No payment method configured',
            });
          }
        } catch (error: any) {
          console.error('Error processing subscription payment:', error);
          // Mark subscription as payment_failed
          await update('subscriptions', { id: subscription.id }, {
            status: 'payment_failed',
            last_payment_error: error.message,
          });
        }

        processed.push(subscription.id);
      }

      return c.json({
        success: true,
        processed: processed.length,
        subscriptions: processed,
      });
    } catch (error: any) {
      console.error('Error processing renewals:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

