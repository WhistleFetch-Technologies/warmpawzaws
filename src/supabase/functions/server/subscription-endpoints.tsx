// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { getDbClient } from '../../../supabase/lib/db';

export function registerSubscriptionEndpoints(app: Hono) {

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
      
      const newPlan = {
        id: planId,
        vendorId,
        name,
        price: Number(price),
        interval, // 'monthly', 'yearly'
        features: features || [],
        isActive: true,
        createdAt: new Date().toISOString()
      };

      // ✅ SQL: Store subscription plan
      const db = getDbClient();
      await db.from('vendor_subscription_plans').insert({
        plan_id: planId,
        vendor_id: vendorId,
        name: name,
        price: Number(price),
        interval: interval,
        features: features || [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      return sendSuccess(c, { plan: newPlan });
    } catch (error) {
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
      // ✅ SQL: Get plans for vendor
      const db = getDbClient();
      const { data: plansData } = await db
        .from('vendor_subscription_plans')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      const plans = (plansData || []).map((p: any) => ({
        id: p.plan_id || p.id,
        planId: p.plan_id || p.id,
        vendorId: p.vendor_id,
        name: p.name,
        price: p.price,
        interval: p.interval,
        features: p.features || [],
        isActive: p.is_active,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));

      return sendSuccess(c, { plans });
    } catch (error) {
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
      
      // ✅ SQL: Get plan
      const db = getDbClient();
      const { data: planData } = await db
        .from('vendor_subscription_plans')
        .select('*')
        .eq('plan_id', planId)
        .single();
      
      if (!planData) return sendError(c, 'Plan not found', 404);
      
      const plan = {
        id: planData.plan_id || planData.id,
        vendorId: planData.vendor_id,
        name: planData.name,
        price: planData.price,
        interval: planData.interval,
        features: planData.features || []
      };

      const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Calculate next billing date
      const now = new Date();
      const nextBilling = new Date(now);
      if (plan.interval === 'monthly') {
        nextBilling.setMonth(nextBilling.getMonth() + 1);
      } else if (plan.interval === 'yearly') {
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
      }

      const subscription = {
        id: subId,
        userId,
        planId,
        vendorId: plan.vendorId,
        planName: plan.name,
        price: plan.price,
        interval: plan.interval,
        status: 'active',
        startDate: now.toISOString(),
        nextBillingDate: nextBilling.toISOString(),
        paymentMethodId: paymentMethodId || 'default'
      };

      // ✅ SQL: Store subscription
      await db.from('customer_subscriptions').insert({
        subscription_id: subId,
        customer_id: userId,
        plan_id: planId,
        vendor_id: plan.vendorId,
        plan_name: plan.name,
        price: plan.price,
        interval: plan.interval,
        status: 'active',
        start_date: now.toISOString(),
        next_billing_date: nextBilling.toISOString(),
        payment_method_id: paymentMethodId || 'default',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      return sendSuccess(c, { subscription });
    } catch (error) {
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
      
      // ✅ SQL: Get and update subscription
      const db = getDbClient();
      const { data: subData } = await db
        .from('customer_subscriptions')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .single();
      
      if (!subData) return sendError(c, 'Subscription not found', 404);

      // ✅ SQL: Update subscription status
      await db.from('customer_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || 'User request',
          updated_at: new Date().toISOString()
        })
        .eq('subscription_id', subscriptionId);
      
      const { data: updatedSub } = await db
        .from('customer_subscriptions')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .single();
      
      const sub = {
        id: updatedSub.subscription_id || updatedSub.id,
        subscriptionId: updatedSub.subscription_id,
        userId: updatedSub.customer_id,
        planId: updatedSub.plan_id,
        vendorId: updatedSub.vendor_id,
        planName: updatedSub.plan_name,
        price: updatedSub.price,
        interval: updatedSub.interval,
        status: updatedSub.status,
        startDate: updatedSub.start_date,
        nextBillingDate: updatedSub.next_billing_date,
        paymentMethodId: updatedSub.payment_method_id,
        cancelledAt: updatedSub.cancelled_at,
        cancellationReason: updatedSub.cancellation_reason
      };
      
      return sendSuccess(c, { subscription: sub });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/subscriptions/process-renewals
   * Mock Cron Job to process renewals
   */
  app.post("/make-server-3dd53475/subscriptions/process-renewals", async (c) => {
    try {
      // In a real app, we would iterate via a proper database query.
      // Here we iterate strictly for demo purposes (inefficient for large scale KV)
      // We will just mock the response saying "No renewals needed" or process a specific one if provided
      
      const { specificSubId } = await c.req.json().catch(() => ({}));
      
      if (specificSubId) {
        // ✅ SQL: Get subscription
        const db = getDbClient();
        const { data: subData } = await db
          .from('customer_subscriptions')
          .select('*')
          .eq('subscription_id', specificSubId)
          .single();
        
        if (subData && subData.status === 'active') {
            // Renew
             const now = new Date();
             const nextBilling = new Date(subData.next_billing_date);
             
             if (now >= nextBilling) {
                 // Process renewal
                 if (subData.interval === 'monthly') {
                    nextBilling.setMonth(nextBilling.getMonth() + 1);
                 } else {
                    nextBilling.setFullYear(nextBilling.getFullYear() + 1);
                 }
                 
                 // ✅ SQL: Update next billing date
                 await db.from('customer_subscriptions')
                   .update({
                     next_billing_date: nextBilling.toISOString(),
                     updated_at: new Date().toISOString()
                   })
                   .eq('subscription_id', specificSubId);
                 
                 const { data: renewedSub } = await db
                   .from('customer_subscriptions')
                   .select('*')
                   .eq('subscription_id', specificSubId)
                   .single();
                 
                 const sub = {
                   id: renewedSub.subscription_id || renewedSub.id,
                   subscriptionId: renewedSub.subscription_id,
                   userId: renewedSub.customer_id,
                   planId: renewedSub.plan_id,
                   vendorId: renewedSub.vendor_id,
                   planName: renewedSub.plan_name,
                   price: renewedSub.price,
                   interval: renewedSub.interval,
                   status: renewedSub.status,
                   startDate: renewedSub.start_date,
                   nextBillingDate: renewedSub.next_billing_date
                 };
                 
                 return sendSuccess(c, { subscription: sub }, 'Renewed successfully');
             }
        }
      }

      return sendSuccess(c, {}, 'Renewal check complete');
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}
