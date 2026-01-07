/**
 * ============================================================================
 * RETURNS MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles return requests and refunds:
 * - Check return eligibility
 * - Create return requests
 * - Approve/reject returns
 * - Process refunds
 * 
 * Migrated from: supabase/functions/make-server-3dd53475/returns-management-sql.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, upsert, query } from '../database/rds-connection';
import { getRazorpayClient } from '../utils/razorpay-client';

export function registerReturnsEndpoints(app: Hono) {
  /**
   * POST /returns/check-eligibility
   * Check if return is eligible
   */
  app.post("/returns/check-eligibility", async (c) => {
    try {
      const { orderId, productId, reason } = await c.req.json();

      if (!orderId || !productId || !reason) {
        return c.json({ error: 'orderId, productId, and reason are required' }, 400);
      }

      // Get order
      const orders = await select('orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ eligible: false, message: 'Order not found' });
      }

      const order = orders[0];

      // Check if order is delivered
      if (order.order_status !== 'delivered') {
        return c.json({ eligible: false, message: 'Order not yet delivered' });
      }

      // Get return policies from platform settings
      const settings = await select('platform_settings', { setting_key: 'admin:settings:return_policies' });
      const policies = settings.length > 0 ? (settings[0].setting_value as any[]) : [];

      // Find applicable policy (simplified - would need more complex matching)
      const policy = policies.find((p: any) => p.global === true) || policies[0];

      if (!policy) {
        return c.json({ eligible: false, message: 'No return policy found' });
      }

      // Check return window
      if (order.delivered_at) {
        const deliveryDate = new Date(order.delivered_at);
        const daysSinceDelivery = Math.floor(
          (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceDelivery > (policy.returnWindow || 7)) {
          return c.json({
            eligible: false,
            message: `Return window expired. Returns allowed within ${policy.returnWindow || 7} days of delivery.`,
          });
        }
      }

      return c.json({
        eligible: true,
        policy,
      });
    } catch (error: any) {
      console.error('Error checking return eligibility:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /returns/create
   * Create return request
   */
  app.post("/returns/create", async (c) => {
    try {
      const returnData = await c.req.json();
      const {
        orderId,
        customerId,
        vendorId,
        items,
        returnReason,
        description,
        images,
        pickupAddress,
      } = returnData;

      if (!orderId || !customerId || !vendorId || !items || !returnReason) {
        return c.json({ error: 'orderId, customerId, vendorId, items, and returnReason are required' }, 400);
      }

      // Create return request
      const returnRequest = await insert('returns', {
        order_id: orderId,
        customer_id: customerId,
        vendor_id: vendorId,
        items: items,
        return_reason: returnReason,
        description: description || null,
        images: images || [],
        status: 'pending',
        pickup_address: pickupAddress || {},
      });

      return c.json({
        success: true,
        returnRequest: returnRequest[0],
        message: 'Return request created successfully',
      });
    } catch (error: any) {
      console.error('Error creating return request:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/returns
   * Create return request (Phase 1 - Mobile Improvements)
   */
  app.post("/customer/returns", async (c) => {
    try {
      const { orderId, items, reason, customerId } = await c.req.json();

      if (!orderId || !items || !reason || !customerId) {
        return c.json({ error: 'orderId, items, reason, and customerId are required' }, 400);
      }

      // Get order details
      const orders = await select('orders', { id: orderId, customer_id: customerId });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Create return request
      const returnRequest = await insert('returns', {
        order_id: orderId,
        customer_id: customerId,
        vendor_id: order.vendor_id,
        items: items,
        return_reason: reason,
        description: null,
        images: [],
        status: 'pending',
        pickup_address: null,
      });

      return c.json({
        success: true,
        returnRequest: returnRequest[0],
        message: 'Return request created successfully',
      });
    } catch (error: any) {
      console.error('Error creating return request:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/returns/:returnId
   * Get return status (Phase 1 - Mobile Improvements)
   */
  app.get("/customer/returns/:returnId", async (c) => {
    try {
      const { returnId } = c.req.param();

      const returns = await select('returns', { id: returnId });
      if (returns.length === 0) {
        return c.json({ error: 'Return not found' }, 404);
      }

      return c.json({
        success: true,
        return: returns[0],
      });
    } catch (error: any) {
      console.error('Error fetching return status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/returns
   * Get return history (Phase 1 - Mobile Improvements)
   */
  app.get("/customer/:customerId/returns", async (c) => {
    try {
      const { customerId } = c.req.param();

      const returns = await query(
        `SELECT * FROM returns 
         WHERE customer_id = $1 
         ORDER BY created_at DESC`,
        [customerId]
      );

      return c.json({
        success: true,
        returns: returns.rows,
        count: returns.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching return history:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/returns/:returnId/cancel
   * Cancel return request (Phase 1 - Mobile Improvements)
   */
  app.post("/customer/returns/:returnId/cancel", async (c) => {
    try {
      const { returnId } = c.req.param();
      const { customerId } = await c.req.json();

      if (!customerId) {
        return c.json({ error: 'customerId is required' }, 400);
      }

      const returns = await select('returns', { id: returnId, customer_id: customerId });
      if (returns.length === 0) {
        return c.json({ error: 'Return not found or unauthorized' }, 404);
      }

      if (returns[0].status !== 'pending') {
        return c.json({ error: 'Only pending returns can be cancelled' }, 400);
      }

      const updated = await update('returns',
        { id: returnId },
        {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        }
      );

      return c.json({
        success: true,
        return: updated[0],
        message: 'Return cancelled successfully',
      });
    } catch (error: any) {
      console.error('Error cancelling return:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /returns/:returnId
   * Get return details
   */
  app.get("/returns/:returnId", async (c) => {
    try {
      const { returnId } = c.req.param();

      const returns = await select('returns', { id: returnId });
      if (returns.length === 0) {
        return c.json({ error: 'Return not found' }, 404);
      }

      return c.json({
        success: true,
        returnRequest: returns[0],
      });
    } catch (error: any) {
      console.error('Error fetching return:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /returns/customer/:customerId
   * Get customer's returns
   */
  app.get("/returns/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      const returns = await query(
        `SELECT * FROM returns
         WHERE customer_id = $1
         ORDER BY created_at DESC`,
        [customerId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        returns: returns.rows,
        total: returns.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer returns:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /returns/:returnId/approve
   * Approve return and schedule pickup
   */
  app.post("/returns/:returnId/approve", async (c) => {
    try {
      const { returnId } = c.req.param();
      const { logisticsPartner } = await c.req.json();

      const returns = await select('returns', { id: returnId });
      if (returns.length === 0) {
        return c.json({ error: 'Return not found' }, 404);
      }

      const returnRequest = returns[0];

      // Update return status
      const updated = await update('returns',
        { id: returnId },
        {
          status: 'approved',
          approved_at: new Date().toISOString(),
          logistics: {
            partner: logisticsPartner || 'shiprocket',
          },
        }
      );

      return c.json({
        success: true,
        returnRequest: updated[0],
        message: 'Return approved. Pickup will be scheduled.',
      });
    } catch (error: any) {
      console.error('Error approving return:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /returns/:returnId/refund
   * Process refund for return
   */
  app.post("/returns/:returnId/refund", async (c) => {
    try {
      const { returnId } = c.req.param();

      const returns = await select('returns', { id: returnId, status: 'received' });
      if (returns.length === 0) {
        return c.json({ error: 'Return not found or not yet received' }, 404);
      }

      const returnRequest = returns[0];

      // Get order
      const orders = await select('orders', { id: returnRequest.order_id });
      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // Parse items JSONB field
      const items = Array.isArray(returnRequest.items) 
        ? returnRequest.items 
        : (typeof returnRequest.items === 'string' ? JSON.parse(returnRequest.items) : []);

      // Calculate refund amount
      const refundAmount = items.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item.price || '0') * (item.quantity || 1));
      }, 0);

      // Process refund via Razorpay
      try {
        const razorpayClient = await getRazorpayClient();
        const refund = await razorpayClient.payments.refund({
          payment_id: order.payment_id || '',
          amount: Math.round(refundAmount * 100), // Convert to paise
        });

        // Update return with refund info
        await update('returns',
          { id: returnId },
          {
            status: 'refunded',
            refund: {
              amount: refundAmount,
              method: 'original_payment',
              status: 'completed',
              transaction_id: refund.id,
            },
            completed_at: new Date().toISOString(),
          }
        );

        // Update order
        await update('orders',
          { id: order.id },
          { order_status: 'refunded' }
        );

        return c.json({
          success: true,
          refund: {
            amount: refundAmount,
            transactionId: refund.id,
            status: 'completed',
          },
          message: 'Refund processed successfully',
        });
      } catch (razorpayError: any) {
        console.error('Razorpay refund error:', razorpayError);
        throw razorpayError;
      }
    } catch (error: any) {
      console.error('Error processing refund:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/returns/policies
   * Get return policies
   */
  app.get("/admin/returns/policies", async (c) => {
    try {
      const settings = await select('platform_settings', { setting_key: 'admin:settings:return_policies' });
      const policies = settings.length > 0 ? (settings[0].setting_value as any[]) : [];

      return c.json({
        success: true,
        policies,
      });
    } catch (error: any) {
      console.error('Error fetching return policies:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/returns/policies
   * Create/update return policy
   */
  app.post("/admin/returns/policies", async (c) => {
    try {
      const policyData = await c.req.json();

      const settings = await select('platform_settings', { setting_key: 'admin:settings:return_policies' });
      const existingPolicies = settings.length > 0 ? (settings[0].setting_value as any[]) : [];

      // Add or update policy
      const policyIndex = existingPolicies.findIndex((p: any) => p.id === policyData.id);
      if (policyIndex >= 0) {
        existingPolicies[policyIndex] = policyData;
      } else {
        existingPolicies.push(policyData);
      }

      await upsert('platform_settings',
        {
          setting_key: 'admin:settings:return_policies',
          setting_value: existingPolicies,
          setting_type: 'json',
          description: 'Return policies configuration',
        },
        'setting_key'
      );

      return c.json({
        success: true,
        message: 'Return policy saved',
      });
    } catch (error: any) {
      console.error('Error saving return policy:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

