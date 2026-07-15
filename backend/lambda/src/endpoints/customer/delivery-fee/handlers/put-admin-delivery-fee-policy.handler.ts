import type { Context } from 'hono';
import { query } from '../../../../database/rds-connection';
import { validateCustomerDeliveryFeePolicy } from '../../../../utils/customer-delivery-fee-policy';
import { POLICY_KEY } from '../constants';

export async function putAdminDeliveryFeePolicyHandler(c: Context) {
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
}
