import type { Context } from 'hono';
import { query } from '../../../../database/rds-connection';
import {
  DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY,
  validateCustomerDeliveryFeePolicy,
} from '../../../../utils/customer-delivery-fee-policy';
import { POLICY_KEY } from '../constants';

export async function getAdminDeliveryFeePolicyHandler(c: Context) {
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
}
