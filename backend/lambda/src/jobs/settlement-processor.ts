/**
 * ============================================================================
 * SETTLEMENT QUEUE PROCESSOR
 * ============================================================================
 * 
 * Lambda function that processes settlements from SQS queue
 * Triggered by: SQS event source mapping from settlement queue
 * 
 * Handles:
 * - Automatic settlement processing
 * - Razorpay Route API transfers
 * - Settlement status tracking
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { SQSEvent, Context } from 'aws-lambda';
import { select, insert, update, query } from '../database/rds-connection';
// Import Razorpay client - check if it exists
let getRazorpayClient: () => any;
try {
  const razorpayModule = require('../utils/razorpay-client');
  getRazorpayClient = razorpayModule.getRazorpayClient || (() => {
    throw new Error('Razorpay client not configured');
  });
} catch (error) {
  getRazorpayClient = () => {
    throw new Error('Razorpay client module not found');
  };
}

interface SettlementMessage {
  bookingId: string;
  vendorId: string;
  amount: number;
  commission: number;
  vendorAmount: number;
  settlementType: 'automatic' | 'scheduled' | 'manual';
  scheduledDate?: string;
}

export async function handler(event: SQSEvent, context: Context) {
  console.log('Settlement processor triggered', { recordCount: event.Records.length });

  const results = [];

  for (const record of event.Records) {
    try {
      // Parse SNS message if it came from SNS → SQS
      let messageBody = record.body;
      if (record.body.startsWith('{') && JSON.parse(record.body).Message) {
        const snsMessage = JSON.parse(record.body);
        messageBody = snsMessage.Message;
      }

      const settlement: SettlementMessage = JSON.parse(messageBody);
      console.log('Processing settlement:', { bookingId: settlement.bookingId, vendorId: settlement.vendorId });

      await processSettlement(settlement);

      results.push({ messageId: record.messageId, status: 'success' });
    } catch (error: any) {
      console.error('Error processing settlement:', record.body, error);
      results.push({ 
        messageId: record.messageId, 
        status: 'failed', 
        error: error.message 
      });
      // Don't throw - continue processing other messages
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      processed: results.length,
      results 
    }),
  };
}

async function processSettlement(settlement: SettlementMessage) {
  // Check if settlement already exists
  const existingSettlements = await query(
    `SELECT * FROM settlements 
     WHERE booking_id = $1 AND vendor_id = $2 AND status IN ('pending', 'processing', 'completed')`,
    [settlement.bookingId, settlement.vendorId]
  );

  const existingRows = Array.isArray(existingSettlements) 
    ? existingSettlements 
    : (existingSettlements as any).rows || [];

  if (existingRows.length > 0) {
    console.log(`Settlement already exists for booking ${settlement.bookingId}`);
    return;
  }

  // Create settlement record
  const settlementId = crypto.randomUUID();
  await insert('settlements', {
    id: settlementId,
    booking_id: settlement.bookingId,
    vendor_id: settlement.vendorId,
    total_amount: settlement.amount,
    commission_amount: settlement.commission,
    vendor_amount: settlement.vendorAmount,
    settlement_type: settlement.settlementType,
    scheduled_date: settlement.scheduledDate || null,
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  // Process settlement if automatic
  if (settlement.settlementType === 'automatic') {
    await executeSettlement(settlementId, settlement);
  } else {
    console.log(`Settlement ${settlementId} scheduled for ${settlement.scheduledDate || 'manual processing'}`);
  }
}

async function executeSettlement(settlementId: string, settlement: SettlementMessage) {
  try {
    // Get vendor's Razorpay linked account
    const vendors = await select('vendors', { id: settlement.vendorId });
    if (vendors.length === 0) {
      throw new Error(`Vendor ${settlement.vendorId} not found`);
    }

    const vendor = vendors[0];
    const linkedAccountId = vendor.razorpay_linked_account_id;

    if (!linkedAccountId) {
      throw new Error(`Vendor ${settlement.vendorId} does not have Razorpay linked account`);
    }

    // Update settlement status to processing
    await update('settlements', { id: settlementId }, {
      status: 'processing',
      processed_at: new Date().toISOString(),
    });

    // Transfer funds via Razorpay Route API
    const razorpayClient = getRazorpayClient();
    
    // Get payment ID from booking
    const bookings = await select('bookings', { id: settlement.bookingId });
    if (bookings.length === 0) {
      throw new Error(`Booking ${settlement.bookingId} not found`);
    }

    const booking = bookings[0];
    const paymentId = booking.payment_id;

    if (!paymentId) {
      throw new Error(`Booking ${settlement.bookingId} does not have payment ID`);
    }

    // Create transfer via Razorpay Route API
    const transfer = await razorpayClient.transfers.create({
      account: linkedAccountId,
      amount: Math.round(settlement.vendorAmount * 100), // Convert to paise
      currency: 'INR',
      notes: {
        booking_id: settlement.bookingId,
        settlement_id: settlementId,
        type: 'vendor_settlement',
      },
    });

    console.log(`Transfer created: ${transfer.id}`);

    // Update settlement with transfer details
    await update('settlements', { id: settlementId }, {
      status: 'completed',
      razorpay_transfer_id: transfer.id,
      completed_at: new Date().toISOString(),
    });

    // Log settlement completion
    await insert('settlement_logs', {
      settlement_id: settlementId,
      action: 'transfer_created',
      transfer_id: transfer.id,
      amount: settlement.vendorAmount,
      status: 'success',
      created_at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error executing settlement:', error);
    
    // Update settlement status to failed
    await update('settlements', { id: settlementId }, {
      status: 'failed',
      error_message: error.message,
      failed_at: new Date().toISOString(),
    });

    // Log settlement failure
    await insert('settlement_logs', {
      settlement_id: settlementId,
      action: 'transfer_failed',
      error_message: error.message,
      status: 'failed',
      created_at: new Date().toISOString(),
    });

    throw error; // Re-throw to trigger DLQ
  }
}
