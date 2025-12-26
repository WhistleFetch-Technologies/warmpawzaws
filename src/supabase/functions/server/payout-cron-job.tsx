/**
 * AUTOMATED PAYOUT PROCESSING CRON JOB
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
import { sendSuccess, sendError } from "./response-utils.ts";
import { createRazorpayPayout } from "./razorpay-marketplace-payout.tsx";
import { createNotificationHelper } from "./notification-system.tsx";
// ✅ SQL Repositories
import { getPayoutsRepository } from "../../../supabase/lib/repositories/payouts.ts";
import { getVendorsRepository } from "../../../supabase/lib/repositories/vendors.ts";
import { getVendorEarningsRepository } from "../../../supabase/lib/repositories/vendor-earnings.ts";
import { getDbClient } from "../../../supabase/lib/db.ts";
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

      // ✅ SQL: Get payout policies from payout_policies table
      const dbClient = getDbClient();
      const { data: payoutPolicy } = await dbClient
        .from('payout_policies')
        .select('*')
        .eq('policy_key', 'default')
        .maybeSingle();

      const payoutPolicies = payoutPolicy || {
        hold_period_days: 7,
        auto_payout: false,
        min_payout_amount: 1000.00,
        payout_period: 'weekly'
      };

      // If auto-payout is disabled, skip processing
      if (!payoutPolicies.auto_payout) {
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
      
      console.log(`📊 [PAYOUT-CRON] Found ${scheduledPayouts.length} scheduled payouts due`);

      for (const payout of scheduledPayouts) {
        try {
          // Check minimum payout amount
          if (payout.amount < payoutPolicies.min_payout_amount) {
            console.log(`⚠️ [PAYOUT-CRON] Payout ${payout.id} below minimum: ₹${payout.amount} < ₹${payoutPolicies.min_payout_amount}`);
            skippedCount++;
            continue;
          }

          // ✅ SQL: Get vendor bank details
          const { data: vendorBank } = await dbClient
            .from('vendor_bank_details')
            .select('*')
            .eq('vendor_id', payout.vendor_id)
            .eq('is_verified', true)
            .maybeSingle();
          
          if (!vendorBank) {
            console.log(`⚠️ [PAYOUT-CRON] Vendor ${payout.vendor_id} bank not verified, skipping payout ${payout.id}`);
            skippedCount++;
            continue;
          }

            try {
              // ✅ SQL: Update payout status to processing
              await payoutsRepo.update(payout.id, {
                status: 'processing',
              });

              // ✅ ACTUAL RAZORPAY API: Process payout
              console.log(`💸 [PAYOUT-CRON] Processing payout ${payout.id}: ₹${payout.amount} to vendor ${payout.vendor_id}`);

              // Create Razorpay payout
              const razorpayPayout = await createRazorpayPayout({
                accountId: vendorBank.account_number, // Use account_number as accountId
                amount: payout.amount,
                currency: 'INR',
                notes: {
                  payoutId: payout.id,
                  vendorId: payout.vendor_id,
                  settlementIds: payout.settlement_ids,
                  accountHolderName: vendorBank.account_holder_name,
                  ifsc: vendorBank.ifsc_code,
                  accountNumber: vendorBank.account_number
                }
              });

              // ✅ SQL: Update payout with Razorpay details and mark as completed
              await payoutsRepo.complete(payout.id, razorpayPayout.id);

              // ✅ SQL: Link earnings to payout
              const earningsRepo = getVendorEarningsRepository();
              for (const settlementId of payout.settlement_ids) {
                const earnings = await earningsRepo.findByVendor(payout.vendor_id, { 
                  status: 'settled',
                });
                const relevantEarnings = earnings.filter(e => e.settlement_id === settlementId);
                if (relevantEarnings.length > 0) {
                  await earningsRepo.linkToPayout(
                    relevantEarnings.map(e => e.id),
                    payout.id
                  );
                }
              }

              // ✅ SQL: Get vendor for notification
              const vendorsRepo = getVendorsRepository();
              const vendor = await vendorsRepo.findById(payout.vendor_id);

              // ✅ NOTIFICATION: Notify vendor
              try {
                await createNotificationHelper({
                  recipientId: payout.vendor_id,
                  recipientType: 'vendor',
                  type: 'payout_completed',
                  category: 'payouts',
                  title: 'Payout Processed',
                  message: `Your payout of ₹${payout.amount} has been processed. Razorpay ID: ${razorpayPayout.id}`,
                  recipientEmail: vendor?.email || undefined,
                  recipientPhone: vendor?.phone,
                  channels: { email: true, sms: false, inApp: true, push: false },
                  data: { payoutId: payout.id, amount: payout.amount, razorpayPayoutId: razorpayPayout.id },
                  priority: 'medium'
                });
              } catch (notifError) {
                console.error(`⚠️ [PAYOUT-CRON] Failed to send notification:`, notifError);
                // Don't fail payout if notification fails
              }

              processedCount++;
              results.push({
                payoutId: payout.id,
                vendorId: payout.vendor_id,
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
                vendorId: payout.vendor_id,
                amount: payout.amount,
                status: 'failed',
                error: payoutError.message
              });
            }
          }

        } catch (payoutError: any) {
          console.error(`❌ [PAYOUT-CRON] Error processing payout:`, payoutError);
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
   * Get status of payout processing (for monitoring)
   * ✅ SQL: Uses payouts repository
   */
  app.get(`${BASE_PATH}/cron/payout-status`, async (c) => {
    try {
      // ✅ SQL: Get payout policies
      const { data: payoutPolicy } = await dbClient
        .from('payout_policies')
        .select('*')
        .eq('policy_key', 'default')
        .maybeSingle();

      const payoutPolicies = payoutPolicy || {
        hold_period_days: 7,
        auto_payout: false,
        min_payout_amount: 1000.00,
      };

      // ✅ SQL: Count scheduled payouts
      const scheduledPayouts = await payoutsRepo.findByStatus('scheduled');
      const pendingCount = scheduledPayouts.length;
      const pendingAmount = scheduledPayouts.reduce((sum, p) => sum + p.amount, 0);

      return sendSuccess(c, {
        autoPayoutEnabled: payoutPolicies.auto_payout,
        pendingCount,
        pendingAmount,
        minPayoutAmount: payoutPolicies.min_payout_amount,
        holdPeriodDays: payoutPolicies.hold_period_days
      });

    } catch (error: any) {
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Payout cron job endpoints registered');
}

