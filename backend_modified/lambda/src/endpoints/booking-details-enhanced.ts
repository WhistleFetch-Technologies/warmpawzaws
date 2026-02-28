/**
 * ============================================================================
 * ENHANCED BOOKING DETAILS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Thin route wrapper - business logic extracted to controllers/booking.controller.ts
 * 
 * Provides comprehensive booking details including:
 * - Booking information
 * - Prescriptions (if any)
 * - Medical records (if any)
 * - Chat conversation
 * - Related data (pet, vendor, staff, service)
 * 
 * Date: 2026-01-27
 * Controller extraction: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import {
  GetEnhancedBookingDetailsHandler,
  GetBookingPrescriptionsHandler,
  GetBookingMedicalRecordsHandler,
  GetBookingChatHandler,
  createApiGatewayEventForBooking,
  createLambdaContextForBooking,
} from '../controllers/booking.controller';

export function registerBookingDetailsEnhancedEndpoints(app: Hono) {
  const enhancedHandler = new GetEnhancedBookingDetailsHandler();
  const prescriptionsHandler = new GetBookingPrescriptionsHandler();
  const medicalRecordsHandler = new GetBookingMedicalRecordsHandler();
  const chatHandler = new GetBookingChatHandler();

  // Get comprehensive booking details with all related data
  app.get('/bookings/:bookingId/enhanced', async (c) => {
    const event = createApiGatewayEventForBooking(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    event.queryStringParameters = {
      actorId: c.req.query('actorId') || undefined,
      actorRole: c.req.query('actorRole') || 'customer',
    };
    const context = createLambdaContextForBooking();
    const result = await enhancedHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get prescriptions for a booking
  app.get('/bookings/:bookingId/prescriptions', async (c) => {
    const event = createApiGatewayEventForBooking(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContextForBooking();
    const result = await prescriptionsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get medical records for a booking
  app.get('/bookings/:bookingId/medical-records', async (c) => {
    const event = createApiGatewayEventForBooking(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContextForBooking();
    const result = await medicalRecordsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get chat for a booking
  app.get('/bookings/:bookingId/chat', async (c) => {
    const event = createApiGatewayEventForBooking(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContextForBooking();
    const result = await chatHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
