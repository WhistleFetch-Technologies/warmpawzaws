"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentEndpointsSQL = paymentEndpointsSQL;
const response_utils_1 = require("./response-utils");
const payments_1 = require("../lib/repositories/payments");
const bookings_1 = require("../lib/repositories/bookings");
const customers_1 = require("../lib/repositories/customers");
const vendors_1 = require("../lib/repositories/vendors");
const wallets_1 = require("../lib/repositories/wallets");
const refunds_1 = require("../lib/repositories/refunds");
const gst_calculator_1 = require("../lib/services/gst-calculator");
const db_1 = require("../lib/db");
const state_machine_validator_1 = require("../lib/services/state-machine-validator");
const db_2 = require("../lib/db");
// TODO: Implement razorpay helpers or import from supabase functions
async function createRazorpayOrder(params) {
    throw new Error('createRazorpayOrder not implemented');
}
async function verifyRazorpayPayment(params) {
    throw new Error('verifyRazorpayPayment not implemented');
}
const BASE_PATH = "/make-server-3dd53475";
function paymentEndpointsSQL(app) {
    /**
     * POST /payments
     * Create payment (SQL only)
     */
    app.post(`${BASE_PATH}/payments`, async (c) => {
        try {
            const paymentData = await c.req.json();
            // Validate required fields
            if (!paymentData.customer_id || !paymentData.amount) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields: customer_id, amount', 400);
            }
            // Get customer and vendor
            const customersRepo = (0, customers_1.getCustomersRepository)();
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const customer = await customersRepo.findById(paymentData.customer_id);
            if (!customer) {
                return (0, response_utils_1.sendError)(c, 'Customer not found', 404);
            }
            let vendor = null;
            if (paymentData.vendor_id) {
                vendor = await vendorsRepo.findById(paymentData.vendor_id);
                if (!vendor) {
                    return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
                }
            }
            // Calculate GST if booking/service info provided
            let gstAmount = 0;
            let subtotal = paymentData.amount;
            if (paymentData.booking_id || (vendor && paymentData.service_type)) {
                const gst = await (0, gst_calculator_1.calculateGST)({
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
            const paymentsRepo = (0, payments_1.getPaymentsRepository)();
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
                await (0, db_1.withTransaction)(async (txClient) => {
                    const walletsRepo = (0, wallets_1.getWalletsRepository)();
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
                return (0, response_utils_1.sendSuccess)(c, {
                    payment: { ...payment, razorpay_order_id: razorpayOrder.id },
                    razorpay_order: razorpayOrder
                }, 'Payment created');
            }
            // Log audit
            await (0, db_2.selectQuery)("SELECT create_audit_log($1, $2, $3, $4, $5, $6)", [
                'payment_created',
                'payment',
                payment.id,
                paymentData.customer_id,
                'customer',
                JSON.stringify({ amount: totalAmount, method: paymentData.payment_method })
            ]);
            return (0, response_utils_1.sendSuccess)(c, { payment }, 'Payment created');
        }
        catch (error) {
            console.error('❌ [PAYMENT] Error creating payment:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const paymentsRepo = (0, payments_1.getPaymentsRepository)();
            const payment = await paymentsRepo.findById(paymentId);
            if (!payment) {
                return (0, response_utils_1.sendError)(c, 'Payment not found', 404);
            }
            // Verify Razorpay signature
            const isValid = await verifyRazorpayPayment({
                razorpay_order_id: payment.razorpay_order_id || '',
                razorpay_payment_id,
                razorpay_signature
            });
            if (!isValid) {
                return (0, response_utils_1.sendError)(c, 'Invalid payment signature', 400);
            }
            // Validate transition
            const canTransition = await (0, state_machine_validator_1.validateTransition)(payment.payment_status, 'completed');
            if (!canTransition) {
                return (0, response_utils_1.sendError)(c, 'Invalid payment status transition', 400);
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
                const bookingsRepo = (0, bookings_1.getBookingsRepository)();
                await bookingsRepo.update(payment.booking_id, {
                    payment_status: 'paid',
                    payment_id: paymentId
                });
            }
            // Log transaction
            await (0, db_2.selectQuery)("INSERT INTO payment_transaction_log (payment_id, transaction_type, old_status, new_status, amount) VALUES ($1, $2, $3, $4, $5)", [paymentId, 'complete', payment.payment_status, 'completed', payment.amount]);
            return (0, response_utils_1.sendSuccess)(c, { payment: updated }, 'Payment verified');
        }
        catch (error) {
            console.error('❌ [PAYMENT] Error verifying payment:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const paymentsRepo = (0, payments_1.getPaymentsRepository)();
            const payment = await paymentsRepo.findById(paymentId);
            if (!payment) {
                return (0, response_utils_1.sendError)(c, 'Payment not found', 404);
            }
            if (payment.payment_status !== 'completed') {
                return (0, response_utils_1.sendError)(c, 'Can only refund completed payments', 400);
            }
            const refundAmount = amount || payment.amount;
            // Process refund atomically
            const refundsRepo = (0, refunds_1.getRefundsRepository)();
            const { payment: updatedPayment, refund } = await (0, db_1.withTransaction)(async (txClient) => {
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
                await (0, db_1.withTransaction)(async (txClient) => {
                    const walletsRepo = (0, wallets_1.getWalletsRepository)();
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
            return (0, response_utils_1.sendSuccess)(c, { payment: updatedPayment, refund }, 'Refund processed');
        }
        catch (error) {
            console.error('❌ [PAYMENT] Error processing refund:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /payments/:paymentId
     * Get payment by ID
     */
    app.get(`${BASE_PATH}/payments/:paymentId`, async (c) => {
        try {
            const { paymentId } = c.req.param();
            const paymentsRepo = (0, payments_1.getPaymentsRepository)();
            const payment = await paymentsRepo.findById(paymentId);
            if (!payment) {
                return (0, response_utils_1.sendError)(c, 'Payment not found', 404);
            }
            return (0, response_utils_1.sendSuccess)(c, { payment }, 'Payment retrieved');
        }
        catch (error) {
            console.error('❌ [PAYMENT] Error getting payment:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
}
//# sourceMappingURL=payment-endpoints.js.map