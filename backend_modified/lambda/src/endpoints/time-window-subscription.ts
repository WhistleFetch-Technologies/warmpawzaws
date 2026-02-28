/**
 * ============================================================================
 * TIME WINDOW SUBSCRIPTION ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles time window subscription scheduling:
 * - Create time window subscriptions
 * - Manage recurring schedules
 * - Morning/Afternoon/Evening time slots
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

const TIME_WINDOWS = [
  { name: 'morning', label: 'Morning (8 AM - 12 PM)', startHour: 8, endHour: 12 },
  { name: 'afternoon', label: 'Afternoon (12 PM - 4 PM)', startHour: 12, endHour: 16 },
  { name: 'evening', label: 'Evening (4 PM - 8 PM)', startHour: 16, endHour: 20 },
];

export function registerTimeWindowSubscriptionEndpoints(app: Hono) {
  /**
   * POST /booking/subscription/time-window
   * Create time window subscription for booking
   */
  app.post("/booking/subscription/time-window", async (c) => {
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
        return c.json({ error: 'Required fields missing' }, 400);
      }

      // Validate time window
      const validWindows = TIME_WINDOWS.map(w => w.name);
      if (!validWindows.includes(timeWindow)) {
        return c.json({ error: `Invalid time window. Must be one of: ${validWindows.join(', ')}` }, 400);
      }

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // For time window subscriptions, we need to create a custom subscription plan first
      // Since plan_id is required, we'll create a minimal subscription plan for time windows
      const vendorId = providerId || bookings[0].vendor_id;
      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required for time window subscriptions' }, 400);
      }

      const timeWindowPlan = await insert('subscription_plans', {
        vendor_id: vendorId,
        name: `Time Window Subscription - ${timeWindow}`,
        description: `Custom time window subscription for ${serviceType}`,
        price: 0, // Free, pricing handled separately
        interval: 'monthly',
        features: [],
        is_active: true,
      });

      // Create subscription with the plan
      // Note: customer_subscriptions doesn't have metadata column, so we store time window info in booking
      const subscription = await insert('customer_subscriptions', {
        customer_id: customerId,
        plan_id: timeWindowPlan[0].id,
        vendor_id: vendorId,
        status: 'active',
        start_date: startDate || bookings[0].booking_date,
        next_billing_date: endDate || bookings[0].booking_date,
      });

      // Update booking
      await update('bookings',
        { id: bookingId },
        {
          is_package: true,
          package_details: {
            subscriptionId: subscription[0].id,
            timeWindow,
            recurringSchedule,
          },
        }
      );

      return c.json({
        success: true,
        subscription: subscription[0],
        message: 'Time window subscription created successfully',
      });
    } catch (error: any) {
      console.error('Error creating time window subscription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /subscriptions/time-window/:subscriptionId
   * Get time window subscription details
   */
  app.get("/subscriptions/time-window/:subscriptionId", async (c) => {
    try {
      const { subscriptionId } = c.req.param();

      const subscriptions = await select('customer_subscriptions', { id: subscriptionId });
      if (subscriptions.length === 0) {
        return c.json({ error: 'Subscription not found' }, 404);
      }

      const subscription = subscriptions[0];

      // Get time window details from booking's package_details
      const bookingsResult = await query(
        `SELECT * FROM bookings 
         WHERE package_details->>'subscriptionId' = $1 
         LIMIT 1`,
        [subscriptionId]
      ).catch(() => ({ rows: [] }));
      
      let timeWindow = null;
      let recurringSchedule = null;
      if (bookingsResult.rows.length > 0 && bookingsResult.rows[0].package_details) {
        const packageDetails = bookingsResult.rows[0].package_details as any;
        timeWindow = packageDetails.timeWindow;
        recurringSchedule = packageDetails.recurringSchedule;
      }

      return c.json({
        success: true,
        subscription: {
          ...subscription,
          timeWindow,
          recurringSchedule,
        },
      });
    } catch (error: any) {
      console.error('Error fetching time window subscription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /subscriptions/time-window/customer/:customerId
   * Get all time window subscriptions for a customer
   */
  app.get("/subscriptions/time-window/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      // Get all subscriptions for customer, then filter by checking booking package_details
      const subscriptions = await query(
        `SELECT cs.* FROM customer_subscriptions cs
         INNER JOIN bookings b ON b.package_details->>'subscriptionId' = cs.id::text
         WHERE cs.customer_id = $1
         ORDER BY cs.created_at DESC`,
        [customerId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        subscriptions: subscriptions.rows,
        total: subscriptions.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer time window subscriptions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /subscriptions/time-window/windows
   * Get available time windows
   */
  app.get("/subscriptions/time-window/windows", async (c) => {
    return c.json({
      success: true,
      windows: TIME_WINDOWS,
    });
  });
}

