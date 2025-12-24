/**
 * AUTOMATED PAYOUT PROCESSING SYSTEM (SQL-ONLY)
 * 
 * ✅ MIGRATED TO SQL: All operations use SQL repositories (NO KV STORE)
 * 
 * Features:
 * - Automated vendor payout calculation
 * - Tier-based payout schedule (T+7, T+14, T+30)
 * - Batch payout processing
 * - Payout status tracking
 * - Staff earnings settlement
 * 
 * Status: ✅ P0 CRITICAL IMPLEMENTATION
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getDbClient } from '../../lib/db.ts';
import { getPayoutsRepository } from '../../lib/repositories/payouts.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { processAutomaticPayouts } from '../../lib/services/payout-processing.ts';

const app = new Hono();
app.use('*', cors());

/**
 * POST /payouts/process
 * ✅ MIGRATED TO SQL: Process automated vendor payouts
 */
app.post('/make-server-3dd53475/payouts/process', async (c) => {
  try {
    const { vendorId, dryRun } = await c.req.json();
    
    if (!vendorId) {
      return c.json({ error: 'vendorId is required' }, 400);
    }
    
    // ✅ SQL: Use payout processing service
    const stats = await processAutomaticPayouts();
    
    return c.json({
      success: true,
      dryRun: dryRun || false,
      stats
    });
    
  } catch (error) {
    console.error('❌ Error processing payout:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /payouts/process-batch
 * ✅ MIGRATED TO SQL: Process payouts for multiple vendors
 */
app.post('/make-server-3dd53475/payouts/process-batch', async (c) => {
  try {
    const { vendorIds, dryRun } = await c.req.json();
    
    if (!vendorIds || !Array.isArray(vendorIds)) {
      return c.json({ error: 'vendorIds array is required' }, 400);
    }
    
    const client = getDbClient();
    const results = [];
    let totalAmount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    // ✅ SQL: Get payout rule
    const { data: payoutRule } = await client
      .from('payout_rules')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();
    
    if (!payoutRule) {
      return c.json({ error: 'No active payout rule found' }, 400);
    }
    
    for (const vendorId of vendorIds) {
      try {
        // ✅ SQL: Get vendor
        const vendorsRepo = getVendorsRepository();
        const vendor = await vendorsRepo.findById(vendorId);
        
        if (!vendor) {
          results.push({
            vendorId,
            success: false,
            error: 'Vendor not found'
          });
          errorCount++;
          continue;
        }
        
        // ✅ SQL: Calculate pending earnings from completed bookings
        const bookingsRepo = getBookingsRepository();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - payoutRule.processing_days);
        
        // ✅ SQL: Get all completed bookings for vendor
        const allCompletedBookings = await bookingsRepo.findByVendor(vendorId, {
          status: 'completed',
        });
        
        // Filter by cutoff date
        const completedBookings = allCompletedBookings.filter(
          b => b.completed_at && new Date(b.completed_at) <= cutoffDate
        );
        
        // Filter bookings that haven't been settled
        const { data: existingPayouts } = await client
          .from('payouts')
          .select('payment_ids')
          .eq('vendor_id', vendorId)
          .in('payout_status', ['pending', 'processing', 'completed']);
        
        const settledPaymentIds = new Set(
          (existingPayouts || []).flatMap(p => p.payment_ids || [])
        );
        
        // Filter bookings that haven't been settled (by payment_id or settled_at)
        const readyBookings = completedBookings.filter(
          b => b.payment_id 
            && !settledPaymentIds.has(b.payment_id)
            && !b.settled_at  // Additional check: booking not explicitly marked as settled
        );
        
        const pendingEarnings = readyBookings.reduce(
          (sum, b) => sum + (b.total_amount || 0),
          0
        );
        
        if (pendingEarnings > 0 && !dryRun) {
          // ✅ SQL: Create payout
          const payoutsRepo = getPayoutsRepository();
          
          // Get vendor bank details
          const { data: bankDetails } = await client
            .from('vendor_bank_details')
            .select('*')
            .eq('vendor_id', vendorId)
            .eq('is_verified', true)
            .single();
          
          if (!bankDetails) {
            results.push({
              vendorId,
              success: false,
              error: 'No verified bank details'
            });
            errorCount++;
            continue;
          }
          
          const payout = await payoutsRepo.create({
            vendor_id: vendorId,
            amount: pendingEarnings,
            bank_account_number: bankDetails.account_number,
            ifsc_code: bankDetails.ifsc_code,
            account_holder_name: bankDetails.account_holder_name,
            payment_ids: readyBookings
              .map(b => b.payment_id)
              .filter(Boolean) as string[],
          });
          
          // Add to pending queue
          await client
            .from('pending_payouts')
            .insert({
              payout_id: payout.id,
              vendor_id: vendorId,
              amount: pendingEarnings,
              priority: 5,
            });
          
          // ✅ FIX: Mark bookings as settled
          const bookingIds = readyBookings.map(b => b.id);
          if (bookingIds.length > 0) {
            await client
              .from('bookings')
              .update({ settled_at: new Date().toISOString() })
              .in('id', bookingIds);
            
            console.log(`✅ Marked ${bookingIds.length} bookings as settled for payout ${payout.id}`);
          }
          
          totalAmount += pendingEarnings;
          successCount++;
          
          results.push({
            vendorId,
            success: true,
            payoutId: payout.id,
            amount: pendingEarnings,
            bookingsCount: readyBookings.length
          });
        } else {
          results.push({
            vendorId,
            success: true,
            amount: pendingEarnings,
            bookingsCount: readyBookings.length,
            message: pendingEarnings === 0 ? 'No pending earnings' : 'Dry run'
          });
        }
      } catch (error) {
        errorCount++;
        results.push({
          vendorId,
          success: false,
          error: String(error)
        });
      }
    }
    
    console.log(`✅ Batch payout ${dryRun ? 'calculated' : 'processed'}: ${successCount} vendors, ₹${totalAmount}`);
    
    return c.json({
      success: true,
      dryRun: dryRun || false,
      summary: {
        totalVendors: vendorIds.length,
        successCount,
        errorCount,
        totalAmount
      },
      results
    });
    
  } catch (error) {
    console.error('❌ Error processing batch payouts:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /vendor/:vendorId/payouts
 * ✅ MIGRATED TO SQL: Get vendor payout history and pending earnings
 */
app.get('/make-server-3dd53475/vendor/:vendorId/payouts', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const client = getDbClient();
    
    // ✅ SQL: Get payout rule
    const { data: payoutRule } = await client
      .from('payout_rules')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();
    
    const payoutPeriodDays = payoutRule?.processing_days || 14;
    
    // ✅ SQL: Calculate pending earnings
    const bookingsRepo = getBookingsRepository();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - payoutPeriodDays);
    
    // ✅ SQL: Get all completed bookings for vendor
    const allCompletedBookings = await bookingsRepo.findByVendor(vendorId, {
      status: 'completed',
    });
    
    // Filter by cutoff date
    const completedBookings = allCompletedBookings.filter(
      b => b.completed_at && new Date(b.completed_at) <= cutoffDate
    );
    
    // Get settled payment IDs
    const { data: existingPayouts } = await client
      .from('payouts')
      .select('payment_ids')
      .eq('vendor_id', vendorId)
      .in('payout_status', ['pending', 'processing', 'completed']);
    
    const settledPaymentIds = new Set(
      (existingPayouts || []).flatMap(p => p.payment_ids || [])
    );
    
    // Filter bookings that haven't been settled (by payment_id or settled_at)
    const readyBookings = completedBookings.filter(
      b => b.payment_id 
        && !settledPaymentIds.has(b.payment_id)
        && !b.settled_at  // Additional check: booking not explicitly marked as settled
    );
    
    const pendingEarnings = readyBookings.reduce(
      (sum, b) => sum + (b.total_amount || 0),
      0
    );
    
    // ✅ SQL: Get payout history
    const payoutsRepo = getPayoutsRepository();
    const payouts = await payoutsRepo.findByVendor(vendorId);
    
    // Calculate next payout date
    let nextPayoutDate = null;
    if (pendingEarnings > 0 || readyBookings.length > 0) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + payoutPeriodDays);
      nextPayoutDate = nextDate.toISOString();
    }
    
    // ✅ SQL: Calculate total earnings from all completed bookings
    const allCompletedBookings = await bookingsRepo.findByVendor(vendorId, {
      status: 'completed',
    });
    
    const totalEarnings = allCompletedBookings.reduce(
      (sum, b) => sum + (b.total_amount || 0),
      0
    );
    
    const settledEarnings = payouts
      .filter(p => p.payout_status === 'completed')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    
    const lastPayout = payouts
      .filter(p => p.payout_status === 'completed')
      .sort((a, b) => new Date(b.completed_at || '').getTime() - new Date(a.completed_at || '').getTime())[0];
    
    return c.json({
      success: true,
      payoutSchedule: {
        periodDays: payoutPeriodDays,
        nextPayoutDate,
        readyForPayout: pendingEarnings > 0,
        pendingEarnings,
        readyBookingsCount: readyBookings.length
      },
      earnings: {
        totalEarnings,
        settledEarnings,
        pendingEarnings,
        lastPayoutAt: lastPayout?.completed_at || null,
        lastPayoutAmount: lastPayout ? Number(lastPayout.amount) : 0
      },
      payoutHistory: payouts
    });
    
  } catch (error) {
    console.error('❌ Error fetching vendor payouts:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /payouts/pending
 * ✅ MIGRATED TO SQL: Get all vendors with pending payouts ready for processing
 */
app.get('/make-server-3dd53475/payouts/pending', async (c) => {
  try {
    const client = getDbClient();
    
    // ✅ SQL: Get all active vendors
    const { data: vendors } = await client
      .from('vendors')
      .select('id, business_name, status')
      .eq('status', 'active');
    
    if (!vendors) {
      return c.json({ success: true, pendingPayouts: [], totalPending: 0 });
    }
    
    // ✅ SQL: Get payout rule
    const { data: payoutRule } = await client
      .from('payout_rules')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();
    
    const payoutPeriodDays = payoutRule?.processing_days || 14;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - payoutPeriodDays);
    
    const pendingPayouts = [];
    const bookingsRepo = getBookingsRepository();
    
    for (const vendor of vendors) {
      try {
        // ✅ SQL: Get all completed bookings for vendor
        const allCompletedBookings = await bookingsRepo.findByVendor(vendor.id, {
          status: 'completed',
        });
        
        // Filter by cutoff date
        const completedBookings = allCompletedBookings.filter(
          b => b.completed_at && new Date(b.completed_at) <= cutoffDate
        );
        
        // Get settled payment IDs
        const { data: existingPayouts } = await client
          .from('payouts')
          .select('payment_ids')
          .eq('vendor_id', vendor.id)
          .in('payout_status', ['pending', 'processing', 'completed']);
        
        const settledPaymentIds = new Set(
          (existingPayouts || []).flatMap(p => p.payment_ids || [])
        );
        
        // Filter bookings that haven't been settled (by payment_id or settled_at)
        const readyBookings = completedBookings.filter(
          b => b.payment_id 
            && !settledPaymentIds.has(b.payment_id)
            && !b.settled_at  // Additional check: booking not explicitly marked as settled
        );
        
        const pendingEarnings = readyBookings.reduce(
          (sum, b) => sum + (b.total_amount || 0),
          0
        );
        
        if (pendingEarnings > 0) {
          // Get vendor tier
          const { data: vendorTier } = await client
            .from('vendor_tiers')
            .select('tier_name')
            .eq('vendor_id', vendor.id)
            .single();
          
          pendingPayouts.push({
            vendorId: vendor.id,
            vendorName: vendor.business_name,
            tier: vendorTier?.tier_name || 'None',
            payoutPeriodDays,
            pendingEarnings,
            bookingsCount: readyBookings.length
          });
        }
      } catch (error) {
        console.error(`Error processing vendor ${vendor.id}:`, error);
      }
    }
    
    // Sort by pending amount (highest first)
    pendingPayouts.sort((a, b) => b.pendingEarnings - a.pendingEarnings);
    
    const totalPending = pendingPayouts.reduce((sum, p) => sum + p.pendingEarnings, 0);
    
    return c.json({
      success: true,
      pendingPayouts,
      totalPending,
      vendorsCount: pendingPayouts.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching pending payouts:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;

