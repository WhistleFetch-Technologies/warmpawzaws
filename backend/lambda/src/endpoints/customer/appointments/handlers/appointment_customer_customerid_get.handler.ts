import type { Context } from 'hono';
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
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../../handler/base-handler';
import { query } from '../../../../database/rds-connection';
import {
  previewCustomerCancellationRefundByMethod,
  normalizeCustomerCancellationRefundMethod,
} from '../../../../lib/services/cancellation-policy-service';
import { hasCustomerPaidCapture } from '../../../../lib/services/refundable-base';
import { computeHoursUntilBookingStart } from '../../../../lib/utils/booking-start-wall-time';
import { creditCustomerWalletForBookingRefund } from '../../../../utils/credit-customer-wallet';

export async function appointmentCustomerCustomeridGetHandler(c: Context) {
    const event = createApiGatewayEvent(c.req);
    mergeAllQueryFromHono(c, event);
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
}
