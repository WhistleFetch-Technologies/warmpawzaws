/**
 * ============================================================================
 * LOCATION SHARING ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles location sharing between vendors and customers:
 * - Start location sharing
 * - Update location
 * - Stop location sharing
 * - Get shared location
 * 
 * Date: 2026-01-07
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { select, insert, update, query } from '../database/rds-connection';

// ============================================================================
// LOCATION SHARING HANDLERS
// ============================================================================

class StartLocationSharingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId, vendorId, customerId, location } = body;

    this.validateRequired(body, ['bookingId', 'vendorId', 'customerId', 'location']);

    // Verify booking exists
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return this.error('Booking not found', 404);
    }

    const booking = bookings[0];

    // Verify vendor owns this booking
    if (booking.vendor_id !== vendorId) {
      return this.error('Unauthorized: This booking belongs to another vendor', 403);
    }

    // Check if location sharing already active
    const existingSharing = await query(
      `SELECT * FROM location_sharing WHERE booking_id = $1 AND is_active = true`,
      [bookingId]
    );

    if (existingSharing.rows.length > 0) {
      // Update existing sharing
      await update('location_sharing',
        { booking_id: bookingId, is_active: true },
        {
          latitude: location.latitude,
          longitude: location.longitude,
          updated_at: new Date().toISOString(),
        }
      );
    } else {
      // Create new location sharing record
      await insert('location_sharing', {
        booking_id: bookingId,
        vendor_id: vendorId,
        customer_id: customerId,
        latitude: location.latitude,
        longitude: location.longitude,
        is_active: true,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    return this.success({
      success: true,
      message: 'Location sharing started',
      bookingId,
    });
  }
}

class UpdateLocationHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId, location } = body;

    this.validateRequired(body, ['bookingId', 'location']);

    // Verify location sharing is active
    const sharing = await query(
      `SELECT * FROM location_sharing WHERE booking_id = $1 AND is_active = true`,
      [bookingId]
    );

    if (sharing.rows.length === 0) {
      return this.error('Location sharing not active for this booking', 400);
    }

    // Update location
    await update('location_sharing',
      { booking_id: bookingId, is_active: true },
      {
        latitude: location.latitude,
        longitude: location.longitude,
        updated_at: new Date().toISOString(),
      }
    );

    // Insert location history
    await insert('location_history', {
      booking_id: bookingId,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy || null,
      speed: location.speed || null,
      heading: location.heading || null,
      timestamp: new Date().toISOString(),
    }).catch(() => {
      // Table might not exist, ignore error
    });

    return this.success({
      success: true,
      message: 'Location updated',
    });
  }
}

class StopLocationSharingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId } = body;

    this.validateRequired(body, ['bookingId']);

    // Stop location sharing
    await update('location_sharing',
      { booking_id: bookingId, is_active: true },
      {
        is_active: false,
        stopped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );

    return this.success({
      success: true,
      message: 'Location sharing stopped',
    });
  }
}

class GetSharedLocationHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    // Get active location sharing
    const sharing = await query(
      `SELECT * FROM location_sharing WHERE booking_id = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1`,
      [bookingId]
    );

    if (sharing.rows.length === 0) {
      return this.error('Location sharing not active', 404);
    }

    return this.success({
      location: {
        latitude: sharing.rows[0].latitude,
        longitude: sharing.rows[0].longitude,
        updated_at: sharing.rows[0].updated_at,
      },
      is_active: true,
    });
  }
}

// ============================================================================
// ENDPOINT REGISTRATION
// ============================================================================

export function registerLocationSharingEndpoints(app: Hono) {
  const startHandler = new StartLocationSharingHandler();
  const updateHandler = new UpdateLocationHandler();
  const stopHandler = new StopLocationSharingHandler();
  const getHandler = new GetSharedLocationHandler();

  app.post("/location/start-sharing", async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await startHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post("/location/update", async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await updateHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post("/location/stop-sharing", async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await stopHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get("/location/:bookingId", async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result = await getHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    pathParameters: {},
    queryStringParameters: {},
    headers: Object.fromEntries(req.headers.entries()),
    body: req.body ? JSON.stringify(req.body) : undefined,
    requestContext: {
      requestId: `req-${Date.now()}`,
    },
  };
}

function createLambdaContext(): any {
  return {
    awsRequestId: `req-${Date.now()}`,
    functionName: 'warmpawz-api',
    functionVersion: '$LATEST',
  };
}

