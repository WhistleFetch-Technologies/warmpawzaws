/**
 * ============================================================================
 * PAYMENTS REPOSITORY
 * ============================================================================
 * 
 * Repository for payment data access.
 * Replaces: payment:{paymentId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, withTransaction } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface Payment {
  id: string;
  booking_id?: string | null;
  order_id?: string | null;
  customer_id: string;
  vendor_id?: string | null;
  amount: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_signature?: string | null;
  discount_amount: number;
  coupon_code?: string | null;
  promotion_id?: string | null;
  loyalty_points_used: number;
  wallet_amount_used: number;
  transaction_id?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface CreatePaymentInput {
  booking_id?: string;
  order_id?: string;
  customer_id: string;
  vendor_id?: string;
  amount: number;
  currency?: string;
  payment_method: string;
  discount_amount?: number;
  coupon_code?: string;
  promotion_id?: string;
  loyalty_points_used?: number;
  wallet_amount_used?: number;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

export interface UpdatePaymentInput {
  payment_status?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  transaction_id?: string;
  failure_reason?: string;
  completed_at?: string;
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class PaymentsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get payment by ID
   * Replaces: kv.get(`payment:${paymentId}`)
   */
  async findById(paymentId: string): Promise<Payment | null> {
    const results = await selectQuery<Payment>("payments", { id: paymentId }, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Get all payments (with optional filters)
   */
  async findAll(options?: { limit?: number; offset?: number; paymentStatus?: string }): Promise<Payment[]> {
    const conditions: any = {};
    if (options?.paymentStatus) {
      conditions.payment_status = options.paymentStatus;
    }
    
    return selectQuery<Payment>("payments", conditions, {
      limit: options?.limit || 1000,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  /**
   * Get payment by Razorpay order ID
   */
  async findByRazorpayOrderId(orderId: string): Promise<Payment | null> {
    const results = await selectQuery<Payment>("payments", { razorpay_order_id: orderId }, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Get payment by Razorpay payment ID
   */
  async findByRazorpayPaymentId(paymentId: string): Promise<Payment | null> {
    const results = await selectQuery<Payment>("payments", { razorpay_payment_id: paymentId }, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Get payments by customer
   * Replaces: customer:{id}:payments KV pattern
   */
  async findByCustomer(customerId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<Payment[]> {
    const filters: any = { customer_id: customerId };
    if (options?.status) {
      filters.payment_status = options.status;
    }
    
    return selectQuery<Payment>("payments", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  /**
   * Get payments by vendor
   * Replaces: vendor:{id}:payments KV pattern
   */
  async findByVendor(vendorId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<Payment[]> {
    const filters: any = { vendor_id: vendorId };
    if (options?.status) {
      filters.payment_status = options.status;
    }
    
    return selectQuery<Payment>("payments", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  /**
   * Get payments by booking
   */
  async findByBooking(bookingId: string): Promise<Payment[]> {
    return selectQuery<Payment>("payments", { booking_id: bookingId }, {
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  /**
   * Get payments by order
   */
  async findByOrder(orderId: string): Promise<Payment[]> {
    return selectQuery<Payment>("payments", { order_id: orderId }, {
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  /**
   * Create a new payment
   * Replaces: kv.set(`payment:${paymentId}`, paymentData)
   */
  async create(input: CreatePaymentInput): Promise<Payment> {
    const results = await insertQuery<Payment>("payments", {
      ...input,
      currency: input.currency || "INR",
      payment_status: "pending",
      discount_amount: input.discount_amount || 0,
      loyalty_points_used: input.loyalty_points_used || 0,
      wallet_amount_used: input.wallet_amount_used || 0,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create payment");
    }
    
    // Also create payment history entry
    await this.createPaymentHistory(results[0]);
    
    return results[0];
  }

  /**
   * Update payment
   * Replaces: kv.set(`payment:${paymentId}`, updatedData)
   */
  async update(paymentId: string, input: UpdatePaymentInput): Promise<Payment> {
    const updateData: any = {
      ...input,
      updated_at: new Date().toISOString(),
    };
    
    // If payment is completed, set completed_at
    if (input.payment_status === "completed" && !input.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }
    
    const results = await updateQuery<Payment>(
      "payments",
      { id: paymentId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Payment not found: ${paymentId}`);
    }
    
    // Update payment history if status changed
    if (input.payment_status) {
      await this.createPaymentHistory(results[0]);
    }
    
    return results[0];
  }

  /**
   * Mark payment as completed
   */
  async complete(paymentId: string, transactionId?: string): Promise<Payment> {
    return this.update(paymentId, {
      payment_status: "completed",
      transaction_id: transactionId,
      completed_at: new Date().toISOString(),
    });
  }

  /**
   * Mark payment as failed
   */
  async fail(paymentId: string, reason: string): Promise<Payment> {
    return this.update(paymentId, {
      payment_status: "failed",
      failure_reason: reason,
    });
  }

  /**
   * Mark payment as refunded
   */
  async refund(paymentId: string): Promise<Payment> {
    return this.update(paymentId, {
      payment_status: "refunded",
    });
  }

  /**
   * Create payment history entry
   * Replaces: customer:{id}:payments, vendor:{id}:payments KV patterns
   */
  private async createPaymentHistory(payment: Payment): Promise<void> {
    const client = getDbClient();
    await client.from("payment_history").insert({
      payment_id: payment.id,
      customer_id: payment.customer_id,
      vendor_id: payment.vendor_id,
      amount: payment.amount,
      payment_date: payment.completed_at || payment.created_at,
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: PaymentsRepository | null = null;

export function getPaymentsRepository(): PaymentsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new PaymentsRepository();
  }
  return repositoryInstance;
}

