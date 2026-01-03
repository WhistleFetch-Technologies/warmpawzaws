/**
 * ============================================================================
 * SETTLEMENTS & PAYOUTS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor settlements and payouts:
 * - Calculate daily settlements
 * - Process payouts
 * - Get settlement history
 * - Vendor bank account management
 * 
 * Migrated from: supabase/functions/make-server-payment/settlement-automation.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { getRazorpayClient } from '../utils/razorpay-client';
import { getSnsClient } from '../utils/sns-client';
import { PublishCommand } from '@aws-sdk/client-sns';

export function registerSettlementEndpoints(app: Hono) {
  /**
   * POST /settlements/calculate-daily
   * Calculate daily settlements (cron job)
   * ✅ TEMPORAL FIX: Uses advisory locks to prevent concurrent execution
   */
  app.post("/settlements/calculate-daily", async (c) => {
    try {
      // ✅ TEMPORAL FIX: Acquire advisory lock to prevent concurrent settlement calculations
      const lockId = 999999; // Unique ID for settlement calculation lock
      const lockAcquired = await query(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [lockId]
      );

      if (!lockAcquired.rows[0].acquired) {
        return c.json({
          success: false,
          message: 'Settlement calculation already in progress',
        }, 409);
      }

      try {
        // Get payout rules from platform settings
      const settings = await select('platform_settings', { setting_key: 'admin:settings:payout_rules' });
      const rules = settings.length > 0
        ? (settings[0].setting_value as any)
        : {
            holdPeriodDays: 7,
            minimumPayout: 1000,
            autoPayout: true,
            defaultCommission: 10,
          };

      const holdPeriodMs = rules.holdPeriodDays * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(Date.now() - holdPeriodMs);

      // Get eligible bookings (completed, past hold period, not settled)
      const eligibleBookings = await query(
        `SELECT b.*, v.commission_percentage, v.tier
         FROM bookings b
         INNER JOIN vendors v ON b.vendor_id = v.id
         WHERE b.status = 'completed'
         AND b.completed_at < $1
         AND b.settled_at IS NULL
         ORDER BY b.completed_at ASC`,
        [cutoffDate]
      );

      // Group by vendor
      const vendorSettlements: Record<string, any> = {};

      for (const booking of eligibleBookings.rows) {
        const vendorId = booking.vendor_id;
        if (!vendorSettlements[vendorId]) {
          vendorSettlements[vendorId] = {
            vendorId,
            bookingIds: [],
            totalAmount: 0,
            commissionAmount: 0,
            netAmount: 0,
          };
        }

        const commissionRate = parseFloat(booking.commission_percentage || rules.defaultCommission);
        const bookingAmount = parseFloat(booking.total_amount || '0');
        const commissionAmount = (bookingAmount * commissionRate) / 100;
        const netAmount = bookingAmount - commissionAmount;

        vendorSettlements[vendorId].bookingIds.push(booking.id);
        vendorSettlements[vendorId].totalAmount += bookingAmount;
        vendorSettlements[vendorId].commissionAmount += commissionAmount;
        vendorSettlements[vendorId].netAmount += netAmount;
      }

      // Create settlements
      const settlements = [];
      for (const vendorId in vendorSettlements) {
        const settlement = vendorSettlements[vendorId];

        // Check minimum payout
        if (settlement.netAmount < rules.minimumPayout) {
          continue;
        }

        // Create settlement record
        const settlementRecord = await insert('settlements', {
          vendor_id: vendorId,
          total_amount: settlement.totalAmount,
          commission_amount: settlement.commissionAmount,
          net_amount: settlement.netAmount,
          settlement_status: rules.autoPayout ? 'processing' : 'pending',
          settlement_period_start: cutoffDate.toISOString().split('T')[0],
          settlement_period_end: new Date().toISOString().split('T')[0],
          payment_ids: settlement.bookingIds,
        });

        // Mark bookings as settled
        await query(
          `UPDATE bookings
           SET settled_at = NOW(),
               settlement_status = 'settled'
           WHERE id = ANY($1)`,
          [settlement.bookingIds]
        );

        settlements.push(settlementRecord[0]);

        // If auto-payout, create payout
        if (rules.autoPayout) {
          await createPayout(settlementRecord[0].id, vendorId, settlement.netAmount);
        }

        // Notify vendor
        const snsClient = getSnsClient();
        await snsClient.send(new PublishCommand({
          TopicArn: process.env.SETTLEMENT_CREATED_TOPIC_ARN || '',
          Message: JSON.stringify({
            eventType: 'SettlementCreated',
            vendorId,
            settlementId: settlementRecord[0].id,
            amount: settlement.netAmount,
          }),
        }));
      }

      return c.json({
        success: true,
        settlementsCreated: settlements.length,
        totalAmount: settlements.reduce((sum: number, s: any) => sum + parseFloat(s.net_amount || '0'), 0),
        settlements,
      });
      } finally {
        // ✅ TEMPORAL FIX: Release advisory lock
        await query('SELECT pg_advisory_unlock($1)', [lockId]);
      }
    } catch (error: any) {
      console.error('Error calculating settlements:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /settlements/vendor/:vendorId
   * Get vendor settlement history
   */
  app.get("/settlements/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const settlements = await query(
        `SELECT * FROM settlements
         WHERE vendor_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [vendorId]
      );

      return c.json({
        success: true,
        settlements: settlements.rows,
        total: settlements.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching settlements:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /payouts/vendor/:vendorId
   * Get vendor payout history
   */
  app.get("/payouts/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const payouts = await query(
        `SELECT * FROM payouts
         WHERE vendor_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [vendorId]
      );

      return c.json({
        success: true,
        payouts: payouts.rows,
        total: payouts.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching payouts:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /payouts/process
   * Process a payout (admin or automated)
   */
  app.post("/payouts/process", async (c) => {
    try {
      const { settlementId, vendorId, amount } = await c.req.json();

      if (!settlementId || !vendorId || !amount) {
        return c.json({ error: 'settlementId, vendorId, and amount are required' }, 400);
      }

      // Get vendor bank details
      const bankDetails = await select('vendor_bank_details', { vendor_id: vendorId });
      if (bankDetails.length === 0) {
        return c.json({ error: 'Vendor bank details not found' }, 404);
      }

      const bank = bankDetails[0];

      // Create payout record
      const payout = await insert('payouts', {
        vendor_id: vendorId,
        amount: amount,
        settlement_id: settlementId,
        bank_account_number: bank.account_number,
        ifsc_code: bank.ifsc_code,
        account_holder_name: bank.account_holder_name,
        payout_status: 'processing',
      });

      // Process via Razorpay
      try {
        const razorpayClient = await getRazorpayClient();
        const payoutResponse = await razorpayClient.payouts.create({
          account_number: bank.account_number,
          fund_account: {
            account_type: 'bank_account',
            bank_account: {
              name: bank.account_holder_name,
              ifsc: bank.ifsc_code,
              account_number: bank.account_number,
            },
          },
          amount: Math.round(amount * 100), // Convert to paise
          currency: 'INR',
          mode: 'IMPS',
          purpose: 'payout',
          queue_if_low_balance: true,
          reference_id: `PAYOUT-${payout[0].id}`,
        });

        // Update payout with Razorpay ID
        await update('payouts',
          { id: payout[0].id },
          {
            razorpay_payout_id: payoutResponse.id,
            payout_status: 'processing',
          }
        );

        return c.json({
          success: true,
          payout: payout[0],
          razorpayPayoutId: payoutResponse.id,
          message: 'Payout initiated successfully',
        });
      } catch (razorpayError: any) {
        // Update payout as failed
        await update('payouts',
          { id: payout[0].id },
          {
            payout_status: 'failed',
            failure_reason: razorpayError.message,
          }
        );

        throw razorpayError;
      }
    } catch (error: any) {
      console.error('Error processing payout:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/bank-details
   * Add/update vendor bank details
   */
  app.post("/vendor/:vendorId/bank-details", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const bankData = await c.req.json();
      const {
        accountNumber,
        ifscCode,
        accountHolderName,
        bankName,
      } = bankData;

      if (!accountNumber || !ifscCode || !accountHolderName) {
        return c.json({ error: 'accountNumber, ifscCode, and accountHolderName are required' }, 400);
      }

      // Check if exists
      const existing = await select('vendor_bank_details', { vendor_id: vendorId });

      let bankDetails;
      if (existing.length > 0) {
        // Update
        const updated = await update('vendor_bank_details',
          { vendor_id: vendorId },
          {
            account_number: accountNumber,
            ifsc_code: ifscCode,
            account_holder_name: accountHolderName,
            bank_name: bankName || null,
          }
        );
        bankDetails = updated[0];
      } else {
        // Create
        const created = await insert('vendor_bank_details', {
          vendor_id: vendorId,
          account_number: accountNumber,
          ifsc_code: ifscCode,
          account_holder_name: accountHolderName,
          bank_name: bankName || null,
        });
        bankDetails = created[0];
      }

      return c.json({
        success: true,
        bankDetails,
        message: 'Bank details saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving bank details:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/bank-details
   * Get vendor bank details
   */
  app.get("/vendor/:vendorId/bank-details", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const bankDetails = await select('vendor_bank_details', { vendor_id: vendorId });

      if (bankDetails.length === 0) {
        return c.json({ error: 'Bank details not found' }, 404);
      }

      // Mask account number for security
      const bank = bankDetails[0];
      const maskedAccount = bank.account_number
        ? `****${bank.account_number.slice(-4)}`
        : null;

      return c.json({
        success: true,
        bankDetails: {
          ...bank,
          account_number: maskedAccount, // Masked for security
        },
      });
    } catch (error: any) {
      console.error('Error fetching bank details:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * Helper function to create payout
   */
  async function createPayout(settlementId: string, vendorId: string, amount: number) {
    // Get vendor bank details
    const bankDetails = await select('vendor_bank_details', { vendor_id: vendorId });
    if (bankDetails.length === 0) {
      console.warn(`Vendor ${vendorId} has no bank details, skipping payout`);
      return;
    }

    const bank = bankDetails[0];

    // Create payout record
    await insert('payouts', {
      vendor_id: vendorId,
      amount: amount,
      settlement_id: settlementId,
      bank_account_number: bank.account_number,
      ifsc_code: bank.ifsc_code,
      account_holder_name: bank.account_holder_name,
      payout_status: 'pending',
    });
  }
}

