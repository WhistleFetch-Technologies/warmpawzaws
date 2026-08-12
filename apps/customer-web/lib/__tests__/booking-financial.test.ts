import {
  buildBookingCardPriceView,
  extractBookingFinancial,
  resolveBookingListAllInAmount,
} from '../pricing/booking-financial';
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

  it('reconstructs all-in Total payable when stored total is tax-exclusive (Anannya grooming case)', () => {
    const fin = extractBookingFinancial({
      total_amount: '1699',
      base_price: '1699',
      price: '1699',
      payment_status: 'pending',
      status: 'cancelled',
      notes:
        'wp_financial_meta:{"servicePrice":1699,"cgst":152.91,"sgst":152.91,"totalTax":305.82,"finalPaid":1699}',
    });
    expect(fin.servicePrice).toBe(1699);
    expect(fin.totalTax).toBe(305.82);
    expect(fin.finalPaid).toBe(2004.82);
    expect(fin.lines.find((l) => l.kind === 'final')!.amount).toBe(2004.82);
    expect(fin.isPaid).toBe(false);
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

describe('resolveBookingListAllInAmount', () => {
  it('uses financial meta components (post-discount + GST + fees)', () => {
    const allIn = resolveBookingListAllInAmount({
      specialInstructions:
        'wp_financial_meta:{"servicePrice":1999,"vendorDiscount":1999,"subtotalAfterDiscounts":0,"totalTax":0,"platformFee":40,"convenienceFee":0,"deliveryFee":0,"walletAmount":40,"finalPaid":40}',
      paidAmount: 0,
      price: 0,
    });
    expect(allIn).toBe(40);
  });

  it('uses component gross for 10% off + GST + platform fee', () => {
    const allIn = resolveBookingListAllInAmount({
      notes:
        'wp_financial_meta:{"servicePrice":1000,"vendorDiscount":100,"subtotalAfterDiscounts":900,"totalTax":162,"platformFee":40,"convenienceFee":0,"deliveryFee":0,"walletAmount":0,"finalPaid":1102}',
      paidAmount: 1102,
      price: 1102,
    });
    expect(allIn).toBe(1102);
  });

  it('sums payment sources when meta is missing', () => {
    const allIn = resolveBookingListAllInAmount({
      paidAmount: 180,
      price: 180,
      paymentSources: [
        { method: 'wallet', amount: 1000 },
        { method: 'razorpay', amount: 180 },
      ],
    });
    expect(allIn).toBe(1180);
  });

  it('uses wallet when cash total is zero', () => {
    const allIn = resolveBookingListAllInAmount({
      paidAmount: 0,
      price: 0,
      paymentSources: [{ method: 'wallet', amount: 500 }],
    });
    expect(allIn).toBe(500);
  });

  it('uses finalPaid when subtotalAfterDiscounts is stale (COLLABCODE prod regression)', () => {
    const allIn = resolveBookingListAllInAmount({
      specialInstructions:
        'wp_financial_meta:{"servicePrice":1999,"vendorDiscount":0,"platformDiscount":0,"couponDiscount":1999,"subtotalAfterDiscounts":1999,"totalTax":0,"platformFee":40,"convenienceFee":0,"deliveryFee":0,"walletAmount":0,"finalPaid":40}',
      paidAmount: 40,
      price: 40,
    });
    expect(allIn).toBe(40);
  });
});

describe('buildBookingCardPriceView', () => {
  const collabMeta =
    'wp_financial_meta:{"servicePrice":1999,"vendorDiscount":0,"platformDiscount":0,"couponDiscount":1999,"subtotalAfterDiscounts":1999,"totalTax":0,"platformFee":40,"convenienceFee":0,"deliveryFee":0,"walletAmount":0,"finalPaid":40}';

  it('shows 100% service discount with platform fee separate (COLLABCODE)', () => {
    const fin = extractBookingFinancial({
      notes: collabMeta,
      coupon_code: 'COLLABCODE',
      payment_status: 'paid',
      paidAmount: 40,
    });
    const view = buildBookingCardPriceView(fin, 40);

    expect(view.servicePrice).toBe(1999);
    expect(view.serviceAfterDiscount).toBe(0);
    expect(view.serviceDiscountPercent).toBe(100);
    expect(view.platformFee).toBe(40);
    expect(view.totalTax).toBe(0);
    expect(view.totalPayable).toBe(40);
    expect(view.serviceSavings).toBe(1999);
  });

  it('includes GST on discounted service for partial coupon (80% off)', () => {
    const fin = extractBookingFinancial({
      notes:
        'wp_financial_meta:{"servicePrice":1000,"couponDiscount":800,"subtotalAfterDiscounts":200,"totalTax":36,"platformFee":40,"convenienceFee":0,"deliveryFee":0,"finalPaid":276}',
      coupon_code: 'SAVE80',
      payment_status: 'paid',
      paidAmount: 276,
    });
    const view = buildBookingCardPriceView(fin, 276);

    expect(view.serviceAfterDiscount).toBe(200);
    expect(view.serviceDiscountPercent).toBe(80);
    expect(view.totalTax).toBe(36);
    expect(view.platformFee).toBe(40);
    expect(view.totalPayable).toBe(276);
  });
});
