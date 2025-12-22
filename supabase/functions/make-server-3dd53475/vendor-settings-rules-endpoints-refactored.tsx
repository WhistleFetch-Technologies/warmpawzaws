/**
 * ============================================================================
 * VENDOR SETTINGS RULES ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Vendor settings rules endpoints for payment rules, refund tiers, and schedule settings
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - All settings stored in platform_settings table
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getDbClient } from "../../lib/db.ts";

export function registerVendorSettingsRulesEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const db = getDbClient();

  // ============================================
  // PAYMENT & REFUND RULES
  // ============================================

  /**
   * GET /admin/vendor-settings-rules
   * Get all payment rules and refund tiers
   */
  app.get(`${BASE_PATH}/admin/vendor-settings-rules`, async (c) => {
    try {
      // ✅ SQL: Get payment rules from platform_settings
      const { data: paymentRulesData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:payment_rules')
        .maybeSingle();
      
      // ✅ SQL: Get refund tiers from platform_settings
      const { data: refundTiersData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:refund_tiers')
        .maybeSingle();

      const paymentRules = paymentRulesData?.setting_value || [];
      const refundTiers = refundTiersData?.setting_value || [];

      return c.json({
        success: true,
        paymentRules,
        refundTiers
      });
    } catch (error) {
      console.error('Error fetching vendor settings rules:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /admin/vendor-settings/payment-rules
   * Create a new payment rule
   */
  app.post(`${BASE_PATH}/admin/vendor-settings/payment-rules`, async (c) => {
    try {
      const rule = await c.req.json();
      
      if (!rule.id) {
        rule.id = `rule_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }
      rule.createdAt = rule.createdAt || new Date().toISOString();

      // ✅ SQL: Get existing payment rules
      const { data: existingData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:payment_rules')
        .maybeSingle();
      
      const rules = existingData?.setting_value || [];
      rules.push(rule);
      
      // ✅ SQL: Save updated rules
      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'admin:settings:payment_rules',
          setting_value: rules,
          setting_type: 'array',
          updated_at: new Date().toISOString(),
        });

      return c.json({ success: true, rule });
    } catch (error) {
      console.error('Error creating payment rule:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * PUT /admin/vendor-settings/payment-rules/:id
   * Update a payment rule
   */
  app.put(`${BASE_PATH}/admin/vendor-settings/payment-rules/:id`, async (c) => {
    try {
      const { id } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Get existing payment rules
      const { data: existingData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:payment_rules')
        .maybeSingle();
      
      const rules = existingData?.setting_value || [];
      const index = rules.findIndex((r: any) => r.id === id);

      if (index === -1) {
        return c.json({ error: 'Rule not found' }, 404);
      }

      rules[index] = { ...rules[index], ...updates };
      
      // ✅ SQL: Save updated rules
      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'admin:settings:payment_rules',
          setting_value: rules,
          setting_type: 'array',
          updated_at: new Date().toISOString(),
        });

      return c.json({ success: true, rule: rules[index] });
    } catch (error) {
      console.error('Error updating payment rule:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * DELETE /admin/vendor-settings/payment-rules/:id
   * Delete a payment rule
   */
  app.delete(`${BASE_PATH}/admin/vendor-settings/payment-rules/:id`, async (c) => {
    try {
      const { id } = c.req.param();

      // ✅ SQL: Get existing payment rules
      const { data: existingData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:payment_rules')
        .maybeSingle();
      
      const rules = existingData?.setting_value || [];
      const newRules = rules.filter((r: any) => r.id !== id);
      
      // ✅ SQL: Save updated rules
      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'admin:settings:payment_rules',
          setting_value: newRules,
          setting_type: 'array',
          updated_at: new Date().toISOString(),
        });

      return c.json({ success: true });
    } catch (error) {
      console.error('Error deleting payment rule:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /admin/vendor-settings/refund-tiers
   * Create a new refund tier
   */
  app.post(`${BASE_PATH}/admin/vendor-settings/refund-tiers`, async (c) => {
    try {
      const tier = await c.req.json();
      
      if (!tier.id) {
        tier.id = `tier_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }
      tier.createdAt = tier.createdAt || new Date().toISOString();

      // ✅ SQL: Get existing refund tiers
      const { data: existingData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:refund_tiers')
        .maybeSingle();
      
      const tiers = existingData?.setting_value || [];
      tiers.push(tier);
      
      // ✅ SQL: Save updated tiers
      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'admin:settings:refund_tiers',
          setting_value: tiers,
          setting_type: 'array',
          updated_at: new Date().toISOString(),
        });

      return c.json({ success: true, tier });
    } catch (error) {
      console.error('Error creating refund tier:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * PUT /admin/vendor-settings/refund-tiers/:id
   * Update a refund tier
   */
  app.put(`${BASE_PATH}/admin/vendor-settings/refund-tiers/:id`, async (c) => {
    try {
      const { id } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Get existing refund tiers
      const { data: existingData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:refund_tiers')
        .maybeSingle();
      
      const tiers = existingData?.setting_value || [];
      const index = tiers.findIndex((t: any) => t.id === id);

      if (index === -1) {
        return c.json({ error: 'Tier not found' }, 404);
      }

      tiers[index] = { ...tiers[index], ...updates };
      
      // ✅ SQL: Save updated tiers
      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'admin:settings:refund_tiers',
          setting_value: tiers,
          setting_type: 'array',
          updated_at: new Date().toISOString(),
        });

      return c.json({ success: true, tier: tiers[index] });
    } catch (error) {
      console.error('Error updating refund tier:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * DELETE /admin/vendor-settings/refund-tiers/:id
   * Delete a refund tier
   */
  app.delete(`${BASE_PATH}/admin/vendor-settings/refund-tiers/:id`, async (c) => {
    try {
      const { id } = c.req.param();

      // ✅ SQL: Get existing refund tiers
      const { data: existingData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:refund_tiers')
        .maybeSingle();
      
      const tiers = existingData?.setting_value || [];
      const newTiers = tiers.filter((t: any) => t.id !== id);
      
      // ✅ SQL: Save updated tiers
      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'admin:settings:refund_tiers',
          setting_value: newTiers,
          setting_type: 'array',
          updated_at: new Date().toISOString(),
        });

      return c.json({ success: true });
    } catch (error) {
      console.error('Error deleting refund tier:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // SCHEDULE SETTINGS
  // ============================================

  /**
   * GET /admin/schedule-settings
   * Get global schedule settings
   */
  app.get(`${BASE_PATH}/admin/schedule-settings`, async (c) => {
    try {
      // ✅ SQL: Get schedule settings from platform_settings
      const { data: settingsData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:schedule')
        .maybeSingle();
      
      const settings = settingsData?.setting_value || {
        bufferTime: {
          at_center: 30,
          at_home: 120,
          tele: 15,
          instant_video: 5
        },
        vendorBufferTime: {},
        maxDaysAhead: 30,
        minSlotDuration: 30,
        slotInterval: 30,
        travelTimeBetweenLocations: 30
      };

      return c.json({
        success: true,
        settings
      });
    } catch (error) {
      console.error('Error fetching schedule settings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /admin/schedule-settings
   * Save global schedule settings
   */
  app.post(`${BASE_PATH}/admin/schedule-settings`, async (c) => {
    try {
      const settings = await c.req.json();
      
      // ✅ SQL: Save schedule settings in platform_settings
      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'admin:settings:schedule',
          setting_value: settings,
          setting_type: 'object',
          updated_at: new Date().toISOString(),
        });
      
      return c.json({ success: true, settings });
    } catch (error) {
      console.error('Error saving schedule settings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  console.log('✅ Vendor settings rules endpoints registered (SQL-only)');
}

