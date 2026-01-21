/**
 * ============================================================================
 * WEBHOOK ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Endpoints for managing webhooks and delivering events to external systems
 * 
 * Endpoints:
 * - GET /admin/webhooks - List all webhooks
 * - POST /admin/webhooks - Create a new webhook
 * - GET /admin/webhooks/:id - Get webhook details
 * - PUT /admin/webhooks/:id - Update webhook
 * - DELETE /admin/webhooks/:id - Delete webhook
 * - POST /admin/webhooks/:id/test - Test webhook
 * - GET /admin/webhooks/:id/events - Get webhook event history
 * - GET /admin/webhooks/events - Get all webhook events
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, update, insert } from '../database/rds-connection';
import crypto from 'crypto';

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

class ListWebhooksHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const webhooks = await select('webhooks', {});
      
      // Don't expose secrets in list view
      const sanitized = webhooks.map(w => ({
        ...w,
        secret: w.secret ? '***' : undefined,
      }));

      return this.success({ webhooks: sanitized });
    } catch (error: any) {
      return this.error(error.message || 'Failed to load webhooks', 500);
    }
  }
}

class CreateWebhookHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { name, url, events, secret, is_active, retry_count, timeout_seconds } = body;

    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      return this.error('Name, URL, and at least one event are required', 400);
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return this.error('Invalid webhook URL', 400);
    }

    try {
      const webhook = await insert('webhooks', {
        id: crypto.randomUUID(),
        name,
        url,
        events: JSON.stringify(events),
        secret: secret || null,
        is_active: is_active !== false,
        retry_count: retry_count || 3,
        timeout_seconds: timeout_seconds || 30,
        success_count: 0,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return this.success({ 
        webhook: {
          ...webhook,
          events: JSON.parse(webhook.events || '[]'),
          secret: webhook.secret ? '***' : undefined,
        }
      });
    } catch (error: any) {
      return this.error(error.message || 'Failed to create webhook', 500);
    }
  }
}

class GetWebhookHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const webhookId = context.event.pathParameters?.id;

    if (!webhookId) {
      return this.error('Webhook ID is required', 400);
    }

    try {
      const webhooks = await select('webhooks', { id: webhookId });
      
      if (webhooks.length === 0) {
        return this.error('Webhook not found', 404);
      }

      const webhook = webhooks[0];
      return this.success({
        webhook: {
          ...webhook,
          events: JSON.parse(webhook.events || '[]'),
          secret: webhook.secret ? '***' : undefined,
        }
      });
    } catch (error: any) {
      return this.error(error.message || 'Failed to load webhook', 500);
    }
  }
}

class UpdateWebhookHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const webhookId = context.event.pathParameters?.id;
    const body = this.parseBody(context.event);
    const { name, url, events, secret, is_active, retry_count, timeout_seconds } = body;

    if (!webhookId) {
      return this.error('Webhook ID is required', 400);
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return this.error('Invalid webhook URL', 400);
      }
    }

    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) updateData.name = name;
      if (url !== undefined) updateData.url = url;
      if (events !== undefined) updateData.events = JSON.stringify(events);
      if (secret !== undefined) updateData.secret = secret || null;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (retry_count !== undefined) updateData.retry_count = retry_count;
      if (timeout_seconds !== undefined) updateData.timeout_seconds = timeout_seconds;

      await update('webhooks', { id: webhookId }, updateData);

      const webhooks = await select('webhooks', { id: webhookId });
      const webhook = webhooks[0];

      return this.success({
        webhook: {
          ...webhook,
          events: JSON.parse(webhook.events || '[]'),
          secret: webhook.secret ? '***' : undefined,
        }
      });
    } catch (error: any) {
      return this.error(error.message || 'Failed to update webhook', 500);
    }
  }
}

class DeleteWebhookHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const webhookId = context.event.pathParameters?.id;

    if (!webhookId) {
      return this.error('Webhook ID is required', 400);
    }

    try {
      // Delete webhook events first
      await query('DELETE FROM webhook_events WHERE webhook_id = $1', [webhookId]);
      
      // Delete webhook
      await query('DELETE FROM webhooks WHERE id = $1', [webhookId]);

      return this.success({ message: 'Webhook deleted successfully' });
    } catch (error: any) {
      return this.error(error.message || 'Failed to delete webhook', 500);
    }
  }
}

class TestWebhookHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const webhookId = context.event.pathParameters?.id;

    if (!webhookId) {
      return this.error('Webhook ID is required', 400);
    }

    try {
      const webhooks = await select('webhooks', { id: webhookId });
      
      if (webhooks.length === 0) {
        return this.error('Webhook not found', 404);
      }

      const webhook = webhooks[0];

      if (!webhook.is_active) {
        return this.error('Webhook is not active', 400);
      }

      // Trigger test webhook delivery
      const testPayload = {
        event_type: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook',
          webhook_id: webhookId,
          webhook_name: webhook.name,
        },
      };

      await deliverWebhook(webhook, testPayload);

      return this.success({ message: 'Test webhook sent successfully' });
    } catch (error: any) {
      return this.error(error.message || 'Failed to send test webhook', 500);
    }
  }
}

class GetWebhookEventsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const webhookId = context.event.pathParameters?.id;
    const limit = parseInt(context.event.queryStringParameters?.limit || '50');
    const offset = parseInt(context.event.queryStringParameters?.offset || '0');

    try {
      let events;
      if (webhookId) {
        events = await query(
          'SELECT * FROM webhook_events WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
          [webhookId, limit, offset]
        );
      } else {
        events = await query(
          'SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT $1 OFFSET $2',
          [limit, offset]
        );
      }

      return this.success({ events });
    } catch (error: any) {
      return this.error(error.message || 'Failed to load webhook events', 500);
    }
  }
}

// ============================================================================
// WEBHOOK DELIVERY UTILITY
// ============================================================================

/**
 * Deliver webhook to external URL
 */
