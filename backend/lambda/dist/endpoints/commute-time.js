"use strict";
/**
 * ============================================================================
 * COMMUTE TIME ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Endpoints for calculating commute time between locations
 * Used for staff assignment, ETA calculations, route optimization
 *
 * Date: 2026-01-27
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommuteTimeEndpoints = registerCommuteTimeEndpoints;
const crypto_1 = require("crypto");
const base_handler_1 = require("../handler/base-handler");
const commute_time_calculator_1 = require("../utils/commute-time-calculator");
class CalculateCommuteTimeHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { origin, destination, options } = body;
        if (!origin || !destination) {
            return this.error('Origin and destination are required', 400);
        }
        if (!origin.latitude || !origin.longitude || !destination.latitude || !destination.longitude) {
            return this.error('Origin and destination must have latitude and longitude', 400);
        }
        try {
            const result = await (0, commute_time_calculator_1.calculateCommuteTime)(origin, destination, {
                googleMapsApiKey: options?.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY,
                averageSpeedKmh: options?.averageSpeedKmh || 30,
                trafficMultiplier: options?.trafficMultiplier || 1.25,
                departureTime: options?.departureTime ? new Date(options.departureTime) : undefined,
            });
            return this.success(result);
        }
        catch (error) {
            console.error('Error calculating commute time:', error);
            return this.error(error.message || 'Failed to calculate commute time', 500);
        }
    }
}
class CalculateMultipleCommuteTimesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { origin, destinations, options } = body;
        if (!origin || !destinations || !Array.isArray(destinations) || destinations.length === 0) {
            return this.error('Origin and destinations array are required', 400);
        }
        try {
            const results = await (0, commute_time_calculator_1.calculateMultipleCommuteTimes)(origin, destinations, {
                googleMapsApiKey: options?.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY,
                averageSpeedKmh: options?.averageSpeedKmh || 30,
                trafficMultiplier: options?.trafficMultiplier || 1.25,
            });
            return this.success({ results, sorted: results });
        }
        catch (error) {
            console.error('Error calculating multiple commute times:', error);
            return this.error(error.message || 'Failed to calculate commute times', 500);
        }
    }
}
class CalculateStaffETAHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { staff_id, customer_location, booking_datetime, options } = body;
        if (!staff_id || !customer_location || !booking_datetime) {
            return this.error('staff_id, customer_location, and booking_datetime are required', 400);
        }
        if (!customer_location.latitude || !customer_location.longitude) {
            return this.error('customer_location must have latitude and longitude', 400);
        }
        try {
            const result = await (0, commute_time_calculator_1.calculateStaffETA)(staff_id, customer_location, new Date(booking_datetime), {
                googleMapsApiKey: options?.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY,
                bufferMinutes: options?.bufferMinutes || 5,
            });
            return this.success(result);
        }
        catch (error) {
            console.error('Error calculating staff ETA:', error);
            return this.error(error.message || 'Failed to calculate staff ETA', 500);
        }
    }
}
function registerCommuteTimeEndpoints(app) {
    const calculateHandler = new CalculateCommuteTimeHandler();
    const calculateMultipleHandler = new CalculateMultipleCommuteTimesHandler();
    const staffETAHandler = new CalculateStaffETAHandler();
    // Calculate commute time between two locations
    app.post('/commute-time/calculate', async (c) => {
        const event = await createApiGatewayEvent(c);
        const context = createLambdaContext();
        const result = await calculateHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    // Calculate commute time to multiple destinations (for route optimization)
    app.post('/commute-time/calculate-multiple', async (c) => {
        const event = await createApiGatewayEvent(c);
        const context = createLambdaContext();
        const result = await calculateMultipleHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    // Calculate ETA for staff arrival at customer location
    app.post('/commute-time/staff-eta', async (c) => {
        const event = await createApiGatewayEvent(c);
        const context = createLambdaContext();
        const result = await staffETAHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
}
async function createApiGatewayEvent(c) {
    const body = await c.req.json().catch(() => ({}));
    return {
        httpMethod: c.req.method,
        path: c.req.url,
        headers: c.req.headers,
        body: JSON.stringify(body),
        pathParameters: c.req.param() || {},
        queryStringParameters: Object.fromEntries(new URL(c.req.url).searchParams),
        requestContext: {
            requestId: (0, crypto_1.randomUUID)(),
        },
    };
}
function createLambdaContext() {
    return {
        requestId: (0, crypto_1.randomUUID)(),
        functionName: 'commute-time-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=commute-time.js.map