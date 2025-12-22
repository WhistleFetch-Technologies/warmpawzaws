/**
 * ============================================================================
 * TRANSACTION HELPER
 * ============================================================================
 * 
 * Provides transactional safety for multi-step operations
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";

/**
 * Execute operations in a transaction using raw SQL
 */
export async function withTransaction<T>(
  operations: (tx: TransactionContext) => Promise<T>
): Promise<T> {
  const client = getDbClient();
  const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    // Begin transaction
    await client.rpc('begin_transaction', { tx_id: txId });
    
    const txContext: TransactionContext = {
      txId,
      async query(sql: string, params?: any[]) {
        return await selectQuery(sql, params);
      },
      async insert(table: string, data: any) {
        return await insertQuery(table, data);
      },
      async update(table: string, where: any, data: any) {
        return await updateQuery(table, where, data);
      }
    };
    
    const result = await operations(txContext);
    
    // Commit transaction
    await client.rpc('commit_transaction', { tx_id: txId });
    
    return result;
  } catch (error) {
    // Rollback transaction
    try {
      await client.rpc('rollback_transaction', { tx_id: txId });
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError);
    }
    throw error;
  }
}

export interface TransactionContext {
  txId: string;
  query(sql: string, params?: any[]): Promise<any[]>;
  insert(table: string, data: any): Promise<any[]>;
  update(table: string, where: any, data: any): Promise<any[]>;
}

/**
 * Create booking with payment atomically
 */
export async function createBookingWithPayment(
  bookingData: any,
  paymentData: any
): Promise<{ booking: any; payment: any }> {
  return await withTransaction(async (tx) => {
    // Create payment first
    const payments = await tx.insert('payments', {
      customer_id: paymentData.customer_id,
      booking_id: null, // Will update after booking creation
      amount: paymentData.amount,
      status: 'processing',
      payment_method: paymentData.payment_method,
      payment_gateway: paymentData.payment_gateway,
      gateway_transaction_id: paymentData.gateway_transaction_id,
      created_at: new Date().toISOString()
    });
    
    const payment = payments[0];
    
    // Create booking
    const bookings = await tx.insert('bookings', {
      ...bookingData,
      payment_id: payment.id,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    
    const booking = bookings[0];
    
    // Update payment with booking ID
    await tx.update('payments', { id: payment.id }, { booking_id: booking.id });
    
    // Log transaction
    await tx.insert('booking_transaction_log', {
      booking_id: booking.id,
      transaction_type: 'create',
      details: { payment_id: payment.id }
    });
    
    return { booking, payment };
  });
}

/**
 * Complete booking with settlement atomically
 */
export async function completeBookingWithSettlement(
  bookingId: string,
  settlementData: any
): Promise<{ booking: any; settlement: any }> {
  return await withTransaction(async (tx) => {
    // Update booking status
    const bookings = await tx.update('bookings', { id: bookingId }, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    
    const booking = bookings[0];
    
    // Create settlement
    const settlements = await tx.insert('settlements', {
      vendor_id: settlementData.vendor_id,
      booking_id: bookingId,
      payment_id: booking.payment_id,
      settlement_amount: settlementData.settlement_amount,
      commission_amount: settlementData.commission_amount,
      vendor_amount: settlementData.vendor_amount,
      settlement_status: 'pending',
      created_at: new Date().toISOString()
    });
    
    const settlement = settlements[0];
    
    // Log transaction
    await tx.insert('booking_transaction_log', {
      booking_id: bookingId,
      transaction_type: 'settlement',
      details: { settlement_id: settlement.id }
    });
    
    return { booking, settlement };
  });
}

/**
 * Process refund atomically
 */
export async function processRefundAtomically(
  paymentId: string,
  refundData: any
): Promise<{ payment: any; refund: any }> {
  return await withTransaction(async (tx) => {
    // Get payment
    const payments = await tx.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );
    
    if (!payments || payments.length === 0) {
      throw new Error('Payment not found');
    }
    
    const payment = payments[0];
    
    // Create refund
    const refunds = await tx.insert('refunds', {
      payment_id: paymentId,
      booking_id: payment.booking_id,
      amount: refundData.amount,
      refund_method: refundData.refund_method,
      status: 'processing',
      reason: refundData.reason,
      created_at: new Date().toISOString()
    });
    
    const refund = refunds[0];
    
    // Update payment status
    await tx.update('payments', { id: paymentId }, {
      status: refundData.amount === payment.amount ? 'refunded' : 'partially_refunded'
    });
    
    // Log transaction
    await tx.insert('payment_transaction_log', {
      payment_id: paymentId,
      transaction_type: 'refund',
      amount: refundData.amount,
      details: { refund_id: refund.id }
    });
    
    return { payment, refund };
  });
}

