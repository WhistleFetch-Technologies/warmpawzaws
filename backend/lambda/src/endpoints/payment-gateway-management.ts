/**
 * Payment Gateway Management Endpoints
 * 
 * CRUD operations for payment gateways
 * AWS Serverless compatible (Lambda, RDS, Cognito)
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../lib/handlers/base-handler';
import { query, select, insert, update, deleteRecord } from '../database/rds-connection';

// ============================================================================
// PAYMENT GATEWAY MANAGEMENT
// ============================================================================

class GetPaymentGatewaysHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const queryParams = context.event.queryStringParameters || {};
      const { enabled, gatewayType } = queryParams;

      let queryStr = `
        SELECT 
          id,
          gateway_name,
          gateway_type,
          key_id,
          marketplace_mode,
          enabled,
          test_mode,
          config,
          updated_at,
          created_at
        FROM payment_gateway_settings
        WHERE 1=1
      `;
      const params: any[] = [];

      if (enabled !== undefined) {
        params.push(enabled === 'true');
        queryStr += ` AND enabled = $${params.length}`;
      }

      if (gatewayType) {
        params.push(gatewayType);
        queryStr += ` AND gateway_type = $${params.length}`;
      }

      queryStr += ` ORDER BY gateway_name ASC`;

      const result = await query(queryStr, params);

      // Don't expose sensitive data
      const gateways = result.rows.map((gw: any) => ({
        ...gw,
        key_secret: undefined,
        webhook_secret: undefined,
      }));

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          gateways,
        }),
      };
    } catch (error: any) {
      console.error('Error fetching payment gateways:', error);
      return this.error('Failed to fetch payment gateways', 500);
    }
  }
}

class GetPaymentGatewayHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};

      if (!id) {
        return this.error('Gateway ID is required', 400);
      }

      const gateways = await select('payment_gateway_settings', { id });

      if (gateways.length === 0) {
        return this.error('Payment gateway not found', 404);
      }

      // Don't expose sensitive data
      const gateway = {
        ...gateways[0],
        key_secret: undefined,
        webhook_secret: undefined,
      };

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          gateway,
        }),
      };
    } catch (error: any) {
      console.error('Error fetching payment gateway:', error);
      return this.error('Failed to fetch payment gateway', 500);
    }
  }
}

class CreatePaymentGatewayHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const {
        gateway_name,
        gateway_type,
        key_id,
        key_secret,
        webhook_secret,
        marketplace_mode = true,
        enabled = true,
        test_mode = true,
        config = {},
      } = body;

      // Validate required fields
      if (!gateway_name || !gateway_type) {
        return this.error('gateway_name and gateway_type are required', 400);
      }

      // Validate gateway_type
      const validTypes = ['razorpay', 'stripe', 'paypal', 'paytm'];
      if (!validTypes.includes(gateway_type)) {
        return this.error(`gateway_type must be one of: ${validTypes.join(', ')}`, 400);
      }

      // Check if gateway_name already exists
      const existing = await select('payment_gateway_settings', { gateway_name });
      if (existing.length > 0) {
        return this.error('Gateway name already exists', 409);
      }

      const gateway = await insert('payment_gateway_settings', {
        gateway_name,
        gateway_type,
        key_id: key_id || null,
        key_secret: key_secret || null,
        webhook_secret: webhook_secret || null,
        marketplace_mode,
        enabled,
        test_mode,
        config,
      });

      // Don't expose sensitive data
      const response = {
        ...gateway,
        key_secret: undefined,
        webhook_secret: undefined,
      };

      return {
        statusCode: 201,
        body: JSON.stringify({
          success: true,
          gateway: response,
        }),
      };
    } catch (error: any) {
      console.error('Error creating payment gateway:', error);
      return this.error('Failed to create payment gateway', 500);
    }
  }
}

class UpdatePaymentGatewayHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};
      const body = this.parseBody(context.event);

      if (!id) {
        return this.error('Gateway ID is required', 400);
      }

      // Check if gateway exists
      const existing = await select('payment_gateway_settings', { id });
      if (existing.length === 0) {
        return this.error('Payment gateway not found', 404);
      }

      // Validate gateway_type if provided
      if (body.gateway_type) {
        const validTypes = ['razorpay', 'stripe', 'paypal', 'paytm'];
        if (!validTypes.includes(body.gateway_type)) {
          return this.error(`gateway_type must be one of: ${validTypes.join(', ')}`, 400);
        }
      }

      // Check gateway_name uniqueness if being updated
      if (body.gateway_name && body.gateway_name !== existing[0].gateway_name) {
        const duplicate = await select('payment_gateway_settings', { gateway_name: body.gateway_name });
        if (duplicate.length > 0) {
          return this.error('Gateway name already exists', 409);
        }
      }

      // Only update provided fields
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (body.gateway_name !== undefined) updateData.gateway_name = body.gateway_name;
      if (body.gateway_type !== undefined) updateData.gateway_type = body.gateway_type;
      if (body.key_id !== undefined) updateData.key_id = body.key_id;
      if (body.key_secret !== undefined) updateData.key_secret = body.key_secret;
      if (body.webhook_secret !== undefined) updateData.webhook_secret = body.webhook_secret;
      if (body.marketplace_mode !== undefined) updateData.marketplace_mode = body.marketplace_mode;
      if (body.enabled !== undefined) updateData.enabled = body.enabled;
      if (body.test_mode !== undefined) updateData.test_mode = body.test_mode;
      if (body.config !== undefined) updateData.config = body.config;

      const updated = await update('payment_gateway_settings', { id }, updateData);

      // Don't expose sensitive data
      const response = {
        ...updated,
        key_secret: undefined,
        webhook_secret: undefined,
      };

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          gateway: response,
        }),
      };
    } catch (error: any) {
      console.error('Error updating payment gateway:', error);
      return this.error('Failed to update payment gateway', 500);
    }
  }
}

class DeletePaymentGatewayHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { id } = context.event.pathParameters || {};

      if (!id) {
        return this.error('Gateway ID is required', 400);
      }

      // Check if gateway exists
      const existing = await select('payment_gateway_settings', { id });
      if (existing.length === 0) {
        return this.error('Payment gateway not found', 404);
      }

      // Don't allow deletion if it's the only enabled gateway
      const enabledGateways = await select('payment_gateway_settings', { enabled: true });
      if (enabledGateways.length === 1 && existing[0].enabled) {
        return this.error('Cannot delete the only enabled payment gateway', 400);
      }

      await deleteRecord('payment_gateway_settings', { id });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Payment gateway deleted successfully',
        }),
      };
    } catch (error: any) {
      console.error('Error deleting payment gateway:', error);
      return this.error('Failed to delete payment gateway', 500);
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
    awsRequestId: crypto.randomUUID(),
    functionName: 'payment-gateway-management',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:ap-south-1:123456789012:function:payment-gateway-management',
    memoryLimitInMB: '512',
  };
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerPaymentGatewayManagementEndpoints(app: Hono) {
  const getPaymentGatewaysHandler = new GetPaymentGatewaysHandler();
  const getPaymentGatewayHandler = new GetPaymentGatewayHandler();
  const createPaymentGatewayHandler = new CreatePaymentGatewayHandler();
  const updatePaymentGatewayHandler = new UpdatePaymentGatewayHandler();
  const deletePaymentGatewayHandler = new DeletePaymentGatewayHandler();

  // Payment Gateway CRUD
  app.get('/admin/payment-gateways', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
    const context = createLambdaContext();
    const result = await getPaymentGatewaysHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/payment-gateways/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await getPaymentGatewayHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/payment-gateways', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.body = JSON.stringify(await c.req.json());
    const context = createLambdaContext();
    const result = await createPaymentGatewayHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/admin/payment-gateways/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    event.body = JSON.stringify(await c.req.json());
    const context = createLambdaContext();
    const result = await updatePaymentGatewayHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.delete('/admin/payment-gateways/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await deletePaymentGatewayHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

