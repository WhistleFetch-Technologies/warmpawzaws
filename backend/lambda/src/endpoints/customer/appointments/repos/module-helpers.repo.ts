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

/** SQL/helpers only — handler classes live in services/. */
