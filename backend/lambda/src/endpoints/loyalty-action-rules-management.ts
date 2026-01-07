/**
 * Loyalty Action Rules Management Endpoints
 * 
 * CRUD operations for loyalty action rules
 * AWS Serverless compatible (Lambda, RDS, Cognito)
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update, deleteRecord } from '../database/rds-connection';

// ============================================================================
// LOYALTY ACTION RULES MANAGEMENT
// ============================================================================

class GetLoyaltyActionRulesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const queryParams = context.event.queryStringParameters || {};
      const { isActive, actionCategory, userType } = queryParams;

      let queryStr = `
        SELECT * FROM loyalty_action_rules
        WHERE 1=1
      `;
      const params: any[] = [];

      if (isActive !== undefined) {
        params.push(isActive === 'true');
        queryStr += ` AND is_active = $${params.length}`;
      }

      if (actionCategory) {
        params.push(actionCategory);
        queryStr += ` AND action_category = $${params.length}`;
      }

      if (userType) {
        params.push(userType);
        queryStr += ` AND user_type IN ($${params.length}, 'both')`;
      }

      queryStr += ` ORDER BY priority DESC, action_name ASC`;

      const result = await query(queryStr, params);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          rules: result.rows,
        }),
      };
    } catch (error: any) {
      console.error('Error fetching loyalty action rules:', error);
      return this.error('Failed to fetch loyalty action rules', 500);
    }
  }
}

class GetLoyaltyActionRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};

      if (!id) {
        return this.error('Rule ID is required', 400);
      }

      const rules = await select('loyalty_action_rules', { id });

      if (rules.length === 0) {
        return this.error('Loyalty action rule not found', 404);
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          rule: rules[0],
        }),
      };
    } catch (error: any) {
      console.error('Error fetching loyalty action rule:', error);
      return this.error('Failed to fetch loyalty action rule', 500);
    }
  }
}

class CreateLoyaltyActionRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const {
        action_name,
        action_category,
        user_type,
        points_type,
        points_value,
        base_amount,
        min_amount,
        max_points_per_transaction,
        frequency_type,
        frequency_limit,
        frequency_period,
        conditions,
        multiplier_conditions,
        is_active = true,
        priority = 100,
        description,
        notes,
      } = body;

      // Validate required fields
      if (!action_name || !action_category || !user_type || !points_type || points_value === undefined) {
        return this.error('action_name, action_category, user_type, points_type, and points_value are required', 400);
      }

      // Validate enums
      const validCategories = ['loyalty', 'referral_rewards'];
      if (!validCategories.includes(action_category)) {
        return this.error(`action_category must be one of: ${validCategories.join(', ')}`, 400);
      }

      const validUserTypes = ['customer', 'vendor', 'both'];
      if (!validUserTypes.includes(user_type)) {
        return this.error(`user_type must be one of: ${validUserTypes.join(', ')}`, 400);
      }

      const validPointsTypes = ['fixed', 'percentage', 'per_amount'];
      if (!validPointsTypes.includes(points_type)) {
        return this.error(`points_type must be one of: ${validPointsTypes.join(', ')}`, 400);
      }

      // Check if action_name already exists
      const existing = await select('loyalty_action_rules', { action_name });
      if (existing.length > 0) {
        return this.error('Action name already exists', 409);
      }

      const rule = await insert('loyalty_action_rules', {
        action_name,
        action_category,
        user_type,
        points_type,
        points_value,
        base_amount: base_amount || null,
        min_amount: min_amount || null,
        max_points_per_transaction: max_points_per_transaction || null,
        frequency_type: frequency_type || null,
        frequency_limit: frequency_limit || null,
        frequency_period: frequency_period || null,
        conditions: conditions || {},
        multiplier_conditions: multiplier_conditions || {},
        is_active,
        priority,
        description: description || null,
        notes: notes || null,
      });

      return {
        statusCode: 201,
        body: JSON.stringify({
          success: true,
          rule,
        }),
      };
    } catch (error: any) {
      console.error('Error creating loyalty action rule:', error);
      return this.error('Failed to create loyalty action rule', 500);
    }
  }
}

class UpdateLoyaltyActionRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};
      const body = this.parseBody(context.event);

      if (!id) {
        return this.error('Rule ID is required', 400);
      }

      // Check if rule exists
      const existing = await select('loyalty_action_rules', { id });
      if (existing.length === 0) {
        return this.error('Loyalty action rule not found', 404);
      }

      // Validate enums if provided
      if (body.action_category) {
        const validCategories = ['loyalty', 'referral_rewards'];
        if (!validCategories.includes(body.action_category)) {
          return this.error(`action_category must be one of: ${validCategories.join(', ')}`, 400);
        }
      }

      if (body.user_type) {
        const validUserTypes = ['customer', 'vendor', 'both'];
        if (!validUserTypes.includes(body.user_type)) {
          return this.error(`user_type must be one of: ${validUserTypes.join(', ')}`, 400);
        }
      }

      if (body.points_type) {
        const validPointsTypes = ['fixed', 'percentage', 'per_amount'];
        if (!validPointsTypes.includes(body.points_type)) {
          return this.error(`points_type must be one of: ${validPointsTypes.join(', ')}`, 400);
        }
      }

      // Check action_name uniqueness if being updated
      if (body.action_name && body.action_name !== existing[0].action_name) {
        const duplicate = await select('loyalty_action_rules', { action_name: body.action_name });
        if (duplicate.length > 0) {
          return this.error('Action name already exists', 409);
        }
      }

      const updated = await update('loyalty_action_rules', { id }, {
        ...body,
        updated_at: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          rule: updated,
        }),
      };
    } catch (error: any) {
      console.error('Error updating loyalty action rule:', error);
      return this.error('Failed to update loyalty action rule', 500);
    }
  }
}

class DeleteLoyaltyActionRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};

      if (!id) {
        return this.error('Rule ID is required', 400);
      }

      // Check if rule exists
      const existing = await select('loyalty_action_rules', { id });
      if (existing.length === 0) {
        return this.error('Loyalty action rule not found', 404);
      }

      await deleteRecord('loyalty_action_rules', { id });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Loyalty action rule deleted successfully',
        }),
      };
    } catch (error: any) {
      console.error('Error deleting loyalty action rule:', error);
      return this.error('Failed to delete loyalty action rule', 500);
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS FOR HONO INTEGRATION
// ============================================================================

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url.split('?')[0],
    pathParameters: {},
    queryStringParameters: {},
    headers: Object.fromEntries(req.headers.entries()),
    body: JSON.stringify(req.body || {}),
    isBase64Encoded: false,
  };
}

function createLambdaContext(): any {
  return {
    functionName: 'loyalty-action-rules-management',
    functionVersion: '$LATEST',
    awsRequestId: crypto.randomUUID(),
  };
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerLoyaltyActionRulesManagementEndpoints(app: Hono) {
  const getRulesHandler = new GetLoyaltyActionRulesHandler();
  const getRuleHandler = new GetLoyaltyActionRuleHandler();
  const createRuleHandler = new CreateLoyaltyActionRuleHandler();
  const updateRuleHandler = new UpdateLoyaltyActionRuleHandler();
  const deleteRuleHandler = new DeleteLoyaltyActionRuleHandler();

  // Loyalty Action Rules CRUD
  app.get('/admin/loyalty-action-rules', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
    const context = createLambdaContext();
    const result = await getRulesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/loyalty-action-rules/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await getRuleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/loyalty-action-rules', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.body = JSON.stringify(await c.req.json());
    const context = createLambdaContext();
    const result = await createRuleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/admin/loyalty-action-rules/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    event.body = JSON.stringify(await c.req.json());
    const context = createLambdaContext();
    const result = await updateRuleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.delete('/admin/loyalty-action-rules/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await deleteRuleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

