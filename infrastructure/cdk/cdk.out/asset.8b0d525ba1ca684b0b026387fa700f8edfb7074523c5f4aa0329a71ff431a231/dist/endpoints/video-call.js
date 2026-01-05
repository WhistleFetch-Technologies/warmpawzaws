"use strict";
/**
 * ============================================================================
 * VIDEO CALL ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles video calling for tele consultations using AWS Chime SDK
 * - Create meeting
 * - Join meeting
 * - End meeting
 * - Get meeting info
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVideoCallEndpoints = registerVideoCallEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
const client_chime_sdk_meetings_1 = require("@aws-sdk/client-chime-sdk-meetings");
// ============================================================================
// VIDEO CALL HANDLERS
// ============================================================================
class CreateMeetingHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { bookingId, customerId, vendorId } = body;
        this.validateRequired(body, ['bookingId', 'customerId', 'vendorId']);
        // ✅ SQL: Verify booking exists and is tele consultation
        const bookings = await (0, rds_connection_1.select)('bookings', { id: bookingId });
        if (bookings.length === 0) {
            return this.error('Booking not found', 404);
        }
        const booking = bookings[0];
        if (booking.service_type !== 'tele') {
            return this.error('Video calling is only available for tele consultations', 400);
        }
        // ✅ AWS Chime: Create meeting
        const chimeClient = new client_chime_sdk_meetings_1.ChimeSDKMeetingsClient({
            region: process.env.AWS_REGION || 'ap-south-1',
        });
        const meetingResponse = await chimeClient.send(new client_chime_sdk_meetings_1.CreateMeetingCommand({
            ClientRequestToken: `booking-${bookingId}-${Date.now()}`,
            MediaRegion: process.env.AWS_REGION || 'ap-south-1',
            ExternalMeetingId: bookingId,
        }));
        if (!meetingResponse.Meeting) {
            return this.error('Failed to create meeting', 500);
        }
        const meetingId = meetingResponse.Meeting.MeetingId;
        // ✅ AWS Chime: Create attendees
        const customerAttendee = await chimeClient.send(new client_chime_sdk_meetings_1.CreateAttendeeCommand({
            MeetingId: meetingId,
            ExternalUserId: customerId,
        }));
        const vendorAttendee = await chimeClient.send(new client_chime_sdk_meetings_1.CreateAttendeeCommand({
            MeetingId: meetingId,
            ExternalUserId: vendorId,
        }));
        // ✅ SQL: Store meeting info
        await (0, rds_connection_1.insert)('video_call_sessions', {
            booking_id: bookingId,
            meeting_id: meetingId,
            customer_id: customerId,
            vendor_id: vendorId,
            customer_attendee_id: customerAttendee.Attendee?.AttendeeId,
            vendor_attendee_id: vendorAttendee.Attendee?.AttendeeId,
            status: 'active',
            started_at: new Date(),
        });
        return this.success({
            meetingId,
            meeting: {
                MeetingId: meetingResponse.Meeting.MeetingId,
                MediaRegion: meetingResponse.Meeting.MeetingFeatures?.Audio?.EchoReduction,
                MediaPlacement: meetingResponse.Meeting.MeetingFeatures,
            },
            attendees: {
                customer: {
                    AttendeeId: customerAttendee.Attendee?.AttendeeId,
                    JoinToken: customerAttendee.Attendee?.JoinToken,
                },
                vendor: {
                    AttendeeId: vendorAttendee.Attendee?.AttendeeId,
                    JoinToken: vendorAttendee.Attendee?.JoinToken,
                },
            },
        });
    }
}
class GetMeetingInfoHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const bookingId = context.event.pathParameters?.bookingId;
        if (!bookingId) {
            return this.error('Booking ID is required', 400);
        }
        // ✅ SQL: Get meeting session
        const sessions = await (0, rds_connection_1.select)('video_call_sessions', {
            booking_id: bookingId,
        });
        if (sessions.length === 0) {
            return this.error('Meeting not found', 404);
        }
        const session = sessions[0];
        return this.success({
            meetingId: session.meeting_id,
            status: session.status,
            startedAt: session.started_at,
            endedAt: session.ended_at,
            duration: session.ended_at && session.started_at
                ? Math.floor((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000)
                : null,
        });
    }
}
class EndMeetingHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const bookingId = context.event.pathParameters?.bookingId;
        if (!bookingId) {
            return this.error('Booking ID is required', 400);
        }
        // ✅ SQL: End meeting session
        const sessions = await (0, rds_connection_1.select)('video_call_sessions', {
            booking_id: bookingId,
            status: 'active',
        });
        if (sessions.length > 0) {
            await (0, rds_connection_1.update)('video_call_sessions', { id: sessions[0].id }, {
                status: 'completed',
                ended_at: new Date(),
            });
        }
        return this.success({ message: 'Meeting ended' });
    }
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerVideoCallEndpoints(app) {
    const createHandler = new CreateMeetingHandler();
    const getInfoHandler = new GetMeetingInfoHandler();
    const endHandler = new EndMeetingHandler();
    app.post('/video-call/create', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await createHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/video-call/:bookingId', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { bookingId: c.req.param('bookingId') };
        const context = createLambdaContext();
        const result = await getInfoHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/video-call/:bookingId/end', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { bookingId: c.req.param('bookingId') };
        const context = createLambdaContext();
        const result = await endHandler.execute(event, context);
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
        functionName: 'video-call-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=video-call.js.map