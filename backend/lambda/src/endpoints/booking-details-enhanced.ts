/**
 * ============================================================================
 * ENHANCED BOOKING DETAILS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Provides comprehensive booking details including:
 * - Booking information
 * - Prescriptions (if any)
 * - Medical records (if any)
 * - Chat conversation
 * - Related data (pet, vendor, staff, service)
 * 
 * This endpoint integrates all centre booking enhancements into one response.
 * 
 * Date: 2026-01-27
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { select, query } from '../database/rds-connection';

class GetEnhancedBookingDetailsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const actorId = context.event.queryStringParameters?.actorId;
    const actorRole = context.event.queryStringParameters?.actorRole || 'customer';

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return this.error('Booking not found', 404);
      }

      const booking = bookings[0];

      // Access control (only enforce if actorId is provided)
      // In UAT mode or when actorId is not provided, allow access
      const isUATMode = context.event.headers?.['x-uat-mode'] === 'true' || 
                        context.event.headers?.['X-UAT-Mode'] === 'true';
      
      if (actorId && !isUATMode) {
        if (actorRole === 'customer' && booking.customer_id !== actorId) {
          return this.error('Access denied', 403);
        }

        if (actorRole === 'vendor' && booking.vendor_id !== actorId) {
          return this.error('Access denied', 403);
        }
      }

      // Get related data in parallel
      const [
        prescriptions,
        medicalRecords,
        chatMessages,
        pet,
        vendor,
        staff,
        service,
        customer,
      ] = await Promise.all([
        // Prescriptions for this booking
        query(
          `SELECT * FROM prescriptions 
           WHERE booking_id = $1 AND is_active = true 
           ORDER BY created_at DESC`,
          [bookingId]
        ).catch(() => ({ rows: [] })),

        // Medical records for this booking
        query(
          `SELECT * FROM medical_records 
           WHERE booking_id = $1 AND is_active = true 
           ORDER BY created_at DESC`,
          [bookingId]
        ).catch(() => ({ rows: [] })),

        // Chat messages for this booking
        query(
          `SELECT * FROM chat_messages 
           WHERE booking_id = $1 
           ORDER BY created_at ASC`,
          [bookingId]
        ).catch(() => ({ rows: [] })),

        // Pet information
        booking.pet_id
          ? select('pets', { id: booking.pet_id }).catch(() => [])
          : Promise.resolve([]),

        // Vendor information
        booking.vendor_id
          ? select('vendors', { id: booking.vendor_id }).catch(() => [])
          : Promise.resolve([]),

        // Staff information
        booking.staff_id || booking.assigned_staff_id
          ? select('staff', { id: booking.staff_id || booking.assigned_staff_id }).catch(() => [])
          : Promise.resolve([]),

        // Service information
        booking.service_id
          ? select('services', { id: booking.service_id }).catch(() => [])
          : Promise.resolve([]),

        // Customer information
        booking.customer_id
          ? select('customers', { id: booking.customer_id }).catch(() => [])
          : Promise.resolve([]),
      ]);

      // Build comprehensive response
      const response = {
        booking: {
          id: booking.id,
          status: booking.status,
          payment_status: booking.payment_status,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          service_type: booking.service_type,
          address: booking.address,
          base_price: booking.base_price,
          total_amount: booking.total_amount,
          notes: booking.notes,
          created_at: booking.created_at,
          updated_at: booking.updated_at,
        },
        pet: pet[0] || null,
        vendor: vendor[0] ? {
          id: vendor[0].id,
          business_name: vendor[0].business_name,
          phone: vendor[0].phone,
          email: vendor[0].email,
          address: vendor[0].address,
        } : null,
        staff: staff[0] ? {
          id: staff[0].id,
          name: staff[0].name,
          phone: staff[0].phone,
          role: staff[0].role,
        } : null,
        service: service[0] || null,
        customer: customer[0] ? {
          id: customer[0].id,
          full_name: customer[0].full_name || customer[0].name,
          phone: customer[0].phone,
        } : null,
        prescriptions: prescriptions.rows || [],
        medicalRecords: medicalRecords.rows || [],
        chat: {
          messages: chatMessages.rows || [],
          messageCount: chatMessages.rows?.length || 0,
          hasUnreadMessages: chatMessages.rows?.some((msg: any) => !msg.is_read) || false,
        },
        summary: {
          hasPrescription: (prescriptions.rows?.length || 0) > 0,
          hasMedicalRecords: (medicalRecords.rows?.length || 0) > 0,
          hasChatMessages: (chatMessages.rows?.length || 0) > 0,
          prescriptionCount: prescriptions.rows?.length || 0,
          medicalRecordCount: medicalRecords.rows?.length || 0,
          chatMessageCount: chatMessages.rows?.length || 0,
        },
      };

      return this.success(response);
    } catch (error: any) {
      console.error('Error fetching enhanced booking details:', error);
      return this.error(error.message || 'Failed to fetch booking details', 500);
    }
  }
}

/**
 * Get prescriptions for a booking
 */
class GetBookingPrescriptionsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      const prescriptions = await query(
        `SELECT * FROM prescriptions 
         WHERE booking_id = $1 AND is_active = true 
         ORDER BY created_at DESC`,
        [bookingId]
      ).catch(() => ({ rows: [] }));

      return this.success({ prescriptions: prescriptions.rows || [] });
    } catch (error: any) {
      console.error('Error fetching booking prescriptions:', error);
      return this.error(error.message || 'Failed to fetch prescriptions', 500);
    }
  }
}

/**
 * Get medical records for a booking
 */
class GetBookingMedicalRecordsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      const medicalRecords = await query(
        `SELECT * FROM medical_records 
         WHERE booking_id = $1 AND is_active = true 
         ORDER BY created_at DESC`,
        [bookingId]
      ).catch(() => ({ rows: [] }));

      return this.success({ medicalRecords: medicalRecords.rows || [] });
    } catch (error: any) {
      console.error('Error fetching booking medical records:', error);
      return this.error(error.message || 'Failed to fetch medical records', 500);
    }
  }
}

/**
 * Get chat conversation for a booking
 */
class GetBookingChatHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      const messages = await query(
        `SELECT * FROM chat_messages 
         WHERE booking_id = $1 
         ORDER BY created_at ASC`,
        [bookingId]
      ).catch(() => ({ rows: [] }));

      return this.success({
        messages: messages.rows || [],
        messageCount: messages.rows?.length || 0,
      });
    } catch (error: any) {
      console.error('Error fetching booking chat:', error);
      return this.error(error.message || 'Failed to fetch chat messages', 500);
    }
  }
}

export function registerBookingDetailsEnhancedEndpoints(app: Hono) {
  const enhancedHandler = new GetEnhancedBookingDetailsHandler();
  const prescriptionsHandler = new GetBookingPrescriptionsHandler();
  const medicalRecordsHandler = new GetBookingMedicalRecordsHandler();
  const chatHandler = new GetBookingChatHandler();

  // Get comprehensive booking details with all related data
  app.get('/bookings/:bookingId/enhanced', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    event.queryStringParameters = {
      actorId: c.req.query('actorId') || undefined,
      actorRole: c.req.query('actorRole') || 'customer',
    };
    const context = createLambdaContext();
    const result = await enhancedHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get prescriptions for a booking
  app.get('/bookings/:bookingId/prescriptions', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result = await prescriptionsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get medical records for a booking
  app.get('/bookings/:bookingId/medical-records', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result = await medicalRecordsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get chat for a booking
  app.get('/bookings/:bookingId/chat', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result = await chatHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'booking-details-enhanced-handler',
    functionVersion: '$LATEST',
  };
}

