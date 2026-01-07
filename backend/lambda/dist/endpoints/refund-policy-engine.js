"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRefundPolicyEngineEndpoints = registerRefundPolicyEngineEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
class CalculateRefundPolicyHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { bookingId, cancellationReason } = body;
        this.validateRequired(body, ['bookingId']);
        // Get booking details
        const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
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
            });
        }
        // Calculate hours until booking
        let hoursUntilBooking;
        if (booking.booking_datetime) {
            const bookingDateTime = new Date(booking.booking_datetime);
            hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
        }
        else if (booking.booking_date && booking.booking_time) {
            const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
            hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
        }
        else {
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
            });
        }
        // Get refund rules (vendor-specific or default)
        const refundRules = await this.getRefundRules(booking.vendor_id, booking.service_id);
        // Calculate refund based on rules
        const totalAmount = parseFloat(booking.total_amount || '0');
        let refundPercentage = 0;
        let reason = '';
        let policyType = 'none';
        if (hoursUntilBooking >= refundRules.fullRefundBeforeHours) {
            refundPercentage = 100;
            reason = `Full refund - cancelled ${Math.round(hoursUntilBooking)} hours before booking`;
            policyType = 'full';
        }
        else if (hoursUntilBooking >= refundRules.partialRefundBeforeHours) {
            refundPercentage = refundRules.partialRefundPercentage;
            reason = `Partial refund (${refundPercentage}%) - cancelled ${Math.round(hoursUntilBooking)} hours before booking`;
            policyType = 'partial';
        }
        else if (hoursUntilBooking >= refundRules.cancellationCutoffHours) {
            refundPercentage = refundRules.partialRefundPercentage;
            reason = `Partial refund (${refundPercentage}%) - cancelled ${Math.round(hoursUntilBooking)} hours before booking`;
            policyType = 'partial';
        }
        else {
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
        });
    }
    async getRefundRules(vendorId, serviceId) {
        // Try to get vendor-specific or service-specific rules
        let rulesResult = await (0, rds_connection_1.query)(`SELECT * FROM booking_cancellation_rules
       WHERE (vendor_id = $1 OR vendor_id IS NULL)
         AND (service_id = $2 OR service_id IS NULL)
       ORDER BY vendor_id DESC NULLS LAST, service_id DESC NULLS LAST
       LIMIT 1`, [vendorId || null, serviceId || null]);
        const rows = Array.isArray(rulesResult) ? rulesResult : rulesResult.rows || [];
        if (rows.length > 0) {
            const rule = rows[0];
            return {
                fullRefundBeforeHours: rule.full_refund_before_hours || 48,
                partialRefundBeforeHours: rule.partial_refund_before_hours || 24,
                partialRefundPercentage: parseFloat(rule.partial_refund_percentage || '50'),
                cancellationCutoffHours: rule.cancellation_cutoff_hours || 12,
            };
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
class GetRefundRulesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.queryStringParameters?.vendorId;
        const serviceId = context.event.queryStringParameters?.serviceId;
        let queryStr = 'SELECT * FROM booking_cancellation_rules WHERE 1=1';
        const params = [];
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
        const result = await (0, rds_connection_1.query)(queryStr, params);
        const rows = Array.isArray(result) ? result : result.rows || [];
        return this.success({ rules: rows });
    }
}
class CreateRefundRuleHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { vendorId, serviceId, fullRefundBeforeHours, partialRefundBeforeHours, partialRefundPercentage, cancellationCutoffHours, isActive = true, } = body;
        this.validateRequired(body, ['fullRefundBeforeHours', 'partialRefundBeforeHours', 'partialRefundPercentage']);
        // Validate percentages
        if (partialRefundPercentage < 0 || partialRefundPercentage > 100) {
            return this.error('Partial refund percentage must be between 0 and 100', 400);
        }
        const result = await (0, rds_connection_1.insert)('booking_cancellation_rules', {
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
class UpdateRefundRuleHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const ruleId = context.event.pathParameters?.ruleId;
        const body = this.parseBody(context.event);
        if (!ruleId) {
            return this.error('Rule ID is required', 400);
        }
        const updateData = {};
        if (body.fullRefundBeforeHours !== undefined)
            updateData.full_refund_before_hours = body.fullRefundBeforeHours;
        if (body.partialRefundBeforeHours !== undefined)
            updateData.partial_refund_before_hours = body.partialRefundBeforeHours;
        if (body.partialRefundPercentage !== undefined) {
            if (body.partialRefundPercentage < 0 || body.partialRefundPercentage > 100) {
                return this.error('Partial refund percentage must be between 0 and 100', 400);
            }
            updateData.partial_refund_percentage = body.partialRefundPercentage;
        }
        if (body.cancellationCutoffHours !== undefined)
            updateData.cancellation_cutoff_hours = body.cancellationCutoffHours;
        if (body.isActive !== undefined)
            updateData.is_active = body.isActive;
        updateData.updated_at = new Date();
        const result = await (0, rds_connection_1.update)('booking_cancellation_rules', { id: ruleId }, updateData);
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
function registerRefundPolicyEngineEndpoints(app) {
    const calculateHandler = new CalculateRefundPolicyHandler();
    const getRulesHandler = new GetRefundRulesHandler();
    const createRuleHandler = new CreateRefundRuleHandler();
    const updateRuleHandler = new UpdateRefundRuleHandler();
    // Calculate refund policy for a booking
    app.post('/refund-policy/calculate', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await calculateHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
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
}
function createApiGatewayEvent(req) {
    return {
        httpMethod: req.method,
        path: req.url,
        headers: Object.fromEntries(req.headers || []),
        body: JSON.stringify(req.body || {}),
        pathParameters: {},
        queryStringParameters: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
        requestContext: {
            requestId: crypto.randomUUID(),
        },
    };
}
function createLambdaContext() {
    return {
        requestId: crypto.randomUUID(),
        functionName: 'refund-policy-engine',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=refund-policy-engine.js.map