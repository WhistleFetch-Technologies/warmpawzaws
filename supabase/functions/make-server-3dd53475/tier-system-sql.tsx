/**
 * ============================================================================
 * TIER SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Vendor tier management
 * - Commission rate lookup
 * - Tier calculation based on GMV
 * - Tier upgrades
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * Migration: Phase 6 - KV to SQL (Critical P0)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getDbClient } from "../../lib/db.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { sendSuccess, sendError } from "./response-utils.ts";

export function tierSystemEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * GET /vendor/:vendorId/tier
   * Get current tier status
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/tier`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const client = getDbClient();
      
      // Get vendor
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // Get current tier subscription
      const { data: subscription, error: subError } = await client
        .from('vendor_tier_subscriptions')
        .select('*, vendor_tiers(*)')
        .eq('vendor_id', vendorId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (subError && subError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch tier subscription: ${subError.message}`);
      }
      
      // Get default tier if no subscription
      let tier;
      if (subscription && subscription.vendor_tiers) {
        tier = subscription.vendor_tiers;
      } else {
        const { data: defaultTier, error: tierError } = await client
          .from('vendor_tiers')
          .select('*')
          .eq('is_default', true)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        
        if (tierError) {
          throw new Error(`Failed to fetch default tier: ${tierError.message}`);
        }
        
        tier = defaultTier || {
          tier_name: 'silver',
          display_name: 'Silver',
          commission_rate: 15,
          features: []
        };
      }
      
      // Calculate monthly GMV (simplified - in production, query from analytics)
      const { data: monthlyBookings } = await client
        .from('bookings')
        .select('total_amount')
        .eq('vendor_id', vendorId)
        .eq('status', 'completed')
        .gte('completed_at', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString());
      
      const monthlyGMV = monthlyBookings?.reduce((sum: number, b: any) => sum + parseFloat(b.total_amount || '0'), 0) || 0;
      
      return sendSuccess(c, {
        currentTier: tier.tier_name,
        displayName: tier.display_name,
        commissionRate: parseFloat(tier.commission_rate || '15'),
        monthlyGMV,
        features: tier.features || [],
        subscription: subscription ? {
          subscriptionType: subscription.subscription_type,
          startDate: subscription.start_date,
          endDate: subscription.end_date,
          status: subscription.status
        } : null
      });
    } catch (error) {
      console.error('Error getting vendor tier:', error);
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
      const client = getDbClient();
      
      // Calculate monthly GMV
      const { data: monthlyBookings } = await client
        .from('bookings')
        .select('total_amount')
        .eq('vendor_id', vendorId)
        .eq('status', 'completed')
        .gte('completed_at', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString());
      
      const monthlyGMV = monthlyBookings?.reduce((sum: number, b: any) => sum + parseFloat(b.total_amount || '0'), 0) || 0;
      
      // Find appropriate tier based on GMV
      const { data: tiers, error: tiersError } = await client
        .from('vendor_tiers')
        .select('*')
        .eq('is_active', true)
        .order('tier_level', { ascending: false });
      
      if (tiersError) {
        throw new Error(`Failed to fetch tiers: ${tiersError.message}`);
      }
      
      // Find tier that matches GMV (simplified logic - in production, use tier thresholds)
      let selectedTier = tiers?.find(t => t.tier_name === 'silver') || tiers?.[0];
      
      // Auto-upgrade logic (simplified)
      if (monthlyGMV >= 200000) {
        selectedTier = tiers?.find(t => t.tier_name === 'platinum') || selectedTier;
      } else if (monthlyGMV >= 50000) {
        selectedTier = tiers?.find(t => t.tier_name === 'gold') || selectedTier;
      }
      
      // Update vendor's current tier
      await client
        .from('vendors')
        .update({
          current_tier_id: selectedTier?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', vendorId);
      
      return sendSuccess(c, {
        newTier: selectedTier?.tier_name,
        displayName: selectedTier?.display_name,
        commissionRate: parseFloat(selectedTier?.commission_rate || '15'),
        monthlyGMV,
        message: `Vendor tier updated to ${selectedTier?.display_name}`
      });
    } catch (error) {
      console.error('Error calculating tier:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/tier-system/config
   * Get global tier configuration
   */
  app.get(`${BASE_PATH}/admin/tier-system/config`, async (c) => {
    try {
      const client = getDbClient();
      const { data: tiers, error } = await client
        .from('vendor_tiers')
        .select('*')
        .eq('is_active', true)
        .order('tier_level', { ascending: true });
      
      if (error) {
        throw new Error(`Failed to fetch tier config: ${error.message}`);
      }
      
      return sendSuccess(c, { tiers: tiers || [] });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
  
  /**
   * POST /admin/tier-system/config
   * Update tier thresholds (Admin Only)
   */
  app.post(`${BASE_PATH}/admin/tier-system/config`, async (c) => {
    try {
      const { tiers } = await c.req.json();
      const client = getDbClient();
      
      // Update each tier
      for (const tier of tiers) {
        await client
          .from('vendor_tiers')
          .upsert({
            tier_name: tier.tier_name,
            tier_level: tier.tier_level,
            display_name: tier.display_name,
            commission_rate: tier.commission_rate,
            features: tier.features || [],
            is_active: tier.is_active !== false,
            updated_at: new Date().toISOString()
          }, { onConflict: 'tier_name' });
      }
      
      return sendSuccess(c, { message: 'Tier configuration updated' });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}

