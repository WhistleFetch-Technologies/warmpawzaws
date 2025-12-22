/**
 * TIER UPGRADE AUTOMATION SYSTEM
 * 
 * Automatically upgrades vendors to higher tiers based on performance metrics
 * 
 * Features:
 * - Automatic tier evaluation based on metrics
 * - Scheduled background processing
 * - Tier upgrade/downgrade logic
 * - Notification system for tier changes
 * - Audit trail for all tier changes
 * 
 * Tier Criteria:
 * - Bronze → Silver: 10+ bookings, 4.0+ rating, ₹10,000+ revenue
 * - Silver → Gold: 50+ bookings, 4.5+ rating, ₹50,000+ revenue
 * - Gold → Platinum: 200+ bookings, 4.8+ rating, ₹200,000+ revenue
 * 
 * P0 CRITICAL - Final Gap Implementation
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';

const app = new Hono();
app.use('*', cors());

// Tier configuration with upgrade criteria
const TIER_CONFIG = {
  bronze: {
    name: 'Bronze',
    nextTier: 'silver',
    payoutSchedule: 'T+30',
    platformFee: 20,
    minBookings: 0,
    minRating: 0,
    minRevenue: 0
  },
  silver: {
    name: 'Silver',
    nextTier: 'gold',
    payoutSchedule: 'T+14',
    platformFee: 15,
    minBookings: 10,
    minRating: 4.0,
    minRevenue: 10000
  },
  gold: {
    name: 'Gold',
    nextTier: 'platinum',
    payoutSchedule: 'T+7',
    platformFee: 12,
    minBookings: 50,
    minRating: 4.5,
    minRevenue: 50000
  },
  platinum: {
    name: 'Platinum',
    nextTier: null,
    payoutSchedule: 'T+7',
    platformFee: 10,
    minBookings: 200,
    minRating: 4.8,
    minRevenue: 200000
  }
};

// Helper: Generate ID
function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Calculate vendor metrics
async function calculateVendorMetrics(vendorId: string) {
  try {
    // Get all completed bookings for vendor
    const allBookings = await kv.getByPrefix('booking:');
    const vendorBookings = allBookings.filter((b: any) => 
      b.vendorId === vendorId && b.status === 'completed'
    );

    const totalBookings = vendorBookings.length;

    // Calculate average rating
    const ratingsData = vendorBookings
      .map((b: any) => b.rating)
      .filter((r: any) => r !== undefined && r !== null);
    
    const averageRating = ratingsData.length > 0
      ? ratingsData.reduce((sum: number, r: number) => sum + r, 0) / ratingsData.length
      : 0;

    // Calculate total revenue
    const totalRevenue = vendorBookings.reduce((sum: number, b: any) => 
      sum + (b.price || b.amount || 0), 0
    );

    // Get earnings data
    const earnings = await kv.get(`earnings:vendor:${vendorId}`) || {
      lifetime: { totalEarnings: 0 }
    };

    return {
      totalBookings,
      averageRating: Math.round(averageRating * 10) / 10,
      totalRevenue: earnings.lifetime.totalEarnings || totalRevenue,
      completionRate: totalBookings > 0 ? 100 : 0, // Could be calculated from cancelled bookings
      activeMonths: Math.ceil((Date.now() - new Date(vendorBookings[0]?.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 30))
    };
  } catch (error) {
    console.error(`Error calculating metrics for vendor ${vendorId}:`, error);
    return {
      totalBookings: 0,
      averageRating: 0,
      totalRevenue: 0,
      completionRate: 0,
      activeMonths: 0
    };
  }
}

// Helper: Determine eligible tier
function determineEligibleTier(metrics: any): string {
  const { totalBookings, averageRating, totalRevenue } = metrics;

  // Check from highest to lowest tier
  if (totalBookings >= TIER_CONFIG.platinum.minBookings &&
      averageRating >= TIER_CONFIG.platinum.minRating &&
      totalRevenue >= TIER_CONFIG.platinum.minRevenue) {
    return 'platinum';
  }

  if (totalBookings >= TIER_CONFIG.gold.minBookings &&
      averageRating >= TIER_CONFIG.gold.minRating &&
      totalRevenue >= TIER_CONFIG.gold.minRevenue) {
    return 'gold';
  }

  if (totalBookings >= TIER_CONFIG.silver.minBookings &&
      averageRating >= TIER_CONFIG.silver.minRating &&
      totalRevenue >= TIER_CONFIG.silver.minRevenue) {
    return 'silver';
  }

  return 'bronze';
}

// Helper: Create tier change notification
async function sendTierChangeNotification(vendorId: string, oldTier: string, newTier: string, metrics: any) {
  try {
    const isUpgrade = ['bronze', 'silver', 'gold', 'platinum'].indexOf(newTier) > 
                      ['bronze', 'silver', 'gold', 'platinum'].indexOf(oldTier);

    const notification = {
      id: generateId('notif'),
      userId: vendorId,
      userType: 'vendor',
      type: isUpgrade ? 'tier_upgrade' : 'tier_downgrade',
      title: isUpgrade ? `🎉 Tier Upgraded to ${TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].name}!` : `Tier Changed to ${TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].name}`,
      message: isUpgrade 
        ? `Congratulations! You've been upgraded to ${TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].name} tier. New payout schedule: ${TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].payoutSchedule}, Platform fee: ${TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].platformFee}%`
        : `Your tier has changed to ${TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].name}. Please review your performance metrics.`,
      data: { 
        oldTier, 
        newTier, 
        metrics,
        payoutSchedule: TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].payoutSchedule,
        platformFee: TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].platformFee
      },
      read: false,
      priority: 'high',
      createdAt: new Date().toISOString()
    };

    const notifications = await kv.get(`notifications:${vendorId}`) || [];
    notifications.unshift(notification);
    await kv.set(`notifications:${vendorId}`, notifications);

    console.log(`📧 [TIER-UPGRADE] Notification sent to vendor ${vendorId}`);
  } catch (error) {
    console.error('[TIER-UPGRADE] Error sending notification:', error);
  }
}

// Helper: Log tier change audit
async function logTierChange(vendorId: string, oldTier: string, newTier: string, metrics: any, reason: string) {
  try {
    const auditLog = {
      id: generateId('tier_audit'),
      vendorId,
      oldTier,
      newTier,
      metrics,
      reason,
      timestamp: new Date().toISOString(),
      processedBy: 'system_automation'
    };

    // Store in audit trail
    const auditTrail = await kv.get(`tier:audit:${vendorId}`) || [];
    auditTrail.unshift(auditLog);
    await kv.set(`tier:audit:${vendorId}`, auditTrail);

    console.log(`📝 [TIER-AUDIT] Logged tier change for ${vendorId}: ${oldTier} → ${newTier}`);
  } catch (error) {
    console.error('[TIER-AUDIT] Error logging tier change:', error);
  }
}

/**
 * POST /tier/evaluate/:vendorId
 * Evaluate a specific vendor for tier upgrade
 */
