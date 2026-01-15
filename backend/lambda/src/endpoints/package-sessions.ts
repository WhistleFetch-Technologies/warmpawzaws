/**
 * ============================================================================
 * PACKAGE SESSION TRACKING ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles session tracking for package bookings
 * - Start session
 * - Complete session
 * - Get session progress
 * - Get package usage analytics
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// PACKAGE SESSION HANDLERS
// ============================================================================

class StartSessionHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId, sessionNumber } = body;

    this.validateRequired(body, ['bookingId', 'sessionNumber']);

    // ✅ SQL: Verify booking is a package
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return this.error('Booking not found', 404);
    }

    const booking = bookings[0];
    if (!booking.is_package) {
      return this.error('This booking is not a package', 400);
    }

    // ✅ SQL: Check if session already exists
    const existingSessions = await select('package_sessions', {
      booking_id: bookingId,
      session_number: sessionNumber,
    });

    if (existingSessions.length > 0 && existingSessions[0].status === 'completed') {
      return this.error('Session already completed', 400);
    }

    // ✅ SQL: Create or update session
    if (existingSessions.length > 0) {
      await update(
        'package_sessions',
        { id: existingSessions[0].id },
        {
          status: 'in_progress',
          started_at: new Date(),
        }
      );
    } else {
      await insert('package_sessions', {
        booking_id: bookingId,
        session_number: sessionNumber,
        status: 'in_progress',
        started_at: new Date(),
      });
    }

    return this.success({
      message: 'Session started',
      bookingId,
      sessionNumber,
    });
  }
}

class CompleteSessionHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId, sessionNumber, notes, outcome } = body;

    this.validateRequired(body, ['bookingId', 'sessionNumber']);

    // ✅ SQL: Get session
    const sessions = await select('package_sessions', {
      booking_id: bookingId,
      session_number: sessionNumber,
    });

    if (sessions.length === 0) {
      return this.error('Session not found', 404);
    }

    // ✅ SQL: Complete session
    await update(
      'package_sessions',
      { id: sessions[0].id },
      {
        status: 'completed',
        completed_at: new Date(),
        notes: notes || null,
        outcome: outcome || null,
      }
    );

    // ✅ SQL: Check if all sessions are complete
    const allSessions = await select('package_sessions', {
      booking_id: bookingId,
    });

    const completedSessions = allSessions.filter(s => s.status === 'completed');
    const totalSessions = allSessions.length;

    // Update booking if all sessions complete
    if (completedSessions.length === totalSessions && totalSessions > 0) {
      await update('bookings', { id: bookingId }, { status: 'completed' });
    }

    return this.success({
      message: 'Session completed',
      progress: {
        completed: completedSessions.length,
        total: totalSessions,
        percentage: Math.round((completedSessions.length / totalSessions) * 100),
      },
    });
  }
}

class GetSessionProgressHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    // ✅ SQL: Get all sessions for booking
    const sessions = await select('package_sessions', {
      booking_id: bookingId,
    }, {
      orderBy: 'session_number',
      orderDirection: 'ASC',
    });

    const completedSessions = sessions.filter(s => s.status === 'completed');
    const inProgressSessions = sessions.filter(s => s.status === 'in_progress');
    const pendingSessions = sessions.filter(s => s.status === 'pending');

    return this.success({
      bookingId,
      sessions: sessions.map(s => ({
        sessionNumber: s.session_number,
        status: s.status,
        startedAt: s.started_at,
        completedAt: s.completed_at,
        notes: s.notes,
        outcome: s.outcome,
      })),
      progress: {
        completed: completedSessions.length,
        inProgress: inProgressSessions.length,
        pending: pendingSessions.length,
        total: sessions.length,
        percentage: sessions.length > 0
          ? Math.round((completedSessions.length / sessions.length) * 100)
          : 0,
      },
    });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerPackageSessionEndpoints(app: Hono) {
  const startHandler = new StartSessionHandler();
  const completeHandler = new CompleteSessionHandler();
  const progressHandler = new GetSessionProgressHandler();

  app.post('/package-sessions/start', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await startHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/package-sessions/complete', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await completeHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/package-sessions/:bookingId/progress', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result = await progressHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

function createApiGatewayEvent(req: any): any {
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

function createLambdaContext(): any {
  return {
    requestId: crypto.randomUUID(),
    functionName: 'package-session-handler',
    functionVersion: '$LATEST',
  };
}

