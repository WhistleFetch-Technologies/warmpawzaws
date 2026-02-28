/**
 * ============================================================================
 * AUTHENTICATION ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Thin route wrapper - business logic extracted to controllers/auth.controller.ts
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * Controller extraction: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { 
  SendOtpHandler, 
  VerifyOtpHandler,
  createApiGatewayEvent,
  createLambdaContext
} from '../controllers/auth.controller';

export function registerAuthEndpoints(app: Hono) {
  const sendOtpHandler = new SendOtpHandler();
  const verifyOtpHandler = new VerifyOtpHandler();

  // Primary routes
  app.post('/auth/send-otp', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await sendOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/auth/verify-otp', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await verifyOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Compatibility aliases (web/mobile clients)
  app.post('/auth/otp/send', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await sendOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/auth/otp/verify', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await verifyOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Legacy mobile endpoints
  app.post('/otp/generate', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await sendOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/otp/verify', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await verifyOtpHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
