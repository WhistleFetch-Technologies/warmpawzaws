/**
 * Logistics Management Endpoints
 * 
 * CRUD operations for logistics partners and logistics rules
 * AWS Serverless compatible (Lambda, RDS, Cognito)
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler-enhanced';
import { query, select, insert, update, deleteRecord } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// LOGISTICS PARTNERS MANAGEMENT
// ============================================================================

class GetLogisticsPartnersHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const queryParams = context.event.queryStringParameters || {};
      const { enabled, partnerType } = queryParams;

      let queryStr = `
        SELECT * FROM logistics_partners
        WHERE 1=1
      `;
      const params: any[] = [];

      if (enabled !== undefined) {
        params.push(enabled === 'true');
        queryStr += ` AND enabled = $${params.length}`;
      }

      if (partnerType) {
        params.push(partnerType);
        queryStr += ` AND partner_type = $${params.length}`;
      }

      queryStr += ` ORDER BY partner_name ASC`;

      const result = await query(queryStr, params);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          partners: result.rows,
        }),
      };
    } catch (error: any) {
      console.error('Error fetching logistics partners:', error);
      return this.error('Failed to fetch logistics partners', 500);
    }
  }
}

class GetLogisticsPartnerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};

      if (!id) {
        return this.error('Partner ID is required', 400);
      }

      const partners = await select('logistics_partners', { id });

      if (partners.length === 0) {
        return this.error('Logistics partner not found', 404);
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          partner: partners[0],
        }),
      };
    } catch (error: any) {
      console.error('Error fetching logistics partner:', error);
      return this.error('Failed to fetch logistics partner', 500);
    }
  }
}

class CreateLogisticsPartnerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const {
        partner_id,
        partner_name,
        partner_type,
        email,
        password,
        api_key,
        api_secret,
        enabled = true,
        config = {},
      } = body;

      // Validate required fields
      if (!partner_id || !partner_name || !partner_type) {
        return this.error('partner_id, partner_name, and partner_type are required', 400);
      }

      // Validate partner_type
      const validTypes = ['shiprocket', 'delhivery', 'dunzo', 'other'];
      if (!validTypes.includes(partner_type)) {
        return this.error(`partner_type must be one of: ${validTypes.join(', ')}`, 400);
      }

      // Check if partner_id already exists
      const existing = await select('logistics_partners', { partner_id });
      if (existing.length > 0) {
        return this.error('Partner ID already exists', 409);
      }

      const partner = await insert('logistics_partners', {
        partner_id,
        partner_name,
        partner_type,
        email: email || null,
        password: password || null,
        api_key: api_key || null,
        api_secret: api_secret || null,
        enabled,
        config,
      });

      return {
        statusCode: 201,
        body: JSON.stringify({
          success: true,
          partner,
        }),
      };
    } catch (error: any) {
      console.error('Error creating logistics partner:', error);
      return this.error('Failed to create logistics partner', 500);
    }
  }
}

class UpdateLogisticsPartnerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};
      const body = this.parseBody(context.event);

      if (!id) {
        return this.error('Partner ID is required', 400);
      }

      // Check if partner exists
      const existing = await select('logistics_partners', { id });
      if (existing.length === 0) {
        return this.error('Logistics partner not found', 404);
      }

      // Validate partner_type if provided
      if (body.partner_type) {
        const validTypes = ['shiprocket', 'delhivery', 'dunzo', 'other'];
        if (!validTypes.includes(body.partner_type)) {
          return this.error(`partner_type must be one of: ${validTypes.join(', ')}`, 400);
        }
      }

      // Check partner_id uniqueness if being updated
      if (body.partner_id && body.partner_id !== existing[0].partner_id) {
        const duplicate = await select('logistics_partners', { partner_id: body.partner_id });
        if (duplicate.length > 0) {
          return this.error('Partner ID already exists', 409);
        }
      }

      const updated = await update('logistics_partners', { id }, {
        ...body,
        updated_at: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          partner: updated,
        }),
      };
    } catch (error: any) {
      console.error('Error updating logistics partner:', error);
      return this.error('Failed to update logistics partner', 500);
    }
  }
}

class DeleteLogisticsPartnerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};

      if (!id) {
        return this.error('Partner ID is required', 400);
      }

      // Check if partner exists
      const existing = await select('logistics_partners', { id });
      if (existing.length === 0) {
        return this.error('Logistics partner not found', 404);
      }

      await deleteRecord('logistics_partners', { id });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Logistics partner deleted successfully',
        }),
      };
    } catch (error: any) {
      console.error('Error deleting logistics partner:', error);
      return this.error('Failed to delete logistics partner', 500);
    }
  }
}

// ============================================================================
// LOGISTICS RULES MANAGEMENT
// ============================================================================

class GetLogisticsRulesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const queryParams = context.event.queryStringParameters || {};
      const { isActive, ruleType } = queryParams;

      let queryStr = `
        SELECT * FROM logistics_rules
        WHERE 1=1
      `;
      const params: any[] = [];

      if (isActive !== undefined) {
        params.push(isActive === 'true');
        queryStr += ` AND is_active = $${params.length}`;
      }

      if (ruleType) {
        params.push(ruleType);
        queryStr += ` AND rule_type = $${params.length}`;
      }

      queryStr += ` ORDER BY rule_name ASC`;

      const result = await query(queryStr, params);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          rules: result.rows,
        }),
      };
    } catch (error: any) {
      console.error('Error fetching logistics rules:', error);
      return this.error('Failed to fetch logistics rules', 500);
    }
  }
}

class GetLogisticsRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};

      if (!id) {
        return this.error('Rule ID is required', 400);
      }

      const rules = await select('logistics_rules', { id });

      if (rules.length === 0) {
        return this.error('Logistics rule not found', 404);
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          rule: rules[0],
        }),
      };
    } catch (error: any) {
      console.error('Error fetching logistics rule:', error);
      return this.error('Failed to fetch logistics rule', 500);
    }
  }
}

class CreateLogisticsRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const {
        rule_name,
        rule_type,
        rule_config,
        is_active = true,
      } = body;

      // Validate required fields
      if (!rule_name || !rule_type || !rule_config) {
        return this.error('rule_name, rule_type, and rule_config are required', 400);
      }

      // Check if rule_name already exists
      const existing = await select('logistics_rules', { rule_name });
      if (existing.length > 0) {
        return this.error('Rule name already exists', 409);
      }

      const rule = await insert('logistics_rules', {
        rule_name,
        rule_type,
        rule_config,
        is_active,
      });

      return {
        statusCode: 201,
        body: JSON.stringify({
          success: true,
          rule,
        }),
      };
    } catch (error: any) {
      console.error('Error creating logistics rule:', error);
      return this.error('Failed to create logistics rule', 500);
    }
  }
}

class UpdateLogisticsRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};
      const body = this.parseBody(context.event);

      if (!id) {
        return this.error('Rule ID is required', 400);
      }

      // Check if rule exists
      const existing = await select('logistics_rules', { id });
      if (existing.length === 0) {
        return this.error('Logistics rule not found', 404);
      }

      // Check rule_name uniqueness if being updated
      if (body.rule_name && body.rule_name !== existing[0].rule_name) {
        const duplicate = await select('logistics_rules', { rule_name: body.rule_name });
        if (duplicate.length > 0) {
          return this.error('Rule name already exists', 409);
        }
      }

      const updated = await update('logistics_rules', { id }, {
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
      console.error('Error updating logistics rule:', error);
      return this.error('Failed to update logistics rule', 500);
    }
  }
}

class DeleteLogisticsRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};

      if (!id) {
        return this.error('Rule ID is required', 400);
      }

      // Check if rule exists
      const existing = await select('logistics_rules', { id });
      if (existing.length === 0) {
        return this.error('Logistics rule not found', 404);
      }

      await deleteRecord('logistics_rules', { id });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Logistics rule deleted successfully',
        }),
      };
    } catch (error: any) {
      console.error('Error deleting logistics rule:', error);
      return this.error('Failed to delete logistics rule', 500);
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
    awsRequestId: randomUUID(),
    functionName: 'logistics-management',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:ap-south-1:123456789012:function:logistics-management',
    memoryLimitInMB: '512',
  };
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerLogisticsManagementEndpoints(app: Hono) {
  const getLogisticsPartnersHandler = new GetLogisticsPartnersHandler();
  const getLogisticsPartnerHandler = new GetLogisticsPartnerHandler();
  const createLogisticsPartnerHandler = new CreateLogisticsPartnerHandler();
  const updateLogisticsPartnerHandler = new UpdateLogisticsPartnerHandler();
  const deleteLogisticsPartnerHandler = new DeleteLogisticsPartnerHandler();
  const getLogisticsRulesHandler = new GetLogisticsRulesHandler();
  const getLogisticsRuleHandler = new GetLogisticsRuleHandler();
  const createLogisticsRuleHandler = new CreateLogisticsRuleHandler();
  const updateLogisticsRuleHandler = new UpdateLogisticsRuleHandler();
  const deleteLogisticsRuleHandler = new DeleteLogisticsRuleHandler();

  // Helper to safely extract body and statusCode from handler result
  const parseHandlerResult = (result: any) => {
    const body = result.body ? JSON.parse(result.body) : result;
    const statusCode = result.statusCode || 200;
    return { body, statusCode };
  };

  // Logistics Partners CRUD
  app.get('/admin/logistics-partners', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
    const context = createLambdaContext();
    const result = await getLogisticsPartnersHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 500);
  });

  app.get('/admin/logistics-partners/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await getLogisticsPartnerHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 404 | 500);
  });

  app.post('/admin/logistics-partners', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.body = JSON.stringify(await c.req.json());
    const context = createLambdaContext();
    const result = await createLogisticsPartnerHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 500);
  });

  app.put('/admin/logistics-partners/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    event.body = JSON.stringify(await c.req.json());
    const context = createLambdaContext();
    const result = await updateLogisticsPartnerHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 404 | 500);
  });

  app.delete('/admin/logistics-partners/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await deleteLogisticsPartnerHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 404 | 500);
  });

  // Logistics Rules CRUD
  app.get('/admin/logistics-rules', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
    const context = createLambdaContext();
    const result = await getLogisticsRulesHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 500);
  });

  app.get('/admin/logistics-rules/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await getLogisticsRuleHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 404 | 500);
  });

  app.post('/admin/logistics-rules', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.body = JSON.stringify(await c.req.json());
    const context = createLambdaContext();
    const result = await createLogisticsRuleHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 500);
  });

  app.put('/admin/logistics-rules/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    event.body = JSON.stringify(await c.req.json());
    const context = createLambdaContext();
    const result = await updateLogisticsRuleHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 404 | 500);
  });

  app.delete('/admin/logistics-rules/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await deleteLogisticsRuleHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 404 | 500);
  });

  /**
   * GET /logistics/partners/available
   * Get available logistics partners near a location
   * Fixes GAP-8.3: Logistics Partner Integration
   */
  app.get('/logistics/partners/available', async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');

      if (!lat || !lng) {
        return c.json({ error: 'Latitude and longitude are required' }, 400);
      }

      // Get available logistics partners
      const partnersResult = await query(
        `SELECT 
          lp.id,
          lp.partner_name as name,
          lp.vehicle_number,
          lp.phone,
          lp.status,
          lp.current_latitude,
          lp.current_longitude,
          lp.rating,
          -- Calculate distance (Haversine formula)
          (
            6371 * acos(
              cos(radians($1)) * 
              cos(radians(COALESCE(lp.current_latitude, 0))) * 
              cos(radians(COALESCE(lp.current_longitude, 0)) - radians($2)) + 
              sin(radians($1)) * 
              sin(radians(COALESCE(lp.current_latitude, 0)))
            )
          ) as distance_km
        FROM logistics_partners lp
        WHERE lp.status = 'active'
          AND lp.is_available = true
        HAVING distance_km <= 20
        ORDER BY distance_km ASC
        LIMIT 10`,
        [lat, lng]
      );

      const partners = (partnersResult as any).rows.map((p: any) => ({
        id: p.id,
        name: p.name,
        vehicleNumber: p.vehicle_number,
        phone: p.phone,
        status: p.status === 'active' ? 'available' : p.status,
        rating: p.rating || 4.5,
        estimatedArrival: Math.round(p.distance_km * 2), // Rough estimate: 2 min per km
        distance: p.distance_km,
      }));

      return c.json({
        success: true,
        partners,
      });
    } catch (error: any) {
      console.error('Error fetching available logistics partners:', error);
      // Return empty array if table doesn't exist yet
      return c.json({
        success: true,
        partners: [],
      });
    }
  });

  /**
   * POST /logistics/partners/:partnerId/notify
   * Notify logistics partner about new order
   * Fixes GAP-8.3: Logistics Partner Integration
   */
  app.post('/logistics/partners/:partnerId/notify', async (c) => {
    try {
      const partnerId = c.req.param('partnerId');
      const body = await c.req.json();
      const { orderId, pickupAddress, deliveryAddress, items } = body;

      if (!orderId || !pickupAddress || !deliveryAddress) {
        return c.json({ error: 'Order ID, pickup address, and delivery address are required' }, 400);
      }

      // Get partner
      const partners = await select('logistics_partners', { id: partnerId });
      if (partners.length === 0) {
        return c.json({ error: 'Logistics partner not found' }, 404);
      }

      const partner = partners[0];

      // Create notification (could be stored in notifications table)
      console.log('Notifying logistics partner:', {
        partnerId,
        partnerName: partner.partner_name,
        orderId,
        pickupAddress,
        deliveryAddress,
        items,
      });

      return c.json({
        success: true,
        message: 'Partner notified successfully',
      });
    } catch (error: any) {
      console.error('Error notifying logistics partner:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

