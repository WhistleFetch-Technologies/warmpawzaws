import { Hono } from "hono";
import * as kv from "./kv_store";
import { sendSuccess, sendError } from "./response-utils";

/**
 * PLATFORM SUBSCRIPTION TIER MANAGEMENT
 * Universal system for managing subscription tiers that control:
 * - Vendor commissions
 * - Customer benefits (delivery, priority, etc.)
 * - P2P service access (Mating & Dating)
 * - Feature access levels
 */

export function registerPlatformSubscriptionTiers(app: Hono) {

  // ============================================
  // ADMIN: SUBSCRIPTION TIER MANAGEMENT
  // ============================================

  /**
   * POST /make-server-3dd53475/admin/subscription-tiers
   * Create a new subscription tier
   */
  app.post("/make-server-3dd53475/admin/subscription-tiers", async (c) => {
    try {
      const {
        name,
        description,
        tierType, // 'vendor' | 'customer' | 'p2p_service'
        price,
        billingCycle, // 'monthly' | 'quarterly' | 'semi_annual' | 'annual'
        commissionRate, // Vendor commission %
        applicableRoles, // Array of vendor roles or 'all'
        benefits, // Object with feature flags
        isActive
      } = await c.req.json();

      if (!name || !tierType || price === undefined || !billingCycle) {
        return sendError(c, 'Missing required fields', 400);
      }

      const tierId = `tier_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const tier = {
        id: tierId,
        name,
        description: description || '',
        tierType,
        price: Number(price),
        billingCycle,
        commissionRate: commissionRate !== undefined ? Number(commissionRate) : null,
        applicableRoles: applicableRoles || [],
        benefits: benefits || {},
        isActive: isActive !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Validate tier type
      if (!['vendor', 'customer', 'p2p_service'].includes(tierType)) {
        return sendError(c, 'Invalid tierType. Must be vendor, customer, or p2p_service', 400);
      }

      // Save tier
      await kv.set(`subscription_tier:${tierId}`, tier);

      // Index by type
      const tiersByTypeKey = `subscription_tiers:type:${tierType}`;
      const tiersByType = await kv.get(tiersByTypeKey) || [];
      if (!tiersByType.includes(tierId)) {
        tiersByType.push(tierId);
        await kv.set(tiersByTypeKey, tiersByType);
      }

      // Global index
      const allTiersKey = 'subscription_tiers:all';
      const allTiers = await kv.get(allTiersKey) || [];
      if (!allTiers.includes(tierId)) {
        allTiers.push(tierId);
        await kv.set(allTiersKey, allTiers);
      }

      return sendSuccess(c, { tier }, 'Subscription tier created successfully');
    } catch (error) {
      console.error('Error creating subscription tier:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/admin/subscription-tiers
   * Get all subscription tiers (with optional filtering)
   */
  app.get("/make-server-3dd53475/admin/subscription-tiers", async (c) => {
    try {
      const tierType = c.req.query('tierType');
      const isActive = c.req.query('isActive');

      let tierIds = [];

      if (tierType) {
        tierIds = await kv.get(`subscription_tiers:type:${tierType}`) || [];
      } else {
        tierIds = await kv.get('subscription_tiers:all') || [];
      }

      const tiers = [];
      for (const tierId of tierIds) {
        const tier = await kv.get(`subscription_tier:${tierId}`);
        if (tier) {
          // Filter by isActive if specified
          if (isActive !== undefined) {
            const activeFilter = isActive === 'true';
            if (tier.isActive === activeFilter) {
              tiers.push(tier);
            }
          } else {
            tiers.push(tier);
          }
        }
      }

      // Sort by creation date (newest first)
      tiers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return sendSuccess(c, { tiers, count: tiers.length });
    } catch (error) {
      console.error('Error fetching subscription tiers:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/admin/subscription-tiers/:tierId
   * Get a specific subscription tier
   */
  app.get("/make-server-3dd53475/admin/subscription-tiers/:tierId", async (c) => {
    try {
      const { tierId } = c.req.param();
      const tier = await kv.get(`subscription_tier:${tierId}`);

      if (!tier) {
        return sendError(c, 'Subscription tier not found', 404);
      }

      // Get subscriber count
      const subscribers = await kv.get(`subscription_tier:${tierId}:subscribers`) || [];

      return sendSuccess(c, { tier, subscriberCount: subscribers.length });
    } catch (error) {
      console.error('Error fetching subscription tier:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/admin/subscription-tiers/:tierId
   * Update a subscription tier
   */
  app.put("/make-server-3dd53475/admin/subscription-tiers/:tierId", async (c) => {
    try {
      const { tierId } = c.req.param();
      const updates = await c.req.json();

      const tier = await kv.get(`subscription_tier:${tierId}`);
      if (!tier) {
        return sendError(c, 'Subscription tier not found', 404);
      }

      // Update allowed fields
      const allowedFields = [
        'name', 'description', 'price', 'billingCycle', 
        'commissionRate', 'applicableRoles', 'benefits', 'isActive'
      ];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          tier[field] = updates[field];
        }
      }

      tier.updatedAt = new Date().toISOString();

      await kv.set(`subscription_tier:${tierId}`, tier);

      return sendSuccess(c, { tier }, 'Subscription tier updated successfully');
    } catch (error) {
      console.error('Error updating subscription tier:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/admin/subscription-tiers/:tierId
   * Delete a subscription tier (soft delete - mark as inactive)
   */
  app.delete("/make-server-3dd53475/admin/subscription-tiers/:tierId", async (c) => {
    try {
      const { tierId } = c.req.param();

      const tier = await kv.get(`subscription_tier:${tierId}`);
      if (!tier) {
        return sendError(c, 'Subscription tier not found', 404);
      }

      // Check if there are active subscribers
      const subscribers = await kv.get(`subscription_tier:${tierId}:subscribers`) || [];
      const activeSubscribers = subscribers.filter(async (subId: string) => {
        const sub = await kv.get(`user_subscription:${subId}`);
        return sub && sub.status === 'active';
      });

      if (activeSubscribers.length > 0) {
        return sendError(c, `Cannot delete tier with ${activeSubscribers.length} active subscribers. Please deactivate instead.`, 400);
      }

      // Soft delete
      tier.isActive = false;
      tier.deletedAt = new Date().toISOString();
      await kv.set(`subscription_tier:${tierId}`, tier);

      return sendSuccess(c, { tier }, 'Subscription tier deleted successfully');
    } catch (error) {
      console.error('Error deleting subscription tier:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // USER SUBSCRIPTION MANAGEMENT
  // ============================================

  /**
   * POST /make-server-3dd53475/subscriptions/user/subscribe
   * User subscribes to a tier
   */
  app.post("/make-server-3dd53475/subscriptions/user/subscribe", async (c) => {
    try {
      const { userId, tierId, paymentId, paymentMethod } = await c.req.json();

      if (!userId || !tierId) {
        return sendError(c, 'Missing required fields', 400);
      }

      const tier = await kv.get(`subscription_tier:${tierId}`);
      if (!tier || !tier.isActive) {
        return sendError(c, 'Subscription tier not found or inactive', 404);
      }

      // Check for existing active subscription of same type
      const userSubsKey = `user:${userId}:subscriptions`;
      const existingSubs = await kv.get(userSubsKey) || [];

      for (const subId of existingSubs) {
        const existingSub = await kv.get(`user_subscription:${subId}`);
        if (existingSub && existingSub.status === 'active' && existingSub.tierType === tier.tierType) {
          return sendError(c, `You already have an active ${tier.tierType} subscription. Please cancel it first.`, 400);
        }
      }

      const subscriptionId = `usub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Calculate billing dates
      const startDate = new Date();
      const nextBillingDate = new Date(startDate);

      switch (tier.billingCycle) {
        case 'monthly':
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
          break;
        case 'semi_annual':
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 6);
          break;
        case 'annual':
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
          break;
      }

      const subscription = {
        id: subscriptionId,
        userId,
        tierId,
        tierName: tier.name,
        tierType: tier.tierType,
        price: tier.price,
        billingCycle: tier.billingCycle,
        commissionRate: tier.commissionRate,
        benefits: tier.benefits,
        status: 'active',
        startDate: startDate.toISOString(),
        nextBillingDate: nextBillingDate.toISOString(),
        paymentId: paymentId || null,
        paymentMethod: paymentMethod || 'razorpay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save subscription
      await kv.set(`user_subscription:${subscriptionId}`, subscription);

      // Index by user
      existingSubs.push(subscriptionId);
      await kv.set(userSubsKey, existingSubs);

      // Index by tier
      const tierSubsKey = `subscription_tier:${tierId}:subscribers`;
      const tierSubs = await kv.get(tierSubsKey) || [];
      tierSubs.push(subscriptionId);
      await kv.set(tierSubsKey, tierSubs);

      return sendSuccess(c, { subscription }, 'Subscription activated successfully');
    } catch (error) {
      console.error('Error creating subscription:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/subscriptions/user/:userId
   * Get all subscriptions for a user
   */
  app.get("/make-server-3dd53475/subscriptions/user/:userId", async (c) => {
    try {
      const { userId } = c.req.param();
      const status = c.req.query('status'); // Optional filter

      const userSubsKey = `user:${userId}:subscriptions`;
      const subIds = await kv.get(userSubsKey) || [];

      const subscriptions = [];
      for (const subId of subIds) {
        const sub = await kv.get(`user_subscription:${subId}`);
        if (sub) {
          if (!status || sub.status === status) {
            subscriptions.push(sub);
          }
        }
      }

      // Sort by creation date (newest first)
      subscriptions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return sendSuccess(c, { subscriptions, count: subscriptions.length });
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/subscriptions/user/cancel
   * Cancel a user subscription
   */
  app.post("/make-server-3dd53475/subscriptions/user/cancel", async (c) => {
    try {
      const { subscriptionId, userId, reason } = await c.req.json();

      const subscription = await kv.get(`user_subscription:${subscriptionId}`);
      if (!subscription) {
        return sendError(c, 'Subscription not found', 404);
      }

      // Verify ownership
      if (subscription.userId !== userId) {
        return sendError(c, 'Unauthorized', 403);
      }

      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date().toISOString();
      subscription.cancellationReason = reason || 'User request';
      subscription.updatedAt = new Date().toISOString();

      await kv.set(`user_subscription:${subscriptionId}`, subscription);

      return sendSuccess(c, { subscription }, 'Subscription cancelled successfully');
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/subscriptions/user/:userId/check-access
   * Check if user has access to a specific feature
   */
  app.get("/make-server-3dd53475/subscriptions/user/:userId/check-access", async (c) => {
    try {
      const { userId } = c.req.param();
      const feature = c.req.query('feature'); // e.g., 'p2p_dating', 'free_delivery', 'priority_support'
      const tierType = c.req.query('tierType'); // e.g., 'customer', 'p2p_service'

      if (!feature) {
        return sendError(c, 'Feature parameter required', 400);
      }

      const userSubsKey = `user:${userId}:subscriptions`;
      const subIds = await kv.get(userSubsKey) || [];

      let hasAccess = false;
      let activeSubscription = null;

      for (const subId of subIds) {
        const sub = await kv.get(`user_subscription:${subId}`);
        if (sub && sub.status === 'active') {
          // Check if subscription matches tier type filter
          if (tierType && sub.tierType !== tierType) {
            continue;
          }

          // Check if subscription has the feature in benefits
          if (sub.benefits && sub.benefits[feature]) {
            hasAccess = true;
            activeSubscription = sub;
            break;
          }
        }
      }

      return sendSuccess(c, { 
        hasAccess, 
        feature,
        subscription: activeSubscription 
      });
    } catch (error) {
      console.error('Error checking access:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // VENDOR TIER ASSIGNMENT
  // ============================================

  /**
   * POST /make-server-3dd53475/admin/vendors/:vendorId/assign-tier
   * Admin assigns a tier to a vendor
   */
  app.post("/make-server-3dd53475/admin/vendors/:vendorId/assign-tier", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { tierId } = await c.req.json();

      const tier = await kv.get(`subscription_tier:${tierId}`);
      if (!tier || tier.tierType !== 'vendor') {
        return sendError(c, 'Invalid vendor tier', 400);
      }

      // Get vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Check if tier is applicable to vendor role
      if (tier.applicableRoles.length > 0 && 
          tier.applicableRoles[0] !== 'all' && 
          !tier.applicableRoles.includes(vendor.role)) {
        return sendError(c, `This tier is not applicable to ${vendor.role} vendors`, 400);
      }

      // Update vendor tier
      vendor.subscriptionTierId = tierId;
      vendor.subscriptionTierName = tier.name;
      vendor.commissionRate = tier.commissionRate;
      vendor.tierUpdatedAt = new Date().toISOString();

      await kv.set(`vendor:${vendorId}`, vendor);

      return sendSuccess(c, { vendor }, 'Tier assigned successfully');
    } catch (error) {
      console.error('Error assigning tier to vendor:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/admin/subscription-tiers/analytics
   * Get analytics for subscription tiers
   */
  app.get("/make-server-3dd53475/admin/subscription-tiers/analytics", async (c) => {
    try {
      const tierIds = await kv.get('subscription_tiers:all') || [];

      const analytics = {
        totalTiers: tierIds.length,
        tiersByType: { vendor: 0, customer: 0, p2p_service: 0 },
        totalRevenue: 0,
        totalSubscribers: 0,
        tiers: []
      };

      for (const tierId of tierIds) {
        const tier = await kv.get(`subscription_tier:${tierId}`);
        if (tier && tier.isActive) {
          analytics.tiersByType[tier.tierType]++;

          const subscribers = await kv.get(`subscription_tier:${tierId}:subscribers`) || [];
          let activeCount = 0;
          let revenue = 0;

          for (const subId of subscribers) {
            const sub = await kv.get(`user_subscription:${subId}`);
            if (sub && sub.status === 'active') {
              activeCount++;
              revenue += tier.price;
            }
          }

          analytics.totalSubscribers += activeCount;
          analytics.totalRevenue += revenue;

          analytics.tiers.push({
            id: tier.id,
            name: tier.name,
            tierType: tier.tierType,
            price: tier.price,
            activeSubscribers: activeCount,
            revenue: revenue
          });
        }
      }

      return sendSuccess(c, { analytics });
    } catch (error) {
      console.error('Error fetching tier analytics:', error);
      return sendError(c, error, 500);
    }
  });
}
