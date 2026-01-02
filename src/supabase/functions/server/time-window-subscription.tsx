// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { getBookingsRepository } from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

/**
 * ⏰ TIME WINDOW SUBSCRIPTION SYSTEM
 * 
 * Phase 7C: Home Services Enhancement - Rule 2 Implementation
 * 
 * Features:
 * - Subscription package time window scheduling
 * - Morning (8-12), Afternoon (12-4), Evening (4-8) time slots
 * - Recurring schedule management
 * - Flexible scheduling for subscription packages
 */

interface TimeWindowSubscription {
  subscriptionId: string;
  customerId: string;
  serviceType: string;
  providerId?: string;
  timeWindow: 'morning' | 'afternoon' | 'evening';
  recurringSchedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    days?: string[]; // For weekly: ['monday', 'wednesday', 'friday']
    dates?: number[]; // For monthly: [1, 15, 30]
  };
  startDate: string;
  endDate: string;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  sessionsCompleted: number;
  totalSessions: number;
  createdAt: string;
  updatedAt: string;
}

interface TimeWindow {
  name: 'morning' | 'afternoon' | 'evening';
  label: string;
  startHour: number;
  endHour: number;
}

export function timeWindowSubscriptionEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // Time window definitions
  const TIME_WINDOWS: TimeWindow[] = [
    { name: 'morning', label: 'Morning (8 AM - 12 PM)', startHour: 8, endHour: 12 },
    { name: 'afternoon', label: 'Afternoon (12 PM - 4 PM)', startHour: 12, endHour: 16 },
    { name: 'evening', label: 'Evening (4 PM - 8 PM)', startHour: 16, endHour: 20 },
  ];

  // ========================================
  // CREATE TIME WINDOW SUBSCRIPTION FOR BOOKING
  // ========================================
  app.post(`${BASE_PATH}/booking/subscription/time-window`, async (c) => {
    try {
      const {
        bookingId,
        customerId,
        providerId,
        serviceType,
        timeWindow,
        recurringSchedule,
        startDate,
        endDate,
        totalSessions,
      } = await c.req.json();

      if (!bookingId || !customerId || !serviceType || !timeWindow) {
        return sendError(c, 'Required fields missing', 400);
      }

      console.log(`⏰ Creating time window subscription for booking: ${bookingId}`);

      // Validate time window
      const validWindows = TIME_WINDOWS.map(w => w.name);
      if (!validWindows.includes(timeWindow)) {
        return sendError(c, `Invalid time window. Must be one of: ${validWindows.join(', ')}`, 400);
      }

      // ✅ SQL: Get booking details using repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const subscriptionId = `timewin_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const subscription: TimeWindowSubscription = {
        subscriptionId,
        customerId,
        serviceType,
        providerId,
        timeWindow,
        recurringSchedule: recurringSchedule || {
          frequency: 'daily',
          days: [],
          dates: [],
        },
        startDate: startDate || booking.scheduledDate,
        endDate,
        status: 'active',
        sessionsCompleted: 0,
        totalSessions: totalSessions || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // ✅ SQL: Save subscription to time_window_subscriptions table (if exists) or bookings.metadata
      const db = getDbClient();
      try {
        // Try to insert into time_window_subscriptions table if it exists
        await db.from('time_window_subscriptions').insert({
          id: subscriptionId,
          subscription_id: subscriptionId,
          booking_id: bookingId,
          customer_id: customerId,
          provider_id: providerId,
          service_type: serviceType,
          time_window: timeWindow,
          recurring_schedule: subscription.recurringSchedule,
          start_date: subscription.startDate,
          end_date: subscription.endDate,
          status: subscription.status,
          sessions_completed: subscription.sessionsCompleted,
          total_sessions: subscription.totalSessions,
          created_at: subscription.createdAt,
          updated_at: subscription.updatedAt
        });
      } catch (error) {
        // If table doesn't exist, store in bookings.metadata
        console.warn('time_window_subscriptions table not found, storing in bookings.metadata');
        await bookingsRepo.update(bookingId, {
          metadata: {
            ...(booking.metadata || {}),
            subscriptionId,
            isSubscription: true,
            timeWindow,
            subscription
          }
        });
      }

      // ✅ SQL: Update booking with subscription info
      await bookingsRepo.update(bookingId, {
        metadata: {
          ...(booking.metadata || {}),
          subscriptionId,
          isSubscription: true,
          timeWindow
        }
      });

      console.log(`✅ Time window subscription created: ${subscriptionId}`);

      return sendSuccess(c, {
        subscription,
        message: 'Time window subscription created successfully',
      });
    } catch (error) {
      console.error('❌ Error creating time window subscription:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Time Window Subscription endpoints registered');
}