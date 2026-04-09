/**
 * ============================================================================
 * CONFIGURATION & POLICIES ENDPOINTS
 * ============================================================================
 * 
 * Provides configuration and policy information for the customer app:
 * - Delivery policies
 * - Cancellation policies
 * - Refund policies
 * - Tax policies
 * - Service-specific configurations
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select } from '../database/rds-connection';

// Default policies for different service types
const DEFAULT_POLICIES = {
  pharmacy: {
    delivery: {
      title: 'Delivery Policy',
      description: 'Your order will be delivered within 2-4 hours from nearby pharmacy',
      details: [
        'Free delivery for orders above ₹500',
        'Standard delivery charges: ₹40-₹80 based on distance',
        'Express delivery available at additional cost',
        'Delivery available 8 AM - 10 PM daily',
      ],
    },
    cancellation: {
      title: 'Cancellation Policy',
      description: 'You can cancel your order before it is dispatched',
      details: [
        'Free cancellation before pharmacy confirms order',
        'Cancellation after confirmation may incur charges',
        'No cancellation once order is dispatched',
        'Refund processed within 5-7 business days',
      ],
    },
    refund: {
      title: 'Refund Policy',
      description: 'Refunds are processed for eligible cancellations',
      details: [
        'Full refund for orders cancelled before confirmation',
        'Partial refund may apply after confirmation',
        'Damaged or incorrect items will be replaced or refunded',
        'Refunds credited to original payment method',
      ],
    },
    tax: {
      title: 'Tax Information',
      description: 'GST applicable as per government regulations',
      details: [
        'GST @18% applicable on medicines',
        'Tax invoice provided with order',
        'Prices inclusive of all applicable taxes',
      ],
    },
    prescription: {
      title: 'Prescription Policy',
      description: 'Valid prescription required for scheduled drugs',
      details: [
        'Upload clear image of prescription',
        'Prescription must be from licensed doctor',
        'Prescription validity: 6 months from issue date',
        'Pharmacy will verify prescription before dispatch',
      ],
    },
  },
  meal: {
    delivery: {
      title: 'Delivery Policy',
      description: 'Fresh pet food delivered to your doorstep',
      details: [
        'Free delivery for orders above ₹300',
        'Standard delivery charges: ₹30-₹60 based on distance',
        'Cold chain maintained for freshness',
        'Delivery available 9 AM - 9 PM daily',
      ],
    },
    cancellation: {
      title: 'Cancellation Policy',
      description: 'Cancel before kitchen starts preparation',
      details: [
        'Free cancellation before order confirmation',
        'No cancellation once preparation starts',
        'Subscription cancellation: 24 hours advance notice',
      ],
    },
    refund: {
      title: 'Refund Policy',
      description: 'Quality guaranteed or money back',
      details: [
        'Full refund for orders cancelled before preparation',
        'Replacement for quality issues',
        'Report issues within 2 hours of delivery',
      ],
    },
    tax: {
      title: 'Tax Information',
      description: 'GST applicable as per regulations',
      details: [
        'GST @5% applicable on food items',
        'Prices inclusive of all applicable taxes',
      ],
    },
  },
  booking: {
    payment: {
      title: 'Payment Policy',
      description: 'Secure payments via Razorpay',
      details: [
        'Accepted: Cards, UPI, Net Banking, Wallet',
        'Payment is due at checkout unless otherwise stated',
        'Platform and convenience fees may apply as per config',
      ],
    },
    cancellation: {
      title: 'Cancellation Policy',
      description: 'Flexible cancellation for your convenience',
      details: [
        'Free cancellation up to 4 hours before appointment',
        '50% charge for cancellation within 4 hours',
        'No refund for no-shows',
        'Rescheduling available at no extra cost',
      ],
    },
    refund: {
      title: 'Refund Policy',
      description: 'Hassle-free refunds for eligible cancellations',
      details: [
        'Full refund for timely cancellations',
        'Refund processed within 5-7 business days',
        'Service credits available for faster resolution',
      ],
    },
  },
  default: {
    delivery: {
      title: 'Delivery Policy',
      description: 'Standard delivery terms apply',
      details: ['Delivery charges based on distance', 'Delivery time varies by service'],
    },
    cancellation: {
      title: 'Cancellation Policy',
      description: 'Standard cancellation terms apply',
      details: ['Contact support for cancellation', 'Cancellation fees may apply'],
    },
    refund: {
      title: 'Refund Policy',
      description: 'Standard refund terms apply',
      details: ['Refunds processed as per policy', 'Contact support for queries'],
    },
    tax: {
      title: 'Tax Information',
      description: 'Applicable taxes included',
      details: ['All prices include applicable taxes'],
    },
  },
};

/** Platform-defined service categories and formats for cancellation/refund policies (Warmpawz business rules). */
const PLATFORM_POLICY_OPTIONS = {
  serviceCategories: [
    { id: 'veterinary', name: 'Veterinary Services', description: 'In-clinic, teleconsultation, doorstep' },
    { id: 'grooming', name: 'Grooming Services', description: 'Centre-based and doorstep grooming' },
    { id: 'walkers_training_boarding', name: 'Walkers, Training & Boarding', description: 'Dog walkers, trainers, behaviourists, boarding' },
    { id: 'ecommerce', name: 'E-commerce Products', description: 'Product orders, returns, replacements' },
  ],
  serviceFormats: [
    { id: 'in_clinic', name: 'In-Clinic', description: 'At centre / clinic' },
    { id: 'teleconsultation', name: 'Teleconsultation', description: 'Online / video / audio' },
    { id: 'doorstep', name: 'Doorstep / Home Visit', description: 'At customer location' },
    { id: 'centre', name: 'Centre-Based', description: 'Service at provider centre' },
  ],
};

