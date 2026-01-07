/**
 * ============================================================================
 * CUSTOMER APPOINTMENTS ENDPOINTS
 * ============================================================================
 * 
 * Handles customer appointment management:
 * - List appointments
 * - Get appointment details
 * - Reschedule appointments
 * - Cancel appointments
 * 
 * Date: 2026-01-07
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query } from '../database/rds-connection';

// ============================================================================
// GET /customer/appointments - List all appointments for customer
// ============================================================================

class GetCustomerAppointmentsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      // Extract customer ID from event path or user context
      const customerId = context.event.pathParameters?.customerId || 
                        context.event.queryStringParameters?.customerId ||
                        context.userId;
      
      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      // Get appointments with related data
      const appointments = await query(`
        SELECT 
          a.id,
          a.booking_id,
          a.appointment_date,
          a.appointment_time,
          a.status,
          a.notes,
          a.created_at,
          a.updated_at,
          b.service_id,
          b.vendor_id,
          b.pet_id,
          s.name as service_name,
          s.service_style,
          v.name as vendor_name,
          v.address as vendor_address,
          p.name as pet_name
        FROM appointments a
        INNER JOIN bookings b ON a.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN pets p ON b.pet_id = p.id
        WHERE b.customer_id = $1
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
      `, [customerId]);

      return this.success({
        appointments: appointments.rows,
        count: appointments.rows.length
      });
    } catch (error: any) {
      console.error('Error fetching customer appointments:', error);
      return this.error(error.message || 'Failed to fetch appointments', 500);
    }
  }
}

// ============================================================================
// GET /customer/appointments/:id - Get appointment details
// ============================================================================

class GetAppointmentDetailsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const appointmentId = context.event.pathParameters?.id;
      const customerId = context.event.pathParameters?.customerId || context.userId;

      if (!appointmentId) {
        return this.error('Appointment ID is required', 400);
      }

      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      // Get appointment with full details
      const appointment = await query(`
        SELECT 
          a.*,
          b.id as booking_id,
          b.service_id,
          b.vendor_id,
          b.pet_id,
          b.customer_id,
          b.amount,
          b.payment_status,
          s.name as service_name,
          s.description as service_description,
          s.service_style,
          s.duration,
          v.name as vendor_name,
          v.address as vendor_address,
          v.phone as vendor_phone,
          p.name as pet_name,
          p.species,
          p.breed
        FROM appointments a
        INNER JOIN bookings b ON a.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN pets p ON b.pet_id = p.id
        WHERE a.id = $1 AND b.customer_id = $2
      `, [appointmentId, customerId]);

      if (appointment.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      // Get prescriptions if exists
      const prescriptions = await query(`
        SELECT * FROM prescriptions
        WHERE booking_id = $1
        ORDER BY created_at DESC
      `, [appointment.rows[0].booking_id]);

      // Get medical records if exists
      const medicalRecords = await query(`
        SELECT * FROM medical_records
        WHERE booking_id = $1
        ORDER BY created_at DESC
      `, [appointment.rows[0].booking_id]);

      return this.success({
        appointment: appointment.rows[0],
        prescriptions: prescriptions.rows,
        medicalRecords: medicalRecords.rows
      });
    } catch (error: any) {
      console.error('Error fetching appointment details:', error);
      return this.error(error.message || 'Failed to fetch appointment details', 500);
    }
  }
}

// ============================================================================
// POST /customer/appointments/:id/reschedule - Reschedule appointment
// ============================================================================

class RescheduleAppointmentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const appointmentId = context.event.pathParameters?.id;
      const customerId = context.event.pathParameters?.customerId || context.userId;
      const body = this.parseBody(context.event);
      const { appointment_date, appointment_time, reason } = body || {};

      if (!appointmentId) {
        return this.error('Appointment ID is required', 400);
      }

      if (!appointment_date || !appointment_time) {
        return this.error('Appointment date and time are required', 400);
      }

      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      const db = await getDatabase();

      // Verify appointment belongs to customer
      const appointment = await db.query(`
        SELECT a.*, b.customer_id, b.status as booking_status
        FROM appointments a
        INNER JOIN bookings b ON a.booking_id = b.id
        WHERE a.id = $1 AND b.customer_id = $2
      `, [appointmentId, customerId]);

      if (appointment.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      if (appointment.rows[0].booking_status !== 'confirmed' && appointment.rows[0].booking_status !== 'scheduled') {
        return this.error('Appointment cannot be rescheduled in current status', 400);
      }

      // Update appointment
      const updated = await query(`
        UPDATE appointments
        SET 
          appointment_date = $1,
          appointment_time = $2,
          notes = COALESCE(notes || E'\n', '') || 'Rescheduled: ' || $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [appointment_date, appointment_time, reason || 'No reason provided', appointmentId]);

      // Create reschedule history
      await query(`
        INSERT INTO appointment_history (
          appointment_id,
          action,
          previous_date,
          previous_time,
          new_date,
          new_time,
          reason,
          created_at
        ) VALUES ($1, 'rescheduled', $2, $3, $4, $5, $6, NOW())
      `, [
        appointmentId,
        appointment.rows[0].appointment_date,
        appointment.rows[0].appointment_time,
        appointment_date,
        appointment_time,
        reason
      ]);

      return this.success({
        appointment: updated.rows[0],
        message: 'Appointment rescheduled successfully'
      });
    } catch (error: any) {
      console.error('Error rescheduling appointment:', error);
      return this.error(error.message || 'Failed to reschedule appointment', 500);
    }
  }
}

// ============================================================================
// POST /customer/appointments/:id/cancel - Cancel appointment
// ============================================================================

class CancelAppointmentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const appointmentId = context.event.pathParameters?.id;
      const customerId = context.event.pathParameters?.customerId || context.userId;
      const body = this.parseBody(context.event);
      const { reason } = body || {};

      if (!appointmentId) {
        return this.error('Appointment ID is required', 400);
      }

      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      // Verify appointment belongs to customer
      const appointment = await query(`
        SELECT a.*, b.customer_id, b.status as booking_status, b.id as booking_id
        FROM appointments a
        INNER JOIN bookings b ON a.booking_id = b.id
        WHERE a.id = $1 AND b.customer_id = $2
      `, [appointmentId, customerId]);

      if (appointment.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      if (appointment.rows[0].status === 'cancelled') {
        return this.error('Appointment is already cancelled', 400);
      }

      // Update appointment status
      const updated = await query(`
        UPDATE appointments
        SET 
          status = 'cancelled',
          notes = COALESCE(notes || E'\n', '') || 'Cancelled: ' || $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [reason || 'No reason provided', appointmentId]);

      // Update booking status
      await query(`
        UPDATE bookings
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
      `, [appointment.rows[0].booking_id]);

      // Create cancellation history
      await query(`
        INSERT INTO appointment_history (
          appointment_id,
          action,
          reason,
          created_at
        ) VALUES ($1, 'cancelled', $2, NOW())
      `, [appointmentId, reason]);

      return this.success({
        appointment: updated.rows[0],
        message: 'Appointment cancelled successfully'
      });
    } catch (error: any) {
      console.error('Error cancelling appointment:', error);
      return this.error(error.message || 'Failed to cancel appointment', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerCustomerAppointmentsEndpoints(app: Hono) {
  const getAppointmentsHandler = new GetCustomerAppointmentsHandler();
  const getDetailsHandler = new GetAppointmentDetailsHandler();
  const rescheduleHandler = new RescheduleAppointmentHandler();
  const cancelHandler = new CancelAppointmentHandler();

  app.get('/customer/appointments', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getAppointmentsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/customer/appointments/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getDetailsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/customer/appointments/:id/reschedule', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await rescheduleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/customer/appointments/:id/cancel', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await cancelHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

// Helper to convert Hono request to API Gateway event (for compatibility)
function createApiGatewayEvent(req: any): any {
  return {
    pathParameters: req.param ? Object.fromEntries(Object.entries(req.param())) : {},
    queryStringParameters: req.query ? Object.fromEntries(Object.entries(req.query())) : {},
    body: req.body ? JSON.stringify(req.body) : null,
    headers: req.header ? Object.fromEntries(Object.entries(req.header())) : {},
    requestContext: {
      authorizer: {
        claims: {
          sub: req.header?.('x-user-id') || 'test-user'
        }
      }
    }
  };
}

function createLambdaContext(): any {
  return {};
}

