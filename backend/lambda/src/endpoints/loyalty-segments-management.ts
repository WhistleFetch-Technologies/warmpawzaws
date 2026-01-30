/**
 * Loyalty Segments Management Endpoints
 * 
 * CRUD operations for loyalty segments
 * AWS Serverless compatible (Lambda, RDS, Cognito)
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update, deleteRecord } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// LOYALTY SEGMENTS MANAGEMENT
// ============================================================================

class GetLoyaltySegmentsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const queryParams = context.event.queryStringParameters || {};
      const { isActive, segmentType } = queryParams;

      let queryStr = `
        SELECT * FROM loyalty_segments
        WHERE 1=1
      `;
      const params: any[] = [];

      if (isActive !== undefined) {
        params.push(isActive === 'true');
        queryStr += ` AND is_active = $${params.length}`;
      }

      if (segmentType) {
        params.push(segmentType);
        queryStr += ` AND segment_type IN ($${params.length}, 'both')`;
      }

      queryStr += ` ORDER BY priority DESC, segment_name ASC`;

      const result = await query(queryStr, params);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          segments: result.rows,
        }),
      };
    } catch (error: any) {
      console.error('Error fetching loyalty segments:', error);
      return this.error('Failed to fetch loyalty segments', 500);
    }
  }
}

class GetLoyaltySegmentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};

      if (!id) {
        return this.error('Segment ID is required', 400);
      }

      const segments = await select('loyalty_segments', { id });

      if (segments.length === 0) {
        return this.error('Loyalty segment not found', 404);
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          segment: segments[0],
        }),
      };
    } catch (error: any) {
      console.error('Error fetching loyalty segment:', error);
      return this.error('Failed to fetch loyalty segment', 500);
    }
  }
}

class CreateLoyaltySegmentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const {
        segment_name,
        segment_type,
        description,
        criteria,
        match_type = 'all',
        is_active = true,
        priority = 100,
      } = body;

      // Validate required fields
      if (!segment_name || !segment_type || !criteria) {
        return this.error('segment_name, segment_type, and criteria are required', 400);
      }

      // Validate enums
      const validSegmentTypes = ['customer', 'vendor', 'both'];
      if (!validSegmentTypes.includes(segment_type)) {
        return this.error(`segment_type must be one of: ${validSegmentTypes.join(', ')}`, 400);
      }

      const validMatchTypes = ['all', 'any'];
      if (!validMatchTypes.includes(match_type)) {
        return this.error(`match_type must be one of: ${validMatchTypes.join(', ')}`, 400);
      }

      // Check if segment_name already exists
      const existing = await select('loyalty_segments', { segment_name });
      if (existing.length > 0) {
        return this.error('Segment name already exists', 409);
      }

      const segment = await insert('loyalty_segments', {
        segment_name,
        segment_type,
        description: description || null,
        criteria: typeof criteria === 'string' ? JSON.parse(criteria) : criteria,
        match_type,
        is_active,
        priority,
      });

      return {
        statusCode: 201,
        body: JSON.stringify({
          success: true,
          segment,
        }),
      };
    } catch (error: any) {
      console.error('Error creating loyalty segment:', error);
      return this.error('Failed to create loyalty segment', 500);
    }
  }
}

class UpdateLoyaltySegmentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};
      const body = this.parseBody(context.event);

      if (!id) {
        return this.error('Segment ID is required', 400);
      }

      // Check if segment exists
      const existing = await select('loyalty_segments', { id });
      if (existing.length === 0) {
        return this.error('Loyalty segment not found', 404);
      }

      // Validate enums if provided
      if (body.segment_type) {
        const validSegmentTypes = ['customer', 'vendor', 'both'];
        if (!validSegmentTypes.includes(body.segment_type)) {
          return this.error(`segment_type must be one of: ${validSegmentTypes.join(', ')}`, 400);
        }
      }

      if (body.match_type) {
        const validMatchTypes = ['all', 'any'];
        if (!validMatchTypes.includes(body.match_type)) {
          return this.error(`match_type must be one of: ${validMatchTypes.join(', ')}`, 400);
        }
      }

      // Check segment_name uniqueness if being updated
      if (body.segment_name && body.segment_name !== existing[0].segment_name) {
        const duplicate = await select('loyalty_segments', { segment_name: body.segment_name });
        if (duplicate.length > 0) {
          return this.error('Segment name already exists', 409);
        }
      }

      // Parse criteria if it's a string
      if (body.criteria && typeof body.criteria === 'string') {
        body.criteria = JSON.parse(body.criteria);
      }

      const updated = await update('loyalty_segments', { id }, {
        ...body,
        updated_at: new Date().toISOString(),
      });

      // Invalidate cached segment assignments when segment is updated
      await query(
        `UPDATE customer_segment_assignments SET is_active = false WHERE segment_id = $1`,
        [id]
      );
      await query(
        `UPDATE vendor_segment_assignments SET is_active = false WHERE segment_id = $1`,
        [id]
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          segment: updated,
        }),
      };
    } catch (error: any) {
      console.error('Error updating loyalty segment:', error);
      return this.error('Failed to update loyalty segment', 500);
    }
  }
}

class DeleteLoyaltySegmentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};

      if (!id) {
        return this.error('Segment ID is required', 400);
      }

      // Check if segment exists
      const existing = await select('loyalty_segments', { id });
      if (existing.length === 0) {
        return this.error('Loyalty segment not found', 404);
      }

      // Check if segment is used in any loyalty rules
      const rulesUsingSegment = await query(
        `SELECT COUNT(*) as count FROM loyalty_action_rules
         WHERE conditions::text LIKE '%' || $1 || '%'`,
        [id]
      );

      if (parseInt(rulesUsingSegment.rows[0]?.count || '0', 10) > 0) {
        return this.error('Cannot delete segment: it is being used in loyalty rules', 409);
      }

      await deleteRecord('loyalty_segments', { id });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Loyalty segment deleted successfully',
        }),
      };
    } catch (error: any) {
      console.error('Error deleting loyalty segment:', error);
      return this.error('Failed to delete loyalty segment', 500);
    }
  }
}

class GetCustomerSegmentsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { customerId } = context.event.pathParameters || context.event.queryStringParameters || {};

      if (!customerId) {
        return this.error('Customer ID is required', 400);
      }

      // Get segments using segmentation service
      const { loyaltySegmentationService } = await import('../lib/services/loyalty-segmentation-service');
      const segmentIds = await loyaltySegmentationService.getCustomerSegments(customerId, true);

      // Get segment details
      const segments = segmentIds.length > 0
        ? await query(
            `SELECT * FROM loyalty_segments WHERE id = ANY($1::uuid[])`,
            [segmentIds]
          )
        : { rows: [] };

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          segments: segments.rows,
          segmentIds,
        }),
      };
    } catch (error: any) {
      console.error('Error getting customer segments:', error);
      return this.error('Failed to get customer segments', 500);
    }
  }
}

class RecalculateCustomerSegmentsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { customerId } = context.event.pathParameters || context.event.queryStringParameters || {};

      if (!customerId) {
        return this.error('Customer ID is required', 400);
      }

      // Recalculate segments (force refresh, don't use cache)
      const { loyaltySegmentationService } = await import('../lib/services/loyalty-segmentation-service');
      const segmentIds = await loyaltySegmentationService.getCustomerSegments(customerId, false);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Customer segments recalculated',
          segmentIds,
        }),
      };
    } catch (error: any) {
      console.error('Error recalculating customer segments:', error);
      return this.error('Failed to recalculate customer segments', 500);
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS FOR HONO INTEGRATION
// ============================================================================

function createApiGatewayEvent(req: any): any {
  const headers: Record<string, string> = {};
  if (req.headers && req.headers.entries) {
    try {
      Object.assign(headers, Object.fromEntries(req.headers.entries()));
    } catch (e) {
      // Fallback if entries() fails
      if (req.headers) {
        Object.keys(req.headers).forEach(key => {
          headers[key] = req.headers[key];
        });
      }
    }
  }
  return {
    httpMethod: req.method,
    path: req.url ? req.url.split('?')[0] : '',
    pathParameters: {},
    queryStringParameters: {},
    headers,
    body: JSON.stringify(req.body || {}),
    isBase64Encoded: false,
  };
}

function createLambdaContext(): any {
  return {
    functionName: 'loyalty-segments-management',
    functionVersion: '$LATEST',
    awsRequestId: randomUUID(),
  };
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerLoyaltySegmentsManagementEndpoints(app: Hono) {
  const getSegmentsHandler = new GetLoyaltySegmentsHandler();
  const getSegmentHandler = new GetLoyaltySegmentHandler();
  const createSegmentHandler = new CreateLoyaltySegmentHandler();
  const updateSegmentHandler = new UpdateLoyaltySegmentHandler();
  const deleteSegmentHandler = new DeleteLoyaltySegmentHandler();
  const getCustomerSegmentsHandler = new GetCustomerSegmentsHandler();
  const recalculateCustomerSegmentsHandler = new RecalculateCustomerSegmentsHandler();

  // Loyalty Segments CRUD
  app.get('/admin/loyalty-segments', async (c) => {
    const event = createApiGatewayEvent(c.req);
    try {
      const query = c.req.query();
      event.queryStringParameters = query ? Object.fromEntries(Object.entries(query)) : {};
    } catch (e) {
      event.queryStringParameters = {};
    }
    const context = createLambdaContext();
    const result = await getSegmentsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/loyalty-segments/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await getSegmentHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/loyalty-segments', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.body = JSON.stringify(await c.req.json());
    const context = createLambdaContext();
    const result = await createSegmentHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/admin/loyalty-segments/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    event.body = JSON.stringify(await c.req.json());
    const context = createLambdaContext();
    const result = await updateSegmentHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.delete('/admin/loyalty-segments/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await deleteSegmentHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Customer segment operations
  app.get('/admin/customers/:customerId/segments', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result = await getCustomerSegmentsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/customers/:customerId/segments/recalculate', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result = await recalculateCustomerSegmentsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
