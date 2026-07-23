import type { Hono } from 'hono';
import {
  registerMerchantsAdminRoutes,
  type MerchantsAdminRouteDeps,
} from './routes/merchants-admin.routes';
import { WarmpawzPayMerchantsService } from './services/warmpawz-pay-merchants.service';

export type { MerchantsAdminRouteDeps };

export interface RegisterWarmpawzPayMerchantsAdminRoutesOptions {
  readonly deps?: MerchantsAdminRouteDeps;
}

function createDefaultMerchantsAdminDeps(): MerchantsAdminRouteDeps {
  return {
    merchantsService: new WarmpawzPayMerchantsService(),
  };
}

export function registerWarmpawzPayMerchantsAdminRoutes(
  app: Hono,
  options: RegisterWarmpawzPayMerchantsAdminRoutesOptions = {},
): void {
  registerMerchantsAdminRoutes(app, options.deps ?? createDefaultMerchantsAdminDeps());
}
