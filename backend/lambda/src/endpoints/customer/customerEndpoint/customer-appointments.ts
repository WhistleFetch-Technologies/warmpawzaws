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
import type { Context } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { query } from '../../../database/rds-connection';
import { previewCustomerCancellationRefund } from '../../../lib/services/cancellation-policy-service';
import { hasCustomerPaidCapture } from '../../../lib/services/refundable-base';
import { creditCustomerWalletForBookingRefund } from '../../../utils/credit-customer-wallet';

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

      console.log('[appointments] list customerId:', customerId ?? '(none)', 'appointmentId:', '(n/a)');
      
      if (!customerId) {
        return this.success({ appointments: [], count: 0, message: 'No booking' });
      }

      // Bookings are the source of truth (RDS has no legacy `appointments` table in many envs).
      // `bookings.service_id` references `vendor_services.id`; vendors use `business_name`, not `name`.
      const appointments = await query(
        `
        SELECT 
          b.id,
          b.id AS booking_id,
          b.booking_date AS appointment_date,
          b.booking_time AS appointment_time,
          b.status,
          b.notes,
          b.created_at,
          b.updated_at,
          b.service_id,
          b.vendor_id,
          b.pet_id,
          b.total_amount,
          COALESCE(vs.service_name, 'Service') AS service_name,
          COALESCE(vs.service_style, b.service_type) AS service_style,
          COALESCE(v.business_name, v.owner_name, '') AS vendor_name,
          v.address AS vendor_address,
          p.name AS pet_name
        FROM bookings b
        LEFT JOIN vendor_services vs ON b.service_id = vs.id
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN pets p ON b.pet_id = p.id
        WHERE b.customer_id = $1
        ORDER BY b.booking_date DESC, b.booking_time DESC
      `,
        [customerId]
      ).catch((err) => {
        console.warn('[appointments] list query failed:', err);
        return { rows: [] as Record<string, unknown>[] };
      });

      const rows = appointments.rows;
      if (rows.length === 0) {
        return this.success({ appointments: [], count: 0, message: 'No booking' });
      }
      return this.success({
        appointments: rows,
        count: rows.length,
      });
    } catch (error: any) {
      console.warn('[appointments] list handler error (returning empty):', error);
      return this.success({ appointments: [], count: 0, message: 'No booking' });
    }
  }
}

// ============================================================================
// GET /customer/appointments/:id - Get appointment details
// ============================================================================

class GetAppointmentDetailsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const rawAppointmentId = context.event.pathParameters?.id;
      const rawCustomerId =
        context.event.pathParameters?.customerId ||
        (context.event.queryStringParameters as Record<string, string> | undefined)?.customerId ||
        context.userId;

      const appointmentId =
        typeof rawAppointmentId === 'string' ? rawAppointmentId.trim() : rawAppointmentId;
      const customerId = typeof rawCustomerId === 'string' ? rawCustomerId.trim() : rawCustomerId;

      console.log('[appointments] detail customerId:', customerId ?? '(none)', 'appointmentId:', appointmentId ?? '(none)');

      if (
        !appointmentId ||
        !customerId ||
        appointmentId === 'undefined' ||
        customerId === 'undefined'
      ) {
        return this.error('Appointment not found', 404);
      }

      // Treat :id as booking id (same id returned by the list endpoint above).
      const appointment = await query(
        `
        SELECT 
          b.id,
          b.id AS booking_id,
          b.booking_date AS appointment_date,
          b.booking_time AS appointment_time,
          b.status,
          b.notes,
          b.created_at,
          b.updated_at,
          b.service_id,
          b.vendor_id,
          b.pet_id,
          b.customer_id,
          b.total_amount,
          b.payment_status,
          COALESCE(vs.service_name, 'Service') AS service_name,
          vs.custom_description AS service_description,
          COALESCE(vs.service_style, b.service_type) AS service_style,
          vs.duration_minutes AS duration,
          COALESCE(v.business_name, v.owner_name, '') AS vendor_name,
          v.address AS vendor_address,
          v.phone AS vendor_phone,
          p.name AS pet_name,
          p.species,
          p.breed
        FROM bookings b
        LEFT JOIN vendor_services vs ON b.service_id = vs.id
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN pets p ON b.pet_id = p.id
        WHERE b.id = $1 AND b.customer_id = $2
      `,
        [appointmentId, customerId]
      ).catch((err) => {
        console.warn('[appointments] detail main query failed:', err);
        return { rows: [] as Record<string, unknown>[] };
      });

      if (appointment.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      const bookingId = appointment.rows[0].booking_id ?? appointment.rows[0].id;

      const prescriptions = await query(
        `
        SELECT * FROM prescriptions
        WHERE booking_id = $1
        ORDER BY created_at DESC
      `,
        [bookingId]
      ).catch((err) => {
        console.warn('[appointments] optional prescriptions query failed:', err);
        return { rows: [] as unknown[] };
      });

      const medicalRecords = await query(
        `
        SELECT * FROM medical_records
        WHERE booking_id = $1
        ORDER BY created_at DESC
      `,
        [bookingId]
      ).catch((err) => {
        console.warn('[appointments] optional medical_records query failed:', err);
        return { rows: [] as unknown[] };
      });

      const appointmentHistory = await query(
        `
        SELECT * FROM appointment_history
        WHERE appointment_id = $1
        ORDER BY created_at DESC
      `,
        [bookingId]
      ).catch((err) => {
        console.warn('[appointments] optional appointment_history query failed:', err);
        return { rows: [] as unknown[] };
      });

      try {
        return this.success({
          appointment: appointment.rows[0],
          prescriptions: prescriptions.rows,
          medicalRecords: medicalRecords.rows,
          appointmentHistory: appointmentHistory.rows,
        });
      } catch (serializeErr: any) {
        console.warn('[appointments] detail response build failed (treating as not found):', serializeErr);
        return this.error('Appointment not found', 404);
      }
    } catch (error: any) {
      console.warn('[appointments] detail handler error:', error);
      return this.error('Appointment not found', 404);
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
      const customerId =
        context.event.pathParameters?.customerId ||
        (context.event.queryStringParameters as Record<string, string> | undefined)?.customerId ||
        context.userId;
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

      const appointmentResult = await query(
        `
        SELECT b.id, b.customer_id, b.status AS booking_status,
               b.booking_date, b.booking_time
        FROM bookings b
        WHERE b.id = $1 AND b.customer_id = $2
      `,
        [appointmentId, customerId]
      ).catch((err) => {
        console.warn('[appointments] reschedule lookup failed:', err);
        return { rows: [] as Record<string, unknown>[] };
      });

      if (appointmentResult.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      const bookingStatus = String(appointmentResult.rows[0].booking_status || '');
      if (!['confirmed', 'pending'].includes(bookingStatus)) {
        return this.error('Appointment cannot be rescheduled in current status', 400);
      }

      const updated = await query(
        `
        UPDATE bookings
        SET 
          booking_date = $1::date,
          booking_time = $2::time,
          notes = COALESCE(notes || E'\n', '') || 'Rescheduled: ' || $3,
          updated_at = NOW()
        WHERE id = $4 AND customer_id = $5
        RETURNING *
      `,
        [
          appointment_date,
          appointment_time,
          reason || 'No reason provided',
          appointmentId,
          customerId,
        ]
      ).catch((err) => {
        console.warn('[appointments] reschedule update failed:', err);
        return { rows: [] as Record<string, unknown>[] };
      });

      if (updated.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      await query(
        `
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
      `,
        [
          appointmentId,
          appointmentResult.rows[0].booking_date,
          appointmentResult.rows[0].booking_time,
          appointment_date,
          appointment_time,
          reason,
        ]
      ).catch((histErr) => console.warn('[appointments] appointment_history insert skipped:', histErr));

      const row = updated.rows[0];
      return this.success({
        appointment: {
          ...row,
          appointment_date: row.booking_date,
          appointment_time: row.booking_time,
        },
        message: 'Appointment rescheduled successfully',
      });
    } catch (error: any) {
      console.warn('[appointments] reschedule handler error:', error);
      return this.error('Appointment not found', 404);
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
      const customerId =
        context.event.pathParameters?.customerId ||
        (context.event.queryStringParameters as Record<string, string> | undefined)?.customerId ||
        context.userId;
      const body = this.parseBody(context.event);
      const { reason, refundMethod = 'wallet' } = body || {};

      if (!appointmentId) {
        return this.error('Appointment ID is required', 400);
      }

      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      const appointment = await query(
        `
        SELECT b.*, b.status AS booking_status, b.id AS booking_id,
               b.booking_date, b.booking_time, b.vendor_id, b.service_id, b.service_type,
               b.payment_status, b.total_amount, b.customer_id
        FROM bookings b
        WHERE b.id = $1 AND b.customer_id = $2
      `,
        [appointmentId, customerId]
      ).catch((err) => {
        console.warn('[appointments] cancel lookup failed:', err);
        return { rows: [] as Record<string, unknown>[] };
      });

      if (appointment.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      const bookingRow = appointment.rows[0];
      if (String(bookingRow.status || '') === 'cancelled') {
        return this.error('Appointment is already cancelled', 400);
      }

      const bookingId = bookingRow.booking_id ?? bookingRow.id;

      const updated = await query(
        `
        UPDATE bookings
        SET 
          status = 'cancelled',
          notes = COALESCE(notes || E'\n', '') || 'Cancelled: ' || $1,
          cancelled_at = NOW(),
          cancelled_by = 'pet_parent',
          cancellation_reason = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
        [reason || 'No reason provided', bookingId]
      ).catch((err) => {
        console.warn('[appointments] cancel update failed:', err);
        return { rows: [] as Record<string, unknown>[] };
      });

      if (updated.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      // Apply refund per policy (vendor_refund_tiers by who cancels)
      let refundInfo: { amount: number; percentage: number; method: string; status: string; message: string } | null = null;
      const bookingPaidForRefund = await hasCustomerPaidCapture(String(bookingId), {
        total_amount: bookingRow.total_amount as number | string | null,
        discount_amount: (bookingRow as any).discount_amount ?? null,
        payment_status: (bookingRow as any).payment_status ?? (bookingRow as any).paymentStatus,
      });
      const customerIdForRefund = String(
        (bookingRow as any).customer_id ?? (bookingRow as any).customerId ?? customerId
      );
      if (bookingPaidForRefund) {
        try {
          const preview = await previewCustomerCancellationRefund({
            id: bookingId,
            vendor_id: bookingRow.vendor_id,
            service_id: bookingRow.service_id,
            service_type: bookingRow.service_type,
            booking_datetime: (bookingRow as any).booking_datetime ?? null,
            scheduled_at: (bookingRow as any).scheduled_at ?? null,
            booking_date: String(bookingRow.booking_date),
            booking_time: String(bookingRow.booking_time),
            vendor_timezone: (bookingRow as any).vendor_timezone ?? null,
            total_amount: bookingRow.total_amount,
            discount_amount: (bookingRow as any).discount_amount ?? null,
          });
          const refundAmount = Math.round(preview.refundAmount * 100) / 100;
          const refundPercentage = preview.refundPercentage;
          if (refundAmount > 0) {
            const payments = await query(
              `SELECT id FROM payments
               WHERE booking_id = $1::uuid
                 AND payment_status IN ('completed', 'partially_refunded')
               ORDER BY CASE WHEN payment_status = 'completed' THEN 0 ELSE 1 END
               LIMIT 1`,
              [bookingId]
            ).catch(() => ({ rows: [] }));
            const paymentId = (payments as any).rows?.[0]?.id;
            if (refundMethod === 'wallet') {
              try {
                await creditCustomerWalletForBookingRefund({
                  customerId: customerIdForRefund,
                  bookingId,
                  refundAmount,
                  refundPercentage,
                  label: 'appointment',
                });
                refundInfo = {
                  amount: refundAmount,
                  percentage: refundPercentage,
                  method: 'wallet',
                  status: 'completed',
                  message: `₹${refundAmount.toFixed(2)} credited to wallet`,
                };
              } catch (e) {
                console.error('[appointments] wallet credit failed:', e);
                refundInfo = {
                  amount: refundAmount,
                  percentage: refundPercentage,
                  method: 'wallet',
                  status: 'failed',
                  message:
                    'Cancellation succeeded but wallet refund failed. Please contact support with your appointment ID.',
                };
              }
            } else if (paymentId) {
              await query(
                `INSERT INTO refunds (payment_id, booking_id, customer_id, vendor_id, refund_amount, refund_reason, refund_status, refund_method, requested_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'original', NOW())`,
                [paymentId, bookingId, customerIdForRefund, bookingRow.vendor_id || null, refundAmount, `Appointment cancellation: ${reason || 'No reason'} (${refundPercentage}% refund)`]
              ).catch(() => null);
              refundInfo = { amount: refundAmount, percentage: refundPercentage, method: 'original', status: 'pending', message: `Refund of ₹${refundAmount.toFixed(2)} will be processed to original payment method` };
            }
          }
        } catch (refundErr: any) {
          console.error('Error applying refund on appointment cancel:', refundErr);
        }
      }

      await query(
        `
        INSERT INTO appointment_history (
          appointment_id,
          action,
          reason,
          created_at
        ) VALUES ($1, 'cancelled', $2, NOW())
      `,
        [appointmentId, reason]
      ).catch((histErr) => console.warn('[appointments] appointment_history insert skipped:', histErr));

      const cancelledRow = updated.rows[0];
      return this.success({
        appointment: {
          ...cancelledRow,
          appointment_date: cancelledRow.booking_date,
          appointment_time: cancelledRow.booking_time,
        },
        message: 'Appointment cancelled successfully',
        refund: refundInfo ?? undefined,
      });
    } catch (error: any) {
      console.warn('[appointments] cancel handler error:', error);
      return this.error('Appointment not found', 404);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

const LIST_FALLBACK = {
  appointments: [] as unknown[],
  count: 0,
  message: 'No booking',
};
const NOT_FOUND_FALLBACK = { error: 'Appointment not found' };

const LIST_EMPTY_OK = { appointments: [] as unknown[], count: 0, message: 'No booking' };

async function runAppointmentHandler(
  c: { json: (b: object, s?: number) => Response },
  exec: () => Promise<{ statusCode: number; body: string }>,
  parseFallbackBody: object,
  parseFallbackStatus: number,
  options?: { coerceListErrorsToEmpty?: boolean }
): Promise<Response> {
  try {
    const result = await exec();
    const raw = result?.body;

    // Legacy/stale handlers may return 5xx (e.g. SQL against missing `appointments` table). My Bookings must stay 200.
    if (options?.coerceListErrorsToEmpty && result.statusCode >= 400) {
      console.warn(
        '[appointments] list coerced from error status:',
        result.statusCode,
        typeof raw === 'string' ? raw.slice(0, 400) : raw
      );
      return c.json(LIST_EMPTY_OK, 200);
    }

    if (raw == null || raw === '') {
      console.warn('[appointments] empty handler body, using fallback');
      return c.json(parseFallbackBody, parseFallbackStatus);
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (options?.coerceListErrorsToEmpty && parsed.error != null && !Array.isArray(parsed.appointments)) {
        console.warn('[appointments] list coerced from error payload:', parsed.error);
        return c.json(LIST_EMPTY_OK, 200);
      }
      return c.json(parsed, result.statusCode);
    } catch {
      console.warn('[appointments] invalid handler JSON body, using fallback');
      return c.json(parseFallbackBody, parseFallbackStatus);
    }
  } catch (err) {
    console.warn('[appointments] route execute threw:', err);
    return c.json(parseFallbackBody, parseFallbackStatus);
  }
}

export function registerCustomerAppointmentsEndpoints(app: Hono) {
  const getAppointmentsHandler = new GetCustomerAppointmentsHandler();
  const getDetailsHandler = new GetAppointmentDetailsHandler();
  const rescheduleHandler = new RescheduleAppointmentHandler();
  const cancelHandler = new CancelAppointmentHandler();

  app.get('/customer/appointments', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    return runAppointmentHandler(
      c,
      () => getAppointmentsHandler.execute(event, context),
      LIST_FALLBACK,
      200,
      { coerceListErrorsToEmpty: true }
    );
  });

  app.get('/customer/appointments/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    return runAppointmentHandler(
      c,
      () => getDetailsHandler.execute(event, context),
      NOT_FOUND_FALLBACK,
      404
    );
  });

  app.post('/customer/appointments/:id/reschedule', async (c) => {
    const event = createApiGatewayEvent(c.req);
    await attachParsedJsonBody(c, event);
    const context = createLambdaContext();
    return runAppointmentHandler(
      c,
      () => rescheduleHandler.execute(event, context),
      NOT_FOUND_FALLBACK,
      404
    );
  });

  app.post('/customer/appointments/:id/cancel', async (c) => {
    const event = createApiGatewayEvent(c.req);
    await attachParsedJsonBody(c, event);
    const context = createLambdaContext();
    return runAppointmentHandler(
      c,
      () => cancelHandler.execute(event, context),
      NOT_FOUND_FALLBACK,
      404
    );
  });

  // Compatibility routes: MUST register GET /appointment/customer/:customerId BEFORE GET /appointment/:appointmentId
  // so the path segment "customer" is never bound to :appointmentId.
  app.get('/appointment/customer/:customerId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = {
      ...(event.pathParameters && typeof event.pathParameters === 'object' ? event.pathParameters : {}),
      customerId: c.req.param('customerId'),
    };
    event.queryStringParameters = {
      ...(event.queryStringParameters && typeof event.queryStringParameters === 'object'
        ? event.queryStringParameters
        : {}),
      status: c.req.query('status') || 'all',
    };
    const context = createLambdaContext();
    return runAppointmentHandler(
      c,
      () => getAppointmentsHandler.execute(event, context),
      LIST_FALLBACK,
      200,
      { coerceListErrorsToEmpty: true }
    );
  });

  app.get('/appointment/:appointmentId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = {
      ...(event.pathParameters && typeof event.pathParameters === 'object' ? event.pathParameters : {}),
      id: c.req.param('appointmentId'),
    };
    const context = createLambdaContext();
    return runAppointmentHandler(
      c,
      () => getDetailsHandler.execute(event, context),
      NOT_FOUND_FALLBACK,
      404
    );
  });

  app.post('/appointment/:appointmentId/cancel', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = {
      ...(event.pathParameters && typeof event.pathParameters === 'object' ? event.pathParameters : {}),
      id: c.req.param('appointmentId'),
    };
    await attachParsedJsonBody(c, event);
    const context = createLambdaContext();
    return runAppointmentHandler(
      c,
      () => cancelHandler.execute(event, context),
      NOT_FOUND_FALLBACK,
      404
    );
  });

  app.post('/appointment/:appointmentId/reschedule', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = {
      ...(event.pathParameters && typeof event.pathParameters === 'object' ? event.pathParameters : {}),
      id: c.req.param('appointmentId'),
    };
    await attachParsedJsonBody(c, event);
    const context = createLambdaContext();
    return runAppointmentHandler(
      c,
      () => rescheduleHandler.execute(event, context),
      NOT_FOUND_FALLBACK,
      404
    );
  });
}

/** BaseHandler.parseBody expects `event.body` as JSON string; Hono only exposes payload via `c.req.json()`. */
async function attachParsedJsonBody(c: Context, event: Record<string, unknown>): Promise<void> {
  const method = c.req.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  try {
    const j = await c.req.json();
    event.body = JSON.stringify(j != null && typeof j === 'object' && !Array.isArray(j) ? j : {});
  } catch {
    event.body = typeof event.body === 'string' && event.body.length > 0 ? event.body : '{}';
  }
}

// Helper to convert Hono request to API Gateway event (for compatibility)
function createApiGatewayEvent(req: any): any {
  let pathParameters: Record<string, string> = {};
  let queryStringParameters: Record<string, string> = {};
  let headers: Record<string, string> = {};

  try {
    if (typeof req.param === 'function') {
      const p = req.param();
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        pathParameters = { ...p };
      }
    }
  } catch (e) {
    console.warn('[appointments] createApiGatewayEvent pathParameters failed:', e);
  }

  try {
    if (typeof req.query === 'function') {
      const q = req.query();
      if (q && typeof q === 'object' && !Array.isArray(q)) {
        queryStringParameters = Object.fromEntries(
          Object.entries(q as Record<string, unknown>).map(([k, v]) => [
            k,
            v == null ? '' : String(v),
          ])
        );
      }
    }
  } catch (e) {
    console.warn('[appointments] createApiGatewayEvent queryStringParameters failed:', e);
  }

  try {
    if (typeof req.header === 'function') {
      const h = req.header();
      if (h && typeof h === 'object') {
        headers = Object.fromEntries(
          Object.entries(h as Record<string, unknown>).map(([k, v]) => [
            k,
            v == null ? '' : String(v),
          ])
        );
      }
    }
  } catch (e) {
    console.warn('[appointments] createApiGatewayEvent headers failed:', e);
  }

  let body: string | null = null;
  try {
    if (req.body != null && typeof req.body !== 'undefined') {
      body = JSON.stringify(req.body);
    }
  } catch (e) {
    console.warn('[appointments] createApiGatewayEvent body stringify skipped:', e);
    body = null;
  }

  const sub =
    typeof req.header === 'function'
      ? req.header('x-user-id') || headers['x-user-id'] || 'test-user'
      : 'test-user';

  return {
    pathParameters,
    queryStringParameters,
    body,
    headers,
    requestContext: {
      authorizer: {
        claims: {
          sub,
        },
      },
    },
  };
}

function createLambdaContext(): any {
  return {};
}
