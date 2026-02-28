/**
 * ============================================================================
 * SUBSCRIPTION BOOKING ENDPOINTS
 * ============================================================================
 * 
 * Thin route wrapper - business logic extracted to controllers/booking.controller.ts
 * 
 * Handles subscription-based zero-payment bookings:
 * - Check active subscriptions
 * - Validate subscription coverage
 * - Create zero-payment bookings for unlimited subscriptions
 * - Track subscription usage
 * 
 * Date: 2026-01-20
 * Controller extraction: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import {
  CheckSubscriptionCoverageHandler,
  CreateSubscriptionBookingHandler,
  GetSubscriptionUsageHandler,
  createApiGatewayEventForSubscription,
  createLambdaContextForSubscription,
} from '../controllers/booking.controller';

export function registerSubscriptionBookingEndpoints(app: Hono) {
  const checkCoverageHandler = new CheckSubscriptionCoverageHandler();
  const createBookingHandler = new CreateSubscriptionBookingHandler();
  const usageHandler = new GetSubscriptionUsageHandler();

  // Check if booking is covered by subscription
  app.post('/subscriptions/check-coverage', async (c) => {
    const body = await c.req.json();
    const event = createApiGatewayEventForSubscription(c.req);
    event.body = JSON.stringify(body);
    const context = createLambdaContextForSubscription();
    const result = await checkCoverageHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Create zero-payment subscription booking
  app.post('/subscriptions/create-booking', async (c) => {
    const body = await c.req.json();
    const event = createApiGatewayEventForSubscription(c.req);
    event.body = JSON.stringify(body);
    const context = createLambdaContextForSubscription();
    const result = await createBookingHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get subscription usage history
  app.get('/subscriptions/:subscriptionId/usage', async (c) => {
    const event = createApiGatewayEventForSubscription(c.req);
    event.pathParameters = { subscriptionId: c.req.param('subscriptionId') };
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url).searchParams);
    const context = createLambdaContextForSubscription();
    const result = await usageHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get customer subscription usage
  app.get('/customer/:customerId/subscription-usage', async (c) => {
    const event = createApiGatewayEventForSubscription(c.req);
    event.pathParameters = {};
    event.queryStringParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContextForSubscription();
    const result = await usageHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
