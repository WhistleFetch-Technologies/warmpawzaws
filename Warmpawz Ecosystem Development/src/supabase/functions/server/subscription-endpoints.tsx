import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

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

      await kv.set(`plan:${planId}`, newPlan);
      
      // Index by Vendor
      const vendorPlansKey = `vendor:${vendorId}:plans`;
      const vendorPlans = await kv.get(vendorPlansKey) || [];
      vendorPlans.push(planId);
      await kv.set(vendorPlansKey, vendorPlans);

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
      const vendorPlansKey = `vendor:${vendorId}:plans`;
      const planIds = await kv.get(vendorPlansKey) || [];
      
      const plans = [];
      for (const id of planIds) {
        const plan = await kv.get(`plan:${id}`);
        if (plan && plan.isActive) {
          plans.push(plan);
        }
      }

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
      
      const plan = await kv.get(`plan:${planId}`);
      if (!plan) return sendError(c, 'Plan not found', 404);

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

      await kv.set(`sub:${subId}`, subscription);

      // Index by User
      const userSubsKey = `user:${userId}:subscriptions`;
      const userSubs = await kv.get(userSubsKey) || [];
      userSubs.push(subId);
      await kv.set(userSubsKey, userSubs);

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
      
      const sub = await kv.get(`sub:${subscriptionId}`);
      if (!sub) return sendError(c, 'Subscription not found', 404);

      // Update status
      sub.status = 'cancelled';
      sub.cancelledAt = new Date().toISOString();
      sub.cancellationReason = reason || 'User request';
      
      // Keep nextBillingDate as the "valid until" date
      
      await kv.set(`sub:${subscriptionId}`, sub);
      
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
        const sub = await kv.get(`sub:${specificSubId}`);
        if (sub && sub.status === 'active') {
            // Renew
             const now = new Date();
             const nextBilling = new Date(sub.nextBillingDate);
             
             if (now >= nextBilling) {
                 // Process renewal
                 if (sub.interval === 'monthly') {
                    nextBilling.setMonth(nextBilling.getMonth() + 1);
                 } else {
                    nextBilling.setFullYear(nextBilling.getFullYear() + 1);
                 }
                 sub.nextBillingDate = nextBilling.toISOString();
                 await kv.set(`sub:${specificSubId}`, sub);
                 
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
