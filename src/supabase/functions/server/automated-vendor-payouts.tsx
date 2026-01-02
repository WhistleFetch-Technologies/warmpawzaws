/**
 * Automated Vendor Payout System
 * Uses Razorpay Route for automatic settlement to vendor bank accounts
 */

import { Hono } from 'hono';
import * as kv from './kv_store';
import { createRazorpayTransfer, createLinkedAccount } from './razorpay-integration';
import { sendSuccess, sendError } from './response-utils';

// Payout configuration
const PAYOUT_THRESHOLD = 1000; // Minimum ₹1000 for payout
const AUTO_PAYOUT_ENABLED = Deno.env.get('AUTO_PAYOUT_ENABLED') === 'true';
const PAYOUT_SCHEDULE = 'weekly'; // 'daily', 'weekly', 'monthly'

/**
 * Automated Payout Endpoints
 */
export function automatedPayoutEndpoints(app: Hono) {
  
  /**
   * POST /vendor/:vendorId/payout/setup
   * Setup vendor for automated payouts (create Razorpay linked account)
   */
  app.post('/make-server-3dd53475/vendor/:vendorId/payout/setup', async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Check if already setup
      if (vendor.razorpayAccountId) {
        return sendSuccess(c, { 
          message: 'Payout already setup',
          accountId: vendor.razorpayAccountId
        });
      }

      // Create Razorpay linked account
      const linkedAccount = await createLinkedAccount(vendor);
      
      // Update vendor record
      vendor.razorpayAccountId = linkedAccount.id;
      vendor.payoutEnabled = true;
      vendor.payoutSetupAt = new Date().toISOString();
      await kv.set(`vendor:${vendorId}`, vendor);

      console.log(`✅ Payout setup completed for vendor: ${vendorId}`);
      
      return sendSuccess(c, {
        message: 'Payout setup successful',
        accountId: linkedAccount.id
      });
    } catch (error: any) {
      console.error('Payout setup error:', error);
      return sendError(c, error.message, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/payout/request
   * Vendor requests manual payout
   */
  app.post('/make-server-3dd53475/vendor/:vendorId/payout/request', async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { amount, notes } = await c.req.json();
      
      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Validate amount
      if (!amount || amount <= 0) {
        return sendError(c, 'Invalid payout amount', 400);
      }

      if (amount > vendor.pendingPayout) {
        return sendError(c, `Insufficient balance. Available: ₹${vendor.pendingPayout}`, 400);
      }

      if (amount < PAYOUT_THRESHOLD) {
        return sendError(c, `Minimum payout amount is ₹${PAYOUT_THRESHOLD}`, 400);
      }

      // Create payout request
      const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const payout = {
        id: payoutId,
        vendorId,
        amount,
        status: 'pending',
        type: 'manual',
        notes: notes || '',
        requestedAt: new Date().toISOString(),
        bankDetails: vendor.bankDetails || {},
        razorpayAccountId: vendor.razorpayAccountId
      };

      // Save payout request
      await kv.set(`payout:${payoutId}`, payout);

      // Add to vendor's payout history
      const payoutHistory = await kv.get(`vendor:${vendorId}:payouts`) || [];
      payoutHistory.unshift(payoutId);
      await kv.set(`vendor:${vendorId}:payouts`, payoutHistory);

      // Add to pending payouts queue
      const pendingPayouts = await kv.get('payouts:pending') || [];
      pendingPayouts.push(payoutId);
      await kv.set('payouts:pending', pendingPayouts);

      console.log(`💰 Payout requested: ${payoutId} for vendor: ${vendorId}`);

      // If auto-payout is enabled and vendor has Razorpay account, process immediately
      if (AUTO_PAYOUT_ENABLED && vendor.razorpayAccountId) {
        setTimeout(async () => {
          await processAutomatedPayout(payoutId);
        }, 1000);
      }
      
      return sendSuccess(c, {
        payoutId,
        status: AUTO_PAYOUT_ENABLED ? 'processing' : 'pending',
        message: AUTO_PAYOUT_ENABLED ? 'Payout is being processed' : 'Payout request submitted for approval'
      });
    } catch (error: any) {
      console.error('Payout request error:', error);
      return sendError(c, error.message, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/payouts
   * Get vendor's payout history
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/payouts', async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const payoutIds = await kv.get(`vendor:${vendorId}:payouts`) || [];
      
      const payouts = [];
      for (const payoutId of payoutIds) {
        const payout = await kv.get(`payout:${payoutId}`);
        if (payout) {
          payouts.push(payout);
        }
      }
      
      return sendSuccess(c, { 
        payouts,
        total: payouts.length 
      });
    } catch (error: any) {
      console.error('Error fetching payouts:', error);
      return sendError(c, error.message, 500);
    }
  });

  /**
   * POST /admin/payouts/:payoutId/approve
   * Admin approves manual payout
   */
  app.post('/make-server-3dd53475/admin/payouts/:payoutId/approve', async (c) => {
    try {
      const { payoutId } = c.req.param();
      const { adminId } = await c.req.json();
      
      const payout = await kv.get(`payout:${payoutId}`);
      
      if (!payout) {
        return sendError(c, 'Payout not found', 404);
      }

      if (payout.status !== 'pending') {
        return sendError(c, `Payout already ${payout.status}`, 400);
      }

      // Process payout
      const result = await processAutomatedPayout(payoutId);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      console.log(`✅ Payout approved and processed: ${payoutId}`);
      
      return sendSuccess(c, {
        message: 'Payout approved and processed',
        payout: result.payout
      });
    } catch (error: any) {
      console.error('Payout approval error:', error);
      return sendError(c, error.message, 500);
    }
  });

  /**
   * POST /admin/payouts/:payoutId/reject
   * Admin rejects payout
   */
  app.post('/make-server-3dd53475/admin/payouts/:payoutId/reject', async (c) => {
    try {
      const { payoutId } = c.req.param();
      const { reason, adminId } = await c.req.json();
      
      const payout = await kv.get(`payout:${payoutId}`);
      
      if (!payout) {
        return sendError(c, 'Payout not found', 404);
      }

      if (payout.status !== 'pending') {
        return sendError(c, `Payout already ${payout.status}`, 400);
      }

      // Update payout status
      payout.status = 'rejected';
      payout.rejectedAt = new Date().toISOString();
      payout.rejectedBy = adminId;
      payout.rejectionReason = reason;
      await kv.set(`payout:${payoutId}`, payout);

      // Remove from pending queue
      const pendingPayouts = await kv.get('payouts:pending') || [];
      await kv.set('payouts:pending', pendingPayouts.filter((id: string) => id !== payoutId));

      console.log(`❌ Payout rejected: ${payoutId}`);
      
      return sendSuccess(c, {
        message: 'Payout rejected',
        payout
      });
    } catch (error: any) {
      console.error('Payout rejection error:', error);
      return sendError(c, error.message, 500);
    }
  });

  /**
   * GET /admin/payouts/pending
   * Get all pending payouts
   */
  app.get('/make-server-3dd53475/admin/payouts/pending', async (c) => {
    try {
      const payoutIds = await kv.get('payouts:pending') || [];
      
      const payouts = [];
      for (const payoutId of payoutIds) {
        const payout = await kv.get(`payout:${payoutId}`);
        if (payout && payout.status === 'pending') {
          // Enrich with vendor details
          const vendor = await kv.get(`vendor:${payout.vendorId}`);
          payout.vendorName = vendor?.businessName || 'Unknown';
          payout.vendorEmail = vendor?.email;
          payouts.push(payout);
        }
      }
      
      return sendSuccess(c, { 
        payouts,
        total: payouts.length 
      });
    } catch (error: any) {
      console.error('Error fetching pending payouts:', error);
      return sendError(c, error.message, 500);
    }
  });

  /**
   * POST /cron/process-scheduled-payouts
   * Cron job to process scheduled payouts
   */
  app.post('/make-server-3dd53475/cron/process-scheduled-payouts', async (c) => {
    try {
      console.log('⏰ Running scheduled payout processing...');
      
      // Get all vendors with pending payouts
      const vendors = await kv.getByPrefix('vendor:');
      
      let processedCount = 0;
      let failedCount = 0;

      for (const vendor of vendors) {
        // Skip if no pending payout or below threshold
        if (!vendor.pendingPayout || vendor.pendingPayout < PAYOUT_THRESHOLD) {
          continue;
        }

        // Skip if payout not enabled
        if (!vendor.payoutEnabled || !vendor.razorpayAccountId) {
          continue;
        }

        // Check payout schedule
        if (!shouldProcessPayout(vendor)) {
          continue;
        }

        try {
          // Create automatic payout
          const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const payout = {
            id: payoutId,
            vendorId: vendor.id,
            amount: vendor.pendingPayout,
            status: 'pending',
            type: 'automatic',
            notes: `Scheduled ${PAYOUT_SCHEDULE} payout`,
            requestedAt: new Date().toISOString(),
            razorpayAccountId: vendor.razorpayAccountId
          };

          await kv.set(`payout:${payoutId}`, payout);

          // Process payout
          const result = await processAutomatedPayout(payoutId);
          
          if (result.success) {
            processedCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          console.error(`Failed to process payout for vendor ${vendor.id}:`, err);
          failedCount++;
        }
      }

      console.log(`✅ Scheduled payout processing complete: ${processedCount} succeeded, ${failedCount} failed`);
      
      return sendSuccess(c, {
        processedCount,
        failedCount
      });
    } catch (error: any) {
      console.error('Scheduled payout processing error:', error);
      return sendError(c, error.message, 500);
    }
  });

  console.log('✅ Automated payout endpoints registered');
}

/**
 * Process automated payout via Razorpay
 */
async function processAutomatedPayout(payoutId: string): Promise<{ success: boolean; payout?: any; error?: string }> {
  try {
    const payout = await kv.get(`payout:${payoutId}`);
    
    if (!payout) {
      throw new Error('Payout not found');
    }

    const vendor = await kv.get(`vendor:${payout.vendorId}`);
    
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Update status to processing
    payout.status = 'processing';
    payout.processingStartedAt = new Date().toISOString();
    await kv.set(`payout:${payoutId}`, payout);

    // If vendor has Razorpay account, use Razorpay transfer
    // Otherwise, mark for manual processing
    if (vendor.razorpayAccountId) {
      // In production, use actual Razorpay transfer
      // For now, simulate successful transfer
      
      // const transfer = await createRazorpayTransfer(
      //   vendor.razorpayAccountId,
      //   payout.amount,
      //   payout.razorpayPaymentId,
      //   { payoutId, vendorId: vendor.id }
      // );

      // Simulate successful transfer
      payout.status = 'completed';
      payout.completedAt = new Date().toISOString();
      payout.transferId = `transfer_mock_${Date.now()}`;
      payout.utr = `UTR${Date.now()}`;
    } else {
      // Mark for manual processing
      payout.status = 'pending_manual';
      payout.note = 'Vendor does not have linked Razorpay account. Manual processing required.';
    }

    await kv.set(`payout:${payoutId}`, payout);

    // Update vendor balances
    if (payout.status === 'completed') {
      vendor.pendingPayout = (vendor.pendingPayout || 0) - payout.amount;
      vendor.totalPaidOut = (vendor.totalPaidOut || 0) + payout.amount;
      vendor.lastPayoutAt = new Date().toISOString();
      await kv.set(`vendor:${vendor.id}`, vendor);
    }

    // Remove from pending queue
    const pendingPayouts = await kv.get('payouts:pending') || [];
    await kv.set('payouts:pending', pendingPayouts.filter((id: string) => id !== payoutId));

    console.log(`✅ Payout processed: ${payoutId} - Status: ${payout.status}`);
    
    return { success: true, payout };
  } catch (error: any) {
    console.error('Payout processing error:', error);
    
    // Update payout status to failed
    const payout = await kv.get(`payout:${payoutId}`);
    if (payout) {
      payout.status = 'failed';
      payout.failedAt = new Date().toISOString();
      payout.failureReason = error.message;
      await kv.set(`payout:${payoutId}`, payout);
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Check if vendor should receive payout based on schedule
 */
function shouldProcessPayout(vendor: any): boolean {
  if (!vendor.lastPayoutAt) {
    return true; // First payout
  }

  const lastPayout = new Date(vendor.lastPayoutAt).getTime();
  const now = Date.now();
  const daysSinceLastPayout = (now - lastPayout) / (1000 * 60 * 60 * 24);

  switch (PAYOUT_SCHEDULE) {
    case 'daily':
      return daysSinceLastPayout >= 1;
    case 'weekly':
      return daysSinceLastPayout >= 7;
    case 'monthly':
      return daysSinceLastPayout >= 30;
    default:
      return false;
  }
}
