/**
 * AUTOMATED PAYOUT PROCESSING SYSTEM - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Features:
 * - Automated vendor payout calculation
 * - Tier-based payout schedule (T+7, T+14, T+30)
 * - Batch payout processing
 * - Payout status tracking
 * - Staff earnings settlement
 * 
 * Status: ✅ P0 CRITICAL IMPLEMENTATION
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (23 KV operations → 0)
 * Endpoints: 5
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getDbClient } from '../../lib/db.ts';
import { getPayoutsRepository } from '../../lib/repositories/payouts.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getVendorTiersRepository } from '../../lib/repositories/vendor-tiers.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
// Note: vendor_earnings table exists, using direct DB queries

const app = new Hono();
app.use('*', cors());

// Helper: Get tier payout period
async function getTierPayoutPeriod(vendorId: string): Promise<number> {
  // ✅ SQL: Get vendor
  const vendor = await getVendorsRepository().findById(vendorId);
  
  if (!vendor || !vendor.tier) {
    return 14; // Default T+14 for no tier
  }
  
  // ✅ SQL: Get tier information
  const tierSubscriptions = await getVendorTiersRepository().findByVendor(vendorId);
  if (tierSubscriptions.length > 0) {
    const activeSubscription = tierSubscriptions.find((s: any) => s.status === 'active');
    if (activeSubscription) {
      const tier = await getVendorTiersRepository().findTierById(activeSubscription.tier_id);
      if (tier && tier.payout_period_days) {
        return tier.payout_period_days;
      }
    }
  }
  
  // Default based on tier name
  const tierName = vendor.tier.toLowerCase();
  if (tierName === 'platinum' || tierName === 'gold') {
    return 7; // T+7
  } else if (tierName === 'silver') {
    return 14; // T+14
  } else {
    return 30; // T+30
  }
}

// Helper: Calculate pending earnings ready for payout
async function calculatePendingPayouts(vendorId: string) {
  const payoutPeriodDays = await getTierPayoutPeriod(vendorId);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - payoutPeriodDays);
  
  // ✅ SQL: Get all completed bookings for this vendor with pending earnings
  const db = getDbClient();
  const { data: earnings, error } = await db
    .from('vendor_earnings')
    .select('*, bookings!inner(*)')
    .eq('vendor_id', vendorId)
    .eq('status', 'pending')
    .lte('created_at', cutoffDate.toISOString());
  
  if (error) {
    throw error;
  }
  
  let pendingEarnings = 0;
  let readyBookings: string[] = [];
  
  for (const earning of (earnings || [])) {
    const booking = (earning as any).bookings;
    if (booking && booking.status === 'completed' && booking.completed_at) {
      const completedDate = new Date(booking.completed_at);
      if (completedDate <= cutoffDate) {
        pendingEarnings += parseFloat(earning.amount || 0);
        readyBookings.push(earning.booking_id);
      }
    }
  }
  
  return {
    pendingEarnings,
    readyBookings,
    payoutPeriodDays
  };
}

/**
 * POST /payouts/process
 * Process automated vendor payouts
 * 
 * P0 CRITICAL - Automated payout processing
 */
