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

/** Module helpers (move-only). */

// ============================================================================
// GET /customer/appointments - List all appointments for customer
// ============================================================================

export const LIST_FALLBACK = {
  appointments: [] as unknown[],
  count: 0,
  message: 'No booking',
};
export const NOT_FOUND_FALLBACK = { error: 'Appointment not found' };

const LIST_EMPTY_OK = { appointments: [] as unknown[], count: 0, message: 'No booking' };

export async function runAppointmentHandler(
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
