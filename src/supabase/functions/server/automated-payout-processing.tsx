/**
 * AUTOMATED PAYOUT PROCESSING SYSTEM
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

import { Hono } from 'hono';
import { cors } from "hono/cors";
import * as kv from './kv_store';

const app = new Hono();
app.use('*', cors());

// Helper: Generate payout ID
function generatePayoutId() {
  return `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Get tier payout period
async function getTierPayoutPeriod(vendorId: string): Promise<number> {
  const vendor = await kv.get(`vendor:${vendorId}`);
  
  if (!vendor || !vendor.tier) {
    return 14; // Default T+14 for no tier
  }
  
  // Get tier information
  const tier = await kv.get(`tier:${vendor.tier}`);
  
  if (tier && tier.payoutPeriodDays) {
    return tier.payoutPeriodDays;
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
  
  // Get all completed bookings for this vendor
  const allBookings = await kv.getByPrefix('booking:');
  
  let pendingEarnings = 0;
  let readyBookings = [];
  
  for (const booking of allBookings) {
    if (
      booking.vendorId === vendorId &&
      booking.status === 'completed' &&
      booking.earnings &&
      !booking.earnings.settled &&
      booking.completedAt
    ) {
      const completedDate = new Date(booking.completedAt);
      
      if (completedDate <= cutoffDate) {
        pendingEarnings += booking.earnings.vendorEarnings || 0;
        readyBookings.push(booking.id);
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
    const payoutId = generatePayoutId();
    const payout = {
      id: payoutId,
      vendorId,
      amount: pendingEarnings,
      bookingsCount: readyBookings.length,
      bookingIds: readyBookings,
      payoutPeriodDays,
      status: 'processed',
      processedAt: new Date().toISOString(),
      payoutMethod: 'bank_transfer', // Default, can be configured
      scheduledTransferDate: new Date(Date.now() + 86400000).toISOString() // T+1 for actual transfer
    };
    
    // Save payout record
    await kv.set(`payout:${payoutId}`, payout);
    
    // Update vendor payouts list
    const vendorPayouts = await kv.get(`vendor:${vendorId}:payouts`) || [];
    vendorPayouts.unshift(payoutId);
    await kv.set(`vendor:${vendorId}:payouts`, vendorPayouts);
    
    // Mark bookings as settled
    for (const bookingId of readyBookings) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking && booking.earnings) {
        booking.earnings.settled = true;
        booking.earnings.settledAt = new Date().toISOString();
        booking.earnings.payoutId = payoutId;
        await kv.set(`booking:${bookingId}`, booking);
      }
    }
    
    // Update vendor earnings
    const vendorEarnings = await kv.get(`earnings:vendor:${vendorId}`) || {
      lifetime: { totalEarnings: 0, settledEarnings: 0, pendingEarnings: 0 }
    };
    
    vendorEarnings.lifetime.settledEarnings = (vendorEarnings.lifetime.settledEarnings || 0) + pendingEarnings;
    vendorEarnings.lifetime.pendingEarnings = (vendorEarnings.lifetime.pendingEarnings || 0) - pendingEarnings;
    vendorEarnings.lastPayoutAt = new Date().toISOString();
    vendorEarnings.lastPayoutAmount = pendingEarnings;
    
    await kv.set(`earnings:vendor:${vendorId}`, vendorEarnings);
    
    console.log(`✅ Payout processed: ${payoutId} - ₹${pendingEarnings} for vendor ${vendorId}`);
    
    return c.json({
      success: true,
      payout,
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
            const payoutId = generatePayoutId();
            const payout = {
              id: payoutId,
              vendorId,
              amount: pendingEarnings,
              bookingsCount: readyBookings.length,
              bookingIds: readyBookings,
              payoutPeriodDays,
              status: 'processed',
              processedAt: new Date().toISOString(),
              payoutMethod: 'bank_transfer',
              scheduledTransferDate: new Date(Date.now() + 86400000).toISOString()
            };
            
            await kv.set(`payout:${payoutId}`, payout);
            
            // Update vendor payouts list
            const vendorPayouts = await kv.get(`vendor:${vendorId}:payouts`) || [];
            vendorPayouts.unshift(payoutId);
            await kv.set(`vendor:${vendorId}:payouts`, vendorPayouts);
            
            // Mark bookings as settled
            for (const bookingId of readyBookings) {
              const booking = await kv.get(`booking:${bookingId}`);
              if (booking && booking.earnings) {
                booking.earnings.settled = true;
                booking.earnings.settledAt = new Date().toISOString();
                booking.earnings.payoutId = payoutId;
                await kv.set(`booking:${bookingId}`, booking);
              }
            }
            
            // Update vendor earnings
            const vendorEarnings = await kv.get(`earnings:vendor:${vendorId}`) || {
              lifetime: { totalEarnings: 0, settledEarnings: 0, pendingEarnings: 0 }
            };
            
            vendorEarnings.lifetime.settledEarnings = (vendorEarnings.lifetime.settledEarnings || 0) + pendingEarnings;
            vendorEarnings.lifetime.pendingEarnings = (vendorEarnings.lifetime.pendingEarnings || 0) - pendingEarnings;
            vendorEarnings.lastPayoutAt = new Date().toISOString();
            vendorEarnings.lastPayoutAmount = pendingEarnings;
            
            await kv.set(`earnings:vendor:${vendorId}`, vendorEarnings);
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
    
    // Get payout history
    const payoutIds = await kv.get(`vendor:${vendorId}:payouts`) || [];
    const payouts = [];
    
    for (const payoutId of payoutIds) {
      const payout = await kv.get(`payout:${payoutId}`);
      if (payout) {
        payouts.push(payout);
      }
    }
    
    // Get vendor earnings
    const vendorEarnings = await kv.get(`earnings:vendor:${vendorId}`) || {
      lifetime: { totalEarnings: 0, settledEarnings: 0, pendingEarnings: 0 }
    };
    
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
        totalEarnings: vendorEarnings.lifetime.totalEarnings || 0,
        settledEarnings: vendorEarnings.lifetime.settledEarnings || 0,
        pendingEarnings: vendorEarnings.lifetime.pendingEarnings || 0,
        lastPayoutAt: vendorEarnings.lastPayoutAt,
        lastPayoutAmount: vendorEarnings.lastPayoutAmount || 0
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
    const allVendors = await kv.getByPrefix('vendor:');
    const pendingPayouts = [];
    
    for (const vendor of allVendors) {
      if (vendor.id && !vendor.id.includes(':')) {
        const { pendingEarnings, readyBookings, payoutPeriodDays } = await calculatePendingPayouts(vendor.id);
        
        if (pendingEarnings > 0) {
          pendingPayouts.push({
            vendorId: vendor.id,
            vendorName: vendor.businessName || vendor.name,
            tier: vendor.tier || 'None',
            payoutPeriodDays,
            pendingEarnings,
            bookingsCount: readyBookings.length
          });
        }
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
    
    const payout = await kv.get(`payout:${payoutId}`);
    if (!payout) {
      return c.json({ error: 'Payout not found' }, 404);
    }
    
    payout.status = status; // completed, failed, pending
    payout.updatedAt = new Date().toISOString();
    
    if (transferReference) {
      payout.transferReference = transferReference;
    }
    
    if (transferredAt) {
      payout.transferredAt = transferredAt;
    }
    
    await kv.set(`payout:${payoutId}`, payout);
    
    console.log(`✅ Payout status updated: ${payoutId} -> ${status}`);
    
    return c.json({
      success: true,
      payout
    });
    
  } catch (error) {
    console.error('❌ Error updating payout status:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
