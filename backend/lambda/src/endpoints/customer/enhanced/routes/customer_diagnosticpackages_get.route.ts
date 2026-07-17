import type { Hono } from 'hono';
import { customerDiagnosticpackagesGetHandler } from '../handlers/customer_diagnosticpackages_get.handler';

export function registerCustomerDiagnosticpackagesGetRoute(app: Hono) {
  app.get('/customer/diagnostic-packages', customerDiagnosticpackagesGetHandler);
}
