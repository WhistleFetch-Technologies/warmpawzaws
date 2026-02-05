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
import { randomUUID } from 'crypto';
import { select, insert, update, query } from '../database/rds-connection';
import crypto from 'crypto';

interface SettlementMessage {
  bookingId: string;
  vendorId: string;
  amount: number;
  commission?: number;
  vendorAmount?: number;
  settlementType?: 'automatic' | 'scheduled' | 'manual';
  scheduledDate?: string;
  trigger?: string; // 'booking_completed', 'payment_verified', 'daily_cron', etc.
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

  // ✅ FIX: Determine settlement type - automatic if trigger is booking_completed
  const settlementType = settlement.trigger === 'booking_completed' ? 'automatic' : (settlement.settlementType || 'automatic');
  
  // ✅ Get vendor tier information for detailed breakup
  const vendorResult = await query(
    `SELECT v.*, vt.tier_name, vt.commission_rate as tier_commission_rate
     FROM vendors v
     LEFT JOIN vendor_tiers vt ON v.tier = vt.tier_name
     WHERE v.id = $1`,
    [settlement.vendorId]
  );
  const vendorRows = Array.isArray(vendorResult) ? vendorResult : vendorResult.rows || [];
  const vendor = vendorRows[0] || {};
  
  const tierName = vendor.tier || vendor.tier_name || 'Bronze';
  const commissionRate = parseFloat(settlement.commission && settlement.amount 
    ? ((settlement.commission / settlement.amount) * 100).toFixed(2)
    : vendor.tier_commission_rate || vendor.commission_percentage || '10');
  
  // ✅ Check for pending tier upgrade deductions
  const pendingDeductions = await query(
    `SELECT * FROM tier_upgrade_deductions 
     WHERE vendor_id = $1 AND status IN ('pending', 'in_progress')
     ORDER BY created_at ASC
     LIMIT 1`,
    [settlement.vendorId]
  ).catch(() => ({ rows: [] }));
  
  const deductionRows = Array.isArray(pendingDeductions) ? pendingDeductions : pendingDeductions.rows || [];
  const tierDeduction = deductionRows[0];
  
  let tierDeductionAmount = 0;
  let tierDeductionDescription = '';
  
  if (tierDeduction) {
    // Calculate deduction amount for this settlement
    tierDeductionAmount = Math.min(
      parseFloat(tierDeduction.amount_per_installment || '0'),
      parseFloat(tierDeduction.amount_remaining || '0')
    );
    
    const installmentNumber = (tierDeduction.installments_completed || 0) + 1;
    tierDeductionDescription = `Tier upgrade recovery (${installmentNumber}/${tierDeduction.recovery_installments})`;
    
    console.log(`📉 [SETTLEMENT] Tier deduction: ₹${tierDeductionAmount} for ${tierDeductionDescription}`);
  }
  
  // Calculate amounts
  const grossAmount = settlement.amount;
  const commissionAmount = settlement.commission || 0;
  const vendorAmountBeforeDeduction = settlement.vendorAmount || (grossAmount - commissionAmount);
  const vendorAmountAfterDeduction = vendorAmountBeforeDeduction - tierDeductionAmount;
  
