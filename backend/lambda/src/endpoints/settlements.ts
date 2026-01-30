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
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

export function registerSettlementEndpoints(app: Hono) {
  /**
   * GET /settlements
   * Get all settlements with filtering (Admin UI endpoint)
   */
  app.get("/settlements", async (c) => {
    try {
      const status = c.req.query('status');
      const period = c.req.query('period'); // '7d', '30d', '90d', 'all'
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let queryStr = `
        SELECT 
          s.*,
          v.business_name as vendor_name,
          v.phone as vendor_phone
        FROM settlements s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (status && status !== 'all') {
        queryStr += ` AND s.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (period && period !== 'all') {
        const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
        queryStr += ` AND s.created_at >= NOW() - INTERVAL '${days} days'`;
      }

      queryStr += ` ORDER BY s.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const settlements = await query(queryStr, params).catch(() => ({ rows: [] }));

      // Align with DB: settlements table uses total_amount, vendor_amount (from settlement-processor); some code uses gross_amount, net_amount
      const safeSettlements = (settlements.rows || []).map((s: any) => {
        const gross = parseFloat(s.gross_amount ?? s.total_amount ?? '0');
        const net = parseFloat(s.net_amount ?? s.vendor_amount ?? '0');
        const commission = parseFloat(s.commission_amount || '0');
        return {
          id: String(s.id || ''),
          vendor_id: String(s.vendor_id || ''),
          vendor_name: String(s.vendor_name || ''),
          vendor_phone: String(s.vendor_phone || ''),
          period_start: s.period_start ? String(s.period_start) : '',
          period_end: s.period_end ? String(s.period_end) : '',
          gross_amount: gross,
          commission_amount: commission,
          net_amount: net,
          booking_count: parseInt(s.booking_count || '0', 10),
          status: String(s.status || 'pending'),
          payout_reference: s.payout_reference || undefined,
          payout_date: s.payout_date ? String(s.payout_date) : undefined,
          failure_reason: s.failure_reason || undefined,
          created_at: String(s.created_at || ''),
          updated_at: String(s.updated_at || ''),
        };
      });

      return c.json({
        success: true,
        settlements: safeSettlements,
        count: safeSettlements.length,
      });
    } catch (error: any) {
      console.error('Error fetching settlements:', error);
      return c.json({ success: true, settlements: [], count: 0 });
    }
  });

  /**
   * GET /settlements/summary
   * Get settlement summary statistics
   */
  app.get("/settlements/summary", async (c) => {
    try {
      const summary = await query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
          COUNT(*) FILTER (WHERE status = 'processing') as total_processing,
          COUNT(*) FILTER (WHERE status = 'completed') as total_completed,
          COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
          COALESCE(SUM(COALESCE(net_amount, vendor_amount)) FILTER (WHERE status = 'pending'), 0) as pending_amount,
          COALESCE(SUM(COALESCE(net_amount, vendor_amount)) FILTER (WHERE status = 'completed'), 0) as completed_amount
        FROM settlements
      `).catch(() => ({ rows: [{
        total_pending: '0',
        total_processing: '0',
        total_completed: '0',
        total_failed: '0',
        pending_amount: '0',
        completed_amount: '0'
      }] }));

      return c.json({
        success: true,
        summary: {
          totalPending: parseInt(summary.rows[0]?.total_pending || '0', 10),
          totalProcessing: parseInt(summary.rows[0]?.total_processing || '0', 10),
          totalCompleted: parseInt(summary.rows[0]?.total_completed || '0', 10),
          totalFailed: parseInt(summary.rows[0]?.total_failed || '0', 10),
          pendingAmount: parseFloat(summary.rows[0]?.pending_amount || '0'),
          completedAmount: parseFloat(summary.rows[0]?.completed_amount || '0'),
        },
      });
    } catch (error: any) {
      console.error('Error fetching settlement summary:', error);
      return c.json({
        success: true,
        summary: {
          totalPending: 0,
          totalProcessing: 0,
          totalCompleted: 0,
          totalFailed: 0,
          pendingAmount: 0,
          completedAmount: 0,
        },
      });
    }
  });

  /**
   * GET /settlements/policy
   * Get settlement policy for vendors to see
   * This is the same policy for ALL vendors
   * ✅ CRITICAL: This must be BEFORE /settlements/:id to avoid matching "policy" as an ID
   */
  app.get("/settlements/policy", async (c) => {
    try {
      // Get payout rules from platform settings
      const payoutRules = await select('platform_settings', { setting_key: 'admin:settings:payout_rules' });
      const rules = payoutRules.length > 0
        ? (payoutRules[0].setting_value as any)
        : {
            holdPeriodDays: 7,
            minimumPayout: 1000,
            autoPayout: true,
            defaultCommission: 10,
          };
      
      // Get settlement schedule
      const scheduleSettings = await query(`
        SELECT * FROM platform_settings 
        WHERE setting_key LIKE 'admin:finance:settlement%' 
        LIMIT 1
      `).catch(() => ({ rows: [] }));
      
      const schedule = scheduleSettings.rows.length > 0 
        ? scheduleSettings.rows[0].setting_value 
        : {
            scheduleType: 'weekly',
            settlementPeriodDays: rules.holdPeriodDays,
            minPayoutAmount: rules.minimumPayout,
          };
      
      return c.json({
        success: true,
        policy: {
          // Hold period - how long earnings are held before settlement
          holdPeriodDays: rules.holdPeriodDays || 7,
          
          // Minimum amount required for payout
          minimumPayoutAmount: rules.minimumPayout || 1000,
          
          // Platform commission percentage (based on tier, but default shown)
          defaultCommissionRate: rules.defaultCommission || 10,
          
          // Whether auto-payout is enabled
          autoPayoutEnabled: rules.autoPayout !== false,
          
          // Settlement schedule
          settlementSchedule: typeof schedule === 'string' ? JSON.parse(schedule) : schedule,
          
          // Bank verification requirement
          bankVerificationRequired: true,
          
          // Razorpay integration info
          paymentProcessor: 'Razorpay',
          
          // Policy description for vendors
          description: `Earnings are held for ${rules.holdPeriodDays || 7} days before becoming eligible for settlement. ` +
            `Minimum payout amount is ₹${rules.minimumPayout || 1000}. ` +
            `Platform commission is deducted based on your tier (default ${rules.defaultCommission || 10}%). ` +
            `Bank account must be verified via Razorpay to receive payouts.`,
        },
      });
    } catch (error: any) {
      console.error('Error fetching settlement policy:', error);
      return c.json({
        success: true,
        policy: {
          holdPeriodDays: 7,
          minimumPayoutAmount: 1000,
          defaultCommissionRate: 10,
          autoPayoutEnabled: true,
          bankVerificationRequired: true,
          paymentProcessor: 'Razorpay',
          description: 'Earnings are held for 7 days before settlement. Minimum payout is ₹1000. Bank verification required.',
        },
      });
    }
  });

  /**
   * GET /settlements/:id
   * Get settlement details with bookings
   */
  app.get("/settlements/:id", async (c) => {
    try {
      const id = c.req.param('id');

      const settlements = await select('settlements', { id });
      if (settlements.length === 0) {
        return c.json({ error: 'Settlement not found' }, 404);
      }

      const settlement = settlements[0];

      // Get related bookings
      const bookings = await query(`
        SELECT 
          b.id,
          b.booking_date,
          s.name as service_name,
          b.total_amount,
          b.commission_amount,
          (b.total_amount - b.commission_amount) as net_amount
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.settlement_id = $1
        ORDER BY b.booking_date DESC
      `, [id]).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        settlement: {
          ...settlement,
          bookings: bookings.rows || [],
        },
      });
    } catch (error: any) {
      console.error('Error fetching settlement details:', error);
      return c.json({ error: error.message }, 500);
    }
  });
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

      // Get vendor no-show and cancellation penalties
      const vendorPenalties = await query(
        `SELECT 
           b.vendor_id,
           b.id as booking_id,
           b.customer_id,
           b.total_amount,
           b.status,
           b.cancelled_by
         FROM bookings b
         WHERE (b.status = 'vendor_no_show' OR (b.status = 'cancelled' AND b.cancelled_by = 'vendor'))
         AND b.created_at < $1
         AND b.penalty_processed IS NOT TRUE
         ORDER BY b.created_at ASC`,
        [cutoffDate]
      ).catch(() => ({ rows: [] }));

      // Get cancellation policy for penalty percentages
      const cancellationPolicy = await query(
        `SELECT * FROM cancellation_policies 
         WHERE is_active = true 
         ORDER BY priority DESC 
         LIMIT 1`
      ).catch(() => ({ rows: [] }));

      const vendorPenaltyPercentage = cancellationPolicy.rows[0]?.vendor_cancellation_penalty || 10;
      const customerCompensationPercentage = cancellationPolicy.rows[0]?.customer_compensation_percentage || 50;

      // Track penalties by vendor
      const penaltiesByVendor: Record<string, { penaltyAmount: number; compensations: any[] }> = {};

      for (const penalty of vendorPenalties.rows) {
        const vendorId = penalty.vendor_id;
        const bookingAmount = parseFloat(penalty.total_amount || '0');
        const penaltyAmount = (bookingAmount * vendorPenaltyPercentage) / 100;
        const compensationAmount = (bookingAmount * customerCompensationPercentage) / 100;

        if (!penaltiesByVendor[vendorId]) {
          penaltiesByVendor[vendorId] = { penaltyAmount: 0, compensations: [] };
        }

        penaltiesByVendor[vendorId].penaltyAmount += penaltyAmount;
        penaltiesByVendor[vendorId].compensations.push({
          bookingId: penalty.booking_id,
          customerId: penalty.customer_id,
          compensationAmount,
          reason: penalty.status === 'vendor_no_show' ? 'Vendor no-show' : 'Vendor cancellation',
        });

        // Mark penalty as processed
        await query(
          `UPDATE bookings SET penalty_processed = true WHERE id = $1`,
          [penalty.booking_id]
        ).catch(() => null);
      }

      // Process customer compensations (credit to wallet)
      for (const vendorId in penaltiesByVendor) {
        for (const comp of penaltiesByVendor[vendorId].compensations) {
          if (comp.compensationAmount > 0 && comp.customerId) {
            try {
              // Credit customer wallet
              await insert('wallet_transactions', {
                customer_id: comp.customerId,
                transaction_type: 'credit',
                amount: comp.compensationAmount,
                description: `Compensation for ${comp.reason} - Booking #${comp.bookingId?.slice(-6) || 'N/A'}`,
                reference_type: 'vendor_penalty',
                reference_id: comp.bookingId,
                status: 'completed',
              }).catch(() => null);

              // Update customer wallet balance
              await query(
                `UPDATE customers SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2`,
                [comp.compensationAmount, comp.customerId]
              ).catch(() => null);

              console.log(`[SETTLEMENT] Credited ₹${comp.compensationAmount} to customer ${comp.customerId} for ${comp.reason}`);
            } catch (e) {
              console.error(`[SETTLEMENT] Failed to credit compensation to customer ${comp.customerId}:`, e);
            }
          }
        }
      }

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
            penaltyDeductions: penaltiesByVendor[vendorId]?.penaltyAmount || 0,
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

      // Apply penalty deductions to net amount
      for (const vendorId in vendorSettlements) {
        if (vendorSettlements[vendorId].penaltyDeductions > 0) {
          console.log(`[SETTLEMENT] Applying ₹${vendorSettlements[vendorId].penaltyDeductions} penalty deduction to vendor ${vendorId}`);
          vendorSettlements[vendorId].netAmount -= vendorSettlements[vendorId].penaltyDeductions;
          // Ensure net amount doesn't go negative
          vendorSettlements[vendorId].netAmount = Math.max(0, vendorSettlements[vendorId].netAmount);
        }
      }

      // Create settlements
      const settlements = [];
      for (const vendorId in vendorSettlements) {
        const settlement = vendorSettlements[vendorId];

        // Check minimum payout
        if (settlement.netAmount < rules.minimumPayout) {
          continue;
        }

        // Create settlement record with penalty deductions
        const settlementRecord = await insert('settlements', {
          vendor_id: vendorId,
          total_amount: settlement.totalAmount,
          commission_amount: settlement.commissionAmount,
          penalty_deductions: settlement.penaltyDeductions || 0,
          net_amount: settlement.netAmount,
          settlement_status: rules.autoPayout ? 'processing' : 'pending',
          settlement_period_start: cutoffDate.toISOString().split('T')[0],
          settlement_period_end: new Date().toISOString().split('T')[0],
          payment_ids: settlement.bookingIds,
          metadata: JSON.stringify({
            penaltyDeductions: settlement.penaltyDeductions || 0,
            penaltyReason: settlement.penaltyDeductions > 0 ? 'Vendor cancellation/no-show penalties' : null,
          }),
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

      // Handle test IDs - return empty settlements
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          settlements: [],
          total: 0,
        });
      }

      let settlements;
      try {
        settlements = await query(
          `SELECT * FROM settlements
           WHERE vendor_id = $1
           ORDER BY created_at DESC
           LIMIT 50`,
          [vendorId]
        );
      } catch (error: any) {
        // If UUID validation fails, return empty settlements
        if (error.message?.includes('invalid input syntax for type uuid')) {
          return c.json({
            success: true,
            settlements: [],
            total: 0,
          });
        }
        throw error;
      }

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
   * POST /settlements/process-payouts
   * Process payouts for all pending settlements (bulk processing)
   */
  app.post("/settlements/process-payouts", async (c) => {
    try {
      // Get all pending settlements
      const pendingSettlements = await query(`
        SELECT s.*, v.id as vendor_id, v.business_name
        FROM settlements s
        INNER JOIN vendors v ON s.vendor_id = v.id
        WHERE s.status = 'pending'
        ORDER BY s.created_at ASC
      `).catch(() => ({ rows: [] }));

      if (pendingSettlements.rows.length === 0) {
        return c.json({
          success: true,
          message: 'No pending settlements to process',
          processed: 0,
          failed: 0,
        });
      }

      const results = {
        processed: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Process each settlement
      for (const settlement of pendingSettlements.rows) {
        try {
          // Get vendor bank details
          const bankDetails = await select('vendor_bank_details', { vendor_id: settlement.vendor_id });
          if (bankDetails.length === 0) {
            results.failed++;
            results.errors.push(`Vendor ${settlement.vendor_id} has no bank details`);
            continue;
          }

          const bank = bankDetails[0];
          const netAmount = parseFloat(settlement.net_amount || settlement.netAmount || '0');

          // Create payout record
          const payout = await insert('payouts', {
            vendor_id: settlement.vendor_id,
            amount: netAmount,
            settlement_id: settlement.id,
            bank_account_number: bank.account_number,
            ifsc_code: bank.ifsc_code,
            account_holder_name: bank.account_holder_name,
            payout_status: 'processing',
            created_at: new Date().toISOString(),
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
              amount: Math.round(netAmount * 100), // Convert to paise
              currency: 'INR',
              mode: 'IMPS',
              purpose: 'payout',
              queue_if_low_balance: true,
              reference_id: `PAYOUT-${payout[0].id}`,
            });

            // Update payout and settlement
            await update('payouts',
              { id: payout[0].id },
              {
                razorpay_payout_id: payoutResponse.id,
                payout_status: 'processing',
                updated_at: new Date().toISOString(),
              }
            );

            await update('settlements',
              { id: settlement.id },
              {
                status: 'processing',
                payout_reference: payoutResponse.id,
                updated_at: new Date().toISOString(),
              }
            );

            results.processed++;
          } catch (razorpayError: any) {
            // Update payout as failed
            await update('payouts',
              { id: payout[0].id },
              {
                payout_status: 'failed',
                failure_reason: razorpayError.message,
                updated_at: new Date().toISOString(),
              }
            );

            await update('settlements',
              { id: settlement.id },
              {
                status: 'failed',
                failure_reason: razorpayError.message,
                updated_at: new Date().toISOString(),
              }
            );

            results.failed++;
            results.errors.push(`Settlement ${settlement.id}: ${razorpayError.message}`);
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Settlement ${settlement.id}: ${error.message}`);
        }
      }

      return c.json({
        success: true,
        message: `Processed ${results.processed} payouts, ${results.failed} failed`,
        processed: results.processed,
        failed: results.failed,
        errors: results.errors,
      });
    } catch (error: any) {
      console.error('Error processing payouts:', error);
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
   * 
   * ✅ FIX: Checks both vendor_bank_accounts and vendor_bank_details tables
   * ✅ FIX: Includes vendor resolution logic for vendors in vendor_identity
   */
  app.get("/vendor/:vendorId/bank-details", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs - return empty bank details
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          bankDetails: null,
          message: 'No bank details configured',
        });
      }

      // ✅ CRITICAL FIX: Resolve vendor ID - check vendor_identity if not in vendors table
      let actualVendorId = vendorId;
      const existingVendor = await select('vendors', { id: vendorId });
      
      if (existingVendor.length === 0) {
        console.log(`[BankDetails] Vendor ${vendorId} not found in vendors table, checking vendor_identity...`);
        const identities = await select('vendor_identity', { id: vendorId });
        
        if (identities.length > 0) {
          const identity = identities[0];
          if (identity.onboarding_status === 'APPROVED' || identity.onboarding_status === 'ACTIVATED') {
            // Check if vendor exists by phone (might have different ID)
            const vendorByPhone = await select('vendors', { phone: identity.phone });
            if (vendorByPhone.length > 0) {
              actualVendorId = vendorByPhone[0].id;
              console.log(`[BankDetails] Found existing vendor by phone: ${actualVendorId}`);
            } else {
              // Auto-create vendor record from onboarding application
              const applications = await select('vendor_onboarding_applications', { vendor_identity_id: vendorId });
              const application = applications.length > 0 ? applications[0] : null;
              const payload = application?.application_payload || {};
              
              console.log(`[BankDetails] Auto-creating vendor record for approved vendor ${vendorId}`);
              await insert('vendors', {
                id: vendorId,
                phone: identity.phone,
                email: payload.email || `vendor-${identity.phone}@warmpawz.app`,
                business_name: payload.businessName || payload.business_name || `Vendor ${identity.phone}`,
                owner_name: payload.contactPersonName || payload.ownerName || 'Vendor Owner',
                role_id: identity.selected_role_id,
                category: 'general',
                address: payload.address || 'Not specified',
                city: payload.city || 'Not specified',
                state: payload.state || 'Not specified',
                pincode: payload.pin || payload.pincode || '', // Don't use default - require actual pincode
                status: 'active',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              console.log(`[BankDetails] Created vendor record for ${vendorId}`);
            }
          } else {
            return c.json({ error: 'Vendor not approved or activated' }, 403);
          }
        } else {
          return c.json({ error: 'Vendor not found' }, 404);
        }
      }

      // ✅ FIX: Check both vendor_bank_accounts (newer) and vendor_bank_details (older) tables
      let bankDetails: any[] = [];
      
      // First, try vendor_bank_accounts (newer table, supports multiple accounts)
      try {
        const schemaCheck = await query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'vendor_bank_accounts'
          ) as table_exists
        `);
        
        if (schemaCheck.rows[0]?.table_exists) {
          // Get primary account or first account
          const accounts = await query(
            `SELECT * FROM vendor_bank_accounts 
             WHERE vendor_id = $1 
             ORDER BY is_primary DESC, created_at DESC 
             LIMIT 1`,
            [actualVendorId]
          );
          bankDetails = accounts.rows;
        }
      } catch (e) {
        console.warn('[BankDetails] Error querying vendor_bank_accounts:', e);
      }

      // Fallback to vendor_bank_details if no results from vendor_bank_accounts
      if (bankDetails.length === 0) {
        try {
          bankDetails = await select('vendor_bank_details', { vendor_id: actualVendorId });
        } catch (e) {
          console.warn('[BankDetails] Error querying vendor_bank_details:', e);
        }
      }

      // Return 200 with null bank details if none found (valid state, not an error)
      if (bankDetails.length === 0) {
        return c.json({
          success: true,
          bankDetails: null,
          message: 'No bank details configured yet',
          requiresSetup: true,
        });
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