app.post('/tier/evaluate/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');

    // Get vendor data
    const vendor = await kv.get(`vendor:${vendorId}`);
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }

    const currentTier = vendor.tier || 'bronze';

    // Calculate metrics
    const metrics = await calculateVendorMetrics(vendorId);

    // Determine eligible tier
    const eligibleTier = determineEligibleTier(metrics);

    console.log(`📊 [TIER-EVAL] Vendor ${vendorId}: Current=${currentTier}, Eligible=${eligibleTier}`);
    console.log(`   Metrics:`, metrics);

    // Check if tier change needed
    if (eligibleTier !== currentTier) {
      // Update vendor tier
      vendor.tier = eligibleTier;
      vendor.tierUpdatedAt = new Date().toISOString();
      vendor.payoutSchedule = TIER_CONFIG[eligibleTier as keyof typeof TIER_CONFIG].payoutSchedule;
      vendor.platformFee = TIER_CONFIG[eligibleTier as keyof typeof TIER_CONFIG].platformFee;
      
      await kv.set(`vendor:${vendorId}`, vendor);

      // Send notification
      await sendTierChangeNotification(vendorId, currentTier, eligibleTier, metrics);

      // Log audit trail
      await logTierChange(
        vendorId,
        currentTier,
        eligibleTier,
        metrics,
        'Automatic tier evaluation based on performance metrics'
      );

      console.log(`✅ [TIER-UPGRADE] Vendor ${vendorId} upgraded: ${currentTier} → ${eligibleTier}`);

      return c.json({
        success: true,
        tierChanged: true,
        oldTier: currentTier,
        newTier: eligibleTier,
        metrics,
        message: `Tier updated from ${TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG].name} to ${TIER_CONFIG[eligibleTier as keyof typeof TIER_CONFIG].name}`
      });
    }

    return c.json({
      success: true,
      tierChanged: false,
      currentTier,
      eligibleTier,
      metrics,
      message: 'No tier change needed',
      nextTierRequirements: TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG].nextTier 
        ? TIER_CONFIG[TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG].nextTier as keyof typeof TIER_CONFIG]
        : null
    });

  } catch (error) {
    console.error('❌ Error evaluating tier:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /tier/evaluate-all
 * Evaluate all vendors for tier upgrades (background job)
 */
app.post('/tier/evaluate-all', async (c) => {
  try {
    const { dryRun = false } = await c.req.json().catch(() => ({}));

    console.log(`🔄 [TIER-EVAL-ALL] Starting tier evaluation for all vendors (Dry Run: ${dryRun})`);

    const allVendors = await kv.getByPrefix('vendor:vendor_');
    const results = {
      total: allVendors.length,
      evaluated: 0,
      upgraded: 0,
      downgraded: 0,
      noChange: 0,
      errors: 0,
      changes: [] as any[]
    };

    for (const vendor of allVendors) {
      try {
        const vendorId = vendor.id;
        const currentTier = vendor.tier || 'bronze';

        // Calculate metrics
        const metrics = await calculateVendorMetrics(vendorId);

        // Determine eligible tier
        const eligibleTier = determineEligibleTier(metrics);

        results.evaluated++;

        if (eligibleTier !== currentTier) {
          const isUpgrade = ['bronze', 'silver', 'gold', 'platinum'].indexOf(eligibleTier) > 
                           ['bronze', 'silver', 'gold', 'platinum'].indexOf(currentTier);

          if (isUpgrade) {
            results.upgraded++;
          } else {
            results.downgraded++;
          }

          results.changes.push({
            vendorId,
            vendorName: vendor.businessName || vendor.name,
            oldTier: currentTier,
            newTier: eligibleTier,
            metrics
          });

          if (!dryRun) {
            // Update vendor tier
            vendor.tier = eligibleTier;
            vendor.tierUpdatedAt = new Date().toISOString();
            vendor.payoutSchedule = TIER_CONFIG[eligibleTier as keyof typeof TIER_CONFIG].payoutSchedule;
            vendor.platformFee = TIER_CONFIG[eligibleTier as keyof typeof TIER_CONFIG].platformFee;
            
            await kv.set(`vendor:${vendorId}`, vendor);

            // Send notification
            await sendTierChangeNotification(vendorId, currentTier, eligibleTier, metrics);

            // Log audit trail
            await logTierChange(
              vendorId,
              currentTier,
              eligibleTier,
              metrics,
              'Bulk tier evaluation - automatic upgrade'
            );
          }

          console.log(`${dryRun ? '🔍 [DRY-RUN]' : '✅ [TIER-CHANGE]'} ${vendorId}: ${currentTier} → ${eligibleTier}`);
        } else {
          results.noChange++;
        }

      } catch (error) {
        console.error(`Error evaluating vendor ${vendor.id}:`, error);
        results.errors++;
      }
    }

    console.log(`✅ [TIER-EVAL-ALL] Completed. Upgraded: ${results.upgraded}, Downgraded: ${results.downgraded}, No Change: ${results.noChange}`);

    return c.json({
      success: true,
      dryRun,
      results
    });

  } catch (error) {
    console.error('❌ Error in bulk tier evaluation:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /tier/metrics/:vendorId
 * Get tier eligibility metrics for a vendor
 */
app.get('/tier/metrics/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');

    const vendor = await kv.get(`vendor:${vendorId}`);
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }

    const currentTier = vendor.tier || 'bronze';
    const metrics = await calculateVendorMetrics(vendorId);
    const eligibleTier = determineEligibleTier(metrics);

    // Calculate progress to next tier
    const nextTier = TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG].nextTier;
    let progressToNextTier = null;

    if (nextTier) {
      const nextTierConfig = TIER_CONFIG[nextTier as keyof typeof TIER_CONFIG];
      progressToNextTier = {
        targetTier: nextTier,
        requirements: {
          bookings: {
            current: metrics.totalBookings,
            required: nextTierConfig.minBookings,
            progress: Math.min(100, (metrics.totalBookings / nextTierConfig.minBookings) * 100)
          },
          rating: {
            current: metrics.averageRating,
            required: nextTierConfig.minRating,
            progress: Math.min(100, (metrics.averageRating / nextTierConfig.minRating) * 100)
          },
          revenue: {
            current: metrics.totalRevenue,
            required: nextTierConfig.minRevenue,
            progress: Math.min(100, (metrics.totalRevenue / nextTierConfig.minRevenue) * 100)
          }
        },
        overallProgress: Math.min(100, (
          Math.min(100, (metrics.totalBookings / nextTierConfig.minBookings) * 100) +
          Math.min(100, (metrics.averageRating / nextTierConfig.minRating) * 100) +
          Math.min(100, (metrics.totalRevenue / nextTierConfig.minRevenue) * 100)
        ) / 3)
      };
    }

    return c.json({
      success: true,
      vendorId,
      currentTier,
      eligibleTier,
      upgradeAvailable: eligibleTier !== currentTier,
      metrics,
      progressToNextTier,
      tierConfig: TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG]
    });

  } catch (error) {
    console.error('❌ Error fetching tier metrics:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /tier/audit/:vendorId
 * Get tier change audit trail for a vendor
 */
app.get('/tier/audit/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');

    const auditTrail = await kv.get(`tier:audit:${vendorId}`) || [];

    return c.json({
      success: true,
      vendorId,
      auditTrail,
      count: auditTrail.length
    });

  } catch (error) {
    console.error('❌ Error fetching tier audit:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /tier/schedule-automation
 * Schedule automatic tier evaluation (should be called by cron/scheduler)
 */
app.post('/tier/schedule-automation', async (c) => {
  try {
    console.log('⏰ [TIER-AUTOMATION] Running scheduled tier evaluation');

    // Run evaluation for all vendors
    const response = await fetch(`${c.req.url.replace('/tier/schedule-automation', '/tier/evaluate-all')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: false })
    });

    const result = await response.json();

    // Store automation run log
    const automationLog = {
      id: generateId('tier_auto'),
      timestamp: new Date().toISOString(),
      results: result.results,
      status: 'completed'
    };

    const automationHistory = await kv.get('tier:automation:history') || [];
    automationHistory.unshift(automationLog);
    // Keep last 30 runs
    if (automationHistory.length > 30) {
      automationHistory.splice(30);
    }
    await kv.set('tier:automation:history', automationHistory);

    console.log('✅ [TIER-AUTOMATION] Scheduled evaluation completed');

    return c.json({
      success: true,
      message: 'Tier automation completed',
      ...result
    });

  } catch (error) {
    console.error('❌ Error in tier automation:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /tier/config
 * Get tier configuration
 */
app.get('/tier/config', async (c) => {
  return c.json({
    success: true,
    tiers: TIER_CONFIG
  });
});

export default app;
