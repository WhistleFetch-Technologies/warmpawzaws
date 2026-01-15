/**
 * ============================================================================
 * TIER SYSTEM ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor tier management:
 * - Get vendor tier
 * - Upgrade/downgrade tier
 * - Tier-based commission calculation
 * - Tier eligibility checking
 * 
 * Migrated from: supabase/functions/server/tier-system.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

const TIER_CONFIG = {
  Bronze: { commission: 15.0, minBookings: 0, minRevenue: 0 },
  Silver: { commission: 12.0, minBookings: 50, minRevenue: 50000 },
  Gold: { commission: 10.0, minBookings: 200, minRevenue: 200000 },
  Platinum: { commission: 8.0, minBookings: 500, minRevenue: 500000 },
};

export function registerTierSystemEndpoints(app: Hono) {
  /**
   * GET /vendor/:vendorId/tier
   * Get vendor tier information
   */
  app.get("/vendor/:vendorId/tier", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      const currentTier = vendor.tier || 'Bronze';

      // Get vendor stats
      const bookings = await query(
        `SELECT COUNT(*) as count, SUM(total_amount) as revenue 
         FROM bookings 
         WHERE vendor_id = $1 AND status = 'completed'`,
        [vendorId]
      ).catch(() => ({ rows: [{ count: '0', revenue: '0' }] }));

      const totalBookings = parseInt(bookings.rows[0]?.count || '0', 10);
      const totalRevenue = parseFloat(bookings.rows[0]?.revenue || '0');

      // Check eligibility for next tier
      const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
      const currentTierIndex = tiers.indexOf(currentTier);
      const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;

      let nextTierEligible = false;
      let nextTierProgress = { bookings: 0, revenue: 0 };

      if (nextTier) {
        const nextTierConfig = TIER_CONFIG[nextTier as keyof typeof TIER_CONFIG];
        nextTierEligible = totalBookings >= nextTierConfig.minBookings && totalRevenue >= nextTierConfig.minRevenue;
        nextTierProgress = {
          bookings: Math.min(100, (totalBookings / nextTierConfig.minBookings) * 100),
          revenue: Math.min(100, (totalRevenue / nextTierConfig.minRevenue) * 100),
        };
      }

      return c.json({
        success: true,
        tier: {
          current: currentTier,
          commission: TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG].commission,
          stats: {
            totalBookings,
            totalRevenue,
          },
          nextTier: nextTier ? {
            name: nextTier,
            eligible: nextTierEligible,
            requirements: TIER_CONFIG[nextTier as keyof typeof TIER_CONFIG],
            progress: nextTierProgress,
          } : null,
        },
      });
    } catch (error: any) {
      console.error('Error fetching vendor tier:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/tier/upgrade
   * Upgrade vendor tier (admin only)
   */
  app.post("/vendor/:vendorId/tier/upgrade", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { newTier, adminId } = await c.req.json();

      if (!newTier || !['Bronze', 'Silver', 'Gold', 'Platinum'].includes(newTier)) {
        return c.json({ error: 'Invalid tier. Must be Bronze, Silver, Gold, or Platinum' }, 400);
      }

      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      const oldTier = vendor.tier || 'Bronze';

      // Update tier
      const updated = await update('vendors',
        { id: vendorId },
        {
          tier: newTier,
          commission_percentage: TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].commission,
          metadata: {
            ...(vendor.metadata || {}),
            tierHistory: [
              ...((vendor.metadata as any)?.tierHistory || []),
              {
                from: oldTier,
                to: newTier,
                upgradedAt: new Date().toISOString(),
                upgradedBy: adminId,
              },
            ],
          },
        }
      );

      return c.json({
        success: true,
        vendor: updated[0],
        message: `Vendor tier upgraded from ${oldTier} to ${newTier}`,
      });
    } catch (error: any) {
      console.error('Error upgrading vendor tier:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/tiers/config
   * Get tier configuration
   */
  app.get("/admin/tiers/config", async (c) => {
    return c.json({
      success: true,
      tiers: TIER_CONFIG,
    });
  });

  /**
   * POST /admin/tiers/calculate-commissions
   * Calculate commissions for all vendors based on their tiers
   */
  app.post("/admin/tiers/calculate-commissions", async (c) => {
    try {
      const vendors = await select('vendors', { is_active: true });

      const results = vendors.map((vendor: any) => {
        const tier = vendor.tier || 'Bronze';
        const commission = TIER_CONFIG[tier as keyof typeof TIER_CONFIG].commission;

        return {
          vendorId: vendor.id,
          businessName: vendor.business_name,
          currentTier: tier,
          commissionPercentage: commission,
        };
      });

      return c.json({
        success: true,
        vendors: results,
        total: results.length,
      });
    } catch (error: any) {
      console.error('Error calculating commissions:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

