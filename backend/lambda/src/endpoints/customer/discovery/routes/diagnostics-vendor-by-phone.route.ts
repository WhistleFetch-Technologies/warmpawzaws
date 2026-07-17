import type { Hono } from 'hono';
import { diagnosticsVendorByPhoneHandler } from '../handlers/diagnostics-vendor-by-phone.handler';

export function registerDiagnosticsVendorByPhoneRoute(app: Hono) {
  app.get("/customer/diagnostics/vendor-by-phone", diagnosticsVendorByPhoneHandler);
}
