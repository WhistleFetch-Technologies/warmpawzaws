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

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient, withTransaction } from "../../lib/db.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";

const client = getDbClient();

export function registerPlatformSubscriptionTiersSQL(app: Hono) {

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

      // Validate tier type
      if (!['vendor', 'customer', 'p2p_service'].includes(tierType)) {
        return sendError(c, 'Invalid tierType. Must be vendor, customer, or p2p_service', 400);
      }

      // ✅ SQL: Get next tier_level (max + 1)
      const { data: maxTier } = await client
        .from('subscription_tiers')
        .select('tier_level')
        .order('tier_level', { ascending: false })
        .limit(1)
        .maybeSingle();

      const tierLevel = maxTier ? maxTier.tier_level + 1 : 1;

      // Map price to appropriate column based on billing cycle
      const insertData: any = {
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
      } else if (billingCycle === 'quarterly') {
        insertData.quarterly_price = Number(price);
      } else if (billingCycle === 'semi_annual') {
        insertData.semi_annual_price = Number(price);
      } else if (billingCycle === 'annual') {
        insertData.annual_price = Number(price);
      }

      // ✅ SQL: Create tier
      const { data: tier, error } = await client
        .from('subscription_tiers')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating tier:', error);
        return sendError(c, `Failed to create tier: ${error.message}`, 500);
      }

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

      return sendSuccess(c, { tier: tierResponse }, 'Subscription tier created successfully');
    } catch (error) {
      console.error('Error creating subscription tier:', error);
      return sendError(c, error, 500);
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
      let query = client.from('subscription_tiers').select('*');

      if (tierType) {
        query = query.eq('tier_type', tierType);
      }

      if (isActive !== undefined) {
        query = query.eq('is_active', isActive === 'true');
      }

      query = query.order('created_at', { ascending: false });

      const { data: tiers, error } = await query;

      if (error) {
        throw error;
      }

      // Map to response format
      const tiersResponse = (tiers || []).map((tier: any) => ({
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

      return sendSuccess(c, { tiers: tiersResponse, count: tiersResponse.length });
    } catch (error) {
      console.error('Error fetching subscription tiers:', error);
      return sendError(c, error, 500);
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
      const { data: tier, error: tierError } = await client
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .single();

      if (tierError || !tier) {
        return sendError(c, 'Subscription tier not found', 404);
      }

      // ✅ SQL: Get subscriber count from user_subscriptions
      const { data: subscribers, error: subError } = await client
        .from('user_subscriptions')
        .select('id', { count: 'exact' })
        .eq('tier_id', tierId);

      const subscriberCount = subscribers?.length || 0;

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

      return sendSuccess(c, { tier: tierResponse, subscriberCount });
    } catch (error) {
      console.error('Error fetching subscription tier:', error);
      return sendError(c, error, 500);
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
      const { data: existingTier, error: getError } = await client
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .single();

      if (getError || !existingTier) {
        return sendError(c, 'Subscription tier not found', 404);
      }

      // Map updates to database columns
      const updateData: any = {
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
        } else if (billingCycle === 'quarterly') {
          updateData.quarterly_price = Number(updates.price);
        } else if (billingCycle === 'semi_annual') {
          updateData.semi_annual_price = Number(updates.price);
        } else if (billingCycle === 'annual') {
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
      const { data: tier, error } = await client
        .from('subscription_tiers')
        .update(updateData)
        .eq('id', tierId)
        .select()
        .single();

      if (error) {
        console.error('Error updating tier:', error);
        return sendError(c, `Failed to update tier: ${error.message}`, 500);
      }

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

      return sendSuccess(c, { tier: tierResponse }, 'Subscription tier updated successfully');
    } catch (error) {
      console.error('Error updating subscription tier:', error);
      return sendError(c, error, 500);
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
      const { data: tier, error: getError } = await client
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .single();

      if (getError || !tier) {
        return sendError(c, 'Subscription tier not found', 404);
      }

      // ✅ SQL: Check if there are active subscribers
      const { data: activeSubscriptions, error: subError } = await client
        .from('user_subscriptions')
        .select('id')
        .eq('tier_id', tierId)
        .eq('status', 'active');

      if (subError) {
        throw subError;
      }

      if (activeSubscriptions && activeSubscriptions.length > 0) {
        return sendError(c, `Cannot delete tier with ${activeSubscriptions.length} active subscribers. Please deactivate instead.`, 400);
      }

      // ✅ SQL: Soft delete (mark as inactive)
      const { data: updatedTier, error } = await client
        .from('subscription_tiers')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', tierId)
        .select()
        .single();

      if (error) {
        console.error('Error deleting tier:', error);
        return sendError(c, `Failed to delete tier: ${error.message}`, 500);
      }

      // Map to response format
      const tierResponse = {
        id: updatedTier.id,
        name: updatedTier.tier_name,
        isActive: updatedTier.is_active
      };

      return sendSuccess(c, { tier: tierResponse }, 'Subscription tier deleted successfully');
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
   * ✅ SQL-ONLY: All KV operations replaced with SQL
   */
  app.post("/make-server-3dd53475/subscriptions/user/subscribe", async (c) => {
    try {
      const { userId, tierId, paymentId, paymentMethod } = await c.req.json();

      if (!userId || !tierId) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get tier
      const { data: tier, error: tierError } = await client
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .eq('is_active', true)
        .single();

      if (tierError || !tier) {
        return sendError(c, 'Subscription tier not found or inactive', 404);
      }

      // ✅ SQL: Check for existing active subscription of same type
      const { data: existingSubs, error: existingError } = await client
        .from('user_subscriptions')
        .select('*')
        .eq('customer_id', userId)
        .eq('tier_type', tier.tier_type)
        .eq('status', 'active');

      if (existingError) {
        throw existingError;
      }

      if (existingSubs && existingSubs.length > 0) {
        return sendError(c, `You already have an active ${tier.tier_type} subscription. Please cancel it first.`, 400);
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
      const { data: subscription, error: subError } = await client
        .from('user_subscriptions')
        .insert({
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
        })
        .select()
        .single();

      if (subError) {
        console.error('Error creating subscription:', subError);
        return sendError(c, `Failed to create subscription: ${subError.message}`, 500);
      }

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

      return sendSuccess(c, { subscription: subscriptionResponse }, 'Subscription activated successfully');
    } catch (error) {
      console.error('Error creating subscription:', error);
      return sendError(c, error, 500);
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
      let query = client
        .from('user_subscriptions')
        .select('*')
        .eq('customer_id', userId);

      if (status) {
        query = query.eq('status', status);
      }

      query = query.order('created_at', { ascending: false });

      const { data: subscriptions, error } = await query;

      if (error) {
        throw error;
      }

      // Map to response format
      const subscriptionsResponse = (subscriptions || []).map((sub: any) => ({
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

      return sendSuccess(c, { subscriptions: subscriptionsResponse, count: subscriptionsResponse.length });
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      return sendError(c, error, 500);
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
      const { data: subscription, error: getError } = await client
        .from('user_subscriptions')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .single();

      if (getError || !subscription) {
        return sendError(c, 'Subscription not found', 404);
      }

      // Verify ownership
      if (subscription.customer_id !== userId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Update subscription status
      const { data: updatedSub, error } = await client
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || 'User request',
          updated_at: new Date().toISOString()
        })
        .eq('subscription_id', subscriptionId)
        .select()
        .single();

      if (error) {
        console.error('Error cancelling subscription:', error);
        return sendError(c, `Failed to cancel subscription: ${error.message}`, 500);
      }

      // Map to response format
      const subscriptionResponse = {
        id: updatedSub.subscription_id,
        userId: updatedSub.customer_id,
        tierId: updatedSub.tier_id,
        status: updatedSub.status,
        cancelledAt: updatedSub.cancelled_at,
        cancellationReason: updatedSub.cancellation_reason
      };

      return sendSuccess(c, { subscription: subscriptionResponse }, 'Subscription cancelled successfully');
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return sendError(c, error, 500);
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
        return sendError(c, 'Feature parameter required', 400);
      }

      // ✅ SQL: Get active subscriptions for user
      let query = client
        .from('user_subscriptions')
        .select('*, subscription_tiers(*)')
        .eq('customer_id', userId)
        .eq('status', 'active');

      if (tierType) {
        query = query.eq('tier_type', tierType);
      }

      const { data: subscriptions, error } = await query;

      if (error) {
        throw error;
      }

      let hasAccess = false;
      let activeSubscription = null;

      for (const sub of subscriptions || []) {
        const tier = sub.subscription_tiers;
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
   * ✅ SQL-ONLY: All KV operations replaced with SQL
   */
  app.post("/make-server-3dd53475/admin/vendors/:vendorId/assign-tier", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { tierId } = await c.req.json();

      // ✅ SQL: Get tier
      const { data: tier, error: tierError } = await client
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .eq('tier_type', 'vendor')
        .eq('is_active', true)
        .single();

      if (tierError || !tier) {
        return sendError(c, 'Invalid vendor tier', 400);
      }

      // ✅ SQL: Get vendor
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Check if tier is applicable to vendor role
      const applicableRoles = tier.applicable_roles || [];
      if (applicableRoles.length > 0 && 
          applicableRoles[0] !== 'all' && 
          !applicableRoles.includes(vendor.role_id || '')) {
        return sendError(c, `This tier is not applicable to ${vendor.role_id} vendors`, 400);
      }

      // ✅ SQL: Update vendor tier (store in current_tier_id or use vendor_tier_subscriptions)
      // For now, we'll update the vendor's current_tier_id
      await client
        .from('vendors')
        .update({
          current_tier_id: tierId,
          updated_at: new Date().toISOString()
        })
        .eq('id', vendorId);

      // Get updated vendor
      const updatedVendor = await vendorsRepo.findById(vendorId);

      return sendSuccess(c, { vendor: updatedVendor }, 'Tier assigned successfully');
    } catch (error) {
      console.error('Error assigning tier to vendor:', error);
      return sendError(c, error, 500);
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
      const { data: tiers, error: tiersError } = await client
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true);

      if (tiersError) {
        throw tiersError;
      }

      const analytics = {
        totalTiers: tiers?.length || 0,
        tiersByType: { vendor: 0, customer: 0, p2p_service: 0 },
        totalRevenue: 0,
        totalSubscribers: 0,
        tiers: []
      };

      // ✅ SQL: Get subscriptions for each tier
      for (const tier of tiers || []) {
        analytics.tiersByType[tier.tier_type as keyof typeof analytics.tiersByType]++;

        const { data: subscriptions, error: subError } = await client
          .from('user_subscriptions')
          .select('*')
          .eq('tier_id', tier.id)
          .eq('status', 'active');

        if (subError) {
          console.error(`Error fetching subscriptions for tier ${tier.id}:`, subError);
          continue;
        }

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

      return sendSuccess(c, { analytics });
    } catch (error) {
      console.error('Error fetching tier analytics:', error);
      return sendError(c, error, 500);
    }
  });
}

