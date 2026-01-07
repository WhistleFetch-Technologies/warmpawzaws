/**
 * ============================================================================
 * PAYMENT API CONTRACTS
 * ============================================================================
 */

import { z } from 'zod';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const CreateRazorpayOrderRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('INR'),
  receipt: z.string().min(1, 'Receipt ID required'),
  notes: z.record(z.unknown()).optional(),
  bookingId: z.string().uuid('Invalid booking ID format').optional(),
  customerId: z.string().uuid('Invalid customer ID format').optional(),
  vendorId: z.string().uuid('Invalid vendor ID format').optional(),
});

export const VerifyRazorpayPaymentRequestSchema = z.object({
  razorpayOrderId: z.string().min(1, 'Razorpay order ID required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment ID required'),
  razorpaySignature: z.string().min(1, 'Razorpay signature required'),
  bookingId: z.string().uuid('Invalid booking ID format').optional(),
  customerId: z.string().uuid('Invalid customer ID format').optional(),
});

export const CreatePaymentRequestSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID format'),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['razorpay', 'wallet', 'cash', 'card', 'upi', 'netbanking'], {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }).optional(),
  customerId: z.string().uuid('Invalid customer ID format').optional(),
  vendorId: z.string().uuid('Invalid vendor ID format').optional(),
  idempotencyKey: z.string().uuid('Invalid idempotency key format').optional(),
});

export const ProcessRefundRequestSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID format'),
  amount: z.number().positive('Amount must be positive').optional(),
  reason: z.string().max(500, 'Reason too long').optional(),
  refundType: z.enum(['full', 'partial'], {
    errorMap: () => ({ message: 'Refund type must be full or partial' }),
  }).optional(),
  idempotencyKey: z.string().uuid('Invalid idempotency key format').optional(),
});

export const WalletTopUpRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive').min(100, 'Minimum top-up amount is ₹100'),
  paymentMethod: z.enum(['razorpay', 'card', 'upi', 'netbanking'], {
    errorMap: () => ({ message: 'Invalid payment method for wallet top-up' }),
  }),
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid().nullable(),
  orderId: z.string().uuid().nullable(),
  customerId: z.string().uuid(),
  vendorId: z.string().uuid().nullable(),
  amount: z.number(),
  currency: z.string(),
  paymentMethod: z.enum(['razorpay', 'wallet', 'cash', 'card', 'upi', 'netbanking']),
  paymentStatus: z.enum(['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded']),
  razorpayOrderId: z.string().nullable(),
  razorpayPaymentId: z.string().nullable(),
  razorpaySignature: z.string().nullable(),
  discountAmount: z.number(),
  couponCode: z.string().nullable(),
  promotionId: z.string().uuid().nullable(),
  loyaltyPointsUsed: z.number(),
  walletAmountUsed: z.number(),
  transactionId: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export const RefundSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  bookingId: z.string().uuid().nullable(),
  amount: z.number(),
  reason: z.string().nullable(),
  refundType: z.enum(['full', 'partial']),
  refundStatus: z.enum(['pending', 'auto_approved', 'processing', 'completed', 'failed', 'rejected']),
  razorpayRefundId: z.string().nullable(),
  processedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const WalletSchema = z.object({
  balance: z.number().min(0, 'Balance cannot be negative'),
  currency: z.string().default('INR'),
  transactions: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(['credit', 'debit']),
    amount: z.number(),
    description: z.string(),
    createdAt: z.string().datetime(),
  })).optional(),
});

export const CreateRazorpayOrderResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    orderId: z.string(),
    amount: z.number(),
    currency: z.string(),
    key: z.string(), // Razorpay key ID
  }),
});

export const VerifyPaymentResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    payment: PaymentSchema,
    message: z.string(),
  }),
});

export const CreatePaymentResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    paymentId: z.string().uuid(),
    payment: PaymentSchema,
  }),
});

export const ProcessRefundResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    refundId: z.string().uuid(),
    paymentId: z.string().uuid(),
    amount: z.number(),
    status: z.string(),
    requiresApproval: z.boolean(),
    message: z.string(),
  }),
});

export const WalletResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    wallet: WalletSchema,
  }),
});

// ============================================================================
// TYPES
// ============================================================================

export type CreateRazorpayOrderRequest = z.infer<typeof CreateRazorpayOrderRequestSchema>;
export type VerifyRazorpayPaymentRequest = z.infer<typeof VerifyRazorpayPaymentRequestSchema>;
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
export type ProcessRefundRequest = z.infer<typeof ProcessRefundRequestSchema>;
export type WalletTopUpRequest = z.infer<typeof WalletTopUpRequestSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type Refund = z.infer<typeof RefundSchema>;
export type Wallet = z.infer<typeof WalletSchema>;
export type CreateRazorpayOrderResponse = z.infer<typeof CreateRazorpayOrderResponseSchema>;
export type VerifyPaymentResponse = z.infer<typeof VerifyPaymentResponseSchema>;
export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponseSchema>;
export type ProcessRefundResponse = z.infer<typeof ProcessRefundResponseSchema>;
export type WalletResponse = z.infer<typeof WalletResponseSchema>;

