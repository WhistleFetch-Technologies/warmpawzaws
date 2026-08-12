/**
 * Display helpers for cancelled booking cards / detail (who, reason, refund).
 */

export type BookingRefundSummary = {
  amount?: number | null;
  status?: string | null;
  method?: string | null;
};

export function cancelledByLabel(cancelledBy?: string | null): string {
  const v = String(cancelledBy || '')
    .toLowerCase()
    .trim();
  if (v === 'provider' || v === 'vendor') return 'Cancelled by vendor';
  if (v === 'pet_parent' || v === 'customer') return 'Cancelled by you';
  if (v === 'system' || v === 'admin' || v === 'support') return 'Cancelled by Warmpawz';
  return 'Cancelled';
}

/** Strip provider prefix noise; keep operational note / alternative. */
export function humanizeCancellationReason(reason?: string | null): string {
  let r = String(reason || '').replace(/\s+/g, ' ').trim();
  if (!r) return '';
  r = r
    .replace(/^Provider declined\s*\([^)]*\)\.\s*/i, '')
    .replace(/^Provider declined:\s*/i, '')
    .replace(/^Provider cancelled\s*\([^)]*\)\.\s*/i, '')
    .replace(/^Provider cancelled:\s*/i, '')
    .replace(/\s*\(All package sessions cancelled\.\)\s*$/i, '')
    .replace(/\s*\(100%\s*refund\)\s*$/i, '')
    .trim();
  return r;
}

export function formatRefundStatusLabel(status?: string | null): string {
  const s = String(status || '')
    .toLowerCase()
    .trim();
  if (s === 'completed' || s === 'processed') return 'Refund completed';
  if (s === 'failed') return 'Refund failed';
  if (s === 'processing' || s === 'approved') return 'Refund processing';
  return 'Refund update';
}

export function formatRefundMethodLabel(method?: string | null): string {
  const m = String(method || '')
    .toLowerCase()
    .trim();
  if (m === 'wallet') return 'Warmpawz wallet';
  return 'original payment method';
}

export function formatRefundAmountInr(amount?: number | null): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function buildRefundStripCopy(summary?: BookingRefundSummary | null): {
  title: string;
  subtitle: string;
} | null {
  if (!summary) return null;
  const amount = Number(summary.amount);
  if (!Number.isFinite(amount) || amount <= 0.009) {
    if (String(summary.status || '').toLowerCase() === 'failed') {
      return {
        title: 'Refund failed',
        subtitle: 'Contact support if money was deducted',
      };
    }
    return null;
  }
  const amt = formatRefundAmountInr(amount);
  const status = String(summary.status || '').toLowerCase();
  const method = formatRefundMethodLabel(summary.method);
  if (status === 'completed' || status === 'processed') {
    return {
      title: `Refund of ${amt} completed`,
      subtitle: `Returned to ${method}`,
    };
  }
  if (status === 'failed') {
    return {
      title: `Refund of ${amt} failed`,
      subtitle: 'Contact support for help',
    };
  }
  return {
    title: `Refund of ${amt} processing`,
    subtitle: `Will return to ${method}`,
  };
}

export function hasChargedOrRefundedPayment(input: {
  paymentStatus?: string | null;
  refundSummary?: BookingRefundSummary | null;
}): boolean {
  const ps = String(input.paymentStatus || '')
    .toLowerCase()
    .trim();
  if (
    ['paid', 'completed', 'refunded', 'partially_refunded', 'partial', 'captured'].includes(ps)
  ) {
    return true;
  }
  const amt = Number(input.refundSummary?.amount);
  return Number.isFinite(amt) && amt > 0.009;
}