async function deliverWebhook(webhook: any, payload: any): Promise<void> {
  const events = JSON.parse(webhook.events || '[]');
  
  // Check if webhook is subscribed to this event type
  if (!events.includes(payload.event_type) && payload.event_type !== 'webhook.test') {
    return; // Webhook not subscribed to this event
  }

  // Create signature if secret is provided
  const body = JSON.stringify(payload);
  let signature: string | undefined;
  
  if (webhook.secret) {
    signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');
  }

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'WarmPawz-Webhook/1.0',
    'X-Webhook-Event': payload.event_type,
    'X-Webhook-Timestamp': new Date().toISOString(),
  };

  if (signature) {
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }

  // Record webhook event
  const eventId = crypto.randomUUID();
  await insert('webhook_events', {
    id: eventId,
    webhook_id: webhook.id,
    event_type: payload.event_type,
    payload: body,
    status: 'pending',
    attempts: 0,
    created_at: new Date().toISOString(),
  });

  // Attempt delivery with retries
  let attempts = 0;
  const maxAttempts = webhook.retry_count || 3;
  let lastError: Error | null = null;

  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), (webhook.timeout_seconds || 30) * 1000);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Success
        await update('webhook_events', { id: eventId }, {
          status: 'success',
          attempts,
          completed_at: new Date().toISOString(),
        });

        await update('webhooks', { id: webhook.id }, {
          success_count: (webhook.success_count || 0) + 1,
          last_triggered_at: new Date().toISOString(),
        });

        return;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      lastError = error;
      
      // Wait before retry (exponential backoff)
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
  }

  // All attempts failed
  await update('webhook_events', { id: eventId }, {
    status: 'failed',
    attempts,
    error_message: lastError?.message || 'Unknown error',
    completed_at: new Date().toISOString(),
  });

  await update('webhooks', { id: webhook.id }, {
    failure_count: (webhook.failure_count || 0) + 1,
    last_triggered_at: new Date().toISOString(),
  });

  throw lastError || new Error('Webhook delivery failed');
}

/**
 * Trigger webhook for an event
 * This should be called from other handlers when events occur
 */
export async function triggerWebhook(eventType: string, data: any): Promise<void> {
  try {
    // Get all active webhooks subscribed to this event
    const webhooks = await select('webhooks', { is_active: true });
    
    const payload = {
      event_type: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    // Deliver to all subscribed webhooks in parallel
    const deliveries = webhooks
      .filter(w => {
        const events = JSON.parse(w.events || '[]');
        return events.includes(eventType);
      })
      .map(webhook => 
        deliverWebhook(webhook, payload).catch(error => {
          console.error(`Failed to deliver webhook ${webhook.id}:`, error);
        })
      );

    await Promise.allSettled(deliveries);
  } catch (error) {
    console.error('Error triggering webhooks:', error);
    // Don't throw - webhook failures shouldn't break main flow
  }
}

// ============================================================================
// ROUTER SETUP
// ============================================================================

export function setupWebhookRoutes(app: Hono) {
  // Import helper functions from admin.ts
  const { requireAdminAuth, createApiGatewayEvent, createLambdaContext } = require('./admin');
  
  // All webhook endpoints require admin authentication
  app.get('/admin/webhooks', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await new ListWebhooksHandler().execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/webhooks', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await new CreateWebhookHandler().execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/webhooks/:id', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await new GetWebhookHandler().execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/admin/webhooks/:id', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await new UpdateWebhookHandler().execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.delete('/admin/webhooks/:id', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await new DeleteWebhookHandler().execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/webhooks/:id/test', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await new TestWebhookHandler().execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/webhooks/:id/events', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await new GetWebhookEventsHandler().execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/webhooks/events', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await new GetWebhookEventsHandler().execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