  // ✅ Create detailed settlement breakup with explanations
  const settlementBreakup = {
    booking: {
      label: 'Booking Amount',
      amount: grossAmount,
      explanation: 'Total amount charged to customer for this service',
    },
    commission: {
      label: `Platform Commission (${commissionRate}%)`,
      amount: commissionAmount,
      explanation: `Platform fee based on your ${tierName} tier. Lower tiers have higher commission. Upgrade to a higher tier to reduce commission.`,
      how: `Booking Amount × ${commissionRate}% = ₹${commissionAmount.toFixed(2)}`,
    },
    tierDeduction: tierDeductionAmount > 0 ? {
      label: tierDeductionDescription,
      amount: tierDeductionAmount,
      explanation: `Recovering tier upgrade cost from your earnings. This amount is being deducted from your first ${tierDeduction?.recovery_installments || 2} payouts.`,
      how: `Tier upgrade cost ÷ ${tierDeduction?.recovery_installments || 2} installments = ₹${tierDeductionAmount.toFixed(2)} per payout`,
      remaining: parseFloat(tierDeduction?.amount_remaining || '0') - tierDeductionAmount,
      installmentNumber: (tierDeduction?.installments_completed || 0) + 1,
      totalInstallments: tierDeduction?.recovery_installments || 2,
    } : null,
    netPayout: {
      label: 'Net Amount to Bank',
      amount: vendorAmountAfterDeduction,
      explanation: 'This amount will be credited to your verified bank account',
      how: tierDeductionAmount > 0
        ? `Booking (₹${grossAmount}) - Commission (₹${commissionAmount}) - Tier Recovery (₹${tierDeductionAmount}) = ₹${vendorAmountAfterDeduction.toFixed(2)}`
        : `Booking (₹${grossAmount}) - Commission (₹${commissionAmount}) = ₹${vendorAmountAfterDeduction.toFixed(2)}`,
    },
    summary: {
      tierName,
      commissionRate,
      tierBenefit: `${tierName} tier gives you ${commissionRate}% commission rate`,
      nextTierSavings: tierName !== 'Platinum' 
        ? `Upgrade to save more on commission!` 
        : 'You have the best commission rate!',
    },
  };
  
  // Create settlement record with breakup
  const settlementId = randomUUID();
  await insert('settlements', {
    id: settlementId,
    booking_id: settlement.bookingId,
    vendor_id: settlement.vendorId,
    total_amount: grossAmount,
    commission_amount: commissionAmount,
    vendor_amount: vendorAmountAfterDeduction,
    tier_deduction_amount: tierDeductionAmount,
    settlement_type: settlementType,
    scheduled_date: settlement.scheduledDate || null,
    status: 'pending',
    settlement_breakup: JSON.stringify(settlementBreakup),
    created_at: new Date().toISOString(),
  });
  
