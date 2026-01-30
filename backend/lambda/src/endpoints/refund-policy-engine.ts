/**
 * ============================================================================
 * REFUND POLICY ENGINE - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles refund policy rules and calculations:
 * - Calculate refund eligibility based on booking time
 * - Apply refund rules (time-based, amount-based, status-based)
 * - Get refund percentage and amount
 * - Manage refund rules (admin)
 * 
 * Date: 2026-01-27
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// REFUND POLICY CALCULATION
// ============================================================================

interface RefundPolicyResult {
  allowed: boolean;
  refundPercentage: number;
  refundAmount: number;
  reason: string;
  policyType: 'full' | 'partial' | 'none';
  hoursUntilBooking?: number;
}

class CalculateRefundPolicyHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId, cancellationReason } = body;

    this.validateRequired(body, ['bookingId']);

    // Get booking details
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return this.error('Booking not found', 404);
    }

    const booking = bookings[0];

    // Check if booking can be cancelled
    if (['cancelled', 'completed', 'no_show'].includes(booking.status)) {
      return this.success({
        allowed: false,
        refundPercentage: 0,
        refundAmount: 0,
        reason: `Booking already ${booking.status}`,
        policyType: 'none',
      } as RefundPolicyResult);
    }

    // Calculate hours until booking
    let hoursUntilBooking: number;
    if (booking.booking_datetime) {
      const bookingDateTime = new Date(booking.booking_datetime);
      hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    } else if (booking.booking_date && booking.booking_time) {
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    } else {
      return this.error('Booking date/time not found', 400);
    }

    if (hoursUntilBooking < 0) {
      return this.success({
        allowed: false,
        refundPercentage: 0,
        refundAmount: 0,
        reason: 'Cannot cancel past bookings',
        policyType: 'none',
        hoursUntilBooking: Math.round(hoursUntilBooking),
      } as RefundPolicyResult);
    }

    // Get refund rules (vendor-specific or default)
    const refundRules = await this.getRefundRules(booking.vendor_id, booking.service_id);

    // Calculate refund based on rules
    const totalAmount = parseFloat(booking.total_amount || '0');
    let refundPercentage = 0;
    let reason = '';
    let policyType: 'full' | 'partial' | 'none' = 'none';

    if (hoursUntilBooking >= refundRules.fullRefundBeforeHours) {
      refundPercentage = 100;
      reason = `Full refund - cancelled ${Math.round(hoursUntilBooking)} hours before booking`;
      policyType = 'full';
    } else if (hoursUntilBooking >= refundRules.partialRefundBeforeHours) {
      refundPercentage = refundRules.partialRefundPercentage;
      reason = `Partial refund (${refundPercentage}%) - cancelled ${Math.round(hoursUntilBooking)} hours before booking`;
      policyType = 'partial';
    } else if (hoursUntilBooking >= refundRules.cancellationCutoffHours) {
      refundPercentage = refundRules.partialRefundPercentage;
      reason = `Partial refund (${refundPercentage}%) - cancelled ${Math.round(hoursUntilBooking)} hours before booking`;
      policyType = 'partial';
    } else {
      refundPercentage = 0;
      reason = `No refund - cancelled less than ${refundRules.cancellationCutoffHours} hours before booking`;
      policyType = 'none';
    }

    const refundAmount = (totalAmount * refundPercentage) / 100;

    return this.success({
      allowed: refundPercentage > 0,
      refundPercentage,
      refundAmount: Math.round(refundAmount * 100) / 100, // Round to 2 decimals
      reason,
      policyType,
      hoursUntilBooking: Math.round(hoursUntilBooking),
    } as RefundPolicyResult);
  }

  private async getRefundRules(vendorId?: string, serviceId?: string): Promise<{
    fullRefundBeforeHours: number;
    partialRefundBeforeHours: number;
    partialRefundPercentage: number;
    cancellationCutoffHours: number;
  }> {
    try {
      // Try to get vendor-specific or service-specific rules
      let rulesResult = await query(
        `SELECT * FROM booking_cancellation_rules
         WHERE (vendor_id = $1 OR vendor_id IS NULL)
           AND (service_id = $2 OR service_id IS NULL)
         ORDER BY vendor_id DESC NULLS LAST, service_id DESC NULLS LAST
         LIMIT 1`,
        [vendorId || null, serviceId || null]
      );

      const rows = Array.isArray(rulesResult) ? rulesResult : (rulesResult as any).rows || [];

      if (rows.length > 0) {
        const rule = rows[0];
        return {
          fullRefundBeforeHours: rule.full_refund_before_hours || 48,
          partialRefundBeforeHours: rule.partial_refund_before_hours || 24,
          partialRefundPercentage: parseFloat(rule.partial_refund_percentage || '50'),
          cancellationCutoffHours: rule.cancellation_cutoff_hours || 12,
        };
      }
    } catch (error: any) {
      // If table doesn't exist, use defaults
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        console.warn('[RefundPolicy] booking_cancellation_rules table not found, using defaults');
      } else {
        throw error;
      }
    }

    // Default rules
    return {
      fullRefundBeforeHours: 48,
      partialRefundBeforeHours: 24,
      partialRefundPercentage: 50,
      cancellationCutoffHours: 12,
    };
  }
}

// ============================================================================
// ADMIN: REFUND RULES MANAGEMENT
// ============================================================================

class GetRefundRulesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.queryStringParameters?.vendorId;
      const serviceId = context.event.queryStringParameters?.serviceId;

      let queryStr = 'SELECT * FROM booking_cancellation_rules WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (vendorId) {
        queryStr += ` AND (vendor_id = $${paramIndex} OR vendor_id IS NULL)`;
        params.push(vendorId);
        paramIndex++;
      }

      if (serviceId) {
        queryStr += ` AND (service_id = $${paramIndex} OR service_id IS NULL)`;
        params.push(serviceId);
        paramIndex++;
      }

      queryStr += ' ORDER BY vendor_id DESC NULLS LAST, service_id DESC NULLS LAST';

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      return this.success({ rules: rows });
    } catch (error: any) {
      // Handle case where table doesn't exist
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        console.warn('[RefundRules] booking_cancellation_rules table not found, returning empty rules');
        return this.success({ 
          rules: [],
          message: 'Refund rules table not found. Please run migration 060_create_refund_rules_tables.sql'
        });
      }
      throw error;
    }
  }
}

class CreateRefundRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const {
      vendorId,
      serviceId,
      fullRefundBeforeHours,
      partialRefundBeforeHours,
      partialRefundPercentage,
      cancellationCutoffHours,
      isActive = true,
    } = body;

    this.validateRequired(body, ['fullRefundBeforeHours', 'partialRefundBeforeHours', 'partialRefundPercentage']);

    // Validate percentages
    if (partialRefundPercentage < 0 || partialRefundPercentage > 100) {
      return this.error('Partial refund percentage must be between 0 and 100', 400);
    }

    const result = await insert('booking_cancellation_rules', {
      vendor_id: vendorId || null,
      service_id: serviceId || null,
      full_refund_before_hours: fullRefundBeforeHours,
      partial_refund_before_hours: partialRefundBeforeHours,
      partial_refund_percentage: partialRefundPercentage,
      cancellation_cutoff_hours: cancellationCutoffHours || 12,
      is_active: isActive,
    });

    return this.success({
      rule: result[0],
      message: 'Refund rule created successfully',
    });
  }
}

class UpdateRefundRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const ruleId = context.event.pathParameters?.ruleId;
    const body = this.parseBody(context.event);

    if (!ruleId) {
      return this.error('Rule ID is required', 400);
    }

    const updateData: any = {};
    if (body.fullRefundBeforeHours !== undefined) updateData.full_refund_before_hours = body.fullRefundBeforeHours;
    if (body.partialRefundBeforeHours !== undefined) updateData.partial_refund_before_hours = body.partialRefundBeforeHours;
    if (body.partialRefundPercentage !== undefined) {
      if (body.partialRefundPercentage < 0 || body.partialRefundPercentage > 100) {
        return this.error('Partial refund percentage must be between 0 and 100', 400);
      }
      updateData.partial_refund_percentage = body.partialRefundPercentage;
    }
    if (body.cancellationCutoffHours !== undefined) updateData.cancellation_cutoff_hours = body.cancellationCutoffHours;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    updateData.updated_at = new Date();

    const result = await update('booking_cancellation_rules', { id: ruleId }, updateData);

    if (result.length === 0) {
      return this.error('Refund rule not found', 404);
    }

    return this.success({
      rule: result[0],
      message: 'Refund rule updated successfully',
    });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerRefundPolicyEngineEndpoints(app: Hono) {
  const calculateHandler = new CalculateRefundPolicyHandler();
  const getRulesHandler = new GetRefundRulesHandler();
  const createRuleHandler = new CreateRefundRuleHandler();
  const updateRuleHandler = new UpdateRefundRuleHandler();

  // Calculate refund policy for a booking
  app.post('/refund-policy/calculate', async (c) => {
    try {
      // Parse body from Hono request
      const body = await c.req.json().catch(() => ({}));
      
      // Create API Gateway event with parsed body
      const event: any = {
        httpMethod: 'POST',
        path: c.req.path,
        headers: Object.fromEntries(c.req.raw.headers),
        body: JSON.stringify(body),
        pathParameters: {},
        queryStringParameters: Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams),
        requestContext: {
          requestId: randomUUID(),
        },
      };
      
      const context = createLambdaContext();
      const result = await calculateHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: any) {
      console.error('Error in refund policy calculate:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // Admin: Get refund rules
  app.get('/admin/refund-rules', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
    const context = createLambdaContext();
    const result = await getRulesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Admin: Create refund rule
  app.post('/admin/refund-rules', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await createRuleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Admin: Update refund rule
  app.put('/admin/refund-rules/:ruleId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { ruleId: c.req.param('ruleId') };
    const context = createLambdaContext();
    const result = await updateRuleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // ✅ NEW: Get refund policy settings for frontend
  app.get('/admin/settings/refund-policy', async (c) => {
    try {
      // Get default policy rules
      const rules = await query(
        `SELECT * FROM booking_cancellation_rules
         WHERE vendor_id IS NULL AND service_id IS NULL
         ORDER BY created_at DESC
         LIMIT 1`
      ).catch(() => ({ rows: [] }));

      if (rules.rows.length > 0) {
        const rule = rules.rows[0];
        return c.json({
          success: true,
          policy: {
            cancellationWindowHours: rule.no_refund_before_hours || 0,
            refundPercentages: [
              { withinHours: rule.full_refund_before_hours || 24, percentage: 100 },
              { withinHours: rule.partial_refund_before_hours || 12, percentage: rule.partial_refund_percentage || 50 },
              { withinHours: rule.no_refund_before_hours || 2, percentage: 0 },
            ],
            defaultRefundMethod: 'wallet',
          },
        });
      }

      // Return default policy if not configured
      return c.json({
        success: true,
        policy: {
          cancellationWindowHours: 24,
          refundPercentages: [
            { withinHours: 24, percentage: 100 },
            { withinHours: 12, percentage: 50 },
            { withinHours: 6, percentage: 25 },
            { withinHours: 2, percentage: 0 },
          ],
          defaultRefundMethod: 'wallet',
        },
      });
    } catch (error: any) {
      console.error('Error fetching refund policy:', error);
      return c.json({
        success: true,
        policy: {
          cancellationWindowHours: 24,
          refundPercentages: [
            { withinHours: 24, percentage: 100 },
            { withinHours: 12, percentage: 50 },
          ],
          defaultRefundMethod: 'wallet',
        },
      });
    }
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: Object.fromEntries(req.headers || []),
    body: JSON.stringify(req.body || {}),
    pathParameters: {},
    queryStringParameters: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'refund-policy-engine',
    functionVersion: '$LATEST',
  };
}

