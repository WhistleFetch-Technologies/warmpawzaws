import { debitScopedWallet } from '../../../discount-engine/promo-engine';

export async function debitEcommerceWallet(opts: {
  customerId: string;
  amount: number;
  orderId: string;
  orderNumber: string;
  vendorId?: string | null;
  ecommerceCategoryId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const amount = Math.round((opts.amount || 0) * 100) / 100;
  if (amount <= 0) return { ok: true };

  const debit = await debitScopedWallet({
    customerId: opts.customerId,
    amount,
    serviceCategory: 'ecommerce',
    vendorId: opts.vendorId || null,
    channel: 'ecommerce',
    ecommerceCategoryId: opts.ecommerceCategoryId || null,
    referenceType: 'order',
    referenceId: opts.orderId,
    description: `Applied to order ${opts.orderNumber}`,
  });
  if (!debit.ok) return { ok: false, error: debit.error };
  return { ok: true };
}