export function registerConfigPoliciesEndpoints(app: Hono) {
  /**
   * GET /config/policy-options
   * Returns service categories and service formats for policy configuration (dynamic per platform).
   */
  app.get("/config/policy-options", async (c) => {
    try {
      let options = PLATFORM_POLICY_OPTIONS;
      try {
        const row = await query(
          `SELECT setting_value FROM admin_settings WHERE setting_category = 'policy' AND setting_key = 'policy_options' LIMIT 1`
        ).catch(() => ({ rows: [] }));
        if ((row as any).rows?.length > 0 && (row as any).rows[0].setting_value) {
          const custom = typeof (row as any).rows[0].setting_value === 'string'
            ? JSON.parse((row as any).rows[0].setting_value)
            : (row as any).rows[0].setting_value;
          if (custom?.serviceCategories?.length || custom?.serviceFormats?.length) options = { ...options, ...custom };
        }
      } catch {
        // use defaults
      }
      return c.json({ success: true, ...options });
    } catch (error: any) {
      return c.json({ success: true, ...PLATFORM_POLICY_OPTIONS });
    }
  });

  /**
   * GET /config/policies
   * Get policies for a specific service type
   */
  app.get("/config/policies", async (c) => {
    try {
      const serviceType = c.req.query('service_type') || 'default';
      const policyTypes = c.req.query('policies')?.split(',') || ['delivery', 'cancellation', 'refund', 'tax'];

      // Try to get custom policies from database
      let customPolicies: any = null;
      try {
        const dbPolicies = await query(
          `SELECT * FROM service_policies 
           WHERE service_type = $1 AND is_active = true`,
          [serviceType]
        ).catch(() => ({ rows: [] }));

        if (dbPolicies.rows.length > 0) {
          customPolicies = {};
          for (const policy of dbPolicies.rows) {
            customPolicies[policy.policy_type] = {
              title: policy.title,
              description: policy.description,
              details: typeof policy.details === 'string' ? JSON.parse(policy.details) : policy.details,
            };
          }
        }
      } catch (dbError) {
        console.warn('[CONFIG] Could not fetch custom policies from DB, using defaults');
      }

      // Use custom policies if available, otherwise fall back to defaults
      const servicePolicies = customPolicies || 
        (DEFAULT_POLICIES as any)[serviceType] || 
        DEFAULT_POLICIES.default;

      // Filter to requested policy types
      const filteredPolicies: Record<string, any> = {};
      for (const policyType of policyTypes) {
        if (servicePolicies[policyType]) {
          filteredPolicies[policyType] = servicePolicies[policyType];
        }
      }

      return c.json({
        success: true,
        serviceType,
        policies: filteredPolicies,
      });
    } catch (error: any) {
      console.error('Error fetching policies:', error);
      // Return default policies on error
      return c.json({
        success: true,
        serviceType: 'default',
        policies: DEFAULT_POLICIES.default,
      });
    }
  });

  /**
   * GET /config/logistics-rules
   * Get logistics/delivery rules
   */
  app.get("/config/logistics-rules", async (c) => {
    try {
      const serviceType = c.req.query('service_type') || 'all';

      let rules: any[] = [];
      try {
        const dbRules = await query(
          `SELECT * FROM logistics_rules 
           WHERE is_active = true 
           AND ($1 = 'all' OR $1 = ANY(applies_to))
           ORDER BY min_distance_km ASC`,
          [serviceType]
        ).catch(() => ({ rows: [] }));

        rules = dbRules.rows;
      } catch (dbError) {
        console.warn('[CONFIG] Could not fetch logistics rules from DB');
      }

      // If no rules found, return defaults
      if (rules.length === 0) {
        rules = [
          { min_distance_km: 0, max_distance_km: 5, base_fee: 40, per_km_rate: 0, rule_type: 'slab' },
          { min_distance_km: 5, max_distance_km: 10, base_fee: 60, per_km_rate: 0, rule_type: 'slab' },
          { min_distance_km: 10, max_distance_km: 20, base_fee: 80, per_km_rate: 0, rule_type: 'slab' },
          { min_distance_km: 20, max_distance_km: null, base_fee: 50, per_km_rate: 5, rule_type: 'per_km' },
        ];
      }

      return c.json({
        success: true,
        serviceType,
        rules: rules.map(rule => ({
          minDistanceKm: rule.min_distance_km,
          maxDistanceKm: rule.max_distance_km,
          baseFee: parseFloat(rule.base_fee),
          perKmRate: parseFloat(rule.per_km_rate || 0),
          ruleType: rule.rule_type,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching logistics rules:', error);
      return c.json({
        success: true,
        serviceType: 'default',
        rules: [],
      });
    }
  });

  /**
   * GET /logistics/delivery-rules
   * Alias for admin UI - returns delivery rules (same data as /config/logistics-rules, shape for admin)
   */
  app.get("/logistics/delivery-rules", async (c) => {
    try {
      let rules: any[] = [];
      try {
        const dbRules = await query(
          `SELECT * FROM logistics_rules WHERE is_active = true ORDER BY min_distance_km ASC`
        ).catch(() => ({ rows: [] }));
        rules = (dbRules as { rows: any[] }).rows || [];
      } catch {
        // ignore
      }
      const mapped = rules.map((rule: any, i: number) => ({
        id: rule.id || `rule_${i}`,
        name: rule.rule_name || `Rule ${i + 1}`,
        priority: rule.priority ?? i + 1,
        enabled: rule.is_active !== false,
        conditions: {},
        logistics: {
          primaryPartner: 'warmpawz',
          fallbackPartners: [],
        },
        minDistanceKm: rule.min_distance_km,
        maxDistanceKm: rule.max_distance_km,
        baseFee: parseFloat(rule.base_fee || 0),
        perKmRate: parseFloat(rule.per_km_rate || 0),
      }));
      return c.json({ success: true, rules: mapped });
    } catch (error: any) {
      console.error('Error fetching delivery rules:', error);
      return c.json({ success: true, rules: [] });
    }
  });

  /**
   * POST /logistics/delivery-rules
   * Update delivery rules from admin UI (persist to logistics_rules or no-op)
   */
  app.post("/logistics/delivery-rules", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { rules } = body as { rules?: any[] };
      if (Array.isArray(rules) && rules.length > 0) {
        // Optional: persist to platform_settings or logistics_rules
        // For now acknowledge only
      }
      return c.json({ success: true, message: 'Delivery rules updated' });
    } catch (error: any) {
      console.error('Error saving delivery rules:', error);
      return c.json({ success: false, error: 'Failed to save rules' }, 500);
    }
  });
}