  // ✅ Update tier deduction if applicable
  if (tierDeduction && tierDeductionAmount > 0) {
    const newAmountRecovered = parseFloat(tierDeduction.amount_recovered || '0') + tierDeductionAmount;
    const newAmountRemaining = parseFloat(tierDeduction.amount_remaining || '0') - tierDeductionAmount;
    const newInstallmentsCompleted = (tierDeduction.installments_completed || 0) + 1;
    const isCompleted = newAmountRemaining <= 0 || newInstallmentsCompleted >= tierDeduction.recovery_installments;
    
    await update('tier_upgrade_deductions', { id: tierDeduction.id }, {
      amount_recovered: newAmountRecovered,
      amount_remaining: Math.max(0, newAmountRemaining),
      installments_completed: newInstallmentsCompleted,
      status: isCompleted ? 'completed' : 'in_progress',
      completed_at: isCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    
    // Record the deduction transaction
    await insert('tier_deduction_transactions', {
      deduction_id: tierDeduction.id,
      settlement_id: settlementId,
      vendor_id: settlement.vendorId,
      installment_number: newInstallmentsCompleted,
      amount: tierDeductionAmount,
      settlement_gross_amount: vendorAmountBeforeDeduction,
      settlement_net_amount: vendorAmountAfterDeduction,
      description: tierDeductionDescription,
    });
    
    console.log(`✅ [TIER-DEDUCTION] Recorded: ₹${tierDeductionAmount}, Remaining: ₹${newAmountRemaining}`);
  }
  
  // ✅ Update vendor_earnings record to link with settlement
  await query(
    `UPDATE vendor_earnings 
     SET settlement_id = $1, status = 'settled'
     WHERE booking_id = $2 AND vendor_id = $3`,
    [settlementId, settlement.bookingId, settlement.vendorId]
  );

  // Process settlement if automatic (with updated vendor amount after deduction)
  if (settlementType === 'automatic') {
    // Update settlement message with adjusted amount
    const adjustedSettlement = {
      ...settlement,
      vendorAmount: vendorAmountAfterDeduction,
    };
    await executeSettlement(settlementId, adjustedSettlement);
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
    
    // ✅ FIX: Use razorpay_account_id (created during onboarding) instead of razorpay_linked_account_id
    const linkedAccountId = vendor.razorpay_account_id || vendor.razorpay_linked_account_id;

    if (!linkedAccountId) {
      throw new Error(`Vendor ${settlement.vendorId} does not have Razorpay linked account configured. Please complete bank account setup.`);
    }
    
    // ✅ CRITICAL: Verify bank account is verified before processing settlement
    if (!vendor.bank_verified) {
      throw new Error(`Vendor ${settlement.vendorId} bank account is not verified. Settlement cannot be processed until bank account is verified.`);
    }

    // Update settlement status to processing
    await update('settlements', { id: settlementId }, {
      status: 'processing',
      processed_at: new Date().toISOString(),
    });

    // Transfer funds via Razorpay Route API
    const { razorpayRequest } = await import('../utils/razorpay-client');
    
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
    
    // ✅ FIX: Calculate vendor amount if not provided
    const vendorAmount = settlement.vendorAmount || (settlement.amount - (settlement.commission || 0));
    
    if (vendorAmount <= 0) {
      throw new Error(`Invalid vendor amount: ${vendorAmount}. Cannot process settlement.`);
    }

    // ✅ FIX: Create transfer via Razorpay Route API using razorpayRequest
    // In Razorpay Route API, transfers are created from payments to linked accounts
    const transfer = await razorpayRequest('/transfers', 'POST', {
      account: linkedAccountId,
      amount: Math.round(vendorAmount * 100), // Convert to paise
      currency: 'INR',
      linked_account_notes: {
        booking_id: settlement.bookingId,
        settlement_id: settlementId,
        vendor_id: settlement.vendorId,
      },
      notes: {
        booking_id: settlement.bookingId,
        settlement_id: settlementId,
        vendor_id: settlement.vendorId,
        type: 'vendor_settlement',
        payment_id: paymentId,
      },
      on_hold: false,
      on_hold_until: null,
    });

    console.log(`✅ [SETTLEMENT] Razorpay transfer created: ${transfer.id} for ₹${vendorAmount}`);

    // Update settlement with transfer details
    await update('settlements', { id: settlementId }, {
      status: 'completed',
      razorpay_transfer_id: transfer.id,
      completed_at: new Date().toISOString(),
    });
    
    // ✅ Update vendor_earnings record to mark as paid_out
    await query(
      `UPDATE vendor_earnings 
       SET status = 'paid_out', paid_out_at = NOW()
       WHERE booking_id = $1 AND vendor_id = $2 AND settlement_id = $3`,
      [settlement.bookingId, settlement.vendorId, settlementId]
    );
    
    // ✅ Update vendor's pending_payout (reduce by settled amount)
    await query(
      `UPDATE vendors 
       SET pending_payout = GREATEST(COALESCE(pending_payout, 0) - $1, 0),
           updated_at = NOW()
       WHERE id = $2`,
      [vendorAmount, settlement.vendorId]
    );

    // Log settlement completion
    await insert('settlement_logs', {
      settlement_id: settlementId,
      action: 'transfer_created',
      transfer_id: transfer.id,
      amount: vendorAmount,
      status: 'success',
      created_at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error executing settlement:', error);

    const errMsg = error?.message || String(error);

    // Update settlement status to failed (failure_reason for admin Finance & Logistics)
    await update('settlements', { id: settlementId }, {
      status: 'failed',
      failure_reason: errMsg,
      failed_at: new Date().toISOString(),
    } as any);

    // Log settlement failure
    try {
      await insert('settlement_logs', {
        settlement_id: settlementId,
        action: 'transfer_failed',
        error_message: errMsg,
        status: 'failed',
        created_at: new Date().toISOString(),
      } as any);
    } catch (logErr) {
      console.warn('Could not insert settlement_logs:', logErr);
    }

    throw error; // Re-throw to trigger DLQ
  }
}
