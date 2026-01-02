/**
 * AUTOMATED PAYOUT PROCESSING CRON JOB
 * 
 * ✅ MIGRATED: All operations now use SQL repositories
 * 
 * Processes scheduled payouts automatically based on:
 * - Payout policies (hold period, auto-payout enabled)
 * - Scheduled payout dates
 * - Minimum payout amounts
 * 
 * This endpoint should be called by a cron job (e.g., daily at 2 AM)
 * 
 * Endpoint: POST /make-server-3dd53475/cron/process-scheduled-payouts
 */

import { Hono } from "npm:hono";
// ✅ SQL: Import repositories instead of KV
import { getPayoutsRepository } from "../../lib/repositories/payouts.ts";
import { getPayoutPoliciesRepository } from "../../lib/repositories/payout-policies.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getBankAccountsRepository } from "../../lib/repositories/bank-accounts.ts";
import { getDbClient } from "../../lib/db.ts";
import { sendSuccess, sendError } from "./response-utils.ts";
import { createRazorpayPayout } from "./razorpay-marketplace-payout.tsx";
import { createNotificationHelper } from "./notification-system-refactored.tsx"; // ✅ FIXED: Updated to SQL version
// ✅ Note: Razorpay credentials now fetched from platform settings via createRazorpayPayout

