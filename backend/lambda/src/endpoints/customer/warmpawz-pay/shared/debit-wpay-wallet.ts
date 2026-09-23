function readMetadataNumber(meta: Record<string, unknown> | null, key: string): number | null {
  if (!meta) return null;
  const n = Number(meta[key]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Debit Pay Bill wallet from the stored quote snapshot.
 * Idempotent on payment id — safe from verify, fulfill, and reconcile.
 */
export async function debitWpayWalletFromMetadata(opts: {
  customerId: string;
  paymentId: string;
  vendorId: string;
  metadata: Record<string, unknown> | null;
}): Promise<{ ok: true; skipped: boolean } | { ok: false; error: string }> {
  const walletAmount = Math.max(0, readMetadataNumber(opts.metadata, 'walletAmount') ?? 0);
  if (walletAmount <= 0.009) {
    return { ok: true, skipped: true };
  }
  const { debitScopedWallet } = await import('../../../../discount-engine/promo-engine');
  const debit = await debitScopedWallet({
    customerId: opts.customerId,
    amount: walletAmount,
    serviceCategory: String(opts.metadata?.serviceCategory || ''),
    vendorId: opts.vendorId,
    categoryId: String(opts.metadata?.categoryId || ''),
    channel: 'paybill',
    referenceType: 'wpay',
    referenceId: opts.paymentId,
    description: `Warmpawz Pay ${opts.paymentId}`,
  });
  if (!debit.ok) {
    return { ok: false, error: debit.error };
  }
  return { ok: true, skipped: false };
}
