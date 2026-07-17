import type { Context } from 'hono';
import {
  calculateCustomerDeliveryFee,
  fetchCustomerDeliveryFeePolicy,
} from '../../../../utils/customer-delivery-fee-policy';

export async function executecalculateDeliveryFee(c: Context) {
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
      typeof body.rain === 'boolean' ? body.rain : !!policy.runtimeSignals?.rainActive;
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
}
