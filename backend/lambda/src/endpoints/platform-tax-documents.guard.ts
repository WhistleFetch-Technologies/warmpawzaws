import type { Context } from 'hono';
import { extractAndVerifyAuthToken } from '../utils/jwt-verification';
import { resolveVendorId } from '../utils/vendor-resolve';
import { isPlatformTaxDocumentsEnabled } from '../lib/platform-tax/platform-tax-feature-flag';

export function platformTaxFeatureDisabledResponse(c: Context) {
  return c.json(
    {
      success: false,
      error: 'Platform tax documents are disabled',
      code: 'PLATFORM_TAX_DISABLED',
    },
    503
  );
}

export async function requireAdminPlatformTaxAccess(c: Context): Promise<{ ok: true } | { ok: false; response: Response }> {
  const authHeader = c.req.header('Authorization') || c.req.header('authorization') || '';
  const result = await extractAndVerifyAuthToken({ authorization: authHeader });
  if (!result.valid) {
    return { ok: false, response: c.json({ success: false, error: 'Authentication required' }, 401) };
  }
  const role = String(result.payload?.['custom:user_type'] || '').toLowerCase();
  if (!role.includes('admin')) {
    return { ok: false, response: c.json({ success: false, error: 'Admin access required' }, 403) };
  }
  return { ok: true };
}

export async function requireVendorPlatformTaxAccess(
  c: Context,
  paramVendorId: string
): Promise<{ ok: true; vendorId: string } | { ok: false; response: Response }> {
  const authHeader = c.req.header('Authorization') || c.req.header('authorization') || '';
  const result = await extractAndVerifyAuthToken({ authorization: authHeader });
  if (!result.valid || !result.payload?.sub) {
    return { ok: false, response: c.json({ success: false, error: 'Authentication required' }, 401) };
  }

  const resolvedParam = await resolveVendorId(paramVendorId);
  const resolvedUser = await resolveVendorId(result.payload.sub);
  const role = String(result.payload['custom:user_type'] || '').toLowerCase();

  if (role.includes('admin')) {
    return { ok: true, vendorId: resolvedParam || paramVendorId };
  }

  if (resolvedParam && resolvedUser && String(resolvedParam) === String(resolvedUser)) {
    return { ok: true, vendorId: resolvedParam };
  }

  if (String(result.payload.sub) === paramVendorId) {
    return { ok: true, vendorId: paramVendorId };
  }

  return { ok: false, response: c.json({ success: false, error: 'Not authorized for this vendor' }, 403) };
}

export function assertPlatformTaxFeatureEnabledForMutation(): void {
  if (!isPlatformTaxDocumentsEnabled()) {
    const err = new Error('Platform tax documents are disabled');
    (err as Error & { code?: string }).code = 'PLATFORM_TAX_DISABLED';
    throw err;
  }
}

export function mapPlatformTaxErrorToHttp(error: unknown): { status: number; body: Record<string, unknown> } {
  const message = error instanceof Error ? error.message : 'Platform tax error';
  const code = (error as { code?: string })?.code;
  if (code === 'PLATFORM_TAX_DISABLED') {
    return { status: 503, body: { success: false, error: message, code } };
  }
  if (message.includes('not found')) {
    return { status: 404, body: { success: false, error: message, code: 'NOT_FOUND' } };
  }
  if (message.includes('already issued')) {
    return { status: 409, body: { success: false, error: message, code: 'DUPLICATE' } };
  }
  return { status: 400, body: { success: false, error: message } };
}
