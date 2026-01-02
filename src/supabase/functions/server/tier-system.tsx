// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { 
  getVendorsRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

/**
 * 🏆 TIER SYSTEM IMPLEMENTATION
 * 
 * Phase 7C: Rule 15 - Vendor Tiers & Commission Logic
 * 
 * Tiers:
 * 1. SILVER (Default): 15% Commission, Basic Listings
 * 2. GOLD: 10% Commission, Featured Listings, Priority Support
 * 3. PLATINUM: 5% Commission, Top Placement, Dedicated Manager
 * 
 * Features:
 * - Automated Tier Calculation based on GMV (Gross Merchandise Value)
 * - Commission Rate Lookup
 * - Manual/Auto Upgrades
 */

export const TIER_CONFIG = {
  SILVER: {
    id: 'silver',
    name: 'Silver',
    commissionRate: 15,
    minGMV: 0,
    benefits: ['Basic Listing', 'Standard Support']
  },
  GOLD: {
    id: 'gold',
    name: 'Gold',
    commissionRate: 10,
    minGMV: 50000, // 50k INR Monthly GMV
    benefits: ['Featured Listing', 'Priority Support', 'Lower Commission']
  },
  PLATINUM: {
    id: 'platinum',
    name: 'Platinum',
    commissionRate: 5,
    minGMV: 200000, // 2L INR Monthly GMV
    benefits: ['Top Placement', 'Dedicated Manager', 'Lowest Commission', 'Marketing Boost']
  }
};

export function tierSystemEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * GET /vendor/:vendorId/tier
   * Get current tier status
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/tier`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get vendor tier from vendor_tiers table
      const db = getDbClient();
      const { data: tierData } = await db
        .from('vendor_tiers')
        .select('current_tier, total_gmv, last_updated')
        .eq('vendor_id', vendorId)
        .single();
      
      const tierInfo = tierData || {
        current_tier: 'SILVER',
        total_gmv: 0,
        last_updated: new Date().toISOString()
      };

      const config = TIER_CONFIG[tierInfo.current_tier as keyof typeof TIER_CONFIG];

      return sendSuccess(c, {
        currentTier: tierInfo.current_tier,
        totalGMV: tierInfo.total_gmv,
        lastUpdated: tierInfo.last_updated,
        config
      });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/tier/calculate
   * Recalculate tier based on recent performance
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/tier/calculate`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Fetch Vendor Stats from vendor_daily_stats aggregated
      const db = getDbClient();
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const { data: statsData } = await db
        .from('vendor_daily_stats')
        .select('revenue')
        .eq('vendor_id', vendorId)
        .gte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
        .lte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`);
      
      const monthlyGMV = statsData?.reduce((sum: number, stat: any) => sum + (stat.revenue || 0), 0) || 0;
      
      let newTier = 'SILVER';
      if (monthlyGMV >= TIER_CONFIG.PLATINUM.minGMV) {
        newTier = 'PLATINUM';
      } else if (monthlyGMV >= TIER_CONFIG.GOLD.minGMV) {
        newTier = 'GOLD';
      }

      // ✅ SQL: Update vendor tier in vendor_tiers table
      await db
        .from('vendor_tiers')
        .upsert({
          vendor_id: vendorId,
          current_tier: newTier,
          total_gmv: monthlyGMV,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'vendor_id'
        });
      
      // ✅ SQL: Update Vendor Profile with commission rate for quick lookup
      const vendorsRepo = getVendorsRepository();
      await vendorsRepo.update(vendorId, {
        metadata: {
          ...(await vendorsRepo.findById(vendorId)).metadata,
          commissionRate: TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].commissionRate,
          tier: newTier
        }
      });

      return sendSuccess(c, {
        newTier,
        message: `Vendor tier updated to ${newTier}`
      });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/tier-system/config
   * Get global tier configuration
   */
  app.get(`${BASE_PATH}/admin/tier-system/config`, (c) => {
    return sendSuccess(c, TIER_CONFIG);
  });
  
  /**
   * POST /admin/tier-system/config
   * Update tier thresholds (Admin Only)
   */
  app.post(`${BASE_PATH}/admin/tier-system/config`, async (c) => {
      // In a real DB we would store this config. 
      // Since it's a const in this file, we can't update it dynamically without DB.
      // We will simulate updating a stored config in KV.
      
      // ✅ SQL: Store tier system config in platform_settings
      const { tiers } = await c.req.json();
      const db = getDbClient();
      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'tier_system_config',
          setting_value: tiers,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });
      
      return sendSuccess(c, { message: 'Tier configuration updated' });
  });
}
