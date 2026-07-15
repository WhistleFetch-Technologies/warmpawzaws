/**
 * ============================================================================
 * SUBSCRIPTION PLANS ADMIN ENDPOINTS
 * ============================================================================
 * 
 * Admin CRUD operations for subscription plans
 * - Create, read, update, delete subscription plans
 * - Get subscriber statistics
 * - Manage plan features and pricing
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';

// ============================================================================
// TYPES
// ============================================================================

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  features: string[];
  includedServices: string[];
  maxBookingsPerMonth: number;
  discountPercentage: number;
  isPopular: boolean;
  isActive: boolean;
  subscriberCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// GET SUBSCRIPTION PLANS HANDLER
// ============================================================================

class GetSubscriptionPlansHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const includeInactive = context.event.queryStringParameters?.includeInactive === 'true';

    try {
      let queryStr = `
        SELECT 
          sp.*,
          COALESCE(subscriber_counts.count, 0) as subscriber_count
        FROM subscription_plans sp
        LEFT JOIN (
          SELECT plan_id, COUNT(*) as count 
          FROM customer_subscriptions 
          WHERE status = 'active' 
          GROUP BY plan_id
        ) subscriber_counts ON subscriber_counts.plan_id = sp.id
      `;

      if (!includeInactive) {
        queryStr += ` WHERE sp.is_active = true`;
      }

      queryStr += ` ORDER BY sp.price ASC`;

      const { rows } = await query(queryStr);

      const plans: SubscriptionPlan[] = rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        price: parseFloat(row.price),
        billingCycle: row.billing_cycle,
        features: row.features || [],
        includedServices: row.included_services || [],
        maxBookingsPerMonth: row.max_bookings_per_month,
        discountPercentage: row.discount_percentage,
        isPopular: row.is_popular,
        isActive: row.is_active,
        subscriberCount: parseInt(row.subscriber_count) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      // Calculate stats
      const totalSubscribers = plans.reduce((sum, p) => sum + (p.subscriberCount || 0), 0);
      const monthlyRevenue = plans.reduce((sum, p) => sum + (p.price * (p.subscriberCount || 0)), 0);
      const popularPlan = plans.reduce((max, p) => 
        (p.subscriberCount || 0) > (max?.subscriberCount || 0) ? p : max, 
        plans[0]
      );

      return this.success({
        success: true,
        plans,
        activeSubscribers: totalSubscribers,
        monthlyRevenue,
        popularPlan: popularPlan?.name || '-',
      });
    } catch (error: any) {
      console.error('Error getting subscription plans:', error);
      return this.error(error.message || 'Failed to get plans', 500);
    }
  }
}

// ============================================================================
// CREATE SUBSCRIPTION PLAN HANDLER
// ============================================================================

class CreateSubscriptionPlanHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const {
      name,
      description,
      price,
      billingCycle = 'monthly',
      features = [],
      includedServices = [],
      maxBookingsPerMonth = 10,
      discountPercentage = 0,
      isPopular = false,
      isActive = true,
    } = body;

    if (!name || !price) {
      return this.error('Name and price are required', 400);
    }

    try {
      const [plan] = await insert('subscription_plans', {
        name,
        description: description || '',
        price,
        billing_cycle: billingCycle,
        features: JSON.stringify(features),
        included_services: JSON.stringify(includedServices),
        max_bookings_per_month: maxBookingsPerMonth,
        discount_percentage: discountPercentage,
        is_popular: isPopular,
        is_active: isActive,
        created_at: new Date(),
        updated_at: new Date(),
      });

      return this.success({
        success: true,
        planId: plan.id,
        plan: {
          id: plan.id,
          name,
          price,
          billingCycle,
          isActive,
        },
        message: 'Subscription plan created successfully',
      });
    } catch (error: any) {
      console.error('Error creating plan:', error);
      return this.error(error.message || 'Failed to create plan', 500);
    }
  }
}

// ============================================================================
// UPDATE SUBSCRIPTION PLAN HANDLER
// ============================================================================

class UpdateSubscriptionPlanHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const planId = context.event.pathParameters?.planId;
    const body = this.parseBody(context.event);

    if (!planId) {
      return this.error('Plan ID is required', 400);
    }

    try {
      const updates: any = { updated_at: new Date() };

      if (body.name !== undefined) updates.name = body.name;
      if (body.description !== undefined) updates.description = body.description;
      if (body.price !== undefined) updates.price = body.price;
      if (body.billingCycle !== undefined) updates.billing_cycle = body.billingCycle;
      if (body.features !== undefined) updates.features = JSON.stringify(body.features);
      if (body.includedServices !== undefined) updates.included_services = JSON.stringify(body.includedServices);
      if (body.maxBookingsPerMonth !== undefined) updates.max_bookings_per_month = body.maxBookingsPerMonth;
      if (body.discountPercentage !== undefined) updates.discount_percentage = body.discountPercentage;
      if (body.isPopular !== undefined) updates.is_popular = body.isPopular;
      if (body.isActive !== undefined) updates.is_active = body.isActive;

      await update('subscription_plans', { id: planId }, updates);

      return this.success({
        success: true,
        planId,
        message: 'Subscription plan updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating plan:', error);
      return this.error(error.message || 'Failed to update plan', 500);
    }
  }
}

// ============================================================================
// DELETE SUBSCRIPTION PLAN HANDLER
// ============================================================================

class DeleteSubscriptionPlanHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const planId = context.event.pathParameters?.planId;

    if (!planId) {
      return this.error('Plan ID is required', 400);
    }

    try {
      // Check for active subscribers
      const { rows } = await query(
        `SELECT COUNT(*) as count FROM customer_subscriptions 
         WHERE plan_id = $1 AND status = 'active'`,
        [planId]
      );

      if (parseInt(rows[0]?.count) > 0) {
        return this.error('Cannot delete plan with active subscribers. Deactivate it instead.', 400);
      }

      await query(`DELETE FROM subscription_plans WHERE id = $1`, [planId]);

      return this.success({
        success: true,
        planId,
        message: 'Subscription plan deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      return this.error(error.message || 'Failed to delete plan', 500);
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerSubscriptionPlansAdminEndpoints(app: Hono) {
  const getPlansHandler = new GetSubscriptionPlansHandler();
  const createPlanHandler = new CreateSubscriptionPlanHandler();
  const updatePlanHandler = new UpdateSubscriptionPlanHandler();
  const deletePlanHandler = new DeleteSubscriptionPlanHandler();

  // Get all subscription plans
  app.get('/admin/subscriptions/plans', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: '/admin/subscriptions/plans',
      headers: {},
      body: '',
      pathParameters: {},
      queryStringParameters: Object.fromEntries(new URL(c.req.url).searchParams),
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'subscription-plans', functionVersion: '$LATEST' } as unknown as Context;
    const result = await getPlansHandler.execute(event as unknown as APIGatewayProxyEvent, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Create subscription plan
  app.post('/admin/subscriptions/plans', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const event = {
      httpMethod: 'POST',
      path: '/admin/subscriptions/plans',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'subscription-plans', functionVersion: '$LATEST' } as unknown as Context;
    const result = await createPlanHandler.execute(event as unknown as APIGatewayProxyEvent, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Update subscription plan
  app.put('/admin/subscriptions/plans/:planId', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const event = {
      httpMethod: 'PUT',
      path: `/admin/subscriptions/plans/${c.req.param('planId')}`,
      headers: {},
      body: JSON.stringify(body),
      pathParameters: { planId: c.req.param('planId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'subscription-plans', functionVersion: '$LATEST' } as unknown as Context;
    const result = await updatePlanHandler.execute(event as unknown as APIGatewayProxyEvent, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Delete subscription plan
  app.delete('/admin/subscriptions/plans/:planId', async (c) => {
    const event = {
      httpMethod: 'DELETE',
      path: `/admin/subscriptions/plans/${c.req.param('planId')}`,
      headers: {},
      body: '',
      pathParameters: { planId: c.req.param('planId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'subscription-plans', functionVersion: '$LATEST' } as unknown as Context;
    const result = await deletePlanHandler.execute(event as unknown as APIGatewayProxyEvent, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
