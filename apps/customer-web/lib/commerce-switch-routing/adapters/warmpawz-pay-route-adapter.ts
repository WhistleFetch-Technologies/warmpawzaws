import type { CommerceRouteAdapter } from '../types';
import { isWarmpawzPayFeatureEnabled } from '../warmpawz-pay-feature';

/**
 * Warmpawz Pay routing adapter stub — capability probe only.
 * Does NOT import Warmpawz Pay modules or call payment APIs.
 * Future teams implement navigation when customer Pay APIs are live.
 */
export const warmpawzPayRouteAdapter: CommerceRouteAdapter = {
  modelId: 'warmpawz_pay',
  isAvailable(): boolean {
    return isWarmpawzPayFeatureEnabled();
  },
};
