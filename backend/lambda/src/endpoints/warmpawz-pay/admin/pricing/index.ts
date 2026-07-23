import type { Hono } from 'hono';
import {
  registerPricingAdminRoutes,
  type PricingAdminRouteDeps,
} from './routes/pricing-admin.routes';
import { WarmpawzPayPricingService } from './services/warmpawz-pay-pricing.service';

export type { PricingAdminRouteDeps };

export interface RegisterWarmpawzPayPricingAdminRoutesOptions {
  readonly deps?: PricingAdminRouteDeps;
}

function createDefaultPricingAdminDeps(): PricingAdminRouteDeps {
  return {
    pricingService: new WarmpawzPayPricingService(),
  };
}

export function registerWarmpawzPayPricingAdminRoutes(
  app: Hono,
  options: RegisterWarmpawzPayPricingAdminRoutesOptions = {},
): void {
  registerPricingAdminRoutes(app, options.deps ?? createDefaultPricingAdminDeps());
}
