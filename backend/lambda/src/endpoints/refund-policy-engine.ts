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
import { sqlRefundTierVendorTypesMatch } from '../lib/refund-tier-vendor-types-match';

/** Map DB style string → vendor_refund_tiers.service_location bucket (home|clinic|tele). */
function mapServiceStyleToLocationBucket(st: string): 'home' | 'clinic' | 'tele' | null {
  const s = String(st || '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('home') || s === 'at_home') return 'home';
  if (s.includes('tele') || s.includes('video')) return 'tele';
  if (s.includes('center') || s.includes('clinic') || s.includes('vendor') || s.includes('centre')) return 'clinic';
  return null;
}

/**
 * Resolve service style for tier matching. Payment/booking flows may pass:
 * - vendor_services.id (published row PK), or
 * - service_catalog.id (template id) — then resolve via vendor_id + service_id on vendor_services.
 * Do not reference non-existent columns (e.g. publish_style on vendor_services) or the query throws and tiers never match.
 */
async function serviceLocationForRefundTier(
  vendorId: string | undefined,
  serviceId: string | undefined
): Promise<'home' | 'clinic' | 'tele' | null> {
  if (!serviceId || !isValidUUID(serviceId)) return null;

  const tryRow = (rows: any): 'home' | 'clinic' | 'tele' | null => {
    const st = String(rows?.[0]?.st || '').trim();
    return mapServiceStyleToLocationBucket(st);
  };

  // 1) vendor_services primary key (most bookings)
  try {
    const s = await query(
      `SELECT LOWER(TRIM(COALESCE(service_style::text, ''))) AS st FROM vendor_services WHERE id = $1::uuid LIMIT 1`,
      [serviceId]
    );
    const m = tryRow((s as any).rows);
    if (m) return m;
  } catch {
    /* ignore */
  }

  // 2) service_catalog (client passed catalog template id)
  try {
    const c = await query(
      `SELECT LOWER(TRIM(COALESCE(service_style::text, ''))) AS st FROM service_catalog WHERE id = $1::uuid LIMIT 1`,
      [serviceId]
    );
    const m = tryRow((c as any).rows);
    if (m) return m;
  } catch {
    /* ignore */
  }

  // 3) vendor_services by catalog service_id + vendor (common when serviceId is not the published row PK)
  if (vendorId && isValidUUID(vendorId)) {
    try {
      const vs = await query(
        `SELECT LOWER(TRIM(COALESCE(service_style::text, ''))) AS st
         FROM vendor_services
         WHERE vendor_id = $1::uuid AND service_id = $2::uuid
         ORDER BY CASE WHEN LOWER(COALESCE(publish_status::text, '')) = 'published' THEN 0 ELSE 1 END,
                  updated_at DESC NULLS LAST
         LIMIT 1`,
        [vendorId, serviceId]
      );
      const m = tryRow((vs as any).rows);
      if (m) return m;
    } catch {
      /* ignore */
    }
  }

  return null;
}

/**
 * Customer-facing display policy from vendor_refund_tiers (single source of truth for services).
 * Falls back to booking_cancellation_rules when no tiers match.
 */
async function buildCustomerRefundPolicyFromTiers(
  vendorId: string | undefined,
  serviceId: string | undefined
): Promise<{
  success: boolean;
  policy: {
    cancellationWindowHours: number;
    refundPercentages: { withinHours: number; percentage: number; cancellationFee?: number }[];
    defaultRefundMethod: string;
  };
  policyExtras?: {
    rescheduleAllowed: boolean;
    rescheduleCutoffHours?: number | null;
    maxReschedulesPerBooking?: number | null;
    noShowPolicy: {
      enabled: boolean;
      refundPercentage: number;
      penaltyAmount: number;
      gracePeriodMinutes?: number | null;
    };
    source: string;
  };
} | null> {
  if (!vendorId || !isValidUUID(vendorId)) return null;

  const loc = await serviceLocationForRefundTier(vendorId, serviceId);
  const vr = await query(
    `SELECT r.id::text AS role_id, r.name AS role_name
     FROM vendors v
     JOIN roles r ON r.id = v.role_id
     WHERE v.id = $1
     LIMIT 1`,
    [vendorId]
  ).catch(() => ({ rows: [] }));
  const roleRow = (vr as any).rows?.[0];
  const roleName = String(roleRow?.role_name || '').trim();
  const roleId = String(roleRow?.role_id || '').trim();

  const vendorMatch = sqlRefundTierVendorTypesMatch(2, 3);
  const tiersRes = await query(
    `SELECT hours_before_service, refund_percentage, hours_operator, hours_threshold, cancellation_fee, policy_extensions
     FROM vendor_refund_tiers
     WHERE is_active = true AND COALESCE(cancelled_by, 'pet_parent') = 'pet_parent'
       AND (
         service_location = 'all'
         OR ($1::text IS NOT NULL AND service_location = $1)
         OR (service_location = 'both' AND $1::text IN ('home', 'clinic'))
       )
       AND ${vendorMatch}
     ORDER BY COALESCE(hours_threshold, hours_before_service) DESC NULLS LAST`,
    [loc, roleName || null, roleId || null]
  ).catch(() => ({ rows: [] }));

  const tierRows = (tiersRes as any).rows || [];
  if (tierRows.length === 0) return null;

  const refundPercentages = tierRows.map((row: any) => ({
    withinHours: Number(
      row.hours_threshold != null && row.hours_operator != null
        ? row.hours_threshold
        : row.hours_before_service != null && Number.isFinite(Number(row.hours_before_service))
          ? Number(row.hours_before_service)
          : 24
    ),
    percentage: Math.min(100, Math.max(0, Number(row.refund_percentage ?? 0))),
    cancellationFee: Number(row.cancellation_fee ?? 0) || 0,
  }));

  const hoursList = tierRows.map((r: any) => Number(r.hours_before_service ?? 0)).filter((n: number) => Number.isFinite(n));
  const cancellationWindowHours = hoursList.length ? Math.min(...hoursList) : 0;

  let rescheduleAllowed = false;
  let rescheduleCutoffHours: number | undefined;
  let maxReschedulesPerBooking: number | undefined;
  const noShowPolicy = { enabled: false, refundPercentage: 0, penaltyAmount: 0 };
  let noShowGraceMinutes: number | undefined;

  const parseExt = (row: any): Record<string, unknown> | null => {
    let ext = row.policy_extensions;
    if (typeof ext === 'string') {
      try {
        ext = JSON.parse(ext);
      } catch {
        ext = null;
      }
    }
    return ext && typeof ext === 'object' && !Array.isArray(ext) ? (ext as Record<string, unknown>) : null;
  };

  for (const row of tierRows) {
    const ext = parseExt(row);
    if (!ext) continue;
    if (ext.rescheduleAllowed === true) {
      rescheduleAllowed = true;
      const rc = Number((ext as any).rescheduleCutoffHours);
      if (Number.isFinite(rc) && rc > 0) {
        rescheduleCutoffHours =
          rescheduleCutoffHours === undefined ? rc : Math.min(rescheduleCutoffHours, rc);
      }
      const mr = Number((ext as any).maxReschedulesPerBooking);
      if (Number.isFinite(mr) && mr >= 0) {
        const mi = Math.floor(mr);
        maxReschedulesPerBooking =
          maxReschedulesPerBooking === undefined ? mi : Math.max(maxReschedulesPerBooking, mi);
      }
    }
    const ns = (ext as any).noShowPolicy;
    if (ns && ns.enabled) {
      noShowPolicy.enabled = true;
      noShowPolicy.refundPercentage = Math.max(noShowPolicy.refundPercentage, Number(ns.refundPercentage ?? 0));
      noShowPolicy.penaltyAmount = Math.max(noShowPolicy.penaltyAmount, Number(ns.penaltyAmount ?? 0));
      const g = Number(ns.gracePeriodMinutes);
      if (Number.isFinite(g) && g >= 0) {
        const gi = Math.floor(g);
        noShowGraceMinutes = noShowGraceMinutes === undefined ? gi : Math.min(noShowGraceMinutes, gi);
      }
    }
  }

  return {
    success: true,
    policy: {
      cancellationWindowHours,
      refundPercentages,
      defaultRefundMethod: 'wallet',
    },
    policyExtras: {
      rescheduleAllowed,
      ...(rescheduleCutoffHours !== undefined ? { rescheduleCutoffHours } : {}),
      ...(maxReschedulesPerBooking !== undefined ? { maxReschedulesPerBooking } : {}),
      noShowPolicy: {
        ...noShowPolicy,
        ...(noShowGraceMinutes !== undefined ? { gracePeriodMinutes: noShowGraceMinutes } : {}),
      },
      source: 'vendor_refund_tiers',
    },
  };
}

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

  // ✅ Customer-facing: cancellation + refund display (vendor_refund_tiers first; legacy booking_cancellation_rules fallback).
  app.get('/customer/refund-policy', async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const serviceId = c.req.query('serviceId');

      const fromTiers = await buildCustomerRefundPolicyFromTiers(vendorId, serviceId);
      if (fromTiers) {
        return c.json(fromTiers);
      }

      let rules: { rows: any[] } = { rows: [] };
      rules = await query(
        `SELECT * FROM booking_cancellation_rules
         WHERE (vendor_id IS NULL OR vendor_id::text = $1)
           AND (service_id IS NULL OR service_id::text = $2)
         ORDER BY (vendor_id IS NOT NULL)::int + (service_id IS NOT NULL)::int DESC, created_at DESC
         LIMIT 1`,
        [vendorId || null, serviceId || null]
      ).catch(() => ({ rows: [] }));

      const rows = (rules as any).rows || [];
      if (rows.length > 0) {
        const rule = rows[0];
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
          policyExtras: { source: 'booking_cancellation_rules', rescheduleAllowed: false, noShowPolicy: { enabled: false, refundPercentage: 0, penaltyAmount: 0 } },
        });
      }
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
        policyExtras: { source: 'default', rescheduleAllowed: false, noShowPolicy: { enabled: false, refundPercentage: 0, penaltyAmount: 0 } },
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
        policyExtras: { source: 'default', rescheduleAllowed: false, noShowPolicy: { enabled: false, refundPercentage: 0, penaltyAmount: 0 } },
      });
    }
  });

  // ✅ Admin: Get refund policy settings for frontend
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

