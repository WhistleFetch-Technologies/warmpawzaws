import type { Hono } from 'hono';
import { diagnosticsApproveVendorHandler } from '../handlers/diagnostics-approve-vendor.handler';

export function registerDiagnosticsApproveVendorRoute(app: Hono) {
  app.post("/customer/diagnostics/approve-vendor", diagnosticsApproveVendorHandler);
}