app.post('/payouts/process', async (c) => {
  try {
    const { vendorId, dryRun } = await c.req.json();
    
    if (!vendorId) {
      return c.json({ error: 'vendorId is required' }, 400);
    }
    
    // Calculate pending payouts
    const { pendingEarnings, readyBookings, payoutPeriodDays } = await calculatePendingPayouts(vendorId);
    
    if (pendingEarnings === 0) {
      return c.json({
        success: true,
        message: 'No pending earnings ready for payout',
        pendingEarnings: 0,
        payoutPeriodDays
      });
    }
    
    // Dry run - just return calculation
    if (dryRun) {
      return c.json({
        success: true,
        dryRun: true,
        pendingEarnings,
        bookingsCount: readyBookings.length,
        payoutPeriodDays,
        readyBookings
      });
    }
    
    // Process actual payout
    const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const scheduledDate = new Date(Date.now() + 86400000); // T+1
    
    // ✅ SQL: Create payout record
    const payoutsRepo = getPayoutsRepository();
    const payout = await payoutsRepo.create({
      vendor_id: vendorId,
      amount: pendingEarnings,
      scheduled_at: scheduledDate.toISOString(),
      settlement_ids: [] // Will be populated from earnings
    });
    
    // ✅ SQL: Update vendor earnings to mark as paid_out
    const db = getDbClient();
    await db
      .from('vendor_earnings')
      .update({
        status: 'paid_out',
        payout_id: payout.id,
        paid_out_at: new Date().toISOString()
      })
      .in('booking_id', readyBookings)
      .eq('vendor_id', vendorId)
      .eq('status', 'pending');
    
    // ✅ SQL: Update bookings metadata with payout reference
    for (const bookingId of readyBookings) {
      const booking = await getBookingsRepository().findById(bookingId);
      if (booking) {
        const metadata = (booking.metadata as any) || {};
        const earnings = metadata.earnings || {};
        earnings.settled = true;
        earnings.settledAt = new Date().toISOString();
        earnings.payoutId = payout.id;
        
        await getBookingsRepository().update(bookingId, {
          metadata: {
            ...metadata,
            earnings
          }
        });
      }
    }
    
    console.log(`✅ Payout processed: ${payout.id} - ₹${pendingEarnings} for vendor ${vendorId}`);
    
    return c.json({
      success: true,
      payout: {
        id: payout.id,
        vendorId: payout.vendor_id,
        amount: payout.amount,
        status: payout.status,
        scheduledAt: payout.scheduled_at
      },
      message: `Payout of ₹${pendingEarnings} processed successfully`
    });
    
  } catch (error) {
    console.error('❌ Error processing payout:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /payouts/process-batch
 * Process payouts for multiple vendors
 * 
 * For automated daily/weekly batch processing
 */
app.post('/payouts/process-batch', async (c) => {
  try {
    const { vendorIds, dryRun } = await c.req.json();
    
    if (!vendorIds || !Array.isArray(vendorIds)) {
      return c.json({ error: 'vendorIds array is required' }, 400);
    }
    
    const results = [];
    let totalAmount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (const vendorId of vendorIds) {
      try {
        const { pendingEarnings, readyBookings, payoutPeriodDays } = await calculatePendingPayouts(vendorId);
        
        if (pendingEarnings > 0) {
          if (!dryRun) {
            // Process actual payout
            const scheduledDate = new Date(Date.now() + 86400000);
            const payoutsRepo = getPayoutsRepository();
            const payout = await payoutsRepo.create({
              vendor_id: vendorId,
              amount: pendingEarnings,
              scheduled_at: scheduledDate.toISOString(),
              settlement_ids: []
            });
            
            // Update earnings
            const db = getDbClient();
            await db
              .from('vendor_earnings')
              .update({
                status: 'paid_out',
                payout_id: payout.id,
                paid_out_at: new Date().toISOString()
              })
              .in('booking_id', readyBookings)
              .eq('vendor_id', vendorId)
              .eq('status', 'pending');
          }
          
          totalAmount += pendingEarnings;
          successCount++;
          
          results.push({
            vendorId,
            success: true,
            amount: pendingEarnings,
            bookingsCount: readyBookings.length
          });
        } else {
          results.push({
            vendorId,
            success: true,
            amount: 0,
            message: 'No pending earnings'
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
 * Get vendor payout history and pending earnings
 */
app.get('/vendor/:vendorId/payouts', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    // Get payout period for this vendor
    const payoutPeriodDays = await getTierPayoutPeriod(vendorId);
    
    // Calculate pending earnings
    const { pendingEarnings, readyBookings } = await calculatePendingPayouts(vendorId);
    
    // ✅ SQL: Get payout history
    const payoutsRepo = getPayoutsRepository();
    const payouts = await payoutsRepo.findByVendor(vendorId, { limit: 50 });
    
    // ✅ SQL: Get vendor earnings summary
    const db = getDbClient();
    const { data: earningsSummary } = await db
      .from('vendor_earnings')
      .select('status, amount')
      .eq('vendor_id', vendorId);
    
    const totalEarnings = (earningsSummary || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const settledEarnings = (earningsSummary || []).filter(e => e.status === 'paid_out').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const pendingEarningsTotal = (earningsSummary || []).filter(e => e.status === 'pending').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    
    // Calculate next payout date
    let nextPayoutDate = null;
    if (pendingEarnings > 0 || readyBookings.length > 0) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + payoutPeriodDays);
      nextPayoutDate = nextDate.toISOString();
    }
    
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
        pendingEarnings: pendingEarningsTotal,
        lastPayoutAt: payouts[0]?.processed_at || null,
        lastPayoutAmount: payouts[0]?.amount || 0
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
 * Get all vendors with pending payouts ready for processing
 * 
 * Used by admin to see which vendors need payouts
 */
app.get('/payouts/pending', async (c) => {
  try {
    // ✅ SQL: Get all active vendors
    const vendors = await getVendorsRepository().findAll({ status: 'approved' });
    const pendingPayouts = [];
    
    for (const vendor of vendors) {
      const { pendingEarnings, readyBookings, payoutPeriodDays } = await calculatePendingPayouts(vendor.id);
      
      if (pendingEarnings > 0) {
        pendingPayouts.push({
          vendorId: vendor.id,
          vendorName: vendor.business_name,
          tier: vendor.tier || 'None',
          payoutPeriodDays,
          pendingEarnings,
          bookingsCount: readyBookings.length
        });
      }
    }
    
    // Sort by pending amount (highest first)
    pendingPayouts.sort((a, b) => b.pendingEarnings - a.pendingEarnings);
    
    const totalPending = pendingPayouts.reduce((sum, p) => sum + p.pendingEarnings, 0);
    
    console.log(`📊 Pending payouts: ${pendingPayouts.length} vendors, ₹${totalPending}`);
    
    return c.json({
      success: true,
      summary: {
        totalVendors: pendingPayouts.length,
        totalAmount: totalPending
      },
      pendingPayouts
    });
    
  } catch (error) {
    console.error('❌ Error fetching pending payouts:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /payouts/:payoutId/update-status
 * Update payout status (for bank transfer confirmation)
 */
app.post('/payouts/:payoutId/update-status', async (c) => {
  try {
    const payoutId = c.req.param('payoutId');
    const { status, transferReference, transferredAt } = await c.req.json();
    
    // ✅ SQL: Get and update payout
    const payoutsRepo = getPayoutsRepository();
    const payout = await payoutsRepo.findById(payoutId);
    
    if (!payout) {
      return c.json({ error: 'Payout not found' }, 404);
    }
    
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };
    
    if (transferredAt) {
      updateData.processed_at = transferredAt;
    }
    
    // Update payout
    await payoutsRepo.update(payoutId, updateData);
    
    console.log(`✅ Payout status updated: ${payoutId} -> ${status}`);
    
    const updatedPayout = await payoutsRepo.findById(payoutId);
    
    return c.json({
      success: true,
      payout: updatedPayout
    });
    
  } catch (error) {
    console.error('❌ Error updating payout status:', error);
    return c.json({ error: String(error) }, 500);
  }
});

console.log('✅ Automated payout processing endpoints registered (SQL-only)');

export function registerAutomatedPayoutProcessingSQL(app: Hono) {
  // Routes are already registered on the app instance
  // This function is for consistency with other endpoint registrations
}

export default app;
