import type { Context } from 'hono';
import {
  DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY,
  fetchCustomerDeliveryFeePolicy,
} from '../../../../utils/customer-delivery-fee-policy';

export async function executegetDeliveryFeePolicy(c: Context) {
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
}
