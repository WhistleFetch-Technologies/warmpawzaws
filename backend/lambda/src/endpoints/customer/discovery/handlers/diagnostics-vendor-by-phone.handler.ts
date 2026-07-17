import type { Context } from 'hono';
import { executediagnosticsVendorByPhone } from '../services/diagnostics-vendor-by-phone.service';

/** HTTP adapter — delegates to service layer. */
export async function diagnosticsVendorByPhoneHandler(c: Context) {
  return executediagnosticsVendorByPhone(c);
}
