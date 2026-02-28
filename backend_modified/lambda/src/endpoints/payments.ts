/**
 * ============================================================================
 * PAYMENT ENDPOINTS - LAMBDA VERSION (TEMPORAL AUDIT COMPLIANT)
 * ============================================================================
 * 
 * Thin route wrapper - business logic extracted to controllers/payment.controller.ts
 * 
 * Endpoints:
 * - POST /payments/create - Create payment
 * - POST /payments/razorpay/webhook - Razorpay webhook handler
 * - GET /payments/:id - Get payment details
 * 
 * Date: 2025-01-28
 * Updated: 2026-01-02 (Temporal Audit Fixes)
 * Controller extraction: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import {
  CreatePaymentHandler,
  RazorpayWebhookHandler,
  GetPaymentHandler,
  createApiGatewayEventForPayment,
  createLambdaContextForPayment,
} from '../controllers/payment.controller';

export function registerPaymentEndpoints(app: Hono) {
  const createHandler = new CreatePaymentHandler();
  const webhookHandler = new RazorpayWebhookHandler();
  const getHandler = new GetPaymentHandler();

  app.post('/payments/create', async (c) => {
    try {
      const contextData = c.env as { parsedBody?: Record<string, unknown> } | undefined;
      let body: Record<string, unknown> = contextData?.parsedBody as Record<string, unknown> || {};
      
      if (!body || Object.keys(body).length === 0) {
        try {
          body = await c.req.json() as Record<string, unknown>;
        } catch (e) {
          body = {};
        }
      }
      
      const event = createApiGatewayEventForPayment(c.req);
      event.body = JSON.stringify(body);
      const context = createLambdaContextForPayment();
      const result = await createHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: any) {
      console.error('Error in /payments/create:', error);
      return c.json({ 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error?.message || 'Failed to create payment' 
        } 
      }, 500);
    }
  });

  app.post('/payments/razorpay/webhook', async (c) => {
    try {
      const contextData = c.env as { parsedBody?: Record<string, unknown> } | undefined;
      let body: Record<string, unknown> = contextData?.parsedBody as Record<string, unknown> || {};
      
      if (!body || Object.keys(body).length === 0) {
        try {
          body = await c.req.json() as Record<string, unknown>;
        } catch (e) {
          body = {};
        }
      }
      
      const event = createApiGatewayEventForPayment(c.req);
      event.body = JSON.stringify(body);
      const context = createLambdaContextForPayment();
      const result = await webhookHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: any) {
      console.error('Error in /payments/razorpay/webhook:', error);
      return c.json({ success: false, error: error?.message }, 500);
    }
  });

  app.get('/payments/:paymentId', async (c) => {
    try {
      const event = createApiGatewayEventForPayment(c.req);
      event.pathParameters = { id: c.req.param('paymentId') };
      const context = createLambdaContextForPayment();
      const result = await getHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: any) {
      console.error('Error in /payments/:paymentId:', error);
      return c.json({ success: false, error: error?.message }, 500);
    }
  });
}
