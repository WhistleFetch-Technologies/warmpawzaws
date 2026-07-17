import { parseJsonMetaFromNotes } from './booking-notes-meta';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface LockedBookingGross {
  grossTotal: number;
  subtotalAfterDiscounts: number;
  totalTax: number;
  cgst: number;
  sgst: number;
  igst: number;
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  walletAmount: number;
  finalPaid: number;
  source: 'components' | 'finalPaid_plus_wallet' | 'finalPaid_only';
}

function num(meta: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    if (meta[key] != null && meta[key] !== '') {
      const parsed = parseFloat(String(meta[key]));
      if (Number.isFinite(parsed)) return round2(parsed);
    }
  }
  return 0;
}

/** Resolve locked all-in gross from wp_financial_meta embedded in booking notes. */
export function resolveLockedBookingGrossFromNotes(notes: unknown): LockedBookingGross | null {
  const finMeta = parseJsonMetaFromNotes(notes, 'wp_financial_meta');
  if (!finMeta) return null;

  const subtotalAfterDiscounts = num(
    finMeta,
    'subtotalAfterDiscounts',
    'subtotal_after_discounts'
  );
  const totalTax = num(finMeta, 'totalTax', 'total_tax');
  const cgst = num(finMeta, 'cgst');
  const sgst = num(finMeta, 'sgst');
  const igst = num(finMeta, 'igst');
  const platformFee = num(finMeta, 'platformFee', 'platform_fee');
  const convenienceFee = num(finMeta, 'convenienceFee', 'convenience_fee');
  const deliveryFee = num(finMeta, 'deliveryFee', 'delivery_fee');
  const walletAmount = num(finMeta, 'walletAmount', 'wallet_amount');
  const finalPaid = num(finMeta, 'finalPaid', 'final_paid');

  const servicePrice = num(finMeta, 'servicePrice', 'service_price');
  const componentGross = round2(
    subtotalAfterDiscounts + totalTax + platformFee + convenienceFee + deliveryFee
  );

  const base = {
    subtotalAfterDiscounts,
    totalTax,
    cgst,
    sgst,
    igst,
    platformFee,
    convenienceFee,
    deliveryFee,
    walletAmount,
    finalPaid,
  };

  const componentsLookComplete =
    componentGross > 0 &&
    (finalPaid <= 0 || componentGross >= finalPaid - 0.01 || walletAmount > 0);

  if (componentsLookComplete) {
    return { ...base, grossTotal: componentGross, source: 'components' };
  }

  if (walletAmount > 0 && finalPaid > 0) {
    return {
      ...base,
      grossTotal: round2(finalPaid + walletAmount),
      source: 'finalPaid_plus_wallet',
    };
  }

  if (finalPaid > 0) {
    return { ...base, grossTotal: finalPaid, source: 'finalPaid_only' };
  }

  return null;
}

export interface WalletBookingSplitResult {
  walletApplied: number;
  cashRemainder: number;
  fullyWallet: boolean;
}

/** Compute wallet debit and Razorpay remainder against a locked gross total. */
export function computeWalletBookingSplit(params: {
  grossTotal: number;
  walletIntent: number;
  walletBalance: number;
}): WalletBookingSplitResult {
  const gross = round2(Math.max(0, params.grossTotal));
  const intent = round2(Math.max(0, params.walletIntent));
  const balance = round2(Math.max(0, params.walletBalance));
  const walletApplied = round2(Math.min(intent, balance, gross));
  const cashRemainder = round2(Math.max(0, gross - walletApplied));
  return {
    walletApplied,
    cashRemainder,
    fullyWallet: walletApplied > 0 && cashRemainder < 0.01,
  };
}
