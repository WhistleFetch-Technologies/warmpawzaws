import { dbLoadServiceCategories, dbLoadVendorRole } from '../repos/promo-engine.repo';
import { resolvePaymentContext, type PaymentContext } from '../vcf';

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
