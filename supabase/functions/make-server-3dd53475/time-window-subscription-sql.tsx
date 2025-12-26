/**
 * TIME WINDOW SUBSCRIPTION SYSTEM - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Phase 7C: Home Services Enhancement - Rule 2 Implementation
 * 
 * Features:
 * - Subscription package time window scheduling
 * - Morning (8-12), Afternoon (12-4), Evening (4-8) time slots
 * - Recurring schedule management
 * - Flexible scheduling for subscription packages
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (7 KV operations → 0)
 * Endpoints: 4
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from '../../lib/db.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getPackagesRepository } from '../../lib/repositories/packages.ts';

interface TimeWindowSubscription {
  subscriptionId: string;
  customerId: string;
  serviceType: string;
  providerId?: string;
  timeWindow: 'morning' | 'afternoon' | 'evening';
  recurringSchedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    days?: string[];
    dates?: number[];
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

      // ✅ SQL: Get booking details
      const booking = await getBookingsRepository().findById(bookingId);
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
        startDate,
        endDate,
        status: 'active',
        sessionsCompleted: 0,
        totalSessions: totalSessions || 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // ✅ SQL: Save subscription to platform_settings or package_enrollments metadata
      const db = getDbClient();
      const { data: settings } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'time_window_subscriptions')
        .single();
      
      const subscriptions = (settings?.setting_value as any) || [];
      subscriptions.push(subscription);
      
      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'time_window_subscriptions',
          setting_value: subscriptions,
          setting_type: 'array'
        });

      console.log(`✅ Time window subscription created: ${subscriptionId}`);

      return sendSuccess(c, {
        subscription,
        message: 'Time window subscription created successfully'
      });

    } catch (error) {
      console.error('❌ Error creating time window subscription:', error);
      return sendError(c, 'Failed to create subscription', 500);
    }
  });

  // ========================================
  // GET TIME WINDOW SUBSCRIPTION
  // ========================================
  app.get(`${BASE_PATH}/booking/subscription/time-window/:subscriptionId`, async (c) => {
    try {
      const { subscriptionId } = c.req.param();

      // ✅ SQL: Get subscription
      const db = getDbClient();
      const { data: settings } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'time_window_subscriptions')
        .single();
      
      const subscriptions = (settings?.setting_value as any) || [];
      const subscription = subscriptions.find((s: any) => s.subscriptionId === subscriptionId);

      if (!subscription) {
        return sendError(c, 'Subscription not found', 404);
      }

      return sendSuccess(c, { subscription });

    } catch (error) {
      console.error('❌ Error fetching subscription:', error);
      return sendError(c, 'Failed to fetch subscription', 500);
    }
  });

  // ========================================
  // UPDATE TIME WINDOW SUBSCRIPTION
  // ========================================
  app.put(`${BASE_PATH}/booking/subscription/time-window/:subscriptionId`, async (c) => {
    try {
      const { subscriptionId } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Get and update subscription
      const db = getDbClient();
      const { data: settings } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'time_window_subscriptions')
        .single();
      
      const subscriptions = (settings?.setting_value as any) || [];
      const index = subscriptions.findIndex((s: any) => s.subscriptionId === subscriptionId);

      if (index === -1) {
        return sendError(c, 'Subscription not found', 404);
      }

      subscriptions[index] = {
        ...subscriptions[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'time_window_subscriptions',
          setting_value: subscriptions,
          setting_type: 'array'
        });

      return sendSuccess(c, {
        subscription: subscriptions[index],
        message: 'Subscription updated successfully'
      });

    } catch (error) {
      console.error('❌ Error updating subscription:', error);
      return sendError(c, 'Failed to update subscription', 500);
    }
  });

  // ========================================
  // GET AVAILABLE TIME WINDOWS
  // ========================================
  app.get(`${BASE_PATH}/booking/subscription/time-windows`, async (c) => {
    try {
      return sendSuccess(c, {
        timeWindows: TIME_WINDOWS,
        message: 'Available time windows retrieved'
      });
    } catch (error) {
      console.error('❌ Error fetching time windows:', error);
      return sendError(c, 'Failed to fetch time windows', 500);
    }
  });

  console.log('✅ Time window subscription endpoints registered (SQL-only)');
}

export default timeWindowSubscriptionEndpoints;

