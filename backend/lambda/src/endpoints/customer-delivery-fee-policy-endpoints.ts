/**
 * Customer delivery fee policy — public read + calculate; admin GET/PUT.
 */
import { Hono } from 'hono';
import { query } from '../database/rds-connection';
import {
  calculateCustomerDeliveryFee,
  DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY,
  fetchCustomerDeliveryFeePolicy,
  validateCustomerDeliveryFeePolicy,
} from '../utils/customer-delivery-fee-policy';

const POLICY_KEY = 'customer:delivery:fee_policy';

export function registerCustomerDeliveryFeePolicyEndpoints(app: Hono) {
  /**
   * GET /customer/delivery-fee-policy
   * Public: full policy for checkout copy + tables (is_public in platform_settings).
   */
  app.get('/customer/delivery-fee-policy', async (c) => {
    try {
      const policy = await fetchCustomerDeliveryFeePolicy();
      return c.json({
        success: true,
        policy,
        defaults: DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY,
      });
    } catch (e: any) {
      return c.json({ success: false, error: e?.message || 'Failed to load policy' }, 500);
    }
  });

  /**
   * POST /customer/delivery-fee/calculate
   * Public: quote customer delivery from policy (order subtotal + distance; optional surge flags).
   * Body: { orderSubtotalInr, distanceKm, weekend?, festival?, rain? }
   */
  app.post('/customer/delivery-fee/calculate', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const orderSubtotalInr = parseFloat(String(body.orderSubtotalInr ?? body.subtotal ?? '0'));
      const distanceKm = parseFloat(String(body.distanceKm ?? body.distance_km ?? '0'));
      if (!Number.isFinite(orderSubtotalInr) || !Number.isFinite(distanceKm)) {
        return c.json(
          { success: false, error: 'orderSubtotalInr and distanceKm must be numbers' },
          400
        );
      }
      const policy = await fetchCustomerDeliveryFeePolicy();
      const weekend =
        typeof body.weekend === 'boolean'
          ? body.weekend
          : (() => {
              const weekday = new Intl.DateTimeFormat('en-US', {
                weekday: 'short',
                timeZone: 'Asia/Kolkata',
              }).format(new Date());
              return weekday === 'Sat' || weekday === 'Sun';
            })();
      const festival =
        typeof body.festival === 'boolean'
          ? body.festival
          : !!policy.runtimeSignals?.festivalActive;
      const rain =
        typeof body.rain === 'boolean'
          ? body.rain
          : !!policy.runtimeSignals?.rainActive;
      const result = calculateCustomerDeliveryFee({
        policy,
        orderSubtotalInr,
        distanceKm,
        weekend,
        festival,
        rain,
      });
      return c.json({
        success: true,
        calculation: result,
      });
    } catch (e: any) {
      return c.json({ success: false, error: e?.message || 'Calculation failed' }, 500);
    }
  });

  /**
   * GET /admin/delivery-fee-policy
   */
  app.get('/admin/delivery-fee-policy', async (c) => {
    try {
      const r = await query(
        `SELECT setting_value, updated_at FROM platform_settings WHERE setting_key = $1 LIMIT 1`,
        [POLICY_KEY]
      );
      if (r.rows.length === 0) {
        return c.json({
          success: true,
          policy: DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY,
          stored: false,
        });
      }
      const row = r.rows[0] as { setting_value: unknown; updated_at?: string };
      const parsed = validateCustomerDeliveryFeePolicy(row.setting_value);
      return c.json({
        success: true,
        policy: parsed.ok ? parsed.policy : DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY,
        validationWarning: parsed.ok ? undefined : parsed.error,
        stored: true,
        updatedAt: row.updated_at,
      });
    } catch (e: any) {
      return c.json({ success: false, error: e?.message || 'Failed to load' }, 500);
    }
  });

  /**
   * PUT /admin/delivery-fee-policy
   * Full replace of policy JSON (validated).
   */
  app.put('/admin/delivery-fee-policy', async (c) => {
    try {
      const body = await c.req.json();
      const raw = body?.policy !== undefined ? body.policy : body;
      const parsed = validateCustomerDeliveryFeePolicy(raw);
      if (!parsed.ok) {
        return c.json({ success: false, error: parsed.error }, 400);
      }
      const jsonStr = JSON.stringify(parsed.policy);
      const existing = await query(
        `SELECT id FROM platform_settings WHERE setting_key = $1 LIMIT 1`,
        [POLICY_KEY]
      );
      if (existing.rows.length > 0) {
        await query(
          `UPDATE platform_settings SET setting_value = $1::jsonb, updated_at = NOW() WHERE setting_key = $2`,
          [jsonStr, POLICY_KEY]
        );
      } else {
        await query(
          `INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, is_public, created_at, updated_at)
           VALUES ($1, $2::jsonb, 'object', $3, true, NOW(), NOW())`,
          [
            POLICY_KEY,
            jsonStr,
            'Customer-facing delivery fee matrix (zones by distance + order value), surges, and policy copy',
          ]
        );
      }
      return c.json({ success: true, policy: parsed.policy });
    } catch (e: any) {
      return c.json({ success: false, error: e?.message || 'Failed to save' }, 500);
    }
  });
}
