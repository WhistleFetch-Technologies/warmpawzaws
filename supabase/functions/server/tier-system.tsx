import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

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

export function tierSystemEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * GET /vendor/:vendorId/tier
   * Get current tier status
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/tier`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const tierData = await kv.get(`vendor_tier_${vendorId}`) || {
        currentTier: 'SILVER',
        totalGMV: 0,
        lastUpdated: new Date().toISOString()
      };

      const config = TIER_CONFIG[tierData.currentTier as keyof typeof TIER_CONFIG];

      return sendSuccess(c, {
        ...tierData,
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
      
      // Fetch Vendor Stats (Mocked or from real analytics)
      // In real scenario, query `analytics_vendor_monthly_${vendorId}`
      const stats = await kv.get(`vendor_stats_${vendorId}`) || { monthlyGMV: 0 };
      
      let newTier = 'SILVER';
      if (stats.monthlyGMV >= TIER_CONFIG.PLATINUM.minGMV) {
        newTier = 'PLATINUM';
      } else if (stats.monthlyGMV >= TIER_CONFIG.GOLD.minGMV) {
        newTier = 'GOLD';
      }

      const tierData = {
        currentTier: newTier,
        totalGMV: stats.monthlyGMV,
        lastUpdated: new Date().toISOString()
      };

      await kv.set(`vendor_tier_${vendorId}`, tierData);
      
      // Update Vendor Profile with commission rate for quick lookup
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (vendor) {
        vendor.commissionRate = TIER_CONFIG[newTier as keyof typeof TIER_CONFIG].commissionRate;
        vendor.tier = newTier;
        await kv.set(`vendor:${vendorId}`, vendor);
      }

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
      
      const { tiers } = await c.req.json();
      await kv.set('tier_system_config', tiers);
      
      return sendSuccess(c, { message: 'Tier configuration updated' });
  });
}
