import type { Context } from 'hono';
import { executecustomerDiagnosticpackagesGet } from '../services/customer_diagnosticpackages_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerDiagnosticpackagesGetHandler(c: Context) {
  return executecustomerDiagnosticpackagesGet(c);
}
