"use strict";
/**
 * ============================================================================
 * RETURNS MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles return requests and refunds:
 * - Check return eligibility
 * - Create return requests
 * - Approve/reject returns
 * - Process refunds
 *
 * Migrated from: supabase/functions/make-server-3dd53475/returns-management-sql.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerReturnsEndpoints = registerReturnsEndpoints;
const rds_connection_1 = require("../database/rds-connection");
const razorpay_client_1 = require("../utils/razorpay-client");
function registerReturnsEndpoints(app) {
    /**
     * POST /returns/check-eligibility
     * Check if return is eligible
     */
    app.post("/returns/check-eligibility", async (c) => {
        try {
            const { orderId, productId, reason } = await c.req.json();
            if (!orderId || !productId || !reason) {
                return c.json({ error: 'orderId, productId, and reason are required' }, 400);
            }
            // Get order
            const orders = await (0, rds_connection_1.select)('orders', { id: orderId });
            if (orders.length === 0) {
                return c.json({ eligible: false, message: 'Order not found' });
            }
            const order = orders[0];
            // Check if order is delivered
            if (order.order_status !== 'delivered') {
                return c.json({ eligible: false, message: 'Order not yet delivered' });
            }
            // Get return policies from platform settings
            const settings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'admin:settings:return_policies' });
            const policies = settings.length > 0 ? settings[0].setting_value : [];
            // Find applicable policy (simplified - would need more complex matching)
            const policy = policies.find((p) => p.global === true) || policies[0];
            if (!policy) {
                return c.json({ eligible: false, message: 'No return policy found' });
            }
            // Check return window
            if (order.delivered_at) {
                const deliveryDate = new Date(order.delivered_at);
                const daysSinceDelivery = Math.floor((Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceDelivery > (policy.returnWindow || 7)) {
                    return c.json({
                        eligible: false,
                        message: `Return window expired. Returns allowed within ${policy.returnWindow || 7} days of delivery.`,
                    });
                }
            }
            return c.json({
                eligible: true,
                policy,
            });
        }
        catch (error) {
            console.error('Error checking return eligibility:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /returns/create
     * Create return request
     */
    app.post("/returns/create", async (c) => {
        try {
            const returnData = await c.req.json();
            const { orderId, customerId, vendorId, items, returnReason, description, images, pickupAddress, } = returnData;
            if (!orderId || !customerId || !vendorId || !items || !returnReason) {
                return c.json({ error: 'orderId, customerId, vendorId, items, and returnReason are required' }, 400);
            }
            // Create return request
            const returnRequest = await (0, rds_connection_1.insert)('returns', {
                order_id: orderId,
                customer_id: customerId,
                vendor_id: vendorId,
                items: items,
                return_reason: returnReason,
                description: description || null,
                images: images || [],
                status: 'pending',
                pickup_address: pickupAddress || {},
            });
            return c.json({
                success: true,
                returnRequest: returnRequest[0],
                message: 'Return request created successfully',
            });
        }
        catch (error) {
            console.error('Error creating return request:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /returns/:returnId
     * Get return details
     */
    app.get("/returns/:returnId", async (c) => {
        try {
            const { returnId } = c.req.param();
            const returns = await (0, rds_connection_1.select)('returns', { id: returnId });
            if (returns.length === 0) {
                return c.json({ error: 'Return not found' }, 404);
            }
            return c.json({
                success: true,
                returnRequest: returns[0],
            });
        }
        catch (error) {
            console.error('Error fetching return:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /returns/customer/:customerId
     * Get customer's returns
     */
    app.get("/returns/customer/:customerId", async (c) => {
        try {
            const { customerId } = c.req.param();
            const returns = await (0, rds_connection_1.query)(`SELECT * FROM returns
         WHERE customer_id = $1
         ORDER BY created_at DESC`, [customerId]).catch(() => ({ rows: [] }));
            return c.json({
                success: true,
                returns: returns.rows,
                total: returns.rows.length,
            });
        }
        catch (error) {
            console.error('Error fetching customer returns:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /returns/:returnId/approve
     * Approve return and schedule pickup
     */
    app.post("/returns/:returnId/approve", async (c) => {
        try {
            const { returnId } = c.req.param();
            const { logisticsPartner } = await c.req.json();
            const returns = await (0, rds_connection_1.select)('returns', { id: returnId });
            if (returns.length === 0) {
                return c.json({ error: 'Return not found' }, 404);
            }
            const returnRequest = returns[0];
            // Update return status
            const updated = await (0, rds_connection_1.update)('returns', { id: returnId }, {
                status: 'approved',
                approved_at: new Date().toISOString(),
                logistics: {
                    partner: logisticsPartner || 'shiprocket',
                },
            });
            return c.json({
                success: true,
                returnRequest: updated[0],
                message: 'Return approved. Pickup will be scheduled.',
            });
        }
        catch (error) {
            console.error('Error approving return:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /returns/:returnId/refund
     * Process refund for return
     */
    app.post("/returns/:returnId/refund", async (c) => {
        try {
            const { returnId } = c.req.param();
            const returns = await (0, rds_connection_1.select)('returns', { id: returnId, status: 'received' });
            if (returns.length === 0) {
                return c.json({ error: 'Return not found or not yet received' }, 404);
            }
            const returnRequest = returns[0];
            // Get order
            const orders = await (0, rds_connection_1.select)('orders', { id: returnRequest.order_id });
            if (orders.length === 0) {
                return c.json({ error: 'Order not found' }, 404);
            }
            const order = orders[0];
            // Parse items JSONB field
            const items = Array.isArray(returnRequest.items)
                ? returnRequest.items
                : (typeof returnRequest.items === 'string' ? JSON.parse(returnRequest.items) : []);
            // Calculate refund amount
            const refundAmount = items.reduce((sum, item) => {
                return sum + (parseFloat(item.price || '0') * (item.quantity || 1));
            }, 0);
            // Process refund via Razorpay
            try {
                const razorpayClient = await (0, razorpay_client_1.getRazorpayClient)();
                const refund = await razorpayClient.payments.refund({
                    payment_id: order.payment_id || '',
                    amount: Math.round(refundAmount * 100), // Convert to paise
                });
                // Update return with refund info
                await (0, rds_connection_1.update)('returns', { id: returnId }, {
                    status: 'refunded',
                    refund: {
                        amount: refundAmount,
                        method: 'original_payment',
                        status: 'completed',
                        transaction_id: refund.id,
                    },
                    completed_at: new Date().toISOString(),
                });
                // Update order
                await (0, rds_connection_1.update)('orders', { id: order.id }, { order_status: 'refunded' });
                return c.json({
                    success: true,
                    refund: {
                        amount: refundAmount,
                        transactionId: refund.id,
                        status: 'completed',
                    },
                    message: 'Refund processed successfully',
                });
            }
            catch (razorpayError) {
                console.error('Razorpay refund error:', razorpayError);
                throw razorpayError;
            }
        }
        catch (error) {
            console.error('Error processing refund:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /admin/returns/policies
     * Get return policies
     */
    app.get("/admin/returns/policies", async (c) => {
        try {
            const settings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'admin:settings:return_policies' });
            const policies = settings.length > 0 ? settings[0].setting_value : [];
            return c.json({
                success: true,
                policies,
            });
        }
        catch (error) {
            console.error('Error fetching return policies:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /admin/returns/policies
     * Create/update return policy
     */
    app.post("/admin/returns/policies", async (c) => {
        try {
            const policyData = await c.req.json();
            const settings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'admin:settings:return_policies' });
            const existingPolicies = settings.length > 0 ? settings[0].setting_value : [];
            // Add or update policy
            const policyIndex = existingPolicies.findIndex((p) => p.id === policyData.id);
            if (policyIndex >= 0) {
                existingPolicies[policyIndex] = policyData;
            }
            else {
                existingPolicies.push(policyData);
            }
            await (0, rds_connection_1.upsert)('platform_settings', {
                setting_key: 'admin:settings:return_policies',
                setting_value: existingPolicies,
                setting_type: 'json',
                description: 'Return policies configuration',
            }, 'setting_key');
            return c.json({
                success: true,
                message: 'Return policy saved',
            });
        }
        catch (error) {
            console.error('Error saving return policy:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=returns.js.map