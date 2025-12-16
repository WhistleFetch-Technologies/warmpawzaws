import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

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

export function timeWindowSubscriptionEndpoints(app: Hono, kv: any) {
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

      // Get booking details
      const booking = await kv.get(`booking:${bookingId}`);
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

      // Save subscription
      await kv.set(`time_window_subscription_${subscriptionId}`, subscription);

      // Link to booking
      booking.subscriptionId = subscriptionId;
      booking.isSubscription = true;
      booking.timeWindow = timeWindow;
      await kv.set(`booking:${bookingId}`, booking);

      // Add to customer's subscription list
      const customerSubs = await kv.get(`customer_time_window_subs_${customerId}`) || [];
      customerSubs.push(subscriptionId);
      await kv.set(`customer_time_window_subs_${customerId}`, customerSubs);

      // Add to provider's subscription list
      if (providerId) {
        const providerSubs = await kv.get(`provider_time_window_subs_${providerId}`) || [];
        providerSubs.push(subscriptionId);
        await kv.set(`provider_time_window_subs_${providerId}`, providerSubs);
      }

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