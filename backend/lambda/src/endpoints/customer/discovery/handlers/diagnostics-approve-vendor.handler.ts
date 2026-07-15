import type { Context } from 'hono';
import { executediagnosticsApproveVendor } from '../services/diagnostics-approve-vendor.service';

/** HTTP adapter — delegates to service layer. */
export async function diagnosticsApproveVendorHandler(c: Context) {
  return executediagnosticsApproveVendor(c);
}
