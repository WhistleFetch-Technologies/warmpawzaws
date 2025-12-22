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
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";
import { createRazorpayPayout } from "./razorpay-marketplace-payout.tsx";
import { createNotificationHelper } from "./notification-system.tsx";
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

      // Get payout policies
      const payoutPolicies = await kv.get('admin:payout:policies') || {
        holdPeriodDays: 7,
        autoPayout: false,
        minPayoutAmount: 1000,
        payoutPeriod: 'weekly'
      };

      // If auto-payout is disabled, skip processing
      if (!payoutPolicies.autoPayout) {
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

      // Get all vendors with pending payouts
      const allVendors = await kv.getByPrefix('vendor:');
      
      for (const vendor of allVendors) {
        if (!vendor.id || vendor.id.includes(':')) continue;

        const vendorId = vendor.id;

        try {
          // Get vendor's pending payouts
          const vendorPayoutsKey = `vendor:${vendorId}:payouts:pending`;
          const pendingPayoutIds = await kv.get(vendorPayoutsKey) || [];

          if (pendingPayoutIds.length === 0) {
            continue; // No pending payouts for this vendor
          }

          // Process each pending payout
          for (const payoutId of pendingPayoutIds) {
            const payout = await kv.get(`payout:${payoutId}`);
            
            if (!payout || payout.status !== 'scheduled') {
              continue; // Skip if not scheduled
            }

            // Check if payout date has arrived
            const scheduledDate = new Date(payout.scheduledAt);
            if (scheduledDate > now) {
              skippedCount++;
              continue; // Not yet due
            }

            // Check minimum payout amount
            if (payout.amount < payoutPolicies.minPayoutAmount) {
              console.log(`⚠️ [PAYOUT-CRON] Payout ${payoutId} below minimum: ₹${payout.amount} < ₹${payoutPolicies.minPayoutAmount}`);
              skippedCount++;
              continue;
            }

            // Get vendor bank details
            const vendorBank = await kv.get(`vendor_bank:${vendorId}`);
            
            if (!vendorBank || !vendorBank.isVerified) {
              console.log(`⚠️ [PAYOUT-CRON] Vendor ${vendorId} bank not verified, skipping payout ${payoutId}`);
              skippedCount++;
              continue;
            }

            try {
              // ✅ ACTUAL RAZORPAY API: Process payout
              console.log(`💸 [PAYOUT-CRON] Processing payout ${payoutId}: ₹${payout.amount} to vendor ${vendorId}`);

              // Update payout status to processing
              payout.status = 'processing';
              payout.processingStartedAt = new Date().toISOString();
              await kv.set(`payout:${payoutId}`, payout);

              // Create Razorpay payout
              const razorpayPayout = await createRazorpayPayout({
                accountId: vendorBank.fundAccountId || vendorBank.accountNumber,
                amount: payout.amount,
                currency: 'INR',
                notes: {
                  payoutId,
                  vendorId,
                  bookingId: payout.bookingId,
                  settlementId: payout.settlementId,
                  accountHolderName: vendorBank.accountName || vendorBank.name,
                  ifsc: vendorBank.ifsc,
                  accountNumber: vendorBank.accountNumber
                }
              });

              // Update payout with Razorpay details
              payout.status = 'completed';
              payout.completedAt = new Date().toISOString();
              payout.razorpayPayoutId = razorpayPayout.id;
              payout.razorpayPayoutStatus = razorpayPayout.status;
              payout.utr = razorpayPayout.utr || null;
              payout.payoutMode = razorpayPayout.mode || 'NEFT';
              await kv.set(`payout:${payoutId}`, payout);

              // Remove from pending list
              const updatedPending = pendingPayoutIds.filter((id: string) => id !== payoutId);
              await kv.set(vendorPayoutsKey, updatedPending);

              // Add to completed list
              const completedPayoutsKey = `vendor:${vendorId}:payouts:completed`;
              const completedPayouts = await kv.get(completedPayoutsKey) || [];
              completedPayouts.unshift(payoutId);
              await kv.set(completedPayoutsKey, completedPayouts);

              // ✅ NOTIFICATION: Notify vendor
              try {
                const vendor = await kv.get(`vendor:${vendorId}`);
                await createNotificationHelper(kv, {
                  recipientId: vendorId,
                  recipientType: 'vendor',
                  type: 'payout_completed',
                  category: 'payouts',
                  title: 'Payout Processed',
                  message: `Your payout of ₹${payout.amount} has been processed. UTR: ${payout.utr || 'N/A'}`,
                  recipientEmail: vendor?.email,
                  recipientPhone: vendor?.phone,
                  channels: { email: true, sms: false, inApp: true, push: false },
                  data: { payoutId, amount: payout.amount, utr: payout.utr },
                  priority: 'medium'
                });
              } catch (notifError) {
                console.error(`⚠️ [PAYOUT-CRON] Failed to send notification:`, notifError);
                // Don't fail payout if notification fails
              }

              processedCount++;
              results.push({
                payoutId,
                vendorId,
                amount: payout.amount,
                status: 'completed',
                razorpayPayoutId: razorpayPayout.id
              });

              console.log(`✅ [PAYOUT-CRON] Payout ${payoutId} processed successfully: ${razorpayPayout.id}`);

            } catch (payoutError: any) {
              console.error(`❌ [PAYOUT-CRON] Failed to process payout ${payoutId}:`, payoutError);
              
              // Update payout status to failed
              payout.status = 'failed';
              payout.failedAt = new Date().toISOString();
              payout.failureReason = payoutError.message || 'Razorpay payout failed';
              payout.retryCount = (payout.retryCount || 0) + 1;
              await kv.set(`payout:${payoutId}`, payout);

              failedCount++;
              results.push({
                payoutId,
                vendorId,
                amount: payout.amount,
                status: 'failed',
                error: payoutError.message
              });
            }
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
   * Get status of payout processing (for monitoring)
   */
  app.get(`${BASE_PATH}/cron/payout-status`, async (c) => {
    try {
      const payoutPolicies = await kv.get('admin:payout:policies') || {
        holdPeriodDays: 7,
        autoPayout: false,
        minPayoutAmount: 1000
      };

      // Count pending payouts
      let pendingCount = 0;
      let pendingAmount = 0;
      const allVendors = await kv.getByPrefix('vendor:');
      
      for (const vendor of allVendors) {
        if (!vendor.id || vendor.id.includes(':')) continue;
        const pendingPayoutIds = await kv.get(`vendor:${vendor.id}:payouts:pending`) || [];
        
        for (const payoutId of pendingPayoutIds) {
          const payout = await kv.get(`payout:${payoutId}`);
          if (payout && payout.status === 'scheduled') {
            pendingCount++;
            pendingAmount += payout.amount || 0;
          }
        }
      }

      return sendSuccess(c, {
        autoPayoutEnabled: payoutPolicies.autoPayout,
        pendingCount,
        pendingAmount,
        minPayoutAmount: payoutPolicies.minPayoutAmount,
        holdPeriodDays: payoutPolicies.holdPeriodDays
      });

    } catch (error: any) {
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Payout cron job endpoints registered');
}

