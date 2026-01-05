"use strict";
/**
 * ============================================================================
 * GPS TRACKING ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles real-time GPS tracking for home services
 * - Start tracking session
 * - Update location
 * - Get tracking status
 * - End tracking session
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerGpsTrackingEndpoints = registerGpsTrackingEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
// ============================================================================
// GPS TRACKING HANDLERS
// ============================================================================
class StartTrackingHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const bookingId = context.event.pathParameters?.bookingId;
        const body = this.parseBody(context.event);
        const { vendorId, latitude, longitude } = body;
        if (!bookingId || !vendorId) {
            return this.error('Booking ID and Vendor ID are required', 400);
        }
        // ✅ SQL: Check if booking exists and is for home service
        const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
        if (bookings.length === 0) {
            return this.error('Booking not found', 404);
        }
        const booking = bookings[0];
        if (booking.service_type !== 'at_home') {
            return this.error('GPS tracking is only available for home services', 400);
        }
        // ✅ SQL: Create or update tracking session
        const existingSessions = await (0, rds_connection_1.select)('gps_tracking_sessions', {
            booking_id: bookingId,
            status: 'active',
        });
        if (existingSessions.length > 0) {
            // Update existing session
            await (0, rds_connection_1.update)('gps_tracking_sessions', { id: existingSessions[0].id }, {
                started_at: new Date(),
                last_update: new Date(),
            });
        }
        else {
            // Create new session
            const newSessions = await (0, rds_connection_1.insert)('gps_tracking_sessions', {
                booking_id: bookingId,
                vendor_id: vendorId,
                status: 'active',
                started_at: new Date(),
                last_update: new Date(),
                initial_latitude: latitude,
                initial_longitude: longitude,
            });
            // ✅ SQL: Insert initial location point with session_id
            await (0, rds_connection_1.insert)('gps_tracking_points', {
                booking_id: bookingId,
                session_id: newSessions[0].id, // Link to session
                latitude: latitude,
                longitude: longitude,
                timestamp: new Date(),
                accuracy: body.accuracy || null,
                speed: body.speed || null,
                heading: body.heading || null,
            });
            return this.success({
                message: 'Tracking started',
                bookingId,
                sessionId: newSessions[0].id,
            });
        }
        // For existing session, insert point with session_id
        await (0, rds_connection_1.insert)('gps_tracking_points', {
            booking_id: bookingId,
            session_id: existingSessions[0].id, // Link to existing session
            latitude: latitude,
            longitude: longitude,
            timestamp: new Date(),
            accuracy: body.accuracy || null,
            speed: body.speed || null,
            heading: body.heading || null,
        });
        return this.success({
            message: 'Tracking started',
            bookingId,
        });
    }
}
class UpdateLocationHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const bookingId = context.event.pathParameters?.bookingId;
        const body = this.parseBody(context.event);
        const { latitude, longitude, accuracy, speed, heading } = body;
        if (!bookingId || latitude === undefined || longitude === undefined) {
            return this.error('Booking ID, latitude, and longitude are required', 400);
        }
        // ✅ SQL: Get active session first
        const sessions = await (0, rds_connection_1.select)('gps_tracking_sessions', {
            booking_id: bookingId,
            status: 'active',
        });
        if (sessions.length === 0) {
            return this.error('No active tracking session found', 404);
        }
        const session = sessions[0];
        // ✅ SQL: Insert location point with session_id
        await (0, rds_connection_1.insert)('gps_tracking_points', {
            booking_id: bookingId,
            session_id: session.id, // Link to session
            latitude: latitude,
            longitude: longitude,
            timestamp: new Date(),
            accuracy: accuracy || null,
            speed: speed || null,
            heading: heading || null,
        });
        // ✅ SQL: Update session last_update
        await (0, rds_connection_1.update)('gps_tracking_sessions', { id: session.id }, { last_update: new Date() });
        return this.success({ message: 'Location updated' });
    }
}
class GetTrackingStatusHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const bookingId = context.event.pathParameters?.bookingId;
        if (!bookingId) {
            return this.error('Booking ID is required', 400);
        }
        // ✅ SQL: Get active tracking session
        const sessions = await (0, rds_connection_1.select)('gps_tracking_sessions', {
            booking_id: bookingId,
            status: 'active',
        });
        if (sessions.length === 0) {
            return this.success({ isTracking: false });
        }
        const session = sessions[0];
        // ✅ SQL: Get latest location point
        const { rows: latestPoints } = await (0, rds_connection_1.query)(`SELECT * FROM gps_tracking_points 
       WHERE booking_id = $1 
       ORDER BY timestamp DESC 
       LIMIT 1`, [bookingId]);
        // ✅ SQL: Get all points for route
        const { rows: allPoints } = await (0, rds_connection_1.query)(`SELECT * FROM gps_tracking_points 
       WHERE booking_id = $1 
       ORDER BY timestamp ASC`, [bookingId]);
        // Calculate distance traveled
        let totalDistance = 0;
        for (let i = 1; i < allPoints.length; i++) {
            const prev = allPoints[i - 1];
            const curr = allPoints[i];
            const distance = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
            totalDistance += distance;
        }
        return this.success({
            isTracking: true,
            session: {
                id: session.id,
                startedAt: session.started_at,
                lastUpdate: session.last_update,
            },
            currentLocation: latestPoints[0] || null,
            route: allPoints,
            distanceTraveled: totalDistance,
            duration: session.started_at
                ? Math.floor((new Date().getTime() - new Date(session.started_at).getTime()) / 1000)
                : 0,
        });
    }
}
class StopTrackingHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const bookingId = context.event.pathParameters?.bookingId;
        if (!bookingId) {
            return this.error('Booking ID is required', 400);
        }
        // ✅ SQL: End tracking session
        const sessions = await (0, rds_connection_1.select)('gps_tracking_sessions', {
            booking_id: bookingId,
            status: 'active',
        });
        if (sessions.length > 0) {
            await (0, rds_connection_1.update)('gps_tracking_sessions', { id: sessions[0].id }, {
                status: 'completed',
                ended_at: new Date(),
            });
        }
        return this.success({ message: 'Tracking stopped' });
    }
}
// Helper: Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerGpsTrackingEndpoints(app) {
    const startHandler = new StartTrackingHandler();
    const updateHandler = new UpdateLocationHandler();
    const statusHandler = new GetTrackingStatusHandler();
    const stopHandler = new StopTrackingHandler();
    app.post('/vendor/tracking/:bookingId/start', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { bookingId: c.req.param('bookingId') };
        const context = createLambdaContext();
        const result = await startHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/vendor/tracking/:bookingId/update', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { bookingId: c.req.param('bookingId') };
        const context = createLambdaContext();
        const result = await updateHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/vendor/tracking/:bookingId/status', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { bookingId: c.req.param('bookingId') };
        const context = createLambdaContext();
        const result = await statusHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/vendor/tracking/:bookingId/stop', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { bookingId: c.req.param('bookingId') };
        const context = createLambdaContext();
        const result = await stopHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
}
function createApiGatewayEvent(req) {
    return {
        httpMethod: req.method,
        path: req.url,
        headers: req.headers,
        body: JSON.stringify(req.body || {}),
        pathParameters: req.param() || {},
        queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
        requestContext: {
            requestId: crypto.randomUUID(),
        },
    };
}
function createLambdaContext() {
    return {
        requestId: crypto.randomUUID(),
        functionName: 'gps-tracking-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=gps-tracking.js.map