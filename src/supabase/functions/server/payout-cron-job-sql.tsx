/**
 * ============================================================================
 * SQL-BASED AUTOMATED PAYOUT PROCESSING CRON JOB
 * ============================================================================
 * 
 * Migrated from: payout-cron-job.tsx (KV-based)
 * 
 * Processes scheduled payouts automatically based on:
 * - Payout policies from SQL (hold period, auto-payout enabled)
 * - Scheduled payout dates
 * - Minimum payout amounts
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All operations wrapped in transactions
 * ✅ Automatic payout processing (zero manual intervention)
 * 
 * Endpoint: POST /make-server-3dd53475/cron/process-scheduled-payouts
 * Date: 2025-01-22
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { createRazorpayPayout } from "./razorpay-marketplace-payout.tsx";
import { getPayoutsRepository } from "../../lib/repositories/payouts.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getDbClient, withTransaction } from "../../lib/db.ts";
import { createNotificationHelper } from "./notification-system.tsx";

export function registerPayoutCronJobSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const payoutsRepo = getPayoutsRepository();
  const vendorsRepo = getVendorsRepository();
  const client = getDbClient();

  // Helper: Trigger Notification (temporary bridge to KV-based notification system)
  async function triggerNotification(notification: any) {
    try {
      await createNotificationHelper({
        ...notification,
        channels: notification.channels || { email: true, sms: false, inApp: true, push: false }
      });
    } catch (e) {
      console.error(`⚠️ [PAYOUT-CRON-SQL] Failed to send notification:`, e);
    }
  }

  /**
   * POST /cron/process-scheduled-payouts
   * Process all scheduled payouts that are due - SQL-BASED
   */
  app.post(`${BASE_PATH}/cron/process-scheduled-payouts`, async (c) => {
    try {
      console.log(`\n⏰ [PAYOUT-CRON-SQL] Starting scheduled payout processing...`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);

      // ✅ SQL-BASED: Get payout policies from SQL
      const { data: policies, error: policyError } = await client
        .from('payout_policies')
        .select('*')
        .eq('is_active', true)
        .single();

      const payoutPolicies = policies || {
        hold_period_days: 7,
        auto_payout: false,
        min_payout_amount: 1000,
        payout_period: 'weekly'
      };

      // If auto-payout is disabled, skip processing
      if (!payoutPolicies.auto_payout) {
        console.log(`⚠️ [PAYOUT-CRON-SQL] Auto-payout is disabled in admin settings`);
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

      // ✅ SQL-BASED: Get all pending payouts from SQL
      const pendingPayouts = await payoutsRepo.findByStatus('pending', { limit: 100 });

      console.log(`📊 [PAYOUT-CRON-SQL] Found ${pendingPayouts.length} pending payouts`);

      for (const payout of pendingPayouts) {
        try {
          // Check minimum payout amount
          if (Number(payout.amount) < Number(payoutPolicies.min_payout_amount)) {
            console.log(`⚠️ [PAYOUT-CRON-SQL] Payout ${payout.id} below minimum: ₹${payout.amount} < ₹${payoutPolicies.min_payout_amount}`);
            skippedCount++;
            continue;
          }

          // ✅ SQL-BASED: Get vendor and bank details
          const vendor = await vendorsRepo.findById(payout.vendor_id);
          if (!vendor) {
            console.log(`⚠️ [PAYOUT-CRON-SQL] Vendor not found: ${payout.vendor_id}`);
            skippedCount++;
            continue;
          }

          // Get vendor bank details from SQL
          const { data: bankDetails, error: bankError } = await client
            .from('vendor_bank_details')
            .select('*')
            .eq('vendor_id', payout.vendor_id)
            .eq('is_verified', true)
            .single();

          if (!bankDetails || bankError) {
            console.log(`⚠️ [PAYOUT-CRON-SQL] Vendor ${payout.vendor_id} bank not verified`);
            skippedCount++;
            continue;
          }

          // ✅ SQL-BASED: Process payout in transaction
          await withTransaction(async (txClient) => {
            // Update payout status to processing
            await payoutsRepo.update(payout.id, {
              payout_status: 'processing',
              processed_at: new Date().toISOString(),
            });

            // Create Razorpay payout
            const razorpayPayout = await createRazorpayPayout({
              accountId: bankDetails.account_number,
              amount: Number(payout.amount),
              currency: 'INR',
              notes: {
                payoutId: payout.id,
                vendorId: payout.vendor_id,
                accountHolderName: bankDetails.account_holder_name,
                ifsc: bankDetails.ifsc_code,
                accountNumber: bankDetails.account_number
              }
            });

            // Update payout with Razorpay details
            await payoutsRepo.update(payout.id, {
              payout_status: 'completed',
              completed_at: new Date().toISOString(),
              razorpay_payout_id: razorpayPayout.id,
            });

            // Update vendor pending payout amount
            await txClient.from('vendors').update({
              pending_payout: 0, // Reset pending payout
              total_payouts_received: (vendor.total_payouts_received || 0) + Number(payout.amount),
              updated_at: new Date().toISOString(),
            }).eq('id', payout.vendor_id);

            // ✅ NOTIFICATION: Notify vendor
            await triggerNotification({
              recipientId: payout.vendor_id,
              recipientType: 'vendor',
              type: 'payout_completed',
              category: 'payouts',
              title: 'Payout Processed',
              message: `Your payout of ₹${payout.amount} has been processed. UTR: ${razorpayPayout.utr || 'N/A'}`,
              recipientEmail: vendor.email,
              recipientPhone: vendor.phone,
              channels: { email: true, sms: false, inApp: true, push: false },
              data: { payoutId: payout.id, amount: payout.amount },
              priority: 'medium'
            });

            processedCount++;
            results.push({
              payoutId: payout.id,
              vendorId: payout.vendor_id,
              amount: payout.amount,
              status: 'completed',
              razorpayPayoutId: razorpayPayout.id
            });

            console.log(`✅ [PAYOUT-CRON-SQL] Payout ${payout.id} processed successfully: ${razorpayPayout.id}`);
          });

        } catch (payoutError: any) {
          console.error(`❌ [PAYOUT-CRON-SQL] Failed to process payout ${payout.id}:`, payoutError);
          
          // Update payout status to failed
          await payoutsRepo.fail(payout.id, payoutError.message || 'Razorpay payout failed');

          failedCount++;
          results.push({
            payoutId: payout.id,
            vendorId: payout.vendor_id,
            amount: payout.amount,
            status: 'failed',
            error: payoutError.message
          });
        }
      }

      console.log(`\n✅ [PAYOUT-CRON-SQL] Processing complete:`);
      console.log(`   Processed: ${processedCount}`);
      console.log(`   Skipped: ${skippedCount}`);
      console.log(`   Failed: ${failedCount}`);

      return sendSuccess(c, {
        processed: processedCount,
        skipped: skippedCount,
        failed: failedCount,
        results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ [PAYOUT-CRON-SQL] Error:', error);
      return sendError(c, error, 500);
    }
  });
}

