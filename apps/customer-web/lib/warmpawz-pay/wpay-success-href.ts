/**
 * Pay Bill success URL helpers. Uses the current origin — never a hardcoded host.
 */

export function buildWpaySuccessPath(params: {
  paymentId: string;
  saved?: number;
  vendor?: string;
}): string {
  const qs = new URLSearchParams();
  qs.set('paymentId', params.paymentId);
  if (params.saved != null && Number.isFinite(params.saved) && params.saved > 0) {
    qs.set('saved', String(params.saved));
  }
  const vendor = params.vendor?.trim();
  if (vendor) qs.set('vendor', vendor);
  return `/warmpawz-pay/success?${qs.toString()}`;
}

export function buildWpayCheckoutCallbackUrl(
  paymentId: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  const base = String(origin || '').replace(/\/$/, '');
  return `${base}${buildWpaySuccessPath({ paymentId })}`;
}
