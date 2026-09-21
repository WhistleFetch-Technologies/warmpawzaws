import { dbLoadServiceCategories, dbLoadVendorRole } from '../repos/promo-engine.repo';
import { resolvePaymentContext, type PaymentContext } from '../vcf';
import type { EvaluateRequest } from '../types';

const UUID_RE = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function uuidOrNull(raw: unknown): string | null {
  const s = String(raw || '').trim();
  return UUID_RE.test(s) ? s : null;
}

export async function loadServerPaymentContext(opts: {
  surface: 'paybill' | 'ecommerce' | 'booking';
  vendorId?: string | null;
  serviceStyle?: string | null;
  bookingCategoryId?: string | null;
}): Promise<PaymentContext> {
  const vendorId = opts.vendorId ? String(opts.vendorId) : null;
  const vendor = vendorId ? await dbLoadVendorRole(vendorId) : null;
  const catalogue = await dbLoadServiceCategories();
  return resolvePaymentContext({
    surface: opts.surface,
    serviceStyle: opts.serviceStyle,
    vendorId,
    roleId: vendor?.roleId,
    roleName: vendor?.roleName,
    bookingCategoryId: opts.bookingCategoryId,
    catalogue,
  });
}

function inferSurface(tx: Record<string, unknown>): 'paybill' | 'ecommerce' | 'booking' | null {
  const channel = String(tx.channel || '').toLowerCase();
  const type = String(tx.type || '').toUpperCase();
  if (channel === 'paybill' || type === 'WPAY') return 'paybill';
  if (channel === 'ecommerce' || type === 'ECOMMERCE') return 'ecommerce';
  if (
    channel === 'tele' ||
    channel === 'appointment' ||
    type === 'BOOKING' ||
    type === 'PACKAGE'
  ) {
    return 'booking';
  }
  return null;
}

/**
 * Fill channel / vendorId / categoryId from vendors + service_categories.
 * Callers may omit category; Pay Bill preview must still match C-published rules.
 */
export async function hydrateEvaluateRequest(req: EvaluateRequest): Promise<EvaluateRequest> {
  const t = { ...(req.transaction || {}) } as Record<string, unknown>;
  const surface = inferSurface(t);
  if (!surface) return req;
  try {
    const vendorId = String(t.vendorId || t.vendor_id || '') || null;
    const bookingCategoryId = uuidOrNull(t.categoryId) || uuidOrNull(t.service_category);
    const ctx = await loadServerPaymentContext({
      surface,
      vendorId,
      serviceStyle: String(t.service_type || t.serviceStyle || '') || null,
      bookingCategoryId,
    });
    return {
      ...req,
      transaction: {
        ...t,
        channel: ctx.channel || t.channel,
        vendorId: ctx.vendorId || vendorId || undefined,
        vendor_id: ctx.vendorId || vendorId || undefined,
        categoryId: ctx.categoryId || bookingCategoryId || undefined,
      },
    };
  } catch {
    return req;
  }
}
