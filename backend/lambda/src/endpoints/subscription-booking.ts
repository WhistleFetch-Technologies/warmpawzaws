/**
 * ============================================================================
 * SUBSCRIPTION BOOKING ENDPOINTS
 * ============================================================================
 * 
 * Handles subscription-based zero-payment bookings
 * - Check active subscriptions
 * - Validate subscription coverage
 * - Create zero-payment bookings for unlimited subscriptions
 * - Track subscription usage
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';

// ============================================================================
// TYPES
// ============================================================================

interface SubscriptionCoverage {
  covered: boolean;
  subscriptionId: string | null;
  subscriptionName: string | null;
  isUnlimited: boolean;
  usedCount: number;
  remainingCount: number | null; // null = unlimited
  expiresAt: string | null;
  message: string;
}

// ============================================================================
// CHECK SUBSCRIPTION COVERAGE HANDLER
// ============================================================================

class CheckSubscriptionCoverageHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { customerId, serviceId, vendorId, serviceStyle } = body;

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    try {
      // Get active subscriptions for customer
      const { rows: subscriptions } = await query(
        `SELECT 
          cs.id as subscription_id,
          cs.subscription_type_id,
          cs.status,
          cs.start_date,
          cs.end_date,
          cs.usage_count,
          cs.usage_limit,
          cs.is_unlimited,
          st.name as subscription_name,
          st.description,
          st.included_services,
          st.included_vendors,
          st.included_service_styles,
          st.price
        FROM customer_subscriptions cs
        JOIN subscription_types st ON st.id = cs.subscription_type_id
        WHERE cs.customer_id = $1 
          AND cs.status = 'active'
          AND (cs.end_date IS NULL OR cs.end_date > NOW())
        ORDER BY cs.created_at DESC`,
        [customerId]
      );

      if (subscriptions.length === 0) {
        return this.success({
          covered: false,
          subscriptionId: null,
          subscriptionName: null,
          isUnlimited: false,
          usedCount: 0,
          remainingCount: 0,
          expiresAt: null,
          message: 'No active subscription found',
        } as SubscriptionCoverage);
      }

      // Check each subscription for coverage
      for (const sub of subscriptions) {
        let isCovered = false;

        // Check service coverage
        if (serviceId && sub.included_services) {
          const includedServices = typeof sub.included_services === 'string' 
            ? JSON.parse(sub.included_services) 
            : sub.included_services;
          
          // Check if specific service is included or if it's a wildcard (all services)
          isCovered = includedServices.includes('*') || 
                      includedServices.includes(serviceId) ||
                      includedServices.length === 0; // Empty array = all services
        } else {
          // If no included_services specified, cover all services
          isCovered = true;
        }

        // Check vendor coverage
        if (vendorId && sub.included_vendors && !isCovered) {
          const includedVendors = typeof sub.included_vendors === 'string'
            ? JSON.parse(sub.included_vendors)
            : sub.included_vendors;
          
          isCovered = includedVendors.includes('*') || 
                      includedVendors.includes(vendorId) ||
                      includedVendors.length === 0;
        }

        // Check service style coverage
        if (serviceStyle && sub.included_service_styles) {
          const includedStyles = typeof sub.included_service_styles === 'string'
            ? JSON.parse(sub.included_service_styles)
            : sub.included_service_styles;
          
          if (includedStyles.length > 0 && !includedStyles.includes('*')) {
            isCovered = isCovered && includedStyles.includes(serviceStyle);
          }
        }

        // Check usage limits
        if (isCovered) {
          const isUnlimited = sub.is_unlimited || sub.usage_limit === null || sub.usage_limit === 0;
          const usedCount = sub.usage_count || 0;
          const usageLimit = sub.usage_limit || null;
          
          // Check if usage limit exceeded
          if (!isUnlimited && usageLimit && usedCount >= usageLimit) {
            continue; // This subscription is exhausted, check next
          }

          return this.success({
            covered: true,
            subscriptionId: sub.subscription_id,
            subscriptionName: sub.subscription_name,
            isUnlimited,
            usedCount,
            remainingCount: isUnlimited ? null : (usageLimit - usedCount),
            expiresAt: sub.end_date,
            message: isUnlimited 
              ? 'Covered by unlimited subscription' 
              : `Covered by subscription (${usageLimit - usedCount} visits remaining)`,
          } as SubscriptionCoverage);
        }
      }

      // No matching subscription found
      return this.success({
        covered: false,
        subscriptionId: null,
        subscriptionName: null,
        isUnlimited: false,
        usedCount: 0,
        remainingCount: 0,
        expiresAt: null,
        message: 'This service is not covered by your active subscriptions',
      } as SubscriptionCoverage);
    } catch (error: any) {
      console.error('Error checking subscription coverage:', error);
      return this.error(error.message || 'Failed to check subscription', 500);
    }
  }
}

// ============================================================================
// CREATE SUBSCRIPTION BOOKING HANDLER (Zero Payment)
// ============================================================================

class CreateSubscriptionBookingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { 
      customerId, 
      subscriptionId, 
      serviceId, 
      vendorId, 
      staffId,
      bookingDate, 
      bookingTime, 
      serviceStyle,
      petId,
      address,
      notes 
    } = body;

    if (!customerId || !subscriptionId || !serviceId || !vendorId || !bookingDate || !bookingTime) {
      return this.error('Missing required fields', 400);
    }

    try {
      // Verify subscription is still valid and has remaining usage
      const { rows: subscriptions } = await query(
        `SELECT 
          cs.id,
          cs.usage_count,
          cs.usage_limit,
          cs.is_unlimited,
          cs.status,
          cs.end_date
        FROM customer_subscriptions cs
        WHERE cs.id = $1 
          AND cs.customer_id = $2
          AND cs.status = 'active'
          AND (cs.end_date IS NULL OR cs.end_date > NOW())`,
        [subscriptionId, customerId]
      );

      if (subscriptions.length === 0) {
        return this.error('Subscription not found or expired', 404);
      }

      const subscription = subscriptions[0];
      const isUnlimited = subscription.is_unlimited || subscription.usage_limit === null;
      const usedCount = subscription.usage_count || 0;

      // Check usage limit
      if (!isUnlimited && subscription.usage_limit && usedCount >= subscription.usage_limit) {
        return this.error('Subscription usage limit reached', 400);
      }

      // Get service details for booking
      const { rows: services } = await query(
        `SELECT name, duration, price FROM vendor_services WHERE id = $1`,
        [serviceId]
      );

      const service = services.length > 0 ? services[0] : { name: 'Service', duration: 30, price: 0 };

      // Generate booking OTP
      const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
      const otpExpiresAt = new Date();
      otpExpiresAt.setHours(otpExpiresAt.getHours() + 24);

      // Create zero-payment booking
      const bookingData = {
        customer_id: customerId,
        vendor_id: vendorId,
        service_id: serviceId,
        staff_id: staffId || null,
        booking_date: bookingDate,
        booking_time: bookingTime,
        service_type: serviceStyle || 'at_center',
        pet_id: petId || null,
        address: address || null,
        notes: notes || null,
        status: 'confirmed', // Auto-confirm subscription bookings
        payment_status: 'paid', // Covered by subscription
        total_amount: 0, // Zero payment
        subscription_id: subscriptionId,
        is_subscription_booking: true,
        otp_code: otpCode,
        otp_expires_at: otpExpiresAt,
        duration: service.duration || 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const [newBooking] = await insert('bookings', bookingData);

      // Increment subscription usage count
      await query(
        `UPDATE customer_subscriptions 
         SET usage_count = COALESCE(usage_count, 0) + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [subscriptionId]
      );

      // Log subscription usage
      await insert('subscription_usage_logs', {
        subscription_id: subscriptionId,
        customer_id: customerId,
        booking_id: newBooking.id,
        service_id: serviceId,
        vendor_id: vendorId,
        used_at: new Date(),
      }).catch(() => {
        // Table might not exist yet
      });

      return this.success({
        success: true,
        bookingId: newBooking.id,
        booking: {
          id: newBooking.id,
          status: 'confirmed',
          paymentStatus: 'paid',
          totalAmount: 0,
          isSubscriptionBooking: true,
          otpCode,
          bookingDate,
          bookingTime,
          serviceName: service.name,
        },
        subscription: {
          id: subscriptionId,
          usedCount: usedCount + 1,
          remainingCount: isUnlimited ? null : (subscription.usage_limit - usedCount - 1),
          isUnlimited,
        },
        message: 'Booking confirmed! Covered by your subscription.',
      });
    } catch (error: any) {
      console.error('Error creating subscription booking:', error);
      return this.error(error.message || 'Failed to create booking', 500);
    }
  }
}

// ============================================================================
// GET SUBSCRIPTION USAGE HISTORY HANDLER
// ============================================================================

class GetSubscriptionUsageHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const subscriptionId = context.event.pathParameters?.subscriptionId;
    const customerId = context.event.queryStringParameters?.customerId;

    if (!subscriptionId && !customerId) {
      return this.error('Subscription ID or Customer ID is required', 400);
    }

    try {
      let usageLogs: any[] = [];

      if (subscriptionId) {
        const { rows } = await query(
          `SELECT 
            sul.id,
            sul.booking_id,
            sul.service_id,
            sul.vendor_id,
            sul.used_at,
            vs.service_name as service_name,
            v.business_name as vendor_name,
            b.status as booking_status
          FROM subscription_usage_logs sul
          LEFT JOIN vendor_services vs ON vs.id = sul.service_id
          LEFT JOIN vendors v ON v.id = sul.vendor_id
          LEFT JOIN bookings b ON b.id = sul.booking_id
          WHERE sul.subscription_id = $1
          ORDER BY sul.used_at DESC
          LIMIT 50`,
          [subscriptionId]
        );
        usageLogs = rows;
      } else if (customerId) {
        const { rows } = await query(
          `SELECT 
            sul.id,
            sul.subscription_id,
            sul.booking_id,
            sul.service_id,
            sul.vendor_id,
            sul.used_at,
            vs.service_name as service_name,
            v.business_name as vendor_name,
            b.status as booking_status,
            st.name as subscription_name
          FROM subscription_usage_logs sul
          JOIN customer_subscriptions cs ON cs.id = sul.subscription_id
          JOIN subscription_types st ON st.id = cs.subscription_type_id
          LEFT JOIN vendor_services vs ON vs.id = sul.service_id
          LEFT JOIN vendors v ON v.id = sul.vendor_id
          LEFT JOIN bookings b ON b.id = sul.booking_id
          WHERE sul.customer_id = $1
          ORDER BY sul.used_at DESC
          LIMIT 50`,
          [customerId]
        );
        usageLogs = rows;
      }

      return this.success({
        success: true,
        usage: usageLogs.map(log => ({
          id: log.id,
          subscriptionId: log.subscription_id,
          subscriptionName: log.subscription_name,
          bookingId: log.booking_id,
          serviceName: log.service_name || 'Service',
          vendorName: log.vendor_name || 'Vendor',
          usedAt: log.used_at,
          bookingStatus: log.booking_status,
        })),
        count: usageLogs.length,
      });
    } catch (error: any) {
      console.error('Error fetching subscription usage:', error);
      return this.error(error.message || 'Failed to fetch usage', 500);
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerSubscriptionBookingEndpoints(app: Hono) {
  const checkCoverageHandler = new CheckSubscriptionCoverageHandler();
  const createBookingHandler = new CreateSubscriptionBookingHandler();
  const usageHandler = new GetSubscriptionUsageHandler();

  // Check if booking is covered by subscription
  app.post('/subscriptions/check-coverage', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: '/subscriptions/check-coverage',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'subscription-booking', functionVersion: '$LATEST' };
    const result = await checkCoverageHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Create zero-payment subscription booking
  app.post('/subscriptions/create-booking', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: '/subscriptions/create-booking',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'subscription-booking', functionVersion: '$LATEST' };
    const result = await createBookingHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get subscription usage history
  app.get('/subscriptions/:subscriptionId/usage', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/subscriptions/${c.req.param('subscriptionId')}/usage`,
      headers: {},
      body: '',
      pathParameters: { subscriptionId: c.req.param('subscriptionId') },
      queryStringParameters: Object.fromEntries(new URL(c.req.url).searchParams),
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'subscription-booking', functionVersion: '$LATEST' };
    const result = await usageHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get customer subscription usage
  app.get('/customer/:customerId/subscription-usage', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/customer/${c.req.param('customerId')}/subscription-usage`,
      headers: {},
      body: '',
      pathParameters: {},
      queryStringParameters: { customerId: c.req.param('customerId') },
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'subscription-booking', functionVersion: '$LATEST' };
    const result = await usageHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
