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
  // CREATE TIME WINDOW SUBSCRIPTION
  // ========================================
  app.post(`${BASE_PATH}/subscriptions/time-window/create`, async (c) => {
    try {
      const {
        customerId,
        serviceType,
        providerId,
        timeWindow,
        recurringSchedule,
        startDate,
        endDate,
        totalSessions,
      } = await c.req.json();

      if (!customerId || !serviceType || !timeWindow || !recurringSchedule || !startDate || !endDate) {
        return sendError(c, 'Required fields missing', 400);
      }

      // Validate time window
      const validWindows = TIME_WINDOWS.map(w => w.name);
      if (!validWindows.includes(timeWindow)) {
        return sendError(c, `Invalid time window. Must be one of: ${validWindows.join(', ')}`, 400);
      }

      const subscriptionId = `timewin_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const subscription: TimeWindowSubscription = {
        subscriptionId,
        customerId,
        serviceType,
        providerId,
        timeWindow,
        recurringSchedule,
        startDate,
        endDate,
        status: 'active',
        sessionsCompleted: 0,
        totalSessions: totalSessions || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`time_window_subscription_${subscriptionId}`, subscription);

      // Store in customer's subscription list
      const customerSubs = await kv.get(`customer_time_window_subs_${customerId}`) || [];
      customerSubs.push(subscriptionId);
      await kv.set(`customer_time_window_subs_${customerId}`, customerSubs);

      console.log(`✅ Time window subscription created: ${subscriptionId}`);

      return sendSuccess(c, { subscription }, 'Time window subscription created successfully');
    } catch (error) {
      console.error('Error creating subscription:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET TIME WINDOW SUBSCRIPTION
  // ========================================
  app.get(`${BASE_PATH}/subscriptions/time-window/:subscriptionId`, async (c) => {
    try {
      const subscriptionId = c.req.param('subscriptionId');

      const subscription = await kv.get(`time_window_subscription_${subscriptionId}`);

      if (!subscription) {
        return sendError(c, 'Subscription not found', 404);
      }

      // Get time window details
      const timeWindowDetails = TIME_WINDOWS.find(w => w.name === subscription.timeWindow);

      return sendSuccess(c, { 
        subscription,
        timeWindowDetails,
      });
    } catch (error) {
      console.error('Error getting subscription:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // UPDATE TIME WINDOW SUBSCRIPTION
  // ========================================
  app.put(`${BASE_PATH}/subscriptions/time-window/:subscriptionId`, async (c) => {
    try {
      const subscriptionId = c.req.param('subscriptionId');
      const updates = await c.req.json();

      const subscription = await kv.get(`time_window_subscription_${subscriptionId}`);

      if (!subscription) {
        return sendError(c, 'Subscription not found', 404);
      }

      // Update allowed fields
      const updated: TimeWindowSubscription = {
        ...subscription,
        timeWindow: updates.timeWindow || subscription.timeWindow,
        recurringSchedule: updates.recurringSchedule || subscription.recurringSchedule,
        providerId: updates.providerId !== undefined ? updates.providerId : subscription.providerId,
        status: updates.status || subscription.status,
        sessionsCompleted: updates.sessionsCompleted !== undefined ? updates.sessionsCompleted : subscription.sessionsCompleted,
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`time_window_subscription_${subscriptionId}`, updated);

      console.log(`✅ Subscription ${subscriptionId} updated`);

      return sendSuccess(c, { subscription: updated }, 'Subscription updated successfully');
    } catch (error) {
      console.error('Error updating subscription:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET CUSTOMER TIME WINDOW SUBSCRIPTIONS
  // ========================================
  app.get(`${BASE_PATH}/subscriptions/time-window/customer/:customerId`, async (c) => {
    try {
      const customerId = c.req.param('customerId');

      const subscriptionIds = await kv.get(`customer_time_window_subs_${customerId}`) || [];

      const subscriptions = await Promise.all(
        subscriptionIds.map((id: string) => kv.get(`time_window_subscription_${id}`))
      );

      // Filter out null values and add time window details
      const enrichedSubscriptions = subscriptions
        .filter(Boolean)
        .map((sub: any) => ({
          ...sub,
          timeWindowDetails: TIME_WINDOWS.find(w => w.name === sub.timeWindow),
        }));

      return sendSuccess(c, { subscriptions: enrichedSubscriptions });
    } catch (error) {
      console.error('Error getting customer subscriptions:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET NEXT SCHEDULED SESSIONS
  // ========================================
  app.get(`${BASE_PATH}/subscriptions/time-window/:subscriptionId/next-sessions`, async (c) => {
    try {
      const subscriptionId = c.req.param('subscriptionId');
      const count = parseInt(c.req.query('count') || '5');

      const subscription = await kv.get(`time_window_subscription_${subscriptionId}`);

      if (!subscription) {
        return sendError(c, 'Subscription not found', 404);
      }

      const timeWindow = TIME_WINDOWS.find(w => w.name === subscription.timeWindow);
      if (!timeWindow) {
        return sendError(c, 'Invalid time window', 400);
      }

      const nextSessions = [];
      const startDate = new Date(subscription.startDate);
      const endDate = new Date(subscription.endDate);
      const now = new Date();

      let currentDate = new Date(Math.max(startDate.getTime(), now.getTime()));

      while (nextSessions.length < count && currentDate <= endDate) {
        let shouldInclude = false;

        if (subscription.recurringSchedule.frequency === 'daily') {
          shouldInclude = true;
        } else if (subscription.recurringSchedule.frequency === 'weekly') {
          const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'lowercase' });
          shouldInclude = subscription.recurringSchedule.days?.includes(dayName) || false;
        } else if (subscription.recurringSchedule.frequency === 'monthly') {
          const dayOfMonth = currentDate.getDate();
          shouldInclude = subscription.recurringSchedule.dates?.includes(dayOfMonth) || false;
        }

        if (shouldInclude) {
          nextSessions.push({
            date: currentDate.toISOString().split('T')[0],
            timeWindow: subscription.timeWindow,
            startHour: timeWindow.startHour,
            endHour: timeWindow.endHour,
            label: timeWindow.label,
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return sendSuccess(c, { nextSessions, count: nextSessions.length });
    } catch (error) {
      console.error('Error getting next sessions:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // PAUSE/RESUME SUBSCRIPTION
  // ========================================
  app.post(`${BASE_PATH}/subscriptions/time-window/:subscriptionId/pause`, async (c) => {
    try {
      const subscriptionId = c.req.param('subscriptionId');

      const subscription = await kv.get(`time_window_subscription_${subscriptionId}`);

      if (!subscription) {
        return sendError(c, 'Subscription not found', 404);
      }

      subscription.status = 'paused';
      subscription.updatedAt = new Date().toISOString();

      await kv.set(`time_window_subscription_${subscriptionId}`, subscription);

      return sendSuccess(c, { subscription }, 'Subscription paused');
    } catch (error) {
      console.error('Error pausing subscription:', error);
      return sendError(c, error, 500);
    }
  });

  app.post(`${BASE_PATH}/subscriptions/time-window/:subscriptionId/resume`, async (c) => {
    try {
      const subscriptionId = c.req.param('subscriptionId');

      const subscription = await kv.get(`time_window_subscription_${subscriptionId}`);

      if (!subscription) {
        return sendError(c, 'Subscription not found', 404);
      }

      subscription.status = 'active';
      subscription.updatedAt = new Date().toISOString();

      await kv.set(`time_window_subscription_${subscriptionId}`, subscription);

      return sendSuccess(c, { subscription }, 'Subscription resumed');
    } catch (error) {
      console.error('Error resuming subscription:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Time Window Subscription endpoints registered');
}
