export interface PaymentSource {
  method: string;
  label: string;
  amount: number;
}

export function formatGatewayPaymentLabel(method?: string | null): string {
  const m = String(method || 'razorpay').toLowerCase();
  switch (m) {
    case 'wallet':
      return 'Warmpawz Wallet';
    case 'upi':
      return 'UPI';
    case 'card':
    case 'credit_card':
    case 'debit_card':
      return 'Card';
    case 'netbanking':
      return 'Net Banking';
    case 'cod':
      return 'Cash on Delivery';
    case 'razorpay':
      return 'Online Payment';
    default:
      return m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, ' ');
  }
}

export function buildCheckoutPaymentSources(input: {
  walletAmount?: number;
  gatewayAmount?: number;
  gatewayMethod?: string | null;
}): PaymentSource[] {
  const sources: PaymentSource[] = [];
  const wallet = Math.round((input.walletAmount ?? 0) * 100) / 100;
  const gateway = Math.round((input.gatewayAmount ?? 0) * 100) / 100;

  if (wallet > 0.009) {
    sources.push({ method: 'wallet', label: 'Warmpawz Wallet', amount: wallet });
  }
  if (gateway > 0.009) {
    sources.push({
      method: input.gatewayMethod || 'razorpay',
      label: formatGatewayPaymentLabel(input.gatewayMethod),
      amount: gateway,
    });
  }
  return sources;
}

export function totalFromPaymentSources(sources: PaymentSource[]): number {
  return Math.round(sources.reduce((sum, s) => sum + (s.amount || 0), 0) * 100) / 100;
}

/** Short label for booking list badges, e.g. "UPI" or "Wallet + UPI". */
export function formatPaymentSourcesShortLabel(sources: PaymentSource[]): string {
  if (!sources.length) return 'Paid';
  if (sources.length === 1) return sources[0].label;
  return sources.map((s) => s.label).join(' + ');
}

/** Resolve payment sources from API payload or legacy payment_method field. */
export function derivePaymentSourcesFromBooking(raw: Record<string, unknown>): PaymentSource[] {
  const fromApi = normalizePaymentSources(raw.paymentSources ?? raw.payment_sources);
  if (fromApi.length) return fromApi;

  const ps = String(raw.payment_status ?? raw.paymentStatus ?? '').toLowerCase();
  if (ps !== 'paid' && ps !== 'completed') return [];

  const total =
    parseFloat(String(raw.total_amount ?? raw.totalAmount ?? raw.price ?? '0')) || 0;
  const method = String(raw.payment_method ?? raw.paymentMethod ?? '').toLowerCase();
  if (total > 0.009 && method && method !== 'pending') {
    return buildCheckoutPaymentSources({ gatewayAmount: total, gatewayMethod: method });
  }
  return [];
}

export function normalizePaymentSources(raw: unknown): PaymentSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const amount = Number(row.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0.009) return null;
      const method = String(row.method || 'razorpay');
      const label =
        typeof row.label === 'string' && row.label.trim()
          ? row.label.trim()
          : formatGatewayPaymentLabel(method);
      return { method, label, amount: Math.round(amount * 100) / 100 };
    })
    .filter(Boolean) as PaymentSource[];
}
