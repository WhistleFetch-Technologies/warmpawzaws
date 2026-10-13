import type { Context, MiddlewareHandler, Next } from 'hono';
import { isWarmpawzInsuranceAdminEnabled, isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';

function disabled(c: Context): Response {
  return c.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } },
    404,
  );
}

export function requireWarmpawzInsuranceAdminEnabled(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    if (!isWarmpawzInsuranceAdminEnabled()) return disabled(c);
    await next();
  };
}

export function requireWarmpawzInsuranceEnabled(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    if (!isWarmpawzInsuranceEnabled()) return disabled(c);
    await next();
  };
}
