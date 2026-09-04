import type { WpayTransactionCard } from './wpay-api';

export type WpayHistoryBreakdownLine = {
  label: string;
  amount: number;
  tone?: 'muted' | 'discount' | 'total';
};

function n(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** Same customer-facing lines as Pay Bill checkout, from stored payment snapshot. */
export function buildWpayHistoryBreakdownLines(row: WpayTransactionCard): WpayHistoryBreakdownLine[] {
  const lines: WpayHistoryBreakdownLine[] = [
    { label: 'Quoted bill', amount: n(row.originalAmount) },
  ];
  if (n(row.discountAmount) > 0.009) {
    lines.push({
      label: `Offer discount (${n(row.discountPercent)}% OFF)`,
      amount: -n(row.discountAmount),
      tone: 'discount',
    });
  }
  const isTier = row.commercialModel === 'tier_commission';
  if (isTier && n(row.servicePayableAmount) > 0.009) {
    lines.push({ label: 'Service payable', amount: n(row.servicePayableAmount), tone: 'muted' });
  }
  if (isTier && n(row.platformFee) > 0.009) {
    lines.push({ label: 'Platform fee', amount: n(row.platformFee), tone: 'muted' });
    if (n(row.platformFeeGstAmount) > 0.009) {
      const rate = n(row.platformFeeGstRate);
      lines.push({
        label: rate > 0 ? `Platform fee GST (${rate}%)` : 'Platform fee GST',
        amount: n(row.platformFeeGstAmount),
        tone: 'muted',
      });
    }
  }
  if (isTier && n(row.convenienceFee) > 0.009) {
    lines.push({ label: 'Convenience fee', amount: n(row.convenienceFee), tone: 'muted' });
    if (n(row.convenienceGstAmount) > 0.009) {
      const rate = n(row.convenienceGstRate);
      lines.push({
        label: rate > 0 ? `Convenience GST (${rate}%)` : 'Convenience GST',
        amount: n(row.convenienceGstAmount),
        tone: 'muted',
      });
    }
  }
  lines.push({ label: 'You paid', amount: n(row.payableAmount), tone: 'total' });
  return lines;
}
