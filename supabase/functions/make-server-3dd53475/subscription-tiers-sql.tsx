/**
 * ============================================================================
 * SUBSCRIPTION TIERS - SQL-ONLY VERSION (WITH ROLE MANAGEMENT)
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Enhanced subscription tier management with:
 * - Role-based enable/disable per tier
 * - Dynamic role listing
 * - P2P service subscription support
 * - Vendor tier management
 * - Customer tier management
 * 
 * Date: 2025-01-23
 * Migration: Phase 8 - Complete Journey
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from "../../lib/db.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";

export function registerSubscriptionTiersSQL(app: Hono) {
  console.log('✅ Registering Subscription Tiers (SQL-only with role management)...');

  const client = getDbClient();
  const BASE = '/make-server-3dd53475';

  // ============================================
  // ADMIN: TIER MANAGEMENT
  // ============================================

  /**
   * POST /admin/subscription-tiers
   * Create a new subscription tier
   */
  app.post(`${BASE}/admin/subscription-tiers`, async (c) => {
    try {
      const {
        tier_name,
        tier_level,
        display_name,
        tier_type, // 'vendor' | 'customer' | 'p2p_service'
        monthly_price,
        quarterly_price,
        semi_annual_price,
        annual_price,
        commission_rate, // For vendor tiers
        applicable_roles, // Array of role IDs or ['all']
        enabled_roles, // Roles enabled for this tier
        disabled_roles, // Roles disabled for this tier
        benefits, // JSONB object with feature flags
        is_active
      } = await c.req.json();

      if (!tier_name || !tier_type || monthly_price === undefined) {
        return sendError(c, 'Missing required fields: tier_name, tier_type, monthly_price', 400);
      }

      // ✅ SQL: Create tier
      const { data: tier, error } = await client
        .from('subscription_tiers')
        .insert({
          tier_name,
          tier_level: tier_level || 1,
          display_name: display_name || tier_name,
          tier_type,
          monthly_price: parseFloat(monthly_price),
          quarterly_price: quarterly_price ? parseFloat(quarterly_price) : null,
          semi_annual_price: semi_annual_price ? parseFloat(semi_annual_price) : null,
          annual_price: annual_price ? parseFloat(annual_price) : null,
          billing_cycle: 'monthly', // Default
          commission_rate: commission_rate ? parseFloat(commission_rate) : null,
          applicable_roles: applicable_roles || [],
          enabled_roles: enabled_roles || [],
          disabled_roles: disabled_roles || [],
          benefits: benefits || {},
          features: benefits || {}, // Also update features for backward compatibility
          is_active: is_active !== false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating tier:', error);
        return sendError(c, `Failed to create tier: ${error.message}`, 500);
      }

      return sendSuccess(c, { tier }, 'Subscription tier created successfully');
    } catch (error) {
      console.error('Error creating subscription tier:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/subscription-tiers
   * Get all subscription tiers with role information
   */
  app.get(`${BASE}/admin/subscription-tiers`, async (c) => {
    try {
      const tierType = c.req.query('tierType');
      const isActive = c.req.query('isActive');

      let query = client
        .from('subscription_tiers')
        .select('*');

      if (tierType) {
        query = query.eq('tier_type', tierType);
      }

      if (isActive !== undefined) {
        query = query.eq('is_active', isActive === 'true');
      }

      const { data: tiers, error } = await query.order('tier_level', { ascending: true });

      if (error) {
        return sendError(c, `Failed to fetch tiers: ${error.message}`, 500);
      }

      // ✅ SQL: Get all roles for each tier
      const { data: allRoles } = await client
        .from('roles')
        .select('id, role_name, role_type')
        .eq('is_active', true);

      // Enrich tiers with role information
      const enrichedTiers = (tiers || []).map(tier => {
        const applicableRoles = tier.applicable_roles || [];
        const enabledRoles = tier.enabled_roles || [];
        const disabledRoles = tier.disabled_roles || [];

        // Map role IDs to role names
        const applicableRolesInfo = allRoles?.filter((r: any) => 
          applicableRoles.includes(r.id) || applicableRoles.includes('all')
        ) || [];

        const enabledRolesInfo = allRoles?.filter((r: any) => 
          enabledRoles.includes(r.id)
        ) || [];

        const disabledRolesInfo = allRoles?.filter((r: any) => 
          disabledRoles.includes(r.id)
        ) || [];

        return {
          ...tier,
          applicable_roles_info: applicableRolesInfo,
          enabled_roles_info: enabledRolesInfo,
          disabled_roles_info: disabledRolesInfo,
          all_available_roles: allRoles || [],
        };
      });

      return sendSuccess(c, { tiers: enrichedTiers, count: enrichedTiers.length });
    } catch (error) {
      console.error('Error fetching subscription tiers:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/subscription-tiers/:tierId
   * Get specific tier with full role information
   */
  app.get(`${BASE}/admin/subscription-tiers/:tierId`, async (c) => {
    try {
      const { tierId } = c.req.param();

      const { data: tier, error } = await client
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .single();

      if (error || !tier) {
        return sendError(c, 'Subscription tier not found', 404);
      }

      // ✅ SQL: Get all roles
      const { data: allRoles } = await client
        .from('roles')
        .select('id, role_name, role_type, description')
        .eq('is_active', true);

      // ✅ SQL: Get subscriber count
      const { data: subscriptions } = await client
        .from('user_subscriptions')
        .select('id')
        .eq('tier_id', tierId)
        .eq('status', 'active');

      // Map roles
      const applicableRoles = tier.applicable_roles || [];
      const enabledRoles = tier.enabled_roles || [];
      const disabledRoles = tier.disabled_roles || [];

      const applicableRolesInfo = allRoles?.filter((r: any) => 
        applicableRoles.includes(r.id) || applicableRoles.includes('all')
      ) || [];

      const enabledRolesInfo = allRoles?.filter((r: any) => 
        enabledRoles.includes(r.id)
      ) || [];

      const disabledRolesInfo = allRoles?.filter((r: any) => 
        disabledRoles.includes(r.id)
      ) || [];

      return sendSuccess(c, {
        tier: {
          ...tier,
          applicable_roles_info: applicableRolesInfo,
          enabled_roles_info: enabledRolesInfo,
          disabled_roles_info: disabledRolesInfo,
          all_available_roles: allRoles || [],
        },
        subscriberCount: subscriptions?.length || 0
      });
    } catch (error) {
      console.error('Error fetching subscription tier:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/subscription-tiers/:tierId
   * Update tier with role management
   */
  app.put(`${BASE}/admin/subscription-tiers/:tierId`, async (c) => {
    try {
      const { tierId } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Get existing tier
      const { data: existing, error: fetchError } = await client
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .single();

      if (fetchError || !existing) {
        return sendError(c, 'Subscription tier not found', 404);
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.display_name !== undefined) updateData.display_name = updates.display_name;
      if (updates.monthly_price !== undefined) updateData.monthly_price = parseFloat(updates.monthly_price);
      if (updates.quarterly_price !== undefined) updateData.quarterly_price = updates.quarterly_price ? parseFloat(updates.quarterly_price) : null;
      if (updates.semi_annual_price !== undefined) updateData.semi_annual_price = updates.semi_annual_price ? parseFloat(updates.semi_annual_price) : null;
      if (updates.annual_price !== undefined) updateData.annual_price = updates.annual_price ? parseFloat(updates.annual_price) : null;
      if (updates.commission_rate !== undefined) updateData.commission_rate = updates.commission_rate ? parseFloat(updates.commission_rate) : null;
      if (updates.applicable_roles !== undefined) updateData.applicable_roles = updates.applicable_roles;
      if (updates.enabled_roles !== undefined) updateData.enabled_roles = updates.enabled_roles;
      if (updates.disabled_roles !== undefined) updateData.disabled_roles = updates.disabled_roles;
      if (updates.benefits !== undefined) updateData.benefits = updates.benefits;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      // ✅ SQL: Update tier
      const { data: updated, error } = await client
        .from('subscription_tiers')
        .update(updateData)
        .eq('id', tierId)
        .select()
        .single();

      if (error) {
        console.error('Error updating tier:', error);
        return sendError(c, `Failed to update tier: ${error.message}`, 500);
      }

      return sendSuccess(c, { tier: updated }, 'Subscription tier updated successfully');
    } catch (error) {
      console.error('Error updating subscription tier:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/subscription-tiers/roles/all
   * Get all available roles for tier configuration
   */
  app.get(`${BASE}/admin/subscription-tiers/roles/all`, async (c) => {
    try {
      // ✅ SQL: Get all active roles
      const { data: roles, error } = await client
        .from('roles')
        .select('id, role_name, role_type, description, is_active')
        .eq('is_active', true)
        .order('role_name', { ascending: true });

      if (error) {
        return sendError(c, `Failed to fetch roles: ${error.message}`, 500);
      }

      return sendSuccess(c, { roles: roles || [], count: roles?.length || 0 });
    } catch (error) {
      console.error('Error fetching roles:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // USER SUBSCRIPTION MANAGEMENT
  // ============================================

  /**
   * POST /subscriptions/user/subscribe
   * User subscribes to a tier (P2P service)
   */
  app.post(`${BASE}/subscriptions/user/subscribe`, async (c) => {
    try {
      const { customerId, tierId, billingCycle, paymentId, paymentMethod } = await c.req.json();

      if (!customerId || !tierId || !billingCycle) {
        return sendError(c, 'Missing required fields: customerId, tierId, billingCycle', 400);
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
      const { data: existingSubs } = await client
        .from('user_subscriptions')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tier_type', tier.tier_type)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString().split('T')[0]);

      if (existingSubs && existingSubs.length > 0) {
        return sendError(c, `You already have an active ${tier.tier_type} subscription. Please cancel it first.`, 400);
      }

      // Calculate price based on billing cycle
      let price = tier.monthly_price;
      if (billingCycle === 'quarterly' && tier.quarterly_price) {
        price = tier.quarterly_price;
      } else if (billingCycle === 'semi_annual' && tier.semi_annual_price) {
        price = tier.semi_annual_price;
      } else if (billingCycle === 'annual' && tier.annual_price) {
        price = tier.annual_price;
      }

      // Calculate dates
      const startDate = new Date();
      const endDate = new Date(startDate);

      switch (billingCycle) {
        case 'monthly':
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case 'quarterly':
          endDate.setMonth(endDate.getMonth() + 3);
          break;
        case 'semi_annual':
          endDate.setMonth(endDate.getMonth() + 6);
          break;
        case 'annual':
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
      }

      const subscriptionId = `usub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // ✅ SQL: Create subscription
      const { data: subscription, error: subError } = await client
        .from('user_subscriptions')
        .insert({
          subscription_id: subscriptionId,
          customer_id: customerId,
          tier_id: tierId,
          tier_name: tier.tier_name,
          tier_type: tier.tier_type,
          price: price,
          billing_cycle: billingCycle,
          status: 'active',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          next_billing_date: endDate.toISOString().split('T')[0],
          payment_id: paymentId || null,
          payment_method: paymentMethod || 'razorpay',
        })
        .select()
        .single();

      if (subError) {
        console.error('Error creating subscription:', subError);
        return sendError(c, `Failed to create subscription: ${subError.message}`, 500);
      }

      return sendSuccess(c, { subscription }, 'Subscription activated successfully');
    } catch (error) {
      console.error('Error creating subscription:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /subscriptions/user/:customerId
   * Get all subscriptions for a user
   */
  app.get(`${BASE}/subscriptions/user/:customerId`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status');

      let query = client
        .from('user_subscriptions')
        .select('*, subscription_tiers(*)')
        .eq('customer_id', customerId);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: subscriptions, error } = await query.order('created_at', { ascending: false });

      if (error) {
        return sendError(c, `Failed to fetch subscriptions: ${error.message}`, 500);
      }

      return sendSuccess(c, { subscriptions: subscriptions || [], count: subscriptions?.length || 0 });
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /subscriptions/user/:customerId/check-access
   * Check if user has access to a specific feature
   */
  app.get(`${BASE}/subscriptions/user/:customerId/check-access`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const feature = c.req.query('feature'); // e.g., 'dating_chat', 'free_delivery'
      const tierType = c.req.query('tierType'); // e.g., 'customer', 'p2p_service'

      if (!feature) {
        return sendError(c, 'Feature parameter required', 400);
      }

      // ✅ SQL: Get active subscriptions
      let query = client
        .from('user_subscriptions')
        .select('*, subscription_tiers(*)')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString().split('T')[0]);

      if (tierType) {
        query = query.eq('tier_type', tierType);
      }

      const { data: subscriptions, error } = await query;

      if (error) {
        return sendError(c, `Failed to check access: ${error.message}`, 500);
      }

      let hasAccess = false;
      let activeSubscription = null;

      for (const sub of subscriptions || []) {
        const tier = sub.subscription_tiers;
        // Check both benefits and features (for backward compatibility)
        const tierBenefits = tier?.benefits || tier?.features || {};
        if (tier && tierBenefits[feature]) {
          hasAccess = true;
          activeSubscription = sub;
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

  /**
   * POST /subscriptions/user/cancel
   * Cancel a user subscription
   */
  app.post(`${BASE}/subscriptions/user/cancel`, async (c) => {
    try {
      const { subscriptionId, customerId, reason } = await c.req.json();

      // ✅ SQL: Get subscription
      const { data: subscription, error: fetchError } = await client
        .from('user_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (fetchError || !subscription) {
        return sendError(c, 'Subscription not found', 404);
      }

      // Verify ownership
      if (subscription.customer_id !== customerId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Cancel subscription
      const { data: updated, error } = await client
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || 'User request',
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) {
        return sendError(c, `Failed to cancel subscription: ${error.message}`, 500);
      }

      return sendSuccess(c, { subscription: updated }, 'Subscription cancelled successfully');
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * GET /admin/subscription-tiers/analytics
   * Get analytics for subscription tiers
   */
  app.get(`${BASE}/admin/subscription-tiers/analytics`, async (c) => {
    try {
      // ✅ SQL: Get all tiers
      const { data: tiers } = await client
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true);

      const analytics = {
        totalTiers: tiers?.length || 0,
        tiersByType: { vendor: 0, customer: 0, p2p_service: 0 },
        totalRevenue: 0,
        totalSubscribers: 0,
        tiers: []
      };

      for (const tier of tiers || []) {
        analytics.tiersByType[tier.tier_type as keyof typeof analytics.tiersByType]++;

        // ✅ SQL: Get subscribers for this tier
        const { data: subscriptions } = await client
          .from('user_subscriptions')
          .select('*')
          .eq('tier_id', tier.id)
          .eq('status', 'active');

        const activeCount = subscriptions?.length || 0;
        const revenue = activeCount * parseFloat(tier.monthly_price || '0');

        analytics.totalSubscribers += activeCount;
        analytics.totalRevenue += revenue;

        analytics.tiers.push({
          id: tier.id,
          name: tier.tier_name,
          tierType: tier.tier_type,
          price: tier.monthly_price,
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

  /**
   * POST /subscriptions/user/subscribe/payment
   * Process subscription payment and activate
   */
  app.post(`${BASE}/subscriptions/user/subscribe/payment`, async (c) => {
    try {
      const { customerId, tierId, billingCycle, paymentId, razorpayOrderId, razorpayPaymentId } = await c.req.json();

      if (!customerId || !tierId || !billingCycle || !paymentId) {
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

      // Calculate price
      let price = tier.monthly_price;
      if (billingCycle === 'quarterly' && tier.quarterly_price) {
        price = tier.quarterly_price;
      } else if (billingCycle === 'semi_annual' && tier.semi_annual_price) {
        price = tier.semi_annual_price;
      } else if (billingCycle === 'annual' && tier.annual_price) {
        price = tier.annual_price;
      }

      // Calculate dates
      const startDate = new Date();
      const endDate = new Date(startDate);

      switch (billingCycle) {
        case 'monthly':
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case 'quarterly':
          endDate.setMonth(endDate.getMonth() + 3);
          break;
        case 'semi_annual':
          endDate.setMonth(endDate.getMonth() + 6);
          break;
        case 'annual':
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
      }

      const subscriptionId = `usub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // ✅ SQL: Create subscription
      const { data: subscription, error: subError } = await client
        .from('user_subscriptions')
        .insert({
          subscription_id: subscriptionId,
          customer_id: customerId,
          tier_id: tierId,
          tier_name: tier.tier_name,
          tier_type: tier.tier_type,
          price: price,
          billing_cycle: billingCycle,
          status: 'active',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          next_billing_date: endDate.toISOString().split('T')[0],
          payment_id: paymentId,
          payment_method: 'razorpay',
        })
        .select()
        .single();

      if (subError) {
        console.error('Error creating subscription:', subError);
        return sendError(c, `Failed to create subscription: ${subError.message}`, 500);
      }

      // Send notification
      const { getNotificationsRepository } = await import('../../lib/repositories/notifications.ts');
      const notificationsRepo = getNotificationsRepository();
      await notificationsRepo.create({
        recipient_id: customerId,
        recipient_type: 'customer',
        notification_type: 'subscription_activated',
        title: 'Subscription Activated! 🎉',
        message: `Your ${tier.display_name} subscription is now active. Enjoy unlimited chat access!`,
        data: { subscriptionId, tierId },
      });

      return sendSuccess(c, { subscription }, 'Subscription activated successfully');
    } catch (error) {
      console.error('Error processing subscription payment:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Subscription Tiers (SQL-only with role management) registered successfully');
}

