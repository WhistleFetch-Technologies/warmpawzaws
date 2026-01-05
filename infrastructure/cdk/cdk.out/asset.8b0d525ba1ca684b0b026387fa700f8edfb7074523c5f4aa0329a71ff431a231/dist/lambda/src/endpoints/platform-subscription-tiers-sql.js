"use strict";
/**
 * PLATFORM SUBSCRIPTION TIER MANAGEMENT - SQL VERSION
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 *
 * Universal system for managing subscription tiers that control:
 * - Vendor commissions
 * - Customer benefits (delivery, priority, etc.)
 * - P2P service access (Mating & Dating)
 * - Feature access levels
 *
 * Status: ✅ SQL-ONLY IMPLEMENTATION
 * KV Operations: 36 → 0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPlatformSubscriptionTiersSQL = registerPlatformSubscriptionTiersSQL;
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
const vendors_1 = require("../lib/repositories/vendors");
function registerPlatformSubscriptionTiersSQL(app) {
    // ============================================
    // ADMIN: SUBSCRIPTION TIER MANAGEMENT
    // ============================================
    /**
     * POST /make-server-3dd53475/admin/subscription-tiers
     * Create a new subscription tier
     * ✅ SQL-ONLY: All KV operations replaced with SQL
     */
    app.post("/make-server-3dd53475/admin/subscription-tiers", async (c) => {
        try {
            const { name, description, tierType, // 'vendor' | 'customer' | 'p2p_service'
            price, billingCycle, // 'monthly' | 'quarterly' | 'semi_annual' | 'annual'
            commissionRate, // Vendor commission %
            applicableRoles, // Array of vendor roles or 'all'
            benefits, // Object with feature flags
            isActive } = await c.req.json();
            if (!name || !tierType || price === undefined || !billingCycle) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields', 400);
            }
            // Validate tier type
            if (!['vendor', 'customer', 'p2p_service'].includes(tierType)) {
                return (0, response_utils_1.sendError)(c, 'Invalid tierType. Must be vendor, customer, or p2p_service', 400);
            }
            // ✅ SQL: Get next tier_level (max + 1)
            const pool = await (0, db_1.getDbClient)();
            const maxTierResult = await pool.query('SELECT tier_level FROM subscription_tiers ORDER BY tier_level DESC LIMIT 1');
            const maxTier = maxTierResult.rows[0] || null;
            const tierLevel = maxTier ? maxTier.tier_level + 1 : 1;
            // Map price to appropriate column based on billing cycle
            const insertData = {
                tier_name: name,
                display_name: name,
                tier_level: tierLevel,
                tier_type: tierType,
                billing_cycle: billingCycle,
                commission_rate: commissionRate !== undefined ? Number(commissionRate) : null,
                applicable_roles: applicableRoles || [],
                benefits: benefits || {},
                features: benefits || {}, // Also update features for backward compatibility
                is_active: isActive !== false,
            };
            // Set price based on billing cycle
            if (billingCycle === 'monthly') {
                insertData.monthly_price = Number(price);
            }
            else if (billingCycle === 'quarterly') {
                insertData.quarterly_price = Number(price);
            }
            else if (billingCycle === 'semi_annual') {
                insertData.semi_annual_price = Number(price);
            }
            else if (billingCycle === 'annual') {
                insertData.annual_price = Number(price);
            }
            // ✅ SQL: Create tier
            const tierResult = await (0, db_1.insertQuery)('subscription_tiers', insertData);
            if (!tierResult || tierResult.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Failed to create tier', 500);
            }
            const tier = tierResult[0];
            // Map to response format
            const tierResponse = {
                id: tier.id,
                name: tier.tier_name,
                description: description || '',
                tierType: tier.tier_type,
                price: Number(price),
                billingCycle: tier.billing_cycle,
                commissionRate: tier.commission_rate,
                applicableRoles: tier.applicable_roles || [],
                benefits: tier.benefits || {},
                isActive: tier.is_active,
                createdAt: tier.created_at,
                updatedAt: tier.updated_at
            };
            return (0, response_utils_1.sendSuccess)(c, { tier: tierResponse }, 'Subscription tier created successfully');
        }
        catch (error) {
            console.error('Error creating subscription tier:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /make-server-3dd53475/admin/subscription-tiers
     * Get all subscription tiers (with optional filtering)
     * ✅ SQL-ONLY: All KV operations replaced with SQL
     */
    app.get("/make-server-3dd53475/admin/subscription-tiers", async (c) => {
        try {
            const tierType = c.req.query('tierType');
            const isActive = c.req.query('isActive');
            // ✅ SQL: Query tiers with filters
            const filters = {};
            if (tierType) {
                filters.tier_type = tierType;
            }
            if (isActive !== undefined) {
                filters.is_active = isActive === 'true';
            }
            const tiers = await (0, db_1.selectQuery)('subscription_tiers', filters, {
                orderBy: 'created_at',
                orderDirection: 'desc'
            });
            // Map to response format
            const tiersResponse = (tiers || []).map((tier) => ({
                id: tier.id,
                name: tier.tier_name,
                description: tier.description || '',
                tierType: tier.tier_type,
                price: tier.monthly_price || tier.quarterly_price || tier.semi_annual_price || tier.annual_price || 0,
                billingCycle: tier.billing_cycle,
                commissionRate: tier.commission_rate,
                applicableRoles: tier.applicable_roles || [],
                benefits: tier.benefits || {},
                isActive: tier.is_active,
                createdAt: tier.created_at,
                updatedAt: tier.updated_at
            }));
            return (0, response_utils_1.sendSuccess)(c, { tiers: tiersResponse, count: tiersResponse.length });
        }
        catch (error) {
            console.error('Error fetching subscription tiers:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /make-server-3dd53475/admin/subscription-tiers/:tierId
     * Get a specific subscription tier
     * ✅ SQL-ONLY: All KV operations replaced with SQL
     */
    app.get("/make-server-3dd53475/admin/subscription-tiers/:tierId", async (c) => {
        try {
            const { tierId } = c.req.param();
            // ✅ SQL: Get tier
            const tierResults = await (0, db_1.selectQuery)('subscription_tiers', { id: tierId });
            if (!tierResults || tierResults.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Subscription tier not found', 404);
            }
            const tier = tierResults[0];
            // ✅ SQL: Get subscriber count from user_subscriptions
            const subscriberResults = await (0, db_1.selectQuery)('user_subscriptions', { tier_id: tierId });
            const subscriberCount = subscriberResults?.length || 0;
            // Map to response format
            const tierResponse = {
                id: tier.id,
                name: tier.tier_name,
                description: tier.description || '',
                tierType: tier.tier_type,
                price: tier.monthly_price || tier.quarterly_price || tier.semi_annual_price || tier.annual_price || 0,
                billingCycle: tier.billing_cycle,
                commissionRate: tier.commission_rate,
                applicableRoles: tier.applicable_roles || [],
                benefits: tier.benefits || {},
                isActive: tier.is_active,
                createdAt: tier.created_at,
                updatedAt: tier.updated_at
            };
            return (0, response_utils_1.sendSuccess)(c, { tier: tierResponse, subscriberCount });
        }
        catch (error) {
            console.error('Error fetching subscription tier:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * PUT /make-server-3dd53475/admin/subscription-tiers/:tierId
     * Update a subscription tier
     * ✅ SQL-ONLY: All KV operations replaced with SQL
     */
    app.put("/make-server-3dd53475/admin/subscription-tiers/:tierId", async (c) => {
        try {
            const { tierId } = c.req.param();
            const updates = await c.req.json();
            // ✅ SQL: Get tier
            const existingTierResults = await (0, db_1.selectQuery)('subscription_tiers', { id: tierId });
            if (!existingTierResults || existingTierResults.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Subscription tier not found', 404);
            }
            const existingTier = existingTierResults[0];
            // Map updates to database columns
            const updateData = {
                updated_at: new Date().toISOString()
            };
            if (updates.name !== undefined) {
                updateData.tier_name = updates.name;
                updateData.display_name = updates.name;
            }
            if (updates.description !== undefined) {
                updateData.description = updates.description;
            }
            if (updates.price !== undefined) {
                // Update price based on billing cycle
                const billingCycle = updates.billingCycle || existingTier.billing_cycle;
                if (billingCycle === 'monthly') {
                    updateData.monthly_price = Number(updates.price);
                }
                else if (billingCycle === 'quarterly') {
                    updateData.quarterly_price = Number(updates.price);
                }
                else if (billingCycle === 'semi_annual') {
                    updateData.semi_annual_price = Number(updates.price);
                }
                else if (billingCycle === 'annual') {
                    updateData.annual_price = Number(updates.price);
                }
            }
            if (updates.billingCycle !== undefined) {
                updateData.billing_cycle = updates.billingCycle;
            }
            if (updates.commissionRate !== undefined) {
                updateData.commission_rate = Number(updates.commissionRate);
            }
            if (updates.applicableRoles !== undefined) {
                updateData.applicable_roles = updates.applicableRoles;
            }
            if (updates.benefits !== undefined) {
                updateData.benefits = updates.benefits;
                updateData.features = updates.benefits; // Also update features
            }
            if (updates.isActive !== undefined) {
                updateData.is_active = updates.isActive;
            }
            // ✅ SQL: Update tier
            const tierResults = await (0, db_1.updateQuery)('subscription_tiers', { id: tierId }, updateData);
            if (!tierResults || tierResults.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Failed to update tier', 500);
            }
            const tier = tierResults[0];
            // Map to response format
            const tierResponse = {
                id: tier.id,
                name: tier.tier_name,
                description: tier.description || '',
                tierType: tier.tier_type,
                price: tier.monthly_price || tier.quarterly_price || tier.semi_annual_price || tier.annual_price || 0,
                billingCycle: tier.billing_cycle,
                commissionRate: tier.commission_rate,
                applicableRoles: tier.applicable_roles || [],
                benefits: tier.benefits || {},
                isActive: tier.is_active,
                createdAt: tier.created_at,
                updatedAt: tier.updated_at
            };
            return (0, response_utils_1.sendSuccess)(c, { tier: tierResponse }, 'Subscription tier updated successfully');
        }
        catch (error) {
            console.error('Error updating subscription tier:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * DELETE /make-server-3dd53475/admin/subscription-tiers/:tierId
     * Delete a subscription tier (soft delete - mark as inactive)
     * ✅ SQL-ONLY: All KV operations replaced with SQL
     */
    app.delete("/make-server-3dd53475/admin/subscription-tiers/:tierId", async (c) => {
        try {
            const { tierId } = c.req.param();
            // ✅ SQL: Get tier
            const tierResults = await (0, db_1.selectQuery)('subscription_tiers', { id: tierId });
            if (!tierResults || tierResults.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Subscription tier not found', 404);
            }
            const tier = tierResults[0];
            // ✅ SQL: Check if there are active subscribers
            const activeSubscriptions = await (0, db_1.selectQuery)('user_subscriptions', { tier_id: tierId, status: 'active' });
            if (activeSubscriptions && activeSubscriptions.length > 0) {
                return (0, response_utils_1.sendError)(c, `Cannot delete tier with ${activeSubscriptions.length} active subscribers. Please deactivate instead.`, 400);
            }
            // ✅ SQL: Soft delete (mark as inactive)
            const updatedTierResults = await (0, db_1.updateQuery)('subscription_tiers', { id: tierId }, {
                is_active: false,
                updated_at: new Date().toISOString()
            });
            if (!updatedTierResults || updatedTierResults.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Failed to delete tier', 500);
            }
            const updatedTier = updatedTierResults[0];
            // Map to response format
            const tierResponse = {
                id: updatedTier.id,
                name: updatedTier.tier_name,
                isActive: updatedTier.is_active
            };
            return (0, response_utils_1.sendSuccess)(c, { tier: tierResponse }, 'Subscription tier deleted successfully');
        }
        catch (error) {
            console.error('Error deleting subscription tier:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // ============================================
    // USER SUBSCRIPTION MANAGEMENT
    // ============================================
    /**
     * POST /make-server-3dd53475/subscriptions/user/subscribe
     * User subscribes to a tier
     * ✅ SQL-ONLY: All KV operations replaced with SQL
     */
    app.post("/make-server-3dd53475/subscriptions/user/subscribe", async (c) => {
        try {
            const { userId, tierId, paymentId, paymentMethod } = await c.req.json();
            if (!userId || !tierId) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields', 400);
            }
            // ✅ SQL: Get tier
            const tierResults = await (0, db_1.selectQuery)('subscription_tiers', { id: tierId, is_active: true });
            if (!tierResults || tierResults.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Subscription tier not found or inactive', 404);
            }
            const tier = tierResults[0];
            // ✅ SQL: Check for existing active subscription of same type
            const existingSubs = await (0, db_1.selectQuery)('user_subscriptions', {
                customer_id: userId,
                tier_type: tier.tier_type,
                status: 'active'
            });
            if (existingSubs && existingSubs.length > 0) {
                return (0, response_utils_1.sendError)(c, `You already have an active ${tier.tier_type} subscription. Please cancel it first.`, 400);
            }
            // Calculate billing dates
            const startDate = new Date();
            const nextBillingDate = new Date(startDate);
            let price = tier.monthly_price || 0;
            switch (tier.billing_cycle) {
                case 'monthly':
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                    price = tier.monthly_price || 0;
                    break;
                case 'quarterly':
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
                    price = tier.quarterly_price || tier.monthly_price * 3 || 0;
                    break;
                case 'semi_annual':
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 6);
                    price = tier.semi_annual_price || tier.monthly_price * 6 || 0;
                    break;
                case 'annual':
                    nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
                    price = tier.annual_price || tier.monthly_price * 12 || 0;
                    break;
            }
            const subscriptionId = `usub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            // ✅ SQL: Create subscription
            const subscriptionResults = await (0, db_1.insertQuery)('user_subscriptions', {
                subscription_id: subscriptionId,
                customer_id: userId,
                tier_id: tierId,
                tier_name: tier.tier_name,
                tier_type: tier.tier_type,
                price: price,
                billing_cycle: tier.billing_cycle,
                status: 'active',
                start_date: startDate.toISOString().split('T')[0],
                next_billing_date: nextBillingDate.toISOString().split('T')[0],
                end_date: nextBillingDate.toISOString().split('T')[0],
                payment_id: paymentId || null,
                payment_method: paymentMethod || 'razorpay',
            });
            if (!subscriptionResults || subscriptionResults.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Failed to create subscription', 500);
            }
            const subscription = subscriptionResults[0];
            // Map to response format
            const subscriptionResponse = {
                id: subscription.subscription_id,
                userId: subscription.customer_id,
                tierId: subscription.tier_id,
                tierName: subscription.tier_name,
                tierType: subscription.tier_type,
                price: subscription.price,
                billingCycle: subscription.billing_cycle,
                commissionRate: tier.commission_rate,
                benefits: tier.benefits || {},
                status: subscription.status,
                startDate: subscription.start_date,
                nextBillingDate: subscription.next_billing_date,
                paymentId: subscription.payment_id,
                paymentMethod: subscription.payment_method,
                createdAt: subscription.created_at,
                updatedAt: subscription.updated_at
            };
            return (0, response_utils_1.sendSuccess)(c, { subscription: subscriptionResponse }, 'Subscription activated successfully');
        }
        catch (error) {
            console.error('Error creating subscription:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /make-server-3dd53475/subscriptions/user/:userId
     * Get all subscriptions for a user
     * ✅ SQL-ONLY: All KV operations replaced with SQL
     */
    app.get("/make-server-3dd53475/subscriptions/user/:userId", async (c) => {
        try {
            const { userId } = c.req.param();
            const status = c.req.query('status'); // Optional filter
            // ✅ SQL: Get subscriptions
            const filters = { customer_id: userId };
            if (status) {
                filters.status = status;
            }
            const subscriptions = await (0, db_1.selectQuery)('user_subscriptions', filters, {
                orderBy: 'created_at',
                orderDirection: 'desc'
            });
            // Map to response format
            const subscriptionsResponse = (subscriptions || []).map((sub) => ({
                id: sub.subscription_id,
                userId: sub.customer_id,
                tierId: sub.tier_id,
                tierName: sub.tier_name,
                tierType: sub.tier_type,
                price: sub.price,
                billingCycle: sub.billing_cycle,
                status: sub.status,
                startDate: sub.start_date,
                nextBillingDate: sub.next_billing_date,
                endDate: sub.end_date,
                paymentId: sub.payment_id,
                paymentMethod: sub.payment_method,
                createdAt: sub.created_at,
                updatedAt: sub.updated_at
            }));
            return (0, response_utils_1.sendSuccess)(c, { subscriptions: subscriptionsResponse, count: subscriptionsResponse.length });
        }
        catch (error) {
            console.error('Error fetching user subscriptions:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /make-server-3dd53475/subscriptions/user/cancel
     * Cancel a user subscription
     * ✅ SQL-ONLY: All KV operations replaced with SQL
     */
    app.post("/make-server-3dd53475/subscriptions/user/cancel", async (c) => {
        try {
            const { subscriptionId, userId, reason } = await c.req.json();
            // ✅ SQL: Get subscription by subscription_id
            const subscriptionResults = await (0, db_1.selectQuery)('user_subscriptions', { subscription_id: subscriptionId });
            if (!subscriptionResults || subscriptionResults.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Subscription not found', 404);
            }
            const subscription = subscriptionResults[0];
            // Verify ownership
            if (subscription.customer_id !== userId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized', 403);
            }
            // ✅ SQL: Update subscription status
            const updatedSubResults = await (0, db_1.updateQuery)('user_subscriptions', { subscription_id: subscriptionId }, {
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancellation_reason: reason || 'User request',
                updated_at: new Date().toISOString()
            });
            if (!updatedSubResults || updatedSubResults.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Failed to cancel subscription', 500);
            }
            const updatedSub = updatedSubResults[0];
            // Map to response format
            const subscriptionResponse = {
                id: updatedSub.subscription_id,
                userId: updatedSub.customer_id,
                tierId: updatedSub.tier_id,
                status: updatedSub.status,
                cancelledAt: updatedSub.cancelled_at,
                cancellationReason: updatedSub.cancellation_reason
            };
            return (0, response_utils_1.sendSuccess)(c, { subscription: subscriptionResponse }, 'Subscription cancelled successfully');
        }
        catch (error) {
            console.error('Error cancelling subscription:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /make-server-3dd53475/subscriptions/user/:userId/check-access
     * Check if user has access to a specific feature
     * ✅ SQL-ONLY: All KV operations replaced with SQL
     */
    app.get("/make-server-3dd53475/subscriptions/user/:userId/check-access", async (c) => {
        try {
            const { userId } = c.req.param();
            const feature = c.req.query('feature'); // e.g., 'p2p_dating', 'free_delivery', 'priority_support'
            const tierType = c.req.query('tierType'); // e.g., 'customer', 'p2p_service'
            if (!feature) {
                return (0, response_utils_1.sendError)(c, 'Feature parameter required', 400);
            }
            // ✅ SQL: Get active subscriptions for user
            const filters = { customer_id: userId, status: 'active' };
            if (tierType) {
                filters.tier_type = tierType;
            }
            const subscriptions = await (0, db_1.selectQuery)('user_subscriptions', filters);
            let hasAccess = false;
            let activeSubscription = null;
            // Get tier details for each subscription
            for (const sub of subscriptions || []) {
                const tierResults = await (0, db_1.selectQuery)('subscription_tiers', { id: sub.tier_id });
                const tier = tierResults[0] || null;
                if (tier && tier.benefits && tier.benefits[feature]) {
                    hasAccess = true;
                    activeSubscription = {
                        id: sub.subscription_id,
                        tierId: sub.tier_id,
                        tierName: sub.tier_name,
                        tierType: sub.tier_type
                    };
                    break;
                }
            }
            return (0, response_utils_1.sendSuccess)(c, {
                hasAccess,
                feature,
                subscription: activeSubscription
            });
        }
        catch (error) {
            console.error('Error checking access:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // ============================================
    // VENDOR TIER ASSIGNMENT
    // ============================================
    /**
     * POST /make-server-3dd53475/admin/vendors/:vendorId/assign-tier
     * Admin assigns a tier to a vendor
     * ✅ SQL-ONLY: All KV operations replaced with SQL
     */
    app.post("/make-server-3dd53475/admin/vendors/:vendorId/assign-tier", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const { tierId } = await c.req.json();
            // ✅ SQL: Get tier
            const tierResults = await (0, db_1.selectQuery)('subscription_tiers', {
                id: tierId,
                tier_type: 'vendor',
                is_active: true
            });
            if (!tierResults || tierResults.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Invalid vendor tier', 400);
            }
            const tier = tierResults[0];
            // ✅ SQL: Get vendor
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            if (!vendor) {
                return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
            }
            // Check if tier is applicable to vendor role
            const applicableRoles = tier.applicable_roles || [];
            if (applicableRoles.length > 0 &&
                applicableRoles[0] !== 'all' &&
                !applicableRoles.includes(vendor.role_id || '')) {
                return (0, response_utils_1.sendError)(c, `This tier is not applicable to ${vendor.role_id} vendors`, 400);
            }
            // ✅ SQL: Update vendor tier (store in current_tier_id or use vendor_tier_subscriptions)
            // For now, we'll update the vendor's current_tier_id
            await (0, db_1.updateQuery)('vendors', { id: vendorId }, {
                current_tier_id: tierId,
                updated_at: new Date().toISOString()
            });
            // Get updated vendor
            const updatedVendor = await vendorsRepo.findById(vendorId);
            return (0, response_utils_1.sendSuccess)(c, { vendor: updatedVendor }, 'Tier assigned successfully');
        }
        catch (error) {
            console.error('Error assigning tier to vendor:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /make-server-3dd53475/admin/subscription-tiers/analytics
     * Get analytics for subscription tiers
     * ✅ SQL-ONLY: All KV operations replaced with SQL
     */
    app.get("/make-server-3dd53475/admin/subscription-tiers/analytics", async (c) => {
        try {
            // ✅ SQL: Get all active tiers
            const tiers = await (0, db_1.selectQuery)('subscription_tiers', { is_active: true });
            const analytics = {
                totalTiers: tiers?.length || 0,
                tiersByType: { vendor: 0, customer: 0, p2p_service: 0 },
                totalRevenue: 0,
                totalSubscribers: 0,
                tiers: []
            };
            // ✅ SQL: Get subscriptions for each tier
            for (const tier of tiers || []) {
                analytics.tiersByType[tier.tier_type]++;
                const subscriptions = await (0, db_1.selectQuery)('user_subscriptions', {
                    tier_id: tier.id,
                    status: 'active'
                });
                const activeCount = subscriptions?.length || 0;
                const price = tier.monthly_price || tier.quarterly_price || tier.semi_annual_price || tier.annual_price || 0;
                const revenue = activeCount * price;
                analytics.totalSubscribers += activeCount;
                analytics.totalRevenue += revenue;
                analytics.tiers.push({
                    id: tier.id,
                    name: tier.tier_name,
                    tierType: tier.tier_type,
                    price: price,
                    activeSubscribers: activeCount,
                    revenue: revenue
                });
            }
            return (0, response_utils_1.sendSuccess)(c, { analytics });
        }
        catch (error) {
            console.error('Error fetching tier analytics:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
}
//# sourceMappingURL=platform-subscription-tiers-sql.js.map