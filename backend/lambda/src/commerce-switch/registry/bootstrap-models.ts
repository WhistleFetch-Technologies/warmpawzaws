import { getCommerceModelRegistry } from './commerce-model-registry';
import type { CommerceModelDescriptor } from '../contracts/commerce-model';

export const MARKETPLACE_MODEL_DESCRIPTOR: CommerceModelDescriptor = {
  id: 'marketplace',
  displayName: 'Warmpawz Marketplace',
  description: 'Current production service booking model with upfront payment.',
  status: 'active',
  introducedInVersion: '1.0',
  capabilities: ['service_booking', 'upfront_payment'],
};

export const WARMPAWZ_PAY_MODEL_DESCRIPTOR: CommerceModelDescriptor = {
  id: 'warmpawz_pay',
  displayName: 'Warmpawz Pay',
  description: 'Two-phase service booking model (experimental; adapter not enabled by default).',
  status: 'experimental',
  introducedInVersion: '1.0',
  capabilities: ['service_booking', 'slot_fee', 'final_balance'],
};

export function bootstrapCommerceModels(): void {
  const registry = getCommerceModelRegistry();
  registry.register(MARKETPLACE_MODEL_DESCRIPTOR);
  registry.register(WARMPAWZ_PAY_MODEL_DESCRIPTOR);
}
