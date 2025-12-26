import { Hono } from "npm:hono@4";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient } from '../../lib/db.ts';

/**
 * 🏆 TIER SYSTEM IMPLEMENTATION - SQL VERSION
 * 
 * ✅ MIGRATED: Removed all KV usage, using SQL repositories only
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
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
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
   * ✅ SQL: Uses vendors table for tier lookup
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/tier`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vendorsRepo = getVendorsRepository();
      
      // ✅ SQL: Get vendor from SQL database
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // Get tier from vendor record (defaults to 'Bronze' if not set)
      const currentTier = (vendor.tier || 'Bronze').toUpperCase();
      const config = TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.SILVER;
      
      // ✅ SQL: Calculate monthly GMV from bookings (if analytics table exists)
      const dbClient = getDbClient();
      const { data: monthlyStats } = await dbClient
        .from('vendor_earnings')
        .select('amount')
        .eq('vendor_id', vendorId)
        .gte('created_at', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString());
      
      const monthlyGMV = (monthlyStats || []).reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
      
      const tierData = {
        currentTier: currentTier,
        totalGMV: monthlyGMV,
        lastUpdated: vendor.updated_at || vendor.created_at
      };

      return sendSuccess(c, {
        ...tierData,
        config
      });
    } catch (error) {
      console.error('Error getting vendor tier:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/tier/calculate
   * Recalculate tier based on recent performance
   * ✅ SQL: Uses vendors table and vendor_earnings for GMV calculation
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/tier/calculate`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vendorsRepo = getVendorsRepository();
      const dbClient = getDbClient();
      
      // ✅ SQL: Get vendor from SQL database
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // ✅ SQL: Calculate monthly GMV from vendor_earnings
      const { data: monthlyEarnings } = await dbClient
        .from('vendor_earnings')
        .select('amount')
        .eq('vendor_id', vendorId)
        .gte('created_at', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString());
      
      const monthlyGMV = (monthlyEarnings || []).reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
      
      // Determine new tier based on GMV
      let newTier = 'Silver';
      if (monthlyGMV >= TIER_CONFIG.PLATINUM.minGMV) {
        newTier = 'Platinum';
      } else if (monthlyGMV >= TIER_CONFIG.GOLD.minGMV) {
        newTier = 'Gold';
      }

      // ✅ SQL: Update vendor tier and commission rate
      await vendorsRepo.update(vendorId, {
        tier: newTier,
        commission_percentage: TIER_CONFIG[newTier.toUpperCase() as keyof typeof TIER_CONFIG].commissionRate
      });

      return sendSuccess(c, {
        newTier,
        monthlyGMV,
        commissionRate: TIER_CONFIG[newTier.toUpperCase() as keyof typeof TIER_CONFIG].commissionRate,
        message: `Vendor tier updated to ${newTier}`
      });
    } catch (error) {
      console.error('Error calculating vendor tier:', error);
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
   * ✅ SQL: Stores tier config in platform_settings table
   */
  app.post(`${BASE_PATH}/admin/tier-system/config`, async (c) => {
    try {
      const { tiers } = await c.req.json();
      const dbClient = getDbClient();
      
      // ✅ SQL: Store tier config in platform_settings
      await dbClient
        .from('platform_settings')
        .upsert({
          setting_key: 'tier_system_config',
          setting_value: tiers || TIER_CONFIG,
          setting_type: 'object',
          updated_at: new Date().toISOString(),
        });
      
      return sendSuccess(c, { message: 'Tier configuration updated' });
    } catch (error) {
      console.error('Error updating tier config:', error);
      return sendError(c, error, 500);
    }
  });
  
  console.log('✅ Tier system endpoints registered (SQL-only)');
}
