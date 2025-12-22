/**
 * ============================================================================
 * PAYMENT ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { createRazorpayOrder, verifyRazorpaySignature, fetchRazorpayPayment } from "./razorpay-integration.tsx";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getPaymentsRepository } from "../../lib/repositories/payments.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getOrdersRepository } from "../../lib/repositories/orders.ts";
import { getRefundsRepository } from "../../lib/repositories/refunds.ts";
import { getPayoutsRepository } from "../../lib/repositories/payouts.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { withTransaction } from "../../lib/db.ts";

/**
 * SQL-ONLY Payment Endpoints
 * 
 * ❌ NO KV USAGE - All operations use SQL repositories
 */
export function paymentEndpoints(app: Hono) {
  
  // Helper: Trigger Notification using SQL repository
  async function triggerNotification(notification: {
    recipientId: string;
    recipientType: 'customer' | 'vendor' | 'staff' | 'admin';
    type: string;
    title: string;
    message: string;
    channels?: any;
    data?: any;
  }) {
    try {
      await getNotificationsRepository().create({
        recipient_type: notification.recipientType,
        recipient_id: notification.recipientId,
        notification_type: notification.type,
        title: notification.title,
        message: notification.message,
        channels: notification.channels || { email: true, sms: true, inApp: true, push: false },
        data: notification.data,
      });
      
      console.log(`📨 Notification created for ${notification.recipientType}:${notification.recipientId}`);
      
      // TODO: Integrate with AWS SNS/SES for email/SMS delivery
      // This should be done via a background job or separate service
    } catch (e) {
      console.error('Failed to create notification:', e);
    }
  }

  // ============================================
  // PAYMENT & WALLET ENDPOINTS
  // ============================================
  
  /**
   * Initiate payment (Create Payment Intent) - REAL RAZORPAY
   * POST /make-server-3dd53475/ecommerce/payments/initiate
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/ecommerce/payments/initiate", async (c) => {
    try {
      const { 
        bookingId, 
        orderId, 
        customerId, 
        vendorId, 
        amount, 
        paymentMethod,
        discounts,
        couponCode,
        promotionId,
        loyaltyPointsUsed,
        tierName,
        originalAmount,
        walletUsed
      } = await c.req.json();

      if ((!bookingId && !orderId) || !amount) {
        return sendError(c, 'Missing required fields: bookingId or orderId, and amount', 400);
      }

      // ✅ GAP #7 FIX: Validate amount against actual service/order prices
      let validatedAmount = amount;
      let validationDetails: any = {};

      if (bookingId) {
        console.log(`💰 [PAYMENT] Validating amount for booking: ${bookingId}`);
        
        // ✅ SQL: Get booking from repository
        const booking = await getBookingsRepository().findById(bookingId);
        if (!booking) {
          console.error(`❌ [PAYMENT] Booking not found: ${bookingId}`);
          return sendError(c, 'Booking not found', 404);
        }

        // Fetch actual service price from catalog
        let actualPrice = 0;
        
        if (booking.service_id) {
          // Check if it's a staff service first
          if (booking.staff_id) {
            // ✅ SQL: Get staff services from repository
            const staffServices = await getStaffRepository().getStaffServices(booking.staff_id);
            const staffService = staffServices.find((s: any) => 
              s.service_id === booking.service_id
            );
            
            if (staffService && staffService.price) {
              actualPrice = staffService.price;
              validationDetails.source = 'staff_service';
              validationDetails.staffId = booking.staff_id;
              console.log(`✅ [PAYMENT] Found staff service price: ₹${actualPrice}`);
            }
          }
          
          // Fallback to vendor service
          if (actualPrice === 0) {
            // ✅ SQL: Get service from repository
            const service = await getServicesRepository().findById(booking.service_id);
            if (service) {
              actualPrice = service.price;
              validationDetails.source = 'vendor_service';
              console.log(`✅ [PAYMENT] Found vendor service price: ₹${actualPrice}`);
            }
          }
        }
        
        // Handle package bookings
        if (booking.is_package && booking.package_details) {
          const packageDetails = typeof booking.package_details === 'string' 
            ? JSON.parse(booking.package_details) 
            : booking.package_details;
          actualPrice = packageDetails.totalPrice || packageDetails.price || 0;
          validationDetails.source = 'package';
          console.log(`✅ [PAYMENT] Package price: ₹${actualPrice}`);
        }

        // Price validation with tolerance (for rounding, taxes, etc.)
        const tolerance = 1; // ₹1 tolerance for rounding
        const priceDifference = Math.abs(actualPrice - amount);
        
        if (actualPrice > 0 && priceDifference > tolerance) {
          console.error(`❌ [PAYMENT] Price mismatch! Actual: ₹${actualPrice}, Requested: ₹${amount}, Diff: ₹${priceDifference}`);
          return sendError(c, `Price validation failed. Expected: ₹${actualPrice}, Got: ₹${amount}`, 400);
        }
        
        validatedAmount = actualPrice > 0 ? actualPrice : amount;
        validationDetails.requestedAmount = amount;
        validationDetails.actualPrice = actualPrice;
        validationDetails.priceDifference = priceDifference;
        
        console.log(`✅ [PAYMENT] Price validated: ₹${validatedAmount}`, validationDetails);
        
      } else if (orderId) {
        // Marketplace order validation
        console.log(`🛒 [PAYMENT] Validating amount for order: ${orderId}`);
        
        // ✅ SQL: Get order from repository
        const order = await getOrdersRepository().findById(orderId);
        if (!order) {
          console.error(`❌ [PAYMENT] Order not found: ${orderId}`);
          return sendError(c, 'Order not found', 404);
        }
        
        const actualTotal = order.total_amount;
        const tolerance = 1;
        const priceDifference = Math.abs(actualTotal - amount);
        
        if (actualTotal > 0 && priceDifference > tolerance) {
          console.error(`❌ [PAYMENT] Order price mismatch! Actual: ₹${actualTotal}, Requested: ₹${amount}`);
          return sendError(c, `Price validation failed. Expected: ₹${actualTotal}, Got: ₹${amount}`, 400);
        }
        
        validatedAmount = actualTotal > 0 ? actualTotal : amount;
        validationDetails.requestedAmount = amount;
        validationDetails.actualTotal = actualTotal;
        validationDetails.validatedAmount = validatedAmount;
        validationDetails.priceDifference = priceDifference;
        
        console.log(`✅ [PAYMENT] Order price validated: ₹${validatedAmount}`, validationDetails);
      }

      // Create REAL Razorpay Order with VALIDATED amount
      let razorpayOrder;
      try {
        razorpayOrder = await createRazorpayOrder(validatedAmount, bookingId, orderId);
      } catch (error) {
        console.error('❌ Razorpay order creation failed:', error);
        return sendError(c, 'Payment gateway error. Please try again.', 500);
      }
      
      // ✅ SQL: Create payment record in database
      const payment = await getPaymentsRepository().create({
        booking_id: bookingId || undefined,
        order_id: orderId || undefined,
        customer_id: customerId,
        vendor_id: vendorId || undefined,
        amount: validatedAmount,
        payment_method: paymentMethod || 'razorpay',
        discount_amount: discounts?.total || 0,
        coupon_code: couponCode || undefined,
        promotion_id: promotionId || undefined,
        loyalty_points_used: loyaltyPointsUsed || 0,
        wallet_amount_used: walletUsed || 0,
        razorpay_order_id: razorpayOrder.id,
      });

      console.log(`⏳ Payment Initiated with Razorpay: ${payment.id} | Order: ${razorpayOrder.id} | Validated Amount: ₹${validatedAmount}`);

      return sendSuccess(c, { 
        paymentId: payment.id, 
        orderId: razorpayOrder.id,
        amount: validatedAmount,
        currency: 'INR',
        key: Deno.env.get('RAZORPAY_KEY_ID') // Real Razorpay Key for frontend
      });
    } catch (error) {
      console.error('Payment initiation error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Verify Payment (Complete Transaction) - REAL RAZORPAY
   * POST /make-server-3dd53475/payments/verify
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/ecommerce/payments/verify", async (c) => {
    try {
      const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = await c.req.json();

      // ✅ SQL: Get payment from repository
      const payment = await getPaymentsRepository().findById(paymentId);
      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }

      // Verify REAL Razorpay Signature
      const isSignatureValid = await verifyRazorpaySignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );
      
      if (!isSignatureValid) {
        console.error('❌ Invalid Razorpay signature');
        await getPaymentsRepository().fail(paymentId, 'Invalid signature');
        return sendError(c, 'Invalid payment signature', 400);
      }
      
      // ✅ SQL: Update payment status to completed
      const updatedPayment = await getPaymentsRepository().complete(
        paymentId,
        razorpayPaymentId
      );

      // ✅ SQL: Update booking status if booking exists
      if (payment.booking_id) {
        const booking = await getBookingsRepository().findById(payment.booking_id);
        if (booking) {
          await getBookingsRepository().update(payment.booking_id, {
            payment_status: 'paid',
            payment_id: paymentId,
            status: 'confirmed',
          });
        }
      }

      // ✅ SQL: Get customer and vendor for notifications
      const customer = await getCustomersRepository().findById(payment.customer_id);
      const vendor = payment.vendor_id 
        ? await getVendorsRepository().findById(payment.vendor_id)
        : null;

      // ✅ SQL: Create notifications
      if (customer) {
        await triggerNotification({
          recipientId: payment.customer_id,
          recipientType: 'customer',
          type: 'payment_success',
          title: 'Payment Successful',
          message: `Payment of ₹${payment.amount} received successfully! Booking ID: ${payment.booking_id || 'N/A'}. Thank you!`,
          channels: { email: true, sms: true, inApp: true, push: false },
          data: { 
            paymentId, 
            bookingId: payment.booking_id, 
            amount: payment.amount, 
            transactionId: razorpayPaymentId 
          },
        });
      }

      if (vendor) {
        const vendorAmount = payment.amount * 0.9; // 10% commission
        const commission = payment.amount * 0.1;
        
        await triggerNotification({
          recipientId: payment.vendor_id!,
          recipientType: 'vendor',
          type: 'payment_received',
          title: 'Payment Received',
          message: `Received payment of ₹${vendorAmount} for booking ${payment.booking_id || 'N/A'}. Platform commission: ₹${commission}`,
          channels: { email: true, sms: false, inApp: true, push: false },
          data: { 
            paymentId, 
            bookingId: payment.booking_id, 
            vendorAmount, 
            commission 
          },
        });
      }

      console.log(`✅ Razorpay Payment Verified: ${paymentId} | ${razorpayPaymentId}`);
      return sendSuccess(c, { payment: updatedPayment, success: true });

    } catch (error) {
      console.error('Payment verification error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Process payment for booking
   * POST /make-server-3dd53475/payments/process
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/ecommerce/payments/process", async (c) => {
    try {
      const {
        bookingId,
        customerId,
        vendorId,
        amount,
        paymentMethod,
        commission
      } = await c.req.json();

      if (!bookingId || !customerId || !vendorId || !amount || !paymentMethod) {
        return sendError(c, 'Missing required fields', 400);
      }

      // Calculate commission (default 10%)
      const commissionRate = commission || 10;
      const platformCommission = (amount * commissionRate) / 100;
      const vendorAmount = amount - platformCommission;

      // ✅ SQL: Create payment record
      const payment = await getPaymentsRepository().create({
        booking_id: bookingId,
        customer_id: customerId,
        vendor_id: vendorId,
        amount,
        payment_method: paymentMethod,
      });

      // ✅ SQL: Complete payment
      const completedPayment = await getPaymentsRepository().complete(payment.id);

      // ✅ SQL: Update booking payment status
      if (bookingId) {
        await getBookingsRepository().update(bookingId, {
          payment_status: 'paid',
          payment_id: payment.id,
        });
      }

      // ✅ SQL: Update platform revenue (via repository or direct update)
      // TODO: Create platform_revenue repository or update directly
      const client = getDbClient();
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await client
        .from('platform_revenue')
        .select('*')
        .eq('revenue_date', today)
        .maybeSingle();
      
      if (existing) {
        await client
          .from('platform_revenue')
          .update({
            total_revenue: (existing.total_revenue || 0) + amount,
            commission_revenue: (existing.commission_revenue || 0) + platformCommission,
          })
          .eq('id', existing.id);
      } else {
        await client
          .from('platform_revenue')
          .insert({
            revenue_date: today,
            total_revenue: amount,
            commission_revenue: platformCommission,
            transaction_fees: 0,
          });
      }

      console.log(`✅ Payment processed: ${payment.id}`);
      return sendSuccess(c, { paymentId: payment.id, payment: completedPayment });
    } catch (error) {
      console.error('Error processing payment:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get payment details
   * GET /make-server-3dd53475/payments/:paymentId
   * 
   * REFACTORED: Uses SQL repository instead of KV
   */
  app.get("/make-server-3dd53475/ecommerce/payments/:paymentId", async (c) => {
    try {
      const { paymentId } = c.req.param();
      
      // ✅ SQL: Get payment from repository
      const payment = await getPaymentsRepository().findById(paymentId);
      
      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }
      
      return sendSuccess(c, { payment });
    } catch (error) {
      console.error('Error getting payment:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Process refund
   * POST /make-server-3dd53475/payments/:paymentId/refund
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/ecommerce/payments/:paymentId/refund", async (c) => {
    try {
      const { paymentId } = c.req.param();
      const { amount, reason, refundedBy } = await c.req.json();

      // ✅ SQL: Get payment from repository
      const payment = await getPaymentsRepository().findById(paymentId);
      
      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }

      if (payment.payment_status === 'refunded') {
        return sendError(c, 'Payment already refunded', 400);
      }

      const refundAmount = amount || payment.amount;

      // ✅ SQL: Create refund record
      const refund = await getRefundsRepository().create({
        payment_id: paymentId,
        booking_id: payment.booking_id || undefined,
        customer_id: payment.customer_id,
        vendor_id: payment.vendor_id || undefined,
        refund_amount: refundAmount,
        refund_reason: reason || 'Customer request',
      });

      // ✅ SQL: Update payment status
      await getPaymentsRepository().update(paymentId, {
        payment_status: 'refunded',
      });

      // ✅ SQL: Update booking if exists
      if (payment.booking_id) {
        await getBookingsRepository().update(payment.booking_id, {
          payment_status: 'refunded',
        });
      }

      // ✅ SQL: Complete refund
      const completedRefund = await getRefundsRepository().complete(refund.id);

      console.log(`✅ Refund processed: ${refund.id}`);
      return sendSuccess(c, { refundId: refund.id, refund: completedRefund });
    } catch (error) {
      console.error('Error processing refund:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get customer's payment history
   * GET /make-server-3dd53475/payments/customer/:customerId
   * 
   * REFACTORED: Uses SQL repository instead of KV
   */
  app.get("/make-server-3dd53475/ecommerce/payments/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      
      // ✅ SQL: Get payments from repository
      const payments = await getPaymentsRepository().findByCustomer(customerId);
      
      return sendSuccess(c, { payments, total: payments.length });
    } catch (error) {
      console.error('Error getting customer payments:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get vendor's payment history
   * GET /make-server-3dd53475/payments/vendor/:vendorId
   * 
   * REFACTORED: Uses SQL repository instead of KV
   */
  app.get("/make-server-3dd53475/ecommerce/payments/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get payments from repository
      const payments = await getPaymentsRepository().findByVendor(vendorId);
      
      return sendSuccess(c, { payments, total: payments.length });
    } catch (error) {
      console.error('Error getting vendor payments:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get vendor's earnings summary
   * GET /make-server-3dd53475/payments/vendor/:vendorId/earnings
   * 
   * REFACTORED: Uses SQL repository instead of KV
   */
  app.get("/make-server-3dd53475/ecommerce/payments/vendor/:vendorId/earnings", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Verify vendor exists
      const vendor = await getVendorsRepository().findById(vendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // ✅ SQL: Get all completed payments for vendor
      const payments = await getPaymentsRepository().findByVendor(vendorId, {
        status: 'completed',
      });
      
      let totalEarnings = 0;
      let pendingPayout = 0;
      let paidOut = 0;
      
      // Calculate earnings from payments
      for (const payment of payments) {
        if (payment.payment_status === 'completed') {
          const vendorAmount = payment.amount * 0.9; // 10% commission
          totalEarnings += vendorAmount;
          
          // Check if payment has been paid out
          // TODO: Query payouts table to check if payment is included in a payout
          pendingPayout += vendorAmount; // Simplified - should check payout status
        }
      }
      
      return sendSuccess(c, { 
        earnings: {
          total: totalEarnings,
          pending: pendingPayout,
          paidOut: paidOut
        }
      });
    } catch (error) {
      console.error('Error getting vendor earnings:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Process vendor payout
   * POST /make-server-3dd53475/payments/vendor/:vendorId/payout
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/ecommerce/payments/vendor/:vendorId/payout", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { amount, bankDetails, processedBy } = await c.req.json();

      // ✅ SQL: Verify vendor exists
      const vendor = await getVendorsRepository().findById(vendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // ✅ SQL: Get vendor bank details
      const client = getDbClient();
      const { data: bankDetail } = await client
        .from('vendor_bank_details')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (!bankDetail) {
        return sendError(c, 'Vendor bank details not found', 404);
      }

      // Get pending payments for this vendor
      const pendingPayments = await getPaymentsRepository().findByVendor(vendorId, {
        status: 'completed',
      });

      // Calculate total pending amount
      const totalPending = pendingPayments.reduce((sum, p) => {
        return sum + (p.amount * 0.9); // 10% commission
      }, 0);

      if (totalPending < amount) {
        return sendError(c, 'Insufficient pending payout', 400);
      }

      // ✅ SQL: Create payout record
      const paymentIds = pendingPayments.map(p => p.id);
      const payout = await getPayoutsRepository().create({
        vendor_id: vendorId,
        amount,
        bank_account_number: bankDetail.account_number,
        ifsc_code: bankDetail.ifsc_code,
        account_holder_name: bankDetail.account_holder_name,
        payment_ids: paymentIds,
      });

      console.log(`✅ Payout created: ${payout.id}`);
      return sendSuccess(c, { payoutId: payout.id, payout });
    } catch (error) {
      console.error('Error processing payout:', error);
      return sendError(c, error, 500);
    }
  });
}

