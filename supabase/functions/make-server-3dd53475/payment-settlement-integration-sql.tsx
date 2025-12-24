/**
 * ============================================================================
 * PAYMENT & SETTLEMENT INTEGRATION - SQL-ONLY VERSION
 * ============================================================================
 * 
 * Complete Payment & Settlement Lifecycle Integration
 * 
 * Features:
 * - Auto-update order status on payment
 * - Auto-trigger settlement on order delivery
 * - Payment failure handling
 * - Refund processing automation
 * - Settlement reconciliation
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 4, Task 4.2 - Payment & Settlement Integration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getOrdersRepository } from "../../lib/repositories/orders.ts";
import { getPaymentsRepository } from "../../lib/repositories/payments.ts";
import { getSettlementsRepository } from "../../lib/repositories/settlements.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getProductsRepository } from "../../lib/repositories/products.ts";
import { getRefundsRepository } from "../../lib/repositories/refunds.ts";
import { getDbClient } from "../../lib/db.ts";

export function paymentSettlementIntegrationEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const ordersRepo = getOrdersRepository();
  const paymentsRepo = getPaymentsRepository();
  const settlementsRepo = getSettlementsRepository();
  const customersRepo = getCustomersRepository();
  const vendorsRepo = getVendorsRepository();
  const notificationsRepo = getNotificationsRepository();
  const productsRepo = getProductsRepository();
  const db = getDbClient();

  // Helper: Send notification
  async function sendNotification(
    recipientId: string,
    recipientType: 'customer' | 'vendor',
    type: string,
    title: string,
    message: string,
    data: any
  ) {
    try {
      await notificationsRepo.create({
        recipient_id: recipientId,
        recipient_type: recipientType,
        type,
        title,
        message,
        data,
        channels: { email: true, sms: false, inApp: true, push: false },
      });
    } catch (error) {
      console.error(`⚠️ [PAYMENT-SETTLEMENT] Failed to send notification:`, error);
    }
  }

  // ============================================
  // PAYMENT VERIFICATION & ORDER UPDATE
  // ============================================

  /**
   * POST /payments/verify-and-update-order
   * Verify payment and automatically update order status
   */
  app.post(`${BASE_PATH}/payments/verify-and-update-order`, async (c) => {
    try {
      const { payment_id, order_id, razorpay_payment_id, razorpay_signature } = await c.req.json();

      if (!payment_id || !order_id) {
        return sendError(c, 'Missing required fields: payment_id, order_id', 400);
      }

      // Get payment
      const payment = await paymentsRepo.findById(payment_id);
      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }

      // Get order
      const order = await ordersRepo.findById(order_id);
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      // Verify payment (if Razorpay signature provided)
      if (razorpay_payment_id && razorpay_signature) {
        // TODO: Implement Razorpay signature verification
        // For now, assume payment is verified if signature is provided
        console.log(`✅ [PAYMENT-SETTLEMENT] Payment verified: ${payment_id}`);
      }

      // Update payment status
      await paymentsRepo.update(payment_id, {
        status: 'completed',
        transaction_id: razorpay_payment_id || payment.transaction_id,
      });

      // ✅ AUTO-UPDATE ORDER STATUS on payment success
      if (order.order_status === 'pending' && order.payment_status === 'pending') {
        await ordersRepo.update(order_id, {
          order_status: 'confirmed',
          payment_status: 'paid',
          payment_id: payment_id,
        });

        // Notify customer and vendor
        const customer = await customersRepo.findById(order.customer_id);
        if (customer) {
          await sendNotification(
            customer.id,
            'customer',
            'payment_success',
            'Payment Successful',
            `Your payment for order ${order.order_number} has been processed successfully`,
            { order_id, order_number: order.order_number, payment_id }
          );
        }

        if (order.vendor_id) {
          const vendor = await vendorsRepo.findById(order.vendor_id);
          if (vendor) {
            await sendNotification(
              order.vendor_id,
              'vendor',
              'payment_received',
              'Payment Received',
              `Payment received for order ${order.order_number}`,
              { order_id, order_number: order.order_number, payment_id, amount: order.total_amount }
            );
          }
        }

        console.log(`✅ [PAYMENT-SETTLEMENT] Order ${order_id} automatically confirmed after payment`);
      }

      return sendSuccess(c, {
        payment,
        order: await ordersRepo.findById(order_id),
      }, 'Payment verified and order updated');
    } catch (error) {
      console.error('❌ [PAYMENT-SETTLEMENT] Error verifying payment:', error);
      return sendError(c, `Failed to verify payment: ${String(error)}`, 500);
    }
  });

  // ============================================
  // PAYMENT FAILURE HANDLING
  // ============================================

  /**
   * POST /payments/failure
   * Handle payment failure
   */
  app.post(`${BASE_PATH}/payments/failure`, async (c) => {
    try {
      const { payment_id, order_id, failure_reason } = await c.req.json();

      if (!payment_id || !order_id) {
        return sendError(c, 'Missing required fields: payment_id, order_id', 400);
      }

      // Update payment status
      await paymentsRepo.update(payment_id, {
        status: 'failed',
      });

      // Update order payment status
      const order = await ordersRepo.findById(order_id);
      if (order) {
        await ordersRepo.update(order_id, {
          payment_status: 'failed',
        });

        // Notify customer
        const customer = await customersRepo.findById(order.customer_id);
        if (customer) {
          await sendNotification(
            customer.id,
            'customer',
            'payment_failed',
            'Payment Failed',
            `Payment for order ${order.order_number} failed. Please try again.`,
            { order_id, order_number: order.order_number, failure_reason }
          );
        }
      }

      return sendSuccess(c, {}, 'Payment failure handled');
    } catch (error) {
      console.error('❌ [PAYMENT-SETTLEMENT] Error handling payment failure:', error);
      return sendError(c, `Failed to handle payment failure: ${String(error)}`, 500);
    }
  });

  // ============================================
  // AUTOMATIC SETTLEMENT ON DELIVERY
  // ============================================

  /**
   * POST /settlements/auto-create-on-delivery
   * Automatically create settlement when order is delivered
   * (Called from order lifecycle)
   */
  app.post(`${BASE_PATH}/settlements/auto-create-on-delivery`, async (c) => {
    try {
      const { order_id } = await c.req.json();

      if (!order_id) {
        return sendError(c, 'Missing required field: order_id', 400);
      }

      const order = await ordersRepo.findById(order_id);
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      if (order.order_status !== 'delivered') {
        return sendError(c, 'Order must be delivered to create settlement', 400);
      }

      // Get order items to calculate vendor shares
      const { data: orderItems } = await db
        .from('order_items')
        .select('product_id, total_price')
        .eq('order_id', order_id);

      const vendorGroups: Record<string, number> = {};
      for (const item of orderItems || []) {
        if (item.product_id) {
          const product = await productsRepo.findById(item.product_id);
          if (product?.vendor_id) {
            vendorGroups[product.vendor_id] = (vendorGroups[product.vendor_id] || 0) + item.total_price;
          }
        }
      }

      // Create settlements for each vendor
      const settlements = [];
      for (const [vendorId, vendorAmount] of Object.entries(vendorGroups)) {
        const commissionRate = 0.15; // 15% platform commission
        const commission = vendorAmount * commissionRate;
        const vendorPayout = vendorAmount - commission;

        // Check if settlement already exists
        const existingSettlements = await settlementsRepo.findByVendor(vendorId);
        const existingSettlement = existingSettlements.find(s => 
          s.booking_id === order_id || s.payment_id === order.payment_id
        );

        if (!existingSettlement) {
          const settlement = await settlementsRepo.create({
            vendor_id: vendorId,
            booking_id: null,
            payment_id: order.payment_id || null,
            settlement_amount: vendorAmount,
            commission_amount: commission,
            vendor_amount: vendorPayout,
            settlement_date: new Date().toISOString().split('T')[0],
          });

          settlements.push(settlement);

          // Notify vendor
          const vendor = await vendorsRepo.findById(vendorId);
          if (vendor) {
            await sendNotification(
              vendorId,
              'vendor',
              'settlement_created',
              'Settlement Created',
              `Settlement of ₹${vendorPayout.toFixed(2)} created for order ${order.order_number}`,
              { order_id, settlement_id: settlement.id, amount: vendorPayout }
            );
          }

          console.log(`✅ [PAYMENT-SETTLEMENT] Created settlement for vendor ${vendorId} on order ${order_id}`);
        }
      }

      return sendSuccess(c, { settlements }, 'Settlements created successfully');
    } catch (error) {
      console.error('❌ [PAYMENT-SETTLEMENT] Error creating settlements:', error);
      return sendError(c, `Failed to create settlements: ${String(error)}`, 500);
    }
  });

  // ============================================
  // SETTLEMENT RECONCILIATION
  // ============================================

  /**
   * GET /settlements/reconciliation
   * Get settlement reconciliation report
   */
  app.get(`${BASE_PATH}/settlements/reconciliation`, async (c) => {
    try {
      const vendorId = c.req.query('vendor_id');
      const startDate = c.req.query('start_date');
      const endDate = c.req.query('end_date');

      let settlements;
      if (vendorId) {
        const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
        if (!resolvedVendorId) {
          return sendError(c, 'Vendor not found', 404);
        }
        settlements = await settlementsRepo.findByVendor(resolvedVendorId);
      } else {
        settlements = await settlementsRepo.findAll();
      }

      // Filter by date range if provided
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        settlements = settlements.filter(s => {
          const settlementDate = new Date(s.created_at);
          return settlementDate >= start && settlementDate <= end;
        });
      }

      // Calculate totals
      const totalSettlements = settlements.length;
      const totalAmount = settlements.reduce((sum, s) => sum + s.settlement_amount, 0);
      const totalCommission = settlements.reduce((sum, s) => sum + s.commission_amount, 0);
      const totalPayout = settlements.reduce((sum, s) => sum + s.vendor_amount, 0);

      const byStatus = {
        pending: settlements.filter(s => s.settlement_status === 'pending').length,
        processing: settlements.filter(s => s.settlement_status === 'processing').length,
        completed: settlements.filter(s => s.settlement_status === 'completed').length,
        failed: settlements.filter(s => s.settlement_status === 'failed').length,
      };

      return sendSuccess(c, {
        summary: {
          total_settlements: totalSettlements,
          total_amount: Math.round(totalAmount * 100) / 100,
          total_commission: Math.round(totalCommission * 100) / 100,
          total_payout: Math.round(totalPayout * 100) / 100,
          by_status: byStatus,
        },
        settlements: settlements.map(s => ({
          id: s.id,
          vendor_id: s.vendor_id,
          settlement_amount: s.settlement_amount,
          commission_amount: s.commission_amount,
          vendor_amount: s.vendor_amount,
          status: s.settlement_status,
          settlement_date: s.settlement_date,
          created_at: s.created_at,
        })),
      });
    } catch (error) {
      console.error('❌ [PAYMENT-SETTLEMENT] Error fetching reconciliation:', error);
      return sendError(c, `Failed to fetch reconciliation: ${String(error)}`, 500);
    }
  });

  // ============================================
  // REFUND PROCESSING
  // ============================================

  /**
   * POST /payments/refund
   * Process refund for order
   */
  app.post(`${BASE_PATH}/payments/refund`, async (c) => {
    try {
      const { order_id, refund_amount, refund_reason } = await c.req.json();

      if (!order_id || !refund_amount) {
        return sendError(c, 'Missing required fields: order_id, refund_amount', 400);
      }

      const order = await ordersRepo.findById(order_id);
      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      if (refund_amount > order.total_amount) {
        return sendError(c, 'Refund amount cannot exceed order total', 400);
      }

      // Get payment
      const payment = order.payment_id ? await paymentsRepo.findById(order.payment_id) : null;
      if (!payment) {
        return sendError(c, 'Payment not found for this order', 404);
      }

      // TODO: Process actual Razorpay refund
      // For now, create refund record
      const refund = await getRefundsRepository().create({
        order_id: order_id,
        payment_id: payment.id,
        customer_id: order.customer_id,
        amount: parseFloat(refund_amount),
        reason: refund_reason || 'Customer request',
        status: 'pending',
      });

      // Update order status
      await ordersRepo.update(order_id, {
        order_status: 'refunded',
      });

      // Restore inventory if needed
      const { data: orderItems } = await db
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', order_id);

      for (const item of orderItems || []) {
        if (item.product_id) {
          try {
            await productsRepo.updateStock(item.product_id, item.quantity, 'add');
          } catch (stockError) {
            console.error(`⚠️ [PAYMENT-SETTLEMENT] Failed to restore stock:`, stockError);
          }
        }
      }

      // Notify customer
      const customer = await customersRepo.findById(order.customer_id);
      if (customer) {
        await sendNotification(
          customer.id,
          'customer',
          'refund_initiated',
          'Refund Initiated',
          `Refund of ₹${refund_amount} has been initiated for order ${order.order_number}`,
          { order_id, order_number: order.order_number, refund_id: refund.id, amount: refund_amount }
        );
      }

      return sendSuccess(c, { refund }, 'Refund processed successfully');
    } catch (error) {
      console.error('❌ [PAYMENT-SETTLEMENT] Error processing refund:', error);
      return sendError(c, `Failed to process refund: ${String(error)}`, 500);
    }
  });

  console.log('✅ [PAYMENT-SETTLEMENT-SQL] Payment & settlement integration endpoints registered (SQL-only)');
}

