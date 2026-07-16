/**
 * Loyalty Segments Management Endpoints
 * 
 * CRUD operations for loyalty segments
 * AWS Serverless compatible (Lambda, RDS, Cognito)
 */

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { randomUUID } from 'crypto';
import { deleteRecord, insert, query, select, update } from 'src/database/rds-connection';
import { HandlerContext, HandlerResponse } from 'src/handler/base-handler';
import { BaseHandler } from 'src/handler/base-handler-enhanced';
import { loyaltySegmentationService } from 'src/lib/services/loyalty-segmentation-service';


// ============================================================================
// LOYALTY SEGMENTS MANAGEMENT
// ============================================================================

const SEGMENT_WRITABLE_KEYS = new Set([
  'segment_name',
  'segment_type',
  'description',
  'criteria',
  'match_type',
  'is_active',
  'priority',
]);

function coerceSegmentPriority(v: unknown): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : NaN;
}

function coerceSegmentIsActive(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'false' || v === 0 || v === '0') return false;
  if (v === 'true' || v === 1 || v === '1') return true;
  return Boolean(v);
}

function normalizeSegmentCriteria(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) {
    throw new Error('criteria is required (send {} for empty rules)');
  }
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (typeof p !== 'object' || p === null || Array.isArray(p)) {
        throw new Error('criteria JSON must be an object');
      }
      return p as Record<string, unknown>;
    } catch (e: any) {
      throw new Error(e?.message?.includes('criteria') ? e.message : 'criteria must be valid JSON object');
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  throw new Error('criteria must be an object');
}

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

      const name = String(segment_name ?? '').trim();
      if (!name || !segment_type) {
        return this.error('segment_name and segment_type are required', 400);
      }

      let criteriaObj: Record<string, unknown>;
      try {
        criteriaObj = normalizeSegmentCriteria(criteria);
      } catch (e: any) {
        return this.error(e?.message || 'Invalid criteria', 400);
      }

      const priorityNum = coerceSegmentPriority(priority);
      if (!Number.isFinite(priorityNum)) {
        return this.error('priority must be a number', 400);
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

      const existing = await select('loyalty_segments', { segment_name: name });
      if (existing.length > 0) {
        return this.error('Segment name already exists', 409);
      }

      // Always set id in app: some RDS envs have loyalty_segments.id NOT NULL without DEFAULT
      // (CREATE TABLE IF NOT EXISTS never backfills default on an existing table).
      const rows = await insert('loyalty_segments', {
        id: randomUUID(),
        segment_name: name,
        segment_type,
        description: description ? String(description) : null,
        criteria: criteriaObj,
        match_type,
        is_active: coerceSegmentIsActive(is_active),
        priority: priorityNum,
      });

      return {
        statusCode: 201,
        body: JSON.stringify({
          success: true,
          segment: rows[0],
        }),
      };
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error('Error creating loyalty segment:', msg, error?.stack || '');
      const safe = msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
      return this.error(`Failed to create loyalty segment: ${safe}`, 500);
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

      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const key of SEGMENT_WRITABLE_KEYS) {
        if (!(key in body)) continue;
        const v = (body as any)[key];
        if (v === undefined) continue;
        if (key === 'segment_name') {
          const n = String(v).trim();
          if (n) patch.segment_name = n;
          continue;
        }
        if (key === 'priority') {
          const n = coerceSegmentPriority(v);
          if (!Number.isFinite(n)) {
            return this.error('priority must be a number', 400);
          }
          patch.priority = n;
          continue;
        }
        if (key === 'is_active') {
          patch.is_active = coerceSegmentIsActive(v);
          continue;
        }
        if (key === 'criteria') {
          try {
            patch.criteria = normalizeSegmentCriteria(v);
          } catch (e: any) {
            return this.error(e?.message || 'Invalid criteria', 400);
          }
          continue;
        }
        if (key === 'description') {
          patch.description = v === null || v === '' ? null : String(v);
          continue;
        }
        if (key === 'segment_type') {
          const validSegmentTypes = ['customer', 'vendor', 'both'];
          if (!validSegmentTypes.includes(v)) {
            return this.error(`segment_type must be one of: ${validSegmentTypes.join(', ')}`, 400);
          }
          patch.segment_type = v;
          continue;
        }
        if (key === 'match_type') {
          const validMatchTypes = ['all', 'any'];
          if (!validMatchTypes.includes(v)) {
            return this.error(`match_type must be one of: ${validMatchTypes.join(', ')}`, 400);
          }
          patch.match_type = v;
          continue;
        }
      }

      const updated = await update('loyalty_segments', { id }, patch);

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
          segment: updated[0],
        }),
      };
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error('Error updating loyalty segment:', msg, error?.stack || '');
      const safe = msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
      return this.error(`Failed to update loyalty segment: ${safe}`, 500);
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

// Handler.execute (base-handler-enhanced) is typed as APIGatewayProxyResultV2; at
// runtime it always returns a structured { statusCode, body } object.
type HandlerHttpResult = { body: string; statusCode: ContentfulStatusCode };

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
    const result = await getSegmentsHandler.execute(event, context) as HandlerHttpResult;
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/loyalty-segments/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await getSegmentHandler.execute(event, context) as HandlerHttpResult;
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/loyalty-segments', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.body = JSON.stringify(await c.req.json());
    const context = createLambdaContext();
    const result = await createSegmentHandler.execute(event, context) as HandlerHttpResult;
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/admin/loyalty-segments/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    event.body = JSON.stringify(await c.req.json());
    const context = createLambdaContext();
    const result = await updateSegmentHandler.execute(event, context) as HandlerHttpResult;
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.delete('/admin/loyalty-segments/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await deleteSegmentHandler.execute(event, context) as HandlerHttpResult;
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Customer segment operations
  app.get('/admin/customers/:customerId/segments', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result = await getCustomerSegmentsHandler.execute(event, context) as HandlerHttpResult;
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/customers/:customerId/segments/recalculate', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result = await recalculateCustomerSegmentsHandler.execute(event, context) as HandlerHttpResult;
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