export function registerPayoutCronJob(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * POST /cron/process-scheduled-payouts
   * Process all scheduled payouts that are due
   * 
   * This is a cron job endpoint that should be called periodically
   * Recommended: Daily at 2 AM IST
   */
  app.post(`${BASE_PATH}/cron/process-scheduled-payouts`, async (c) => {
    try {
      console.log(`\n⏰ [PAYOUT-CRON] Starting scheduled payout processing...`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);

      // ✅ SQL: Get payout policies
      const policiesRepo = getPayoutPoliciesRepository();
      const payoutPolicy = await policiesRepo.getPolicy();

      // If auto-payout is disabled, skip processing
      if (!payoutPolicy.auto_payout) {
        console.log(`⚠️ [PAYOUT-CRON] Auto-payout is disabled in admin settings`);
        return sendSuccess(c, {
          processed: 0,
          skipped: 0,
          failed: 0,
          message: 'Auto-payout is disabled'
        });
      }

      const now = new Date();
      let processedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const results: any[] = [];

      // ✅ SQL: Get all scheduled payouts that are due
      const payoutsRepo = getPayoutsRepository();
      const scheduledPayouts = await payoutsRepo.findScheduledDue(now);
      
      console.log(`📊 [PAYOUT-CRON] Found ${scheduledPayouts.length} scheduled payouts due for processing`);

      // ✅ SQL: Get all vendors (for bank details lookup)
      const vendorsRepo = getVendorsRepository();
      const dbClient = getDbClient();

      for (const payout of scheduledPayouts) {
        const vendorId = payout.vendor_id;

        try {
          // Check minimum payout amount
          if (payout.amount < payoutPolicy.min_payout_amount) {
            console.log(`⚠️ [PAYOUT-CRON] Payout ${payout.id} below minimum: ₹${payout.amount} < ₹${payoutPolicy.min_payout_amount}`);
            skippedCount++;
            continue;
          }

          // ✅ SQL: Get vendor bank details
          const bankAccountsRepo = getBankAccountsRepository();
          const vendorBank = await bankAccountsRepo.findByVendorId(vendorId);
          
          if (!vendorBank || !vendorBank.is_verified) {
            console.log(`⚠️ [PAYOUT-CRON] Vendor ${vendorId} bank not verified, skipping payout ${payout.id}`);
            skippedCount++;
            continue;
          }

          try {
            // ✅ ACTUAL RAZORPAY API: Process payout
            console.log(`💸 [PAYOUT-CRON] Processing payout ${payout.id}: ₹${payout.amount} to vendor ${vendorId}`);

            // ✅ SQL: Update payout status to processing
            await payoutsRepo.update(payout.id, {
              status: 'processing',
            });

            // Create Razorpay payout
            const razorpayPayout = await createRazorpayPayout({
              accountId: vendorBank.account_number || vendorBank.fund_account_id,
              amount: payout.amount,
              currency: 'INR',
              notes: {
                payoutId: payout.id,
                vendorId,
                settlementIds: payout.settlement_ids,
                accountHolderName: vendorBank.account_holder_name,
                ifsc: vendorBank.ifsc_code,
                accountNumber: vendorBank.account_number
              }
            });

            // ✅ SQL: Update payout with Razorpay details
            await payoutsRepo.update(payout.id, {
              status: 'completed',
              razorpay_payout_id: razorpayPayout.id,
              processed_at: new Date().toISOString(),
            });

            // ✅ SQL: Get vendor for notification
            const vendor = await vendorsRepo.findById(vendorId);

            // ✅ NOTIFICATION: Notify vendor
            try {
              await createNotificationHelper({
                recipientId: vendorId,
                recipientType: 'vendor',
                type: 'payout_completed',
                category: 'payouts',
                title: 'Payout Processed',
                message: `Your payout of ₹${payout.amount} has been processed. UTR: ${razorpayPayout.utr || 'N/A'}`,
                recipientEmail: vendor?.email,
                recipientPhone: vendor?.phone,
                channels: { email: true, sms: false, inApp: true, push: false },
                data: { payoutId: payout.id, amount: payout.amount, utr: razorpayPayout.utr },
                priority: 'medium'
              });
            } catch (notifError) {
              console.error(`⚠️ [PAYOUT-CRON] Failed to send notification:`, notifError);
              // Don't fail payout if notification fails
            }

            processedCount++;
            results.push({
              payoutId: payout.id,
              vendorId,
              amount: payout.amount,
              status: 'completed',
              razorpayPayoutId: razorpayPayout.id
            });

            console.log(`✅ [PAYOUT-CRON] Payout ${payout.id} processed successfully: ${razorpayPayout.id}`);

          } catch (payoutError: any) {
            console.error(`❌ [PAYOUT-CRON] Failed to process payout ${payout.id}:`, payoutError);
            
            // ✅ SQL: Update payout status to failed
            await payoutsRepo.fail(payout.id, payoutError.message || 'Razorpay payout failed');

            failedCount++;
            results.push({
              payoutId: payout.id,
              vendorId,
              amount: payout.amount,
              status: 'failed',
              error: payoutError.message
            });
          }

        } catch (vendorError: any) {
          console.error(`❌ [PAYOUT-CRON] Error processing vendor ${vendorId}:`, vendorError);
          failedCount++;
        }
      }

      console.log(`\n✅ [PAYOUT-CRON] Processing complete:`);
      console.log(`   Processed: ${processedCount}`);
      console.log(`   Skipped: ${skippedCount}`);
      console.log(`   Failed: ${failedCount}`);
      console.log(`   Total: ${processedCount + skippedCount + failedCount}`);

      return sendSuccess(c, {
        processed: processedCount,
        skipped: skippedCount,
        failed: failedCount,
        total: processedCount + skippedCount + failedCount,
        results,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ [PAYOUT-CRON] Cron job error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /cron/payout-status
   * ✅ SQL: Get status of payout processing (for monitoring)
   */
  app.get(`${BASE_PATH}/cron/payout-status`, async (c) => {
    try {
      // ✅ SQL: Get payout policy
      const policiesRepo = getPayoutPoliciesRepository();
      const payoutPolicy = await policiesRepo.getPolicy();

      // ✅ SQL: Count scheduled payouts
      const payoutsRepo = getPayoutsRepository();
      const scheduledPayouts = await payoutsRepo.findByStatus('scheduled');
      
      const pendingCount = scheduledPayouts.length;
      const pendingAmount = scheduledPayouts.reduce((sum, p) => sum + p.amount, 0);

      return sendSuccess(c, {
        autoPayoutEnabled: payoutPolicy.auto_payout,
        pendingCount,
        pendingAmount,
        minPayoutAmount: payoutPolicy.min_payout_amount,
        holdPeriodDays: payoutPolicy.hold_period_days
      });

    } catch (error: any) {
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Payout cron job endpoints registered');
}

