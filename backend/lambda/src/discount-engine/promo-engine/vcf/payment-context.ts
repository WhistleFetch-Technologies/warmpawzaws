import { classifyPaymentChannel } from './channel';
import { categoryIdFromVendorRole, type CatalogueCategoryRow } from './category-from-role';
import type { PaymentChannel, PaymentContext } from './types';

/**
 * Server payment context. Callers pass already-loaded vendor/role/category rows.
 * Booking service categoryId wins when it is a real catalogue id.
 * Pay Bill is never a category.
 */
export function resolvePaymentContext(opts: {
  surface: 'paybill' | 'ecommerce' | 'booking';
  serviceStyle?: string | null;
  vendorId?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  bookingCategoryId?: string | null;
  catalogue: CatalogueCategoryRow[];
}): PaymentContext {
  const classified = classifyPaymentChannel({
    surface: opts.surface,
    serviceStyle: opts.serviceStyle,
  });
  let channel: PaymentChannel | null = classified;
  if (opts.surface === 'paybill') channel = 'paybill';
  if (opts.surface === 'ecommerce') channel = 'ecommerce';

  const vendorId = opts.vendorId ? String(opts.vendorId) : null;
  const roleId = opts.roleId ? String(opts.roleId) : null;
  const booked = String(opts.bookingCategoryId || '').trim();
  const bookedKnown =
    booked && opts.catalogue.some((row) => String(row.id) === booked) ? booked : null;
  const fromRole = categoryIdFromVendorRole({
    roleId,
    roleName: opts.roleName,
    categories: opts.catalogue,
  });

  return {
    channel,
    vendorId,
    roleId,
    categoryId: bookedKnown || fromRole,
  };
}
