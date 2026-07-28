import type { CommerceRouteAdapter } from '../types';
import { isWarmpawzPay } from '@/lib/commerce-switch-client';
import { isWarmpawzPayFeatureEnabled } from '../warmpawz-pay-feature';

/**
 * Warmpawz Pay + Appointments routing adapter — capability probe only.
 * When commerce switch is warmpawz_pay and Pay customer APIs are deployed,
 * callers route to Pay tab and Book Appointment discovery (not legacy marketplace).
 */
export const warmpawzPayRouteAdapter: CommerceRouteAdapter = {
  modelId: 'warmpawz_pay',
  isAvailable(): boolean {
    return isWarmpawzPay() && isWarmpawzPayFeatureEnabled();
  },
};
