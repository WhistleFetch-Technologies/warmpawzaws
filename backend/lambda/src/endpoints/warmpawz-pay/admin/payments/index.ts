import type { Hono } from 'hono';
import {
  registerPaymentsAdminRoutes,
  type PaymentsAdminRouteDeps,
} from './routes/payments-admin.routes';
import { WarmpawzPayPaymentsService } from './services/warmpawz-pay-payments.service';

export type { PaymentsAdminRouteDeps };

function createDefaultPaymentsAdminDeps(): PaymentsAdminRouteDeps {
  return {
    paymentsService: new WarmpawzPayPaymentsService(),
  };
}

export function registerWarmpawzPayPaymentsAdminRoutes(
  app: Hono,
  deps: PaymentsAdminRouteDeps = createDefaultPaymentsAdminDeps(),
): void {
  registerPaymentsAdminRoutes(app, deps);
}
