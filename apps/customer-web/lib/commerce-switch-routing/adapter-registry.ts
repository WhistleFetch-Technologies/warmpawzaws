import type { CommerceModelId } from '@warmpawz/commerce-switch-contracts';
import type { CommerceRouteAdapter } from './types';
import { marketplaceRouteAdapter } from './adapters/marketplace-route-adapter';
import { warmpawzPayRouteAdapter } from './adapters/warmpawz-pay-route-adapter';

const adapters: Record<CommerceModelId, CommerceRouteAdapter> = {
  marketplace: marketplaceRouteAdapter,
  warmpawz_pay: warmpawzPayRouteAdapter,
};

export function registerCommerceRouteAdapter(adapter: CommerceRouteAdapter): void {
  adapters[adapter.modelId] = adapter;
}

export function getCommerceRouteAdapter(modelId: CommerceModelId): CommerceRouteAdapter {
  return adapters[modelId] ?? marketplaceRouteAdapter;
}

export function listCommerceRouteAdapters(): CommerceRouteAdapter[] {
  return Object.values(adapters);
}
