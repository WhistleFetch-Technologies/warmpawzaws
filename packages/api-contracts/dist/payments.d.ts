/**
 * ============================================================================
 * PAYMENT API CONTRACTS
 * ============================================================================
 */
import { z } from 'zod';
export declare const CreateRazorpayOrderRequestSchema: z.ZodObject<{
    amount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    receipt: z.ZodString;
    notes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    bookingId: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
    vendorId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    currency: string;
    receipt: string;
    customerId?: string | undefined;
    vendorId?: string | undefined;
    notes?: Record<string, unknown> | undefined;
    bookingId?: string | undefined;
}, {
    amount: number;
    receipt: string;
    customerId?: string | undefined;
    vendorId?: string | undefined;
    notes?: Record<string, unknown> | undefined;
    bookingId?: string | undefined;
    currency?: string | undefined;
}>;
export declare const VerifyRazorpayPaymentRequestSchema: z.ZodObject<{
    razorpayOrderId: z.ZodString;
    razorpayPaymentId: z.ZodString;
    razorpaySignature: z.ZodString;
    bookingId: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    customerId?: string | undefined;
    bookingId?: string | undefined;
}, {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    customerId?: string | undefined;
    bookingId?: string | undefined;
}>;
export declare const CreatePaymentRequestSchema: z.ZodObject<{
    bookingId: z.ZodString;
    amount: z.ZodNumber;
    paymentMethod: z.ZodOptional<z.ZodEnum<["razorpay", "wallet", "cash", "card", "upi", "netbanking"]>>;
    customerId: z.ZodOptional<z.ZodString>;
    vendorId: z.ZodOptional<z.ZodString>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    bookingId: string;
    customerId?: string | undefined;
    vendorId?: string | undefined;
    idempotencyKey?: string | undefined;
    paymentMethod?: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking" | undefined;
}, {
    amount: number;
    bookingId: string;
    customerId?: string | undefined;
    vendorId?: string | undefined;
    idempotencyKey?: string | undefined;
    paymentMethod?: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking" | undefined;
}>;
export declare const ProcessRefundRequestSchema: z.ZodObject<{
    paymentId: z.ZodString;
    amount: z.ZodOptional<z.ZodNumber>;
    reason: z.ZodOptional<z.ZodString>;
    refundType: z.ZodOptional<z.ZodEnum<["full", "partial"]>>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    paymentId: string;
    amount?: number | undefined;
    idempotencyKey?: string | undefined;
    reason?: string | undefined;
    refundType?: "partial" | "full" | undefined;
}, {
    paymentId: string;
    amount?: number | undefined;
    idempotencyKey?: string | undefined;
    reason?: string | undefined;
    refundType?: "partial" | "full" | undefined;
}>;
export declare const WalletTopUpRequestSchema: z.ZodObject<{
    amount: z.ZodNumber;
    paymentMethod: z.ZodEnum<["razorpay", "card", "upi", "netbanking"]>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    paymentMethod: "razorpay" | "card" | "upi" | "netbanking";
}, {
    amount: number;
    paymentMethod: "razorpay" | "card" | "upi" | "netbanking";
}>;
export declare const PaymentSchema: z.ZodObject<{
    id: z.ZodString;
    bookingId: z.ZodNullable<z.ZodString>;
    orderId: z.ZodNullable<z.ZodString>;
    customerId: z.ZodString;
    vendorId: z.ZodNullable<z.ZodString>;
    amount: z.ZodNumber;
    currency: z.ZodString;
    paymentMethod: z.ZodEnum<["razorpay", "wallet", "cash", "card", "upi", "netbanking"]>;
    paymentStatus: z.ZodEnum<["pending", "processing", "completed", "failed", "refunded", "partially_refunded"]>;
    razorpayOrderId: z.ZodNullable<z.ZodString>;
    razorpayPaymentId: z.ZodNullable<z.ZodString>;
    razorpaySignature: z.ZodNullable<z.ZodString>;
    discountAmount: z.ZodNumber;
    couponCode: z.ZodNullable<z.ZodString>;
    promotionId: z.ZodNullable<z.ZodString>;
    loyaltyPointsUsed: z.ZodNumber;
    walletAmountUsed: z.ZodNumber;
    transactionId: z.ZodNullable<z.ZodString>;
    failureReason: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    completedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    customerId: string;
    vendorId: string | null;
    amount: number;
    couponCode: string | null;
    promotionId: string | null;
    discountAmount: number;
    paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    bookingId: string | null;
    currency: string;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    razorpaySignature: string | null;
    paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
    orderId: string | null;
    loyaltyPointsUsed: number;
    walletAmountUsed: number;
    transactionId: string | null;
    failureReason: string | null;
}, {
    id: string;
    customerId: string;
    vendorId: string | null;
    amount: number;
    couponCode: string | null;
    promotionId: string | null;
    discountAmount: number;
    paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    bookingId: string | null;
    currency: string;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    razorpaySignature: string | null;
    paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
    orderId: string | null;
    loyaltyPointsUsed: number;
    walletAmountUsed: number;
    transactionId: string | null;
    failureReason: string | null;
}>;
export declare const RefundSchema: z.ZodObject<{
    id: z.ZodString;
    paymentId: z.ZodString;
    bookingId: z.ZodNullable<z.ZodString>;
    amount: z.ZodNumber;
    reason: z.ZodNullable<z.ZodString>;
    refundType: z.ZodEnum<["full", "partial"]>;
    refundStatus: z.ZodEnum<["pending", "auto_approved", "processing", "completed", "failed", "rejected"]>;
    razorpayRefundId: z.ZodNullable<z.ZodString>;
    processedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    amount: number;
    reason: string | null;
    paymentId: string;
    createdAt: string;
    updatedAt: string;
    bookingId: string | null;
    refundType: "partial" | "full";
    refundStatus: "pending" | "completed" | "processing" | "failed" | "rejected" | "auto_approved";
    razorpayRefundId: string | null;
    processedAt: string | null;
}, {
    id: string;
    amount: number;
    reason: string | null;
    paymentId: string;
    createdAt: string;
    updatedAt: string;
    bookingId: string | null;
    refundType: "partial" | "full";
    refundStatus: "pending" | "completed" | "processing" | "failed" | "rejected" | "auto_approved";
    razorpayRefundId: string | null;
    processedAt: string | null;
}>;
export declare const WalletSchema: z.ZodObject<{
    balance: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    transactions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["credit", "debit"]>;
        amount: z.ZodNumber;
        description: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "credit" | "debit";
        id: string;
        amount: number;
        createdAt: string;
        description: string;
    }, {
        type: "credit" | "debit";
        id: string;
        amount: number;
        createdAt: string;
        description: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    balance: number;
    transactions?: {
        type: "credit" | "debit";
        id: string;
        amount: number;
        createdAt: string;
        description: string;
    }[] | undefined;
}, {
    balance: number;
    currency?: string | undefined;
    transactions?: {
        type: "credit" | "debit";
        id: string;
        amount: number;
        createdAt: string;
        description: string;
    }[] | undefined;
}>;
export declare const CreateRazorpayOrderResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        orderId: z.ZodString;
        amount: z.ZodNumber;
        currency: z.ZodString;
        key: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        currency: string;
        orderId: string;
        key: string;
    }, {
        amount: number;
        currency: string;
        orderId: string;
        key: string;
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        amount: number;
        currency: string;
        orderId: string;
        key: string;
    };
}, {
    success: true;
    data: {
        amount: number;
        currency: string;
        orderId: string;
        key: string;
    };
}>;
export declare const VerifyPaymentResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        payment: z.ZodObject<{
            id: z.ZodString;
            bookingId: z.ZodNullable<z.ZodString>;
            orderId: z.ZodNullable<z.ZodString>;
            customerId: z.ZodString;
            vendorId: z.ZodNullable<z.ZodString>;
            amount: z.ZodNumber;
            currency: z.ZodString;
            paymentMethod: z.ZodEnum<["razorpay", "wallet", "cash", "card", "upi", "netbanking"]>;
            paymentStatus: z.ZodEnum<["pending", "processing", "completed", "failed", "refunded", "partially_refunded"]>;
            razorpayOrderId: z.ZodNullable<z.ZodString>;
            razorpayPaymentId: z.ZodNullable<z.ZodString>;
            razorpaySignature: z.ZodNullable<z.ZodString>;
            discountAmount: z.ZodNumber;
            couponCode: z.ZodNullable<z.ZodString>;
            promotionId: z.ZodNullable<z.ZodString>;
            loyaltyPointsUsed: z.ZodNumber;
            walletAmountUsed: z.ZodNumber;
            transactionId: z.ZodNullable<z.ZodString>;
            failureReason: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
            completedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            customerId: string;
            vendorId: string | null;
            amount: number;
            couponCode: string | null;
            promotionId: string | null;
            discountAmount: number;
            paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            bookingId: string | null;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            razorpaySignature: string | null;
            paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
            orderId: string | null;
            loyaltyPointsUsed: number;
            walletAmountUsed: number;
            transactionId: string | null;
            failureReason: string | null;
        }, {
            id: string;
            customerId: string;
            vendorId: string | null;
            amount: number;
            couponCode: string | null;
            promotionId: string | null;
            discountAmount: number;
            paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            bookingId: string | null;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            razorpaySignature: string | null;
            paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
            orderId: string | null;
            loyaltyPointsUsed: number;
            walletAmountUsed: number;
            transactionId: string | null;
            failureReason: string | null;
        }>;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        payment: {
            id: string;
            customerId: string;
            vendorId: string | null;
            amount: number;
            couponCode: string | null;
            promotionId: string | null;
            discountAmount: number;
            paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            bookingId: string | null;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            razorpaySignature: string | null;
            paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
            orderId: string | null;
            loyaltyPointsUsed: number;
            walletAmountUsed: number;
            transactionId: string | null;
            failureReason: string | null;
        };
    }, {
        message: string;
        payment: {
            id: string;
            customerId: string;
            vendorId: string | null;
            amount: number;
            couponCode: string | null;
            promotionId: string | null;
            discountAmount: number;
            paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            bookingId: string | null;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            razorpaySignature: string | null;
            paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
            orderId: string | null;
            loyaltyPointsUsed: number;
            walletAmountUsed: number;
            transactionId: string | null;
            failureReason: string | null;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        message: string;
        payment: {
            id: string;
            customerId: string;
            vendorId: string | null;
            amount: number;
            couponCode: string | null;
            promotionId: string | null;
            discountAmount: number;
            paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            bookingId: string | null;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            razorpaySignature: string | null;
            paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
            orderId: string | null;
            loyaltyPointsUsed: number;
            walletAmountUsed: number;
            transactionId: string | null;
            failureReason: string | null;
        };
    };
}, {
    success: true;
    data: {
        message: string;
        payment: {
            id: string;
            customerId: string;
            vendorId: string | null;
            amount: number;
            couponCode: string | null;
            promotionId: string | null;
            discountAmount: number;
            paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            bookingId: string | null;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            razorpaySignature: string | null;
            paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
            orderId: string | null;
            loyaltyPointsUsed: number;
            walletAmountUsed: number;
            transactionId: string | null;
            failureReason: string | null;
        };
    };
}>;
export declare const CreatePaymentResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        paymentId: z.ZodString;
        payment: z.ZodObject<{
            id: z.ZodString;
            bookingId: z.ZodNullable<z.ZodString>;
            orderId: z.ZodNullable<z.ZodString>;
            customerId: z.ZodString;
            vendorId: z.ZodNullable<z.ZodString>;
            amount: z.ZodNumber;
            currency: z.ZodString;
            paymentMethod: z.ZodEnum<["razorpay", "wallet", "cash", "card", "upi", "netbanking"]>;
            paymentStatus: z.ZodEnum<["pending", "processing", "completed", "failed", "refunded", "partially_refunded"]>;
            razorpayOrderId: z.ZodNullable<z.ZodString>;
            razorpayPaymentId: z.ZodNullable<z.ZodString>;
            razorpaySignature: z.ZodNullable<z.ZodString>;
            discountAmount: z.ZodNumber;
            couponCode: z.ZodNullable<z.ZodString>;
            promotionId: z.ZodNullable<z.ZodString>;
            loyaltyPointsUsed: z.ZodNumber;
            walletAmountUsed: z.ZodNumber;
            transactionId: z.ZodNullable<z.ZodString>;
            failureReason: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
            completedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            customerId: string;
            vendorId: string | null;
            amount: number;
            couponCode: string | null;
            promotionId: string | null;
            discountAmount: number;
            paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            bookingId: string | null;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            razorpaySignature: string | null;
            paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
            orderId: string | null;
            loyaltyPointsUsed: number;
            walletAmountUsed: number;
            transactionId: string | null;
            failureReason: string | null;
        }, {
            id: string;
            customerId: string;
            vendorId: string | null;
            amount: number;
            couponCode: string | null;
            promotionId: string | null;
            discountAmount: number;
            paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            bookingId: string | null;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            razorpaySignature: string | null;
            paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
            orderId: string | null;
            loyaltyPointsUsed: number;
            walletAmountUsed: number;
            transactionId: string | null;
            failureReason: string | null;
        }>;
    }, "strip", z.ZodTypeAny, {
        paymentId: string;
        payment: {
            id: string;
            customerId: string;
            vendorId: string | null;
            amount: number;
            couponCode: string | null;
            promotionId: string | null;
            discountAmount: number;
            paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            bookingId: string | null;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            razorpaySignature: string | null;
            paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
            orderId: string | null;
            loyaltyPointsUsed: number;
            walletAmountUsed: number;
            transactionId: string | null;
            failureReason: string | null;
        };
    }, {
        paymentId: string;
        payment: {
            id: string;
            customerId: string;
            vendorId: string | null;
            amount: number;
            couponCode: string | null;
            promotionId: string | null;
            discountAmount: number;
            paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            bookingId: string | null;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            razorpaySignature: string | null;
            paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
            orderId: string | null;
            loyaltyPointsUsed: number;
            walletAmountUsed: number;
            transactionId: string | null;
            failureReason: string | null;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        paymentId: string;
        payment: {
            id: string;
            customerId: string;
            vendorId: string | null;
            amount: number;
            couponCode: string | null;
            promotionId: string | null;
            discountAmount: number;
            paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            bookingId: string | null;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            razorpaySignature: string | null;
            paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
            orderId: string | null;
            loyaltyPointsUsed: number;
            walletAmountUsed: number;
            transactionId: string | null;
            failureReason: string | null;
        };
    };
}, {
    success: true;
    data: {
        paymentId: string;
        payment: {
            id: string;
            customerId: string;
            vendorId: string | null;
            amount: number;
            couponCode: string | null;
            promotionId: string | null;
            discountAmount: number;
            paymentStatus: "pending" | "completed" | "processing" | "refunded" | "failed" | "partially_refunded";
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            bookingId: string | null;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            razorpaySignature: string | null;
            paymentMethod: "razorpay" | "wallet" | "cash" | "card" | "upi" | "netbanking";
            orderId: string | null;
            loyaltyPointsUsed: number;
            walletAmountUsed: number;
            transactionId: string | null;
            failureReason: string | null;
        };
    };
}>;
export declare const ProcessRefundResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        refundId: z.ZodString;
        paymentId: z.ZodString;
        amount: z.ZodNumber;
        status: z.ZodString;
        requiresApproval: z.ZodBoolean;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        status: string;
        amount: number;
        paymentId: string;
        refundId: string;
        requiresApproval: boolean;
    }, {
        message: string;
        status: string;
        amount: number;
        paymentId: string;
        refundId: string;
        requiresApproval: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        message: string;
        status: string;
        amount: number;
        paymentId: string;
        refundId: string;
        requiresApproval: boolean;
    };
}, {
    success: true;
    data: {
        message: string;
        status: string;
        amount: number;
        paymentId: string;
        refundId: string;
        requiresApproval: boolean;
    };
}>;
export declare const WalletResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        wallet: z.ZodObject<{
            balance: z.ZodNumber;
            currency: z.ZodDefault<z.ZodString>;
            transactions: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["credit", "debit"]>;
                amount: z.ZodNumber;
                description: z.ZodString;
                createdAt: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: "credit" | "debit";
                id: string;
                amount: number;
                createdAt: string;
                description: string;
            }, {
                type: "credit" | "debit";
                id: string;
                amount: number;
                createdAt: string;
                description: string;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            currency: string;
            balance: number;
            transactions?: {
                type: "credit" | "debit";
                id: string;
                amount: number;
                createdAt: string;
                description: string;
            }[] | undefined;
        }, {
            balance: number;
            currency?: string | undefined;
            transactions?: {
                type: "credit" | "debit";
                id: string;
                amount: number;
                createdAt: string;
                description: string;
            }[] | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        wallet: {
            currency: string;
            balance: number;
            transactions?: {
                type: "credit" | "debit";
                id: string;
                amount: number;
                createdAt: string;
                description: string;
            }[] | undefined;
        };
    }, {
        wallet: {
            balance: number;
            currency?: string | undefined;
            transactions?: {
                type: "credit" | "debit";
                id: string;
                amount: number;
                createdAt: string;
                description: string;
            }[] | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        wallet: {
            currency: string;
            balance: number;
            transactions?: {
                type: "credit" | "debit";
                id: string;
                amount: number;
                createdAt: string;
                description: string;
            }[] | undefined;
        };
    };
}, {
    success: true;
    data: {
        wallet: {
            balance: number;
            currency?: string | undefined;
            transactions?: {
                type: "credit" | "debit";
                id: string;
                amount: number;
                createdAt: string;
                description: string;
            }[] | undefined;
        };
    };
}>;
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
//# sourceMappingURL=payments.d.ts.map