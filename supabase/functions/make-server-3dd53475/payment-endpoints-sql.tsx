/**
 * ============================================================================
 * PAYMENT ENDPOINTS - SQL ONLY
 * ============================================================================
 * 
 * REFACTORED: All KV usage removed, uses SQL repositories only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getPaymentsRepository } from "../../lib/repositories/payments.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getWalletsRepository } from "../../lib/repositories/wallets.ts";
import { getRefundsRepository } from "../../lib/repositories/refunds.ts";
import { calculateGST } from "../../lib/services/gst-calculator.ts";
import { withTransaction } from "../../lib/utils/transaction-helper.ts";
import { validateTransition } from "../../lib/services/state-machine-validator.ts";
import { selectQuery } from "../../lib/db.ts";
import { createRazorpayOrder, verifyRazorpayPayment } from "./razorpay-helpers.tsx";

const BASE_PATH = "/make-server-3dd53475";

export function paymentEndpointsSQL(app: Hono) {
  
  /**
   * POST /payments
   * Create payment (SQL only)
   */
  app.post(`${BASE_PATH}/payments`, async (c) => {
    try {
      const paymentData = await c.req.json();
      
      // Validate required fields
      if (!paymentData.customer_id || !paymentData.amount) {
        return sendError(c, 'Missing required fields: customer_id, amount', 400);
      }
      
      // Get customer and vendor
      const customersRepo = getCustomersRepository();
      const vendorsRepo = getVendorsRepository();
      
      const customer = await customersRepo.findById(paymentData.customer_id);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }
      
      let vendor = null;
      if (paymentData.vendor_id) {
        vendor = await vendorsRepo.findById(paymentData.vendor_id);
        if (!vendor) {
          return sendError(c, 'Vendor not found', 404);
        }
      }
      
      // Calculate GST if booking/service info provided
      let gstAmount = 0;
      let subtotal = paymentData.amount;
      
      if (paymentData.booking_id || (vendor && paymentData.service_type)) {
        const gst = await calculateGST({
          amount: subtotal,
          roleId: vendor?.role_id,
          serviceStyle: paymentData.service_type || 'at_center',
          customerState: customer.state,
          vendorState: vendor?.state
        });
        gstAmount = gst.gstAmount;
        subtotal = gst.subtotal;
      }
      
      const totalAmount = subtotal + gstAmount;
      
      // Create payment
      const paymentsRepo = getPaymentsRepository();
      const payment = await paymentsRepo.create({
        customer_id: paymentData.customer_id,
        vendor_id: paymentData.vendor_id || null,
        booking_id: paymentData.booking_id || null,
        order_id: paymentData.order_id || null,
        amount: totalAmount,
        payment_method: paymentData.payment_method || 'razorpay',
        payment_status: 'pending',
        discount_amount: paymentData.discount_amount || 0,
        coupon_code: paymentData.coupon_code || null,
        wallet_amount_used: paymentData.wallet_amount_used || 0,
        loyalty_points_used: paymentData.loyalty_points_used || 0
      });
      
      // If using wallet, deduct from wallet atomically
      if (paymentData.wallet_amount_used > 0) {
        await withTransaction(async (txClient) => {
          const walletsRepo = getWalletsRepository();
          const wallet = await walletsRepo.findOrCreate(paymentData.customer_id);
          await walletsRepo.addTransaction({
            wallet_id: wallet.id,
            customer_id: paymentData.customer_id,
            transaction_type: 'debit',
            amount: paymentData.wallet_amount_used,
            purpose: 'payment',
            description: 'Payment for booking/order',
            reference_id: payment.id
          });
        });
      }
      
      // If Razorpay, create order
      if (paymentData.payment_method === 'razorpay') {
        const razorpayOrder = await createRazorpayOrder({
          amount: totalAmount * 100, // Convert to paise
          currency: 'INR',
          receipt: `payment_${payment.id}`
        });
        
        await paymentsRepo.update(payment.id, {
          razorpay_order_id: razorpayOrder.id
        });
        
        return sendSuccess(c, {
          payment: { ...payment, razorpay_order_id: razorpayOrder.id },
          razorpay_order: razorpayOrder
        }, 'Payment created');
      }
      
      // Log audit
      await selectQuery(
        "SELECT create_audit_log($1, $2, $3, $4, $5, $6)",
        [
          'payment_created',
          'payment',
          payment.id,
          paymentData.customer_id,
          'customer',
          JSON.stringify({ amount: totalAmount, method: paymentData.payment_method })
        ]
      );
      
      return sendSuccess(c, { payment }, 'Payment created');
    } catch (error) {
      console.error('❌ [PAYMENT] Error creating payment:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * POST /payments/:paymentId/verify
   * Verify payment (Razorpay)
   */
  app.post(`${BASE_PATH}/payments/:paymentId/verify`, async (c) => {
    try {
      const { paymentId } = c.req.param();
      const { razorpay_payment_id, razorpay_signature } = await c.req.json();
      
      const paymentsRepo = getPaymentsRepository();
      const payment = await paymentsRepo.findById(paymentId);
      
      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }
      
      // Verify Razorpay signature
      const isValid = await verifyRazorpayPayment({
        razorpay_order_id: payment.razorpay_order_id || '',
        razorpay_payment_id,
        razorpay_signature
      });
      
      if (!isValid) {
        return sendError(c, 'Invalid payment signature', 400);
      }
      
      // Validate transition
      const canTransition = await validatePaymentTransition(
        payment.payment_status,
        'completed'
      );
      
      if (!canTransition) {
        return sendError(c, 'Invalid payment status transition', 400);
      }
      
      // Update payment
      const updated = await paymentsRepo.update(paymentId, {
        payment_status: 'completed',
        razorpay_payment_id,
        razorpay_signature,
        completed_at: new Date().toISOString()
      });
      
      // Update booking if exists
      if (payment.booking_id) {
        const bookingsRepo = getBookingsRepository();
        await bookingsRepo.update(payment.booking_id, {
          payment_status: 'paid',
          payment_id: paymentId
        });
      }
      
      // Log transaction
      await selectQuery(
        "INSERT INTO payment_transaction_log (payment_id, transaction_type, old_status, new_status, amount) VALUES ($1, $2, $3, $4, $5)",
        [paymentId, 'complete', payment.payment_status, 'completed', payment.amount]
      );
      
      return sendSuccess(c, { payment: updated }, 'Payment verified');
    } catch (error) {
      console.error('❌ [PAYMENT] Error verifying payment:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * POST /payments/:paymentId/refund
   * Process refund (SQL only)
   */
  app.post(`${BASE_PATH}/payments/:paymentId/refund`, async (c) => {
    try {
      const { paymentId } = c.req.param();
      const { amount, reason, refund_method } = await c.req.json();
      
      const paymentsRepo = getPaymentsRepository();
      const payment = await paymentsRepo.findById(paymentId);
      
      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }
      
      if (payment.payment_status !== 'completed') {
        return sendError(c, 'Can only refund completed payments', 400);
      }
      
      const refundAmount = amount || payment.amount;
      
      // Process refund atomically
      const refundsRepo = getRefundsRepository();
      const { payment: updatedPayment, refund } = await withTransaction(async (txClient) => {
        // Create refund record
        const refund = await refundsRepo.create({
          payment_id: paymentId,
          booking_id: payment.booking_id,
          customer_id: payment.customer_id,
          vendor_id: payment.vendor_id,
          refund_amount: refundAmount,
          refund_reason: reason || 'Customer request',
          refund_status: 'pending'
        });
        
        // Update payment status
        const updatedPayment = await paymentsRepo.update(paymentId, {
          payment_status: payment.payment_status === 'completed' ? 'partially_refunded' : 'refunded'
        });
        
        return { payment: updatedPayment, refund };
      });
      
      // If refund to wallet, credit wallet atomically
      if (refund_method === 'wallet') {
        await withTransaction(async (txClient) => {
          const walletsRepo = getWalletsRepository();
          const wallet = await walletsRepo.findOrCreate(payment.customer_id);
          await walletsRepo.addTransaction({
            wallet_id: wallet.id,
            customer_id: payment.customer_id,
            transaction_type: 'credit',
            amount: refundAmount,
            source: 'refund',
            description: `Refund for payment ${paymentId}`,
            reference_id: refund.id
          });
        });
      }
      
      return sendSuccess(c, { payment: updatedPayment, refund }, 'Refund processed');
    } catch (error) {
      console.error('❌ [PAYMENT] Error processing refund:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * GET /payments/:paymentId
   * Get payment by ID
   */
  app.get(`${BASE_PATH}/payments/:paymentId`, async (c) => {
    try {
      const { paymentId } = c.req.param();
      
      const paymentsRepo = getPaymentsRepository();
      const payment = await paymentsRepo.findById(paymentId);
      
      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }
      
      return sendSuccess(c, { payment }, 'Payment retrieved');
    } catch (error) {
      console.error('❌ [PAYMENT] Error getting payment:', error);
      return sendError(c, error, 500);
    }
  });
}

