"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSubscriptionEndpoints = registerSubscriptionEndpoints;
const rds_connection_1 = require("../database/rds-connection");
function registerSubscriptionEndpoints(app) {
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
            const plan = await (0, rds_connection_1.insert)('subscription_plans', {
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
        }
        catch (error) {
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
            const plans = await (0, rds_connection_1.select)('subscription_plans', { vendor_id: vendorId, is_active: true }, { orderBy: 'created_at', orderDirection: 'DESC' });
            return c.json({
                success: true,
                plans,
                total: plans.length,
            });
        }
        catch (error) {
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
            const plans = await (0, rds_connection_1.select)('subscription_plans', { id: planId });
            if (plans.length === 0) {
                return c.json({ error: 'Subscription plan not found' }, 404);
            }
            return c.json({
                success: true,
                plan: plans[0],
            });
        }
        catch (error) {
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
            const plans = await (0, rds_connection_1.select)('subscription_plans', { id: planId, is_active: true });
            if (plans.length === 0) {
                return c.json({ error: 'Subscription plan not found or inactive' }, 404);
            }
            const plan = plans[0];
            // Calculate next billing date
            const now = new Date();
            const nextBilling = new Date(now);
            if (plan.interval === 'monthly') {
                nextBilling.setMonth(nextBilling.getMonth() + 1);
            }
            else if (plan.interval === 'yearly') {
                nextBilling.setFullYear(nextBilling.getFullYear() + 1);
            }
            // Create subscription
            const subscription = await (0, rds_connection_1.insert)('customer_subscriptions', {
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
        }
        catch (error) {
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
            const subscriptions = await (0, rds_connection_1.query)(`SELECT s.*, p.name as plan_name, p.price, p.interval, v.business_name as vendor_name
         FROM customer_subscriptions s
         INNER JOIN subscription_plans p ON s.plan_id = p.id
         LEFT JOIN vendors v ON s.vendor_id = v.id
         WHERE s.customer_id = $1
         ORDER BY s.created_at DESC`, [customerId]);
            return c.json({
                success: true,
                subscriptions: subscriptions.rows,
                total: subscriptions.rows.length,
            });
        }
        catch (error) {
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
            const subscriptions = await (0, rds_connection_1.select)('customer_subscriptions', { id: subscriptionId });
            if (subscriptions.length === 0) {
                return c.json({ error: 'Subscription not found' }, 404);
            }
            const updated = await (0, rds_connection_1.update)('customer_subscriptions', { id: subscriptionId }, {
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancellation_reason: reason || 'User request',
            });
            return c.json({
                success: true,
                subscription: updated[0],
                message: 'Subscription cancelled successfully',
            });
        }
        catch (error) {
            console.error('Error cancelling subscription:', error);
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
            const dueSubscriptions = await (0, rds_connection_1.query)(`SELECT s.*, p.price, p.interval
         FROM customer_subscriptions s
         INNER JOIN subscription_plans p ON s.plan_id = p.id
         WHERE s.status = 'active'
         AND s.next_billing_date <= $1
         AND s.next_billing_date >= CURRENT_DATE - INTERVAL '1 day'`, [today]);
            const processed = [];
            for (const subscription of dueSubscriptions.rows) {
                // Calculate new next billing date
                const nextBilling = new Date(subscription.next_billing_date);
                if (subscription.interval === 'monthly') {
                    nextBilling.setMonth(nextBilling.getMonth() + 1);
                }
                else if (subscription.interval === 'yearly') {
                    nextBilling.setFullYear(nextBilling.getFullYear() + 1);
                }
                // Update subscription
                await (0, rds_connection_1.update)('customer_subscriptions', { id: subscription.id }, {
                    next_billing_date: nextBilling.toISOString().split('T')[0],
                    last_billed_at: new Date().toISOString(),
                });
                // TODO: Process payment via Razorpay
                // This would create a payment record and charge the customer
                processed.push(subscription.id);
            }
            return c.json({
                success: true,
                processed: processed.length,
                subscriptions: processed,
            });
        }
        catch (error) {
            console.error('Error processing renewals:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=subscriptions.js.map