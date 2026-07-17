import { extractBookingFinancial } from '../pricing/booking-financial';
import type { PriceBreakdownLine } from '../pricing/types';

const sumNonFinal = (lines: PriceBreakdownLine[]) =>
  Math.round(
    lines.filter((l) => l.kind !== 'final' && l.kind !== 'savings' && l.kind !== 'subtotal')
      .reduce((s, l) => s + l.amount, 0) * 100
  ) / 100;

/** Mirrors prod booking 3e40951a: enforcement payment row, failed payment, no booking meta. */
const enforcementBooking = {
  total_amount: '1900',
  base_price: '1900',
  tax_amount: '0',
  notes: null,
  status: 'cancelled',
  payment_status: 'pending',
  payment_amount: '2280',
  gst_amount: '342',
  platform_fee: '0',
  convenience_fee: '0',
  wallet_amount_used: '0',
  payment_row_status: 'failed',
};

describe('extractBookingFinancial payment-row fallback', () => {
  it('takes payable from payment amount when it exceeds booking total and adds a residual fee line', () => {
    const fin = extractBookingFinancial(enforcementBooking);

    expect(fin.servicePrice).toBe(1900);
    expect(fin.totalTax).toBe(342);
    expect(fin.finalPaid).toBe(2280);
    expect(fin.isPaid).toBe(false);

    const residual = fin.lines.find((l) => l.label === 'Platform & other fees');
    expect(residual).toBeDefined();
    expect(residual!.amount).toBe(38);
    expect(residual!.kind).toBe('platform_fee');

    const final = fin.lines.find((l) => l.kind === 'final');
    expect(final!.label).toBe('Total payable');
    expect(final!.amount).toBe(2280);

    // Lines must reconcile with the payable.
    expect(sumNonFinal(fin.lines)).toBe(2280);
  });

  it('accepts camelCase payment-row field variants', () => {
    const fin = extractBookingFinancial({
      totalAmount: '1900',
      basePrice: '1900',
      notes: null,
      paymentStatus: 'pending',
      paymentAmount: '2280',
      gstAmount: '342',
      paymentRowStatus: 'failed',
    });
    expect(fin.finalPaid).toBe(2280);
    expect(fin.totalTax).toBe(342);
    expect(fin.lines.find((l) => l.label === 'Platform & other fees')?.amount).toBe(38);
    expect(fin.isPaid).toBe(false);
  });

  it('does not add a residual line when explicit fee columns are present', () => {
    const fin = extractBookingFinancial({
      total_amount: '1900',
      base_price: '1900',
      notes: null,
      payment_status: 'paid',
      payment_amount: '2280',
      gst_amount: '342',
      platform_fee: '38',
      payment_row_status: 'completed',
    });
    expect(fin.finalPaid).toBe(2280);
    expect(fin.platformFee).toBe(38);
    expect(fin.lines.find((l) => l.label === 'Platform & other fees')).toBeUndefined();
    expect(fin.lines.find((l) => l.kind === 'platform_fee')?.label).toBe('Platform fee');
    expect(sumNonFinal(fin.lines)).toBe(2280);
  });

  it('degrades gracefully without payment-row fields (current prod API)', () => {
    const fin = extractBookingFinancial({
      total_amount: '1900',
      base_price: '1900',
      tax_amount: '0',
      notes: null,
      payment_status: 'pending',
    });
    expect(fin.finalPaid).toBe(1900);
    expect(fin.isPaid).toBe(false);
    expect(fin.lines.find((l) => l.label === 'Platform & other fees')).toBeUndefined();
    expect(fin.lines.find((l) => l.kind === 'final')!.label).toBe('Total payable');
  });
});

describe('extractBookingFinancial wallet line', () => {
  it('renders a negative "Paid from wallet" line when wallet was used', () => {
    const fin = extractBookingFinancial({
      total_amount: '1180',
      base_price: '1000',
      notes: null,
      payment_status: 'paid',
      payment_amount: '1180',
      gst_amount: '180',
      wallet_amount_used: '200',
      payment_row_status: 'completed',
    });
    const wallet = fin.lines.find((l) => l.kind === 'wallet');
    expect(wallet).toBeDefined();
    expect(wallet!.label).toBe('Paid from wallet');
    expect(wallet!.amount).toBe(-200);
    expect(fin.walletAmount).toBe(200);
  });

  it('omits the wallet line when nothing was paid from wallet', () => {
    const fin = extractBookingFinancial(enforcementBooking);
    expect(fin.lines.find((l) => l.kind === 'wallet')).toBeUndefined();
  });
});

describe('extractBookingFinancial payment state label', () => {
  it('labels the final line "Total paid" when booking payment_status is paid', () => {
    const fin = extractBookingFinancial({
      total_amount: '1900',
      base_price: '1900',
      notes: null,
      payment_status: 'paid',
    });
    expect(fin.isPaid).toBe(true);
    expect(fin.lines.find((l) => l.kind === 'final')!.label).toBe('Total paid');
  });

  it('treats a completed payment row as paid even if booking status lags', () => {
    const fin = extractBookingFinancial({
      total_amount: '1900',
      base_price: '1900',
      notes: null,
      payment_status: 'pending',
      payment_amount: '2280',
      gst_amount: '342',
      payment_row_status: 'completed',
    });
    expect(fin.isPaid).toBe(true);
    expect(fin.lines.find((l) => l.kind === 'final')!.label).toBe('Total paid');
  });
});

describe('extractBookingFinancial promo/coupon regression', () => {
  it('still renders the coupon discount line', () => {
    const fin = extractBookingFinancial({
      total_amount: '900',
      base_price: '1000',
      discount_amount: '100',
      coupon_code: 'SAVE10',
      notes: null,
      payment_status: 'paid',
    });
    const coupon = fin.lines.find((l) => l.kind === 'coupon');
    expect(coupon).toBeDefined();
    expect(coupon!.label).toBe('Coupon (SAVE10)');
    expect(coupon!.amount).toBe(-100);
    expect(fin.couponDiscount).toBe(100);
    expect(fin.finalPaid).toBe(900);
  });
});
