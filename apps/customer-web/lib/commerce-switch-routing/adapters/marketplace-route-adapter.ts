import type { CommerceRouteAdapter } from '../types';

/** Marketplace adapter — always available; maps to existing production booking flows. */
export const marketplaceRouteAdapter: CommerceRouteAdapter = {
  modelId: 'marketplace',
  isAvailable(): boolean {
    return true;
  },
};
