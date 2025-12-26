/**
 * ============================================================================
 * SUBSCRIPTION ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Vendor creates subscription plans (e.g., "Premium Grooming Membership")
 * - Customers subscribe to vendor plans
 * - Cancel subscriptions
 * - Process renewals
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Plans stored in `vendor_subscription_plans` table
 * - Subscriptions stored in `customer_subscriptions` table
 * 
 * Date: 2025-01-27
 * Migration: Batch 7 Phase 3 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from '../../lib/db.ts';

/**
 * SUBSCRIPTION ENDPOINTS - SQL-ONLY
 */
export function registerSubscriptionEndpoints(app: Hono) {
  const db = getDbClient();

  /**
   * POST /make-server-3dd53475/subscriptions/plans
   * Vendor creates a subscription plan (e.g., "Premium Grooming Membership")
   */
  app.post("/make-server-3dd53475/subscriptions/plans", async (c) => {
    try {
      const { vendorId, name, price, interval, features } = await c.req.json();
      
      if (!vendorId || !name || !price || !interval) {
        return sendError(c, 'Missing required fields', 400);
      }

      const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // ✅ SQL: Insert plan into vendor_subscription_plans table
      const { data: newPlan, error } = await db
        .from('vendor_subscription_plans')
        .insert({
          plan_id: planId,
          vendor_id: vendorId,
          name,
          price: Number(price),
          interval, // 'monthly', 'yearly'
          features: features || [],
          is_active: true
        })
        .select()
        .single();

      if (error || !newPlan) {
        console.error('Error creating plan:', error);
        return sendError(c, 'Failed to create plan', 500);
      }

      // Map to response format
      const planResponse = {
        id: newPlan.plan_id,
        vendorId: newPlan.vendor_id,
        name: newPlan.name,
        price: Number(newPlan.price),
        interval: newPlan.interval,
        features: newPlan.features || [],
        isActive: newPlan.is_active,
        createdAt: newPlan.created_at
      };

      return sendSuccess(c, { plan: planResponse });
    } catch (error) {
      console.error('Subscription plan creation error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/subscriptions/plans/:vendorId
   * List plans for a vendor
   */
  app.get("/make-server-3dd53475/subscriptions/plans/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get all active plans for vendor
      const { data: plans, error } = await db
        .from('vendor_subscription_plans')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching plans:', error);
        return sendError(c, 'Failed to fetch plans', 500);
      }

      // Map to response format
      const plansResponse = (plans || []).map((plan: any) => ({
        id: plan.plan_id,
        vendorId: plan.vendor_id,
        name: plan.name,
        price: Number(plan.price),
        interval: plan.interval,
        features: plan.features || [],
        isActive: plan.is_active,
        createdAt: plan.created_at
      }));

      return sendSuccess(c, { plans: plansResponse });
    } catch (error) {
      console.error('Error fetching plans:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/subscriptions/subscribe
   * User subscribes to a plan
   */
  app.post("/make-server-3dd53475/subscriptions/subscribe", async (c) => {
    try {
      const { userId, planId, paymentMethodId } = await c.req.json();
      
      // ✅ SQL: Get plan from vendor_subscription_plans
      const { data: plan, error: planError } = await db
        .from('vendor_subscription_plans')
        .select('*')
        .eq('plan_id', planId)
        .eq('is_active', true)
        .single();

      if (planError || !plan) {
        return sendError(c, 'Plan not found', 404);
      }

      const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Calculate next billing date
      const now = new Date();
      const nextBilling = new Date(now);
      if (plan.interval === 'monthly') {
        nextBilling.setMonth(nextBilling.getMonth() + 1);
      } else if (plan.interval === 'yearly') {
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
      }

      // ✅ SQL: Create subscription in customer_subscriptions table
      const { data: subscription, error: subError } = await db
        .from('customer_subscriptions')
        .insert({
          subscription_id: subId,
          customer_id: userId,
          plan_id: planId,
          vendor_id: plan.vendor_id,
          plan_name: plan.name,
          price: Number(plan.price),
          interval: plan.interval,
          status: 'active',
          start_date: now.toISOString(),
          next_billing_date: nextBilling.toISOString(),
          payment_method_id: paymentMethodId || 'default'
        })
        .select()
        .single();

      if (subError || !subscription) {
        console.error('Error creating subscription:', subError);
        return sendError(c, 'Failed to create subscription', 500);
      }

      // Map to response format
      const subscriptionResponse = {
        id: subscription.subscription_id,
        userId: subscription.customer_id,
        planId: subscription.plan_id,
        vendorId: subscription.vendor_id,
        planName: subscription.plan_name,
        price: Number(subscription.price),
        interval: subscription.interval,
        status: subscription.status,
        startDate: subscription.start_date,
        nextBillingDate: subscription.next_billing_date,
        paymentMethodId: subscription.payment_method_id
      };

      return sendSuccess(c, { subscription: subscriptionResponse });
    } catch (error) {
      console.error('Subscription creation error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/subscriptions/cancel
   * Cancel a subscription
   */
  app.post("/make-server-3dd53475/subscriptions/cancel", async (c) => {
    try {
      const { subscriptionId, reason } = await c.req.json();
      
      // ✅ SQL: Get subscription
      const { data: sub, error: fetchError } = await db
        .from('customer_subscriptions')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .single();

      if (fetchError || !sub) {
        return sendError(c, 'Subscription not found', 404);
      }

      // ✅ SQL: Update subscription status
      const { data: updatedSub, error: updateError } = await db
        .from('customer_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || 'User request',
          updated_at: new Date().toISOString()
        })
        .eq('subscription_id', subscriptionId)
        .select()
        .single();

      if (updateError || !updatedSub) {
        console.error('Error cancelling subscription:', updateError);
        return sendError(c, 'Failed to cancel subscription', 500);
      }

      // Map to response format
      const subscriptionResponse = {
        id: updatedSub.subscription_id,
        userId: updatedSub.customer_id,
        planId: updatedSub.plan_id,
        vendorId: updatedSub.vendor_id,
        planName: updatedSub.plan_name,
        price: Number(updatedSub.price),
        interval: updatedSub.interval,
        status: updatedSub.status,
        startDate: updatedSub.start_date,
        nextBillingDate: updatedSub.next_billing_date,
        cancelledAt: updatedSub.cancelled_at,
        cancellationReason: updatedSub.cancellation_reason
      };

      return sendSuccess(c, { subscription: subscriptionResponse });
    } catch (error) {
      console.error('Subscription cancellation error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/subscriptions/process-renewals
   * Process subscription renewals
   */
  app.post("/make-server-3dd53475/subscriptions/process-renewals", async (c) => {
    try {
      const { specificSubId } = await c.req.json().catch(() => ({}));
      
      if (specificSubId) {
        // ✅ SQL: Get specific subscription
        const { data: sub, error: fetchError } = await db
          .from('customer_subscriptions')
          .select('*')
          .eq('subscription_id', specificSubId)
          .eq('status', 'active')
          .single();

        if (!fetchError && sub) {
          const now = new Date();
          const nextBilling = new Date(sub.next_billing_date);
          
          if (now >= nextBilling) {
            // Process renewal
            const newNextBilling = new Date(nextBilling);
            if (sub.interval === 'monthly') {
              newNextBilling.setMonth(newNextBilling.getMonth() + 1);
            } else {
              newNextBilling.setFullYear(newNextBilling.getFullYear() + 1);
            }

            // ✅ SQL: Update next billing date
            const { data: renewedSub, error: updateError } = await db
              .from('customer_subscriptions')
              .update({
                next_billing_date: newNextBilling.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('subscription_id', specificSubId)
              .select()
              .single();

            if (!updateError && renewedSub) {
              const subscriptionResponse = {
                id: renewedSub.subscription_id,
                userId: renewedSub.customer_id,
                planId: renewedSub.plan_id,
                vendorId: renewedSub.vendor_id,
                planName: renewedSub.plan_name,
                price: Number(renewedSub.price),
                interval: renewedSub.interval,
                status: renewedSub.status,
                startDate: renewedSub.start_date,
                nextBillingDate: renewedSub.next_billing_date
              };

              return sendSuccess(c, { subscription: subscriptionResponse }, 'Renewed successfully');
            }
          }
        }
      }

      return sendSuccess(c, {}, 'Renewal check complete');
    } catch (error) {
      console.error('Renewal processing error:', error);
      return sendError(c, error, 500);
    }
  });
}

