import type { Context } from 'hono';
import * as put_admin_delivery_fee_policyRepo from '../repos/put-admin-delivery-fee-policy.repo';
import { validateCustomerDeliveryFeePolicy } from '../../../../utils/customer-delivery-fee-policy';

const DESCRIPTION =
  'Customer-facing delivery fee matrix (zones by distance + order value), surges, and policy copy';

export async function executeputAdminDeliveryFeePolicy(c: Context) {
  try {
    const body = await c.req.json();
    const raw = body?.policy !== undefined ? body.policy : body;
    const parsed = validateCustomerDeliveryFeePolicy(raw);
    if (!parsed.ok) {
      return c.json({ success: false, error: parsed.error }, 400);
    }
    const jsonStr = JSON.stringify(parsed.policy);
    const existing = await put_admin_delivery_fee_policyRepo.dbPutAdminDeliveryFeePolicy0(POLICY_KEY);
    if (existing.rows.length > 0) {
      await put_admin_delivery_fee_policyRepo.dbPutAdminDeliveryFeePolicy1(jsonStr, jsonb);
    } else {
      await put_admin_delivery_fee_policyRepo.dbPutAdminDeliveryFeePolicy2(jsonStr, DESCRIPTION, jsonb, setting_value, setting_type, description, is_public, created_at, $3);
    }
    return c.json({ success: true, policy: parsed.policy });
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Failed to save' }, 500);
  }
}
