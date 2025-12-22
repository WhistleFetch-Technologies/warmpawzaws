import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { createRazorpayOrder, verifyRazorpaySignature, fetchRazorpayPayment } from "./razorpay-integration.tsx";
import { createNotificationHelper } from "./notification-system.tsx";

export function paymentEndpoints(app: Hono, kv: any) {
  
  // ✅ FIX: Use existing notification system (no duplicate code)
  // Helper: Trigger Notification using existing infrastructure
  async function triggerNotification(notification: any) {
    try {
      // Use existing createNotificationHelper which handles AWS SNS integration
      await createNotificationHelper(kv, {
        ...notification,
        channels: notification.channels || { email: true, sms: true, inApp: true, push: false }
      });
      
      console.log(`📨 Notification sent via existing system for ${notification.recipientType}:${notification.recipientId}`);
    } catch (e) {
      console.error('Failed to trigger notification:', e);
    }
  }

  // ============================================
  // PAYMENT & WALLET ENDPOINTS
  // ============================================
  
  /**
   * Initiate payment (Create Payment Intent) - REAL RAZORPAY
   * POST /make-server-3dd53475/ecommerce/payments/initiate
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
        
        const booking = await kv.get(`booking:${bookingId}`);
        if (!booking) {
          console.error(`❌ [PAYMENT] Booking not found: ${bookingId}`);
          return sendError(c, 'Booking not found', 404);
        }

        // Fetch actual service price from catalog
        let actualPrice = 0;
        
        if (booking.serviceId) {
          // Check if it's a staff service first
          if (booking.staffId) {
            const staffServices = await kv.getByPrefix(`staff:${booking.staffId}:service:`);
            const staffService = staffServices.find((s: any) => 
              s.serviceId === booking.serviceId || s.id === booking.serviceId
            );
            
            if (staffService) {
              actualPrice = staffService.price || 0;
              validationDetails.source = 'staff_service';
              validationDetails.staffId = booking.staffId;
              console.log(`✅ [PAYMENT] Found staff service price: ₹${actualPrice}`);
            }
          }
          
          // Fallback to vendor service
          if (actualPrice === 0) {
            const service = await kv.get(`service:${booking.serviceId}`);
            if (service) {
              actualPrice = service.price || 0;
              validationDetails.source = 'vendor_service';
              console.log(`✅ [PAYMENT] Found vendor service price: ₹${actualPrice}`);
            }
          }
        }
        
        // Handle package bookings
        if (booking.isPackage && booking.packageDetails) {
          actualPrice = booking.packageDetails.totalPrice || booking.packageDetails.price || 0;
          validationDetails.source = 'package';
          console.log(`✅ [PAYMENT] Package price: ₹${actualPrice}`);
        }

        // ✅ NEW: Handle package enrollment payments (GAP #3 FIX)
        if (!actualPrice && booking.enrollmentId) {
          // This is a package enrollment payment
          const allVendorEnrollments = await kv.getByPrefix('vendor:');
          
          for (const vendorData of allVendorEnrollments) {
            if (!vendorData || typeof vendorData !== 'object') continue;
            if (!vendorData.id || !vendorData.id.includes(':package_enrollments')) continue;
            
            const vendorEnrollments = await kv.get(vendorData.id) || [];
            const enrollment = vendorEnrollments.find((e: any) => e.id === booking.enrollmentId);
            
            if (enrollment) {
              actualPrice = enrollment.totalPrice || 0;
              validationDetails.source = 'package_enrollment';
              validationDetails.enrollmentId = booking.enrollmentId;
              validationDetails.packageId = enrollment.packageId;
              console.log(`✅ [PAYMENT] Found package enrollment price: ₹${actualPrice}`);
              break;
            }
          }
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
        validatedAmount = validatedAmount;
        validationDetails.priceDifference = priceDifference;
        
        console.log(`✅ [PAYMENT] Price validated: ₹${validatedAmount}`, validationDetails);
        
      } else if (orderId) {
        // Marketplace order validation
        console.log(`🛒 [PAYMENT] Validating amount for order: ${orderId}`);
        
        const order = await kv.get(`order:${orderId}`);
        if (!order) {
          console.error(`❌ [PAYMENT] Order not found: ${orderId}`);
          return sendError(c, 'Order not found', 404);
        }
        
        const actualTotal = order.totalAmount || order.grandTotal || 0;
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

      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create REAL Razorpay Order with VALIDATED amount
      let razorpayOrder;
      try {
        razorpayOrder = await createRazorpayOrder(validatedAmount, bookingId, orderId);
      } catch (error) {
        console.error('❌ Razorpay order creation failed:', error);
        return sendError(c, 'Payment gateway error. Please try again.', 500);
      }
      
      // Create Pending Payment
      const payment = {
        id: paymentId,
        bookingId: bookingId || null,
        orderId: orderId || null,
        customerId,
        vendorId,
        amount: validatedAmount, // ✅ Use validated amount
        paymentMethod,
        status: 'pending',
        createdAt: new Date().toISOString(),
        // Real Razorpay Data
        razorpayOrderId: razorpayOrder.id,
        razorpayAmount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        // ✅ NEW: Price validation audit trail
        priceValidation: validationDetails,
        // ✅ ENHANCED: Discount breakdown for analytics
        discounts: discounts || {},
        couponCode: couponCode || null,
        promotionId: promotionId || null,
        loyaltyPointsUsed: loyaltyPointsUsed || 0,
        tierName: tierName || null,
        originalAmount: originalAmount || validatedAmount,
        walletUsed: walletUsed || 0
      };

      await kv.set(`payment:${paymentId}`, payment);
      console.log(`⏳ Payment Initiated with Razorpay: ${paymentId} | Order: ${razorpayOrder.id} | Validated Amount: ₹${validatedAmount}`);

      return sendSuccess(c, { 
        paymentId, 
        orderId: razorpayOrder.id,
        amount: amount,
        currency: 'INR',
        key: Deno.env.get('RAZORPAY_KEY_ID') // Real Razorpay Key for frontend
      });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * Verify Payment (Complete Transaction) - REAL RAZORPAY
   * POST /make-server-3dd53475/payments/verify
   */
  app.post("/make-server-3dd53475/ecommerce/payments/verify", async (c) => {
    try {
      const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = await c.req.json();

      const payment = await kv.get(`payment:${paymentId}` );
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
        payment.status = 'failed';
        payment.failedAt = new Date().toISOString();
        payment.failureReason = 'Invalid signature';
        await kv.set(`payment:${paymentId}`, payment);
        return sendError(c, 'Invalid payment signature', 400);
      }
      
      // Update Payment Status
      payment.status = 'completed';
      payment.completedAt = new Date().toISOString();
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      
      // Calculate Commission & Vendor Share
      const commissionRate = 10; // 10% Platform Fee
      payment.platformCommission = (payment.amount * commissionRate) / 100;
      payment.vendorAmount = payment.amount - payment.platformCommission;

      await kv.set(`payment:${paymentId}`, payment);

      // Update Booking Status
      const booking = await kv.get(`booking:${payment.bookingId}`);
      if (booking) {
        booking.paymentStatus = 'paid';
        booking.paymentId = paymentId;
        booking.status = 'confirmed'; // Auto-confirm for now (or 'pending_confirmation')
        booking.paidAt = new Date().toISOString();
        booking.statusHistory.push({
          status: 'confirmed',
          timestamp: new Date().toISOString(),
          note: 'Payment successful via Razorpay. Booking confirmed.'
        });
        await kv.set(`booking:${payment.bookingId}`, booking);
        
        // ✅ NEW: Activate package enrollment if this is a package booking (GAP #3 FIX)
        if (booking.enrollmentId) {
          console.log(`📦 [PAYMENT] Activating package enrollment: ${booking.enrollmentId}`);
          
          const allVendorEnrollments = await kv.getByPrefix('vendor:');
          
          for (const vendorData of allVendorEnrollments) {
            if (!vendorData || typeof vendorData !== 'object') continue;
            
            const key = vendorData.id;
            if (!key || !key.includes(':package_enrollments')) continue;
            
            const vendorEnrollments = await kv.get(key) || [];
            const index = vendorEnrollments.findIndex((e: any) => e.id === booking.enrollmentId);
            
            if (index !== -1) {
              const enrollment = vendorEnrollments[index];
              
              // Activate enrollment
              enrollment.status = 'active';
              enrollment.paymentStatus = 'paid';
              enrollment.paidAmount = enrollment.totalPrice;
              enrollment.paymentId = paymentId;
              enrollment.enrolledAt = new Date().toISOString();
              enrollment.updatedAt = new Date().toISOString();
              
              // Save
              vendorEnrollments[index] = enrollment;
              await kv.set(key, vendorEnrollments);
              
              console.log(`✅ [PAYMENT] Package enrollment activated: ${booking.enrollmentId}`);
              break;
            }
          }
        }
      }

      // Add to History Lists (Idempotent)
      const customerPaymentsKey = `customer:${payment.customerId}:payments`;
      const customerPayments = await kv.get(customerPaymentsKey) || [];
      if (!customerPayments.includes(paymentId)) {
        customerPayments.unshift(paymentId);
        await kv.set(customerPaymentsKey, customerPayments);
      }

      const vendorPaymentsKey = `vendor:${payment.vendorId}:payments`;
      const vendorPayments = await kv.get(vendorPaymentsKey) || [];
      if (!vendorPayments.includes(paymentId)) {
        vendorPayments.unshift(paymentId);
        await kv.set(vendorPaymentsKey, vendorPayments);
      }

      // Update Vendor Wallet
      const vendor = await kv.get(`vendor:${payment.vendorId}`);
      if (vendor) {
        vendor.pendingPayout = (vendor.pendingPayout || 0) + payment.vendorAmount;
        vendor.totalEarnings = (vendor.totalEarnings || 0) + payment.vendorAmount;
        await kv.set(`vendor:${payment.vendorId}`, vendor);
      }

      // ✅ NOTIFICATIONS: Payment Success - Use existing notification system
      try {
        const customer = await kv.get(`customer:${payment.customerId}`);
        const vendor = await kv.get(`vendor:${payment.vendorId}`);

        // 1. Notify Customer (Payment Success)
        await createNotificationHelper(kv, {
          recipientId: payment.customerId,
          recipientType: 'customer',
          type: 'payment_success',
          category: 'payments',
          title: 'Payment Successful',
          message: `Payment of ₹${payment.amount} received successfully! Booking ID: ${payment.bookingId}. Thank you!`,
          recipientEmail: customer?.email,
          recipientPhone: customer?.phone,
          channels: { email: true, sms: true, inApp: true, push: false },
          data: { paymentId, bookingId: payment.bookingId, amount: payment.amount, transactionId: razorpayPaymentId },
          priority: 'high'
        });

        // 2. Notify Vendor (Payment Received)
        await createNotificationHelper(kv, {
          recipientId: payment.vendorId,
          recipientType: 'vendor',
          type: 'payment_received',
          category: 'payments',
          title: 'Payment Received',
          message: `Received payment of ₹${payment.vendorAmount} for booking ${payment.bookingId}. Platform commission: ₹${payment.platformCommission}`,
          recipientEmail: vendor?.email,
          recipientPhone: vendor?.phone,
          channels: { email: true, sms: false, inApp: true, push: false },
          data: { paymentId, bookingId: payment.bookingId, vendorAmount: payment.vendorAmount, commission: payment.platformCommission },
        priority: 'medium'
      });

      console.log(`✅ Razorpay Payment Verified: ${paymentId} | ${razorpayPaymentId}`);
      return sendSuccess(c, { payment, success: true });

    } catch (error) {
      console.error('Payment verification error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Process payment for booking
   * POST /make-server-3dd53475/payments/process
   */
  app.post("/make-server-3dd53475/ecommerce/payments/process", async (c) => {
    try {
      const {
        bookingId,
        customerId,
        vendorId,
        amount,
        paymentMethod, // card, upi, wallet, cash
        paymentDetails, // card/UPI details
        commission // Platform commission percentage
      } = await c.req.json();

      // Validate required fields
      if (!bookingId || !customerId || !vendorId || !amount || !paymentMethod) {
        return sendError(c, 'Missing required fields', 400);
      }

      // Generate payment ID
      const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Calculate commission (default 10%)
      const commissionRate = commission || 10;
      const platformCommission = (amount * commissionRate) / 100;
      const vendorAmount = amount - platformCommission;

      // Create payment record
      const payment = {
        id: paymentId,
        bookingId,
        customerId,
        vendorId,
        amount,
        platformCommission,
        vendorAmount,
        commissionRate,
        paymentMethod,
        paymentDetails: paymentDetails || {},
        status: 'completed', // pending, completed, failed, refunded
        
        // For card/UPI payments, this would integrate with payment gateway
        transactionId: `txn_${Date.now()}`,
        
        // Timestamps
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };

      // Save payment
      await kv.set(`payment:${paymentId}`, payment);

      // Update booking payment status
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking) {
        booking.paymentStatus = 'paid';
        booking.paymentId = paymentId;
        booking.paidAt = new Date().toISOString();
        await kv.set(`booking:${bookingId}`, booking);
      }

      // Add to customer's payment history
      const customerPaymentsKey = `customer:${customerId}:payments`;
      const customerPayments = await kv.get(customerPaymentsKey) || [];
      customerPayments.unshift(paymentId);
      await kv.set(customerPaymentsKey, customerPayments);

      // Add to vendor's payment history
      const vendorPaymentsKey = `vendor:${vendorId}:payments`;
      const vendorPayments = await kv.get(vendorPaymentsKey) || [];
      vendorPayments.unshift(paymentId);
      await kv.set(vendorPaymentsKey, vendorPayments);

      // Update vendor earnings
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (vendor) {
        vendor.totalEarnings = (vendor.totalEarnings || 0) + vendorAmount;
        vendor.pendingPayout = (vendor.pendingPayout || 0) + vendorAmount;
        await kv.set(`vendor:${vendorId}`, vendor);
      }

      // Update platform revenue
      const platformStats = await kv.get('platform:revenue') || { total: 0, monthly: {} };
      platformStats.total = (platformStats.total || 0) + platformCommission;
      
      const month = new Date().toISOString().substring(0, 7); // YYYY-MM
      platformStats.monthly[month] = (platformStats.monthly[month] || 0) + platformCommission;
      await kv.set('platform:revenue', platformStats);

      console.log(`✅ Payment processed: ${paymentId}`);
      return sendSuccess(c, { paymentId, payment });
    } catch (error) {
      console.error('Error processing payment:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get payment details
   * GET /make-server-3dd53475/payments/:paymentId
   */
  app.get("/make-server-3dd53475/ecommerce/payments/:paymentId", async (c) => {
    try {
      const { paymentId } = c.req.param();
      
      const payment = await kv.get(`payment:${paymentId}`);
      
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
   */
  app.post("/make-server-3dd53475/ecommerce/payments/:paymentId/refund", async (c) => {
    try {
      const { paymentId } = c.req.param();
      const { amount, reason, refundedBy } = await c.req.json();

      const payment = await kv.get(`payment:${paymentId}`);
      
      if (!payment) {
        return sendError(c, 'Payment not found', 404);
      }

      if (payment.status === 'refunded') {
        return sendError(c, 'Payment already refunded', 400);
      }

      const refundAmount = amount || payment.amount;

      // Create refund record
      const refundId = `refund_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const refund = {
        id: refundId,
        paymentId,
        bookingId: payment.bookingId,
        customerId: payment.customerId,
        vendorId: payment.vendorId,
        amount: refundAmount,
        originalAmount: payment.amount,
        reason: reason || '',
        refundedBy,
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };

      // Save refund
      await kv.set(`refund:${refundId}`, refund);

      // Update payment
      payment.status = 'refunded';
      payment.refundId = refundId;
      payment.refundedAt = new Date().toISOString();
      payment.refundAmount = refundAmount;
      await kv.set(`payment:${paymentId}`, payment);

      // Update booking
      const booking = await kv.get(`booking:${payment.bookingId}`);
      if (booking) {
        booking.paymentStatus = 'refunded';
        booking.refundId = refundId;
        booking.refundedAt = new Date().toISOString();
        await kv.set(`booking:${payment.bookingId}`, booking);
      }

      // Adjust vendor earnings
      const vendor = await kv.get(`vendor:${payment.vendorId}`);
      if (vendor) {
        vendor.pendingPayout = (vendor.pendingPayout || 0) - payment.vendorAmount;
        await kv.set(`vendor:${payment.vendorId}`, vendor);
      }

      console.log(`✅ Refund processed: ${refundId}`);
      return sendSuccess(c, { refundId, refund });
    } catch (error) {
      console.error('Error processing refund:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get customer's payment history
   * GET /make-server-3dd53475/payments/customer/:customerId
   */
  app.get("/make-server-3dd53475/ecommerce/payments/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      
      const paymentIds = await kv.get(`customer:${customerId}:payments`) || [];
      
      const payments = [];
      for (const paymentId of paymentIds) {
        const payment = await kv.get(`payment:${paymentId}`);
        if (payment) {
          payments.push(payment);
        }
      }
      
      return sendSuccess(c, { payments, total: payments.length });
    } catch (error) {
      console.error('Error getting customer payments:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get vendor's payment history
   * GET /make-server-3dd53475/payments/vendor/:vendorId
   */
  app.get("/make-server-3dd53475/ecommerce/payments/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const paymentIds = await kv.get(`vendor:${vendorId}:payments`) || [];
      
      const payments = [];
      for (const paymentId of paymentIds) {
        const payment = await kv.get(`payment:${paymentId}`);
        if (payment) {
          payments.push(payment);
        }
      }
      
      return sendSuccess(c, { payments, total: payments.length });
    } catch (error) {
      console.error('Error getting vendor payments:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get vendor's earnings summary
   * GET /make-server-3dd53475/payments/vendor/:vendorId/earnings
   */
  app.get("/make-server-3dd53475/ecommerce/payments/vendor/:vendorId/earnings", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      const paymentIds = await kv.get(`vendor:${vendorId}:payments`) || [];
      
      let totalEarnings = 0;
      let pendingPayout = 0;
      let paidOut = 0;
      
      for (const paymentId of paymentIds) {
        const payment = await kv.get(`payment:${paymentId}`);
        if (payment && payment.status !== 'refunded') {
          totalEarnings += payment.vendorAmount;
          if (payment.paidOut) {
            paidOut += payment.vendorAmount;
          } else {
            pendingPayout += payment.vendorAmount;
          }
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
   */
  app.post("/make-server-3dd53475/ecommerce/payments/vendor/:vendorId/payout", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { amount, bankDetails, processedBy } = await c.req.json();

      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      if (vendor.pendingPayout < amount) {
        return sendError(c, 'Insufficient pending payout', 400);
      }

      // Generate payout ID
      const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Create payout record
      const payout = {
        id: payoutId,
        vendorId,
        amount,
        bankDetails: bankDetails || vendor.bankDetails,
        status: 'completed', // pending, completed, failed
        processedBy,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };

      // Save payout
      await kv.set(`payout:${payoutId}`, payout);

      // Update vendor
      vendor.pendingPayout = (vendor.pendingPayout || 0) - amount;
      vendor.totalPaidOut = (vendor.totalPaidOut || 0) + amount;
      await kv.set(`vendor:${vendorId}`, vendor);

      // Add to vendor's payout history
      const vendorPayoutsKey = `vendor:${vendorId}:payouts`;
      const vendorPayouts = await kv.get(vendorPayoutsKey) || [];
      vendorPayouts.unshift(payoutId);
      await kv.set(vendorPayoutsKey, vendorPayouts);

      console.log(`✅ Payout processed: ${payoutId}`);
      return sendSuccess(c, { payoutId, payout });
    } catch (error) {
      console.error('Error processing payout:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get vendor's payout history
   * GET /make-server-3dd53475/payments/vendor/:vendorId/payouts
   */
  app.get("/make-server-3dd53475/ecommerce/payments/vendor/:vendorId/payouts", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const payoutIds = await kv.get(`vendor:${vendorId}:payouts`) || [];
      
      const payouts = [];
      for (const payoutId of payoutIds) {
        const payout = await kv.get(`payout:${payoutId}`);
        if (payout) {
          payouts.push(payout);
        }
      }
      
      return sendSuccess(c, { payouts, total: payouts.length });
    } catch (error) {
      console.error('Error getting vendor payouts:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get platform revenue statistics (Admin)
   * GET /make-server-3dd53475/payments/platform/revenue
   */
  app.get("/make-server-3dd53475/ecommerce/payments/platform/revenue", async (c) => {
    try {
      const platformStats = await kv.get('platform:revenue') || { total: 0, monthly: {} };
      
      return sendSuccess(c, { revenue: platformStats });
    } catch (error) {
      console.error('Error getting platform revenue:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Payment endpoints registered');
}