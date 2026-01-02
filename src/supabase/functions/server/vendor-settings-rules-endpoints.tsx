import { Hono } from "hono";
import * as kv from "./kv_store";

export function registerVendorSettingsRulesEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // ============================================
  // PAYMENT & REFUND RULES
  // ============================================

  /**
   * GET /admin/vendor-settings-rules
   * Get all payment rules and refund tiers
   */
  app.get(`${BASE_PATH}/admin/vendor-settings-rules`, async (c) => {
    try {
      const paymentRules = await kv.get('admin:settings:payment_rules') || [];
      const refundTiers = await kv.get('admin:settings:refund_tiers') || [];

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

      const rules = await kv.get('admin:settings:payment_rules') || [];
      rules.push(rule);
      await kv.set('admin:settings:payment_rules', rules);

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

      const rules = await kv.get('admin:settings:payment_rules') || [];
      const index = rules.findIndex((r: any) => r.id === id);

      if (index === -1) {
        return c.json({ error: 'Rule not found' }, 404);
      }

      rules[index] = { ...rules[index], ...updates };
      await kv.set('admin:settings:payment_rules', rules);

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

      const rules = await kv.get('admin:settings:payment_rules') || [];
      const newRules = rules.filter((r: any) => r.id !== id);
      await kv.set('admin:settings:payment_rules', newRules);

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

      const tiers = await kv.get('admin:settings:refund_tiers') || [];
      tiers.push(tier);
      await kv.set('admin:settings:refund_tiers', tiers);

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

      const tiers = await kv.get('admin:settings:refund_tiers') || [];
      const index = tiers.findIndex((t: any) => t.id === id);

      if (index === -1) {
        return c.json({ error: 'Tier not found' }, 404);
      }

      tiers[index] = { ...tiers[index], ...updates };
      await kv.set('admin:settings:refund_tiers', tiers);

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

      const tiers = await kv.get('admin:settings:refund_tiers') || [];
      const newTiers = tiers.filter((t: any) => t.id !== id);
      await kv.set('admin:settings:refund_tiers', newTiers);

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
      const settings = await kv.get('admin:settings:schedule') || {
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
      await kv.set('admin:settings:schedule', settings);
      return c.json({ success: true, settings });
    } catch (error) {
      console.error('Error saving schedule settings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}
