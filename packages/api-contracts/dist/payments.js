"use strict";
/**
 * ============================================================================
 * PAYMENT API CONTRACTS
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletResponseSchema = exports.ProcessRefundResponseSchema = exports.CreatePaymentResponseSchema = exports.VerifyPaymentResponseSchema = exports.CreateRazorpayOrderResponseSchema = exports.WalletSchema = exports.RefundSchema = exports.PaymentSchema = exports.WalletTopUpRequestSchema = exports.ProcessRefundRequestSchema = exports.CreatePaymentRequestSchema = exports.VerifyRazorpayPaymentRequestSchema = exports.CreateRazorpayOrderRequestSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// REQUEST SCHEMAS
// ============================================================================
exports.CreateRazorpayOrderRequestSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Amount must be positive'),
    currency: zod_1.z.string().default('INR'),
    receipt: zod_1.z.string().min(1, 'Receipt ID required'),
    notes: zod_1.z.record(zod_1.z.unknown()).optional(),
    bookingId: zod_1.z.string().uuid('Invalid booking ID format').optional(),
    customerId: zod_1.z.string().uuid('Invalid customer ID format').optional(),
    vendorId: zod_1.z.string().uuid('Invalid vendor ID format').optional(),
});
exports.VerifyRazorpayPaymentRequestSchema = zod_1.z.object({
    razorpayOrderId: zod_1.z.string().min(1, 'Razorpay order ID required'),
    razorpayPaymentId: zod_1.z.string().min(1, 'Razorpay payment ID required'),
    razorpaySignature: zod_1.z.string().min(1, 'Razorpay signature required'),
    bookingId: zod_1.z.string().uuid('Invalid booking ID format').optional(),
    customerId: zod_1.z.string().uuid('Invalid customer ID format').optional(),
});
exports.CreatePaymentRequestSchema = zod_1.z.object({
    bookingId: zod_1.z.string().uuid('Invalid booking ID format'),
    amount: zod_1.z.number().positive('Amount must be positive'),
    paymentMethod: zod_1.z.enum(['razorpay', 'wallet', 'cash', 'card', 'upi', 'netbanking'], {
        errorMap: () => ({ message: 'Invalid payment method' }),
    }).optional(),
    customerId: zod_1.z.string().uuid('Invalid customer ID format').optional(),
    vendorId: zod_1.z.string().uuid('Invalid vendor ID format').optional(),
    idempotencyKey: zod_1.z.string().uuid('Invalid idempotency key format').optional(),
});
exports.ProcessRefundRequestSchema = zod_1.z.object({
    paymentId: zod_1.z.string().uuid('Invalid payment ID format'),
    amount: zod_1.z.number().positive('Amount must be positive').optional(),
    reason: zod_1.z.string().max(500, 'Reason too long').optional(),
    refundType: zod_1.z.enum(['full', 'partial'], {
        errorMap: () => ({ message: 'Refund type must be full or partial' }),
    }).optional(),
    idempotencyKey: zod_1.z.string().uuid('Invalid idempotency key format').optional(),
});
exports.WalletTopUpRequestSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Amount must be positive').min(100, 'Minimum top-up amount is ₹100'),
    paymentMethod: zod_1.z.enum(['razorpay', 'card', 'upi', 'netbanking'], {
        errorMap: () => ({ message: 'Invalid payment method for wallet top-up' }),
    }),
});
// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================
exports.PaymentSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    bookingId: zod_1.z.string().uuid().nullable(),
    orderId: zod_1.z.string().uuid().nullable(),
    customerId: zod_1.z.string().uuid(),
    vendorId: zod_1.z.string().uuid().nullable(),
    amount: zod_1.z.number(),
    currency: zod_1.z.string(),
    paymentMethod: zod_1.z.enum(['razorpay', 'wallet', 'cash', 'card', 'upi', 'netbanking']),
    paymentStatus: zod_1.z.enum(['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded']),
    razorpayOrderId: zod_1.z.string().nullable(),
    razorpayPaymentId: zod_1.z.string().nullable(),
    razorpaySignature: zod_1.z.string().nullable(),
    discountAmount: zod_1.z.number(),
    couponCode: zod_1.z.string().nullable(),
    promotionId: zod_1.z.string().uuid().nullable(),
    loyaltyPointsUsed: zod_1.z.number(),
    walletAmountUsed: zod_1.z.number(),
    transactionId: zod_1.z.string().nullable(),
    failureReason: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
    completedAt: zod_1.z.string().datetime().nullable(),
});
exports.RefundSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    paymentId: zod_1.z.string().uuid(),
    bookingId: zod_1.z.string().uuid().nullable(),
    amount: zod_1.z.number(),
    reason: zod_1.z.string().nullable(),
    refundType: zod_1.z.enum(['full', 'partial']),
    refundStatus: zod_1.z.enum(['pending', 'auto_approved', 'processing', 'completed', 'failed', 'rejected']),
    razorpayRefundId: zod_1.z.string().nullable(),
    processedAt: zod_1.z.string().datetime().nullable(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.WalletSchema = zod_1.z.object({
    balance: zod_1.z.number().min(0, 'Balance cannot be negative'),
    currency: zod_1.z.string().default('INR'),
    transactions: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().uuid(),
        type: zod_1.z.enum(['credit', 'debit']),
        amount: zod_1.z.number(),
        description: zod_1.z.string(),
        createdAt: zod_1.z.string().datetime(),
    })).optional(),
});
exports.CreateRazorpayOrderResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        orderId: zod_1.z.string(),
        amount: zod_1.z.number(),
        currency: zod_1.z.string(),
        key: zod_1.z.string(), // Razorpay key ID
    }),
});
exports.VerifyPaymentResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        payment: exports.PaymentSchema,
        message: zod_1.z.string(),
    }),
});
exports.CreatePaymentResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        paymentId: zod_1.z.string().uuid(),
        payment: exports.PaymentSchema,
    }),
});
exports.ProcessRefundResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        refundId: zod_1.z.string().uuid(),
        paymentId: zod_1.z.string().uuid(),
        amount: zod_1.z.number(),
        status: zod_1.z.string(),
        requiresApproval: zod_1.z.boolean(),
        message: zod_1.z.string(),
    }),
});
exports.WalletResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        wallet: exports.WalletSchema,
    }),
});
