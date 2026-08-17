import {
  customerTaxableAfterDiscount,
  preferVendorSellingPriceOverClientUndercut,
  resolveBookingListPrice,
  resolvePackageCustomerSellingPrice,
  resolvePersistedBookingBasePrice,
  resolvePromoValidationAmount,
  resolveVendorConfiguredSellingPrice,
  sumSelectedServicesListPrice,
} from '../resolve-booking-list-price';
import { buildCanonicalGstSnapshot } from '../canonical-gst-snapshot';

describe('resolveBookingListPrice', () => {
  it('prefers stay/server billed total over vendor unit price', () => {
    expect(
      resolveBookingListPrice({
        stayOrServerBilledTotal: 5000,
        vendorCustomPrice: 1650,
        vendorPrice: 1650,
        selectedServices: [{ price: 1485 }],
      })
    ).toBe(5000);
  });

  it('uses vendor list when selectedServices price is already discounted (Sara Pets)', () => {
    expect(
      resolveBookingListPrice({
        vendorCustomPrice: 1650,
        vendorPrice: 1650,
        selectedServices: [{ price: 1485, quantity: 1 }],
      })
    ).toBe(1650);
  });

  it('sums selected originalPrice lines when more than one service', () => {
    expect(
      resolveBookingListPrice({
        vendorCustomPrice: 800,
        vendorPrice: 800,
        selectedServices: [
          { price: 720, originalPrice: 800, quantity: 1 },
          { price: 450, originalPrice: 500, quantity: 1 },
        ],
      })
    ).toBe(1300);
  });

  it('falls back to selected originalPrice when vendor row is missing', () => {
    expect(
      resolveBookingListPrice({
        selectedServices: [{ price: 1485, original_price: 1650 }],
      })
    ).toBe(1650);
  });
});

describe('sumSelectedServicesListPrice', () => {
  it('prefers originalPrice over baked price', () => {
    expect(sumSelectedServicesListPrice([{ price: 1485, originalPrice: 1650 }])).toBe(1650);
  });
});

describe('resolvePersistedBookingBasePrice', () => {
  it('persists vendor list 1650 when client sends 1485 and there is no higher client amount', () => {
    expect(
      resolvePersistedBookingBasePrice({
        listPrice: 1650,
        clientServicePrice: 1485,
        calculatedBasePrice: 1485,
      })
    ).toBe(1650);
  });

  it('keeps a higher client amount (add-ons) above list', () => {
    expect(
      resolvePersistedBookingBasePrice({
        listPrice: 1650,
        clientServicePrice: 2000,
        calculatedBasePrice: 2000,
      })
    ).toBe(2000);
  });

  it('falls back to calculated when list and client are missing', () => {
    expect(
      resolvePersistedBookingBasePrice({
        listPrice: 0,
        clientServicePrice: null,
        calculatedBasePrice: 499,
      })
    ).toBe(499);
  });
});

describe('resolvePromoValidationAmount', () => {
  it('quotes promos on list 1650, not client 1485', () => {
    expect(
      resolvePromoValidationAmount({
        listPrice: 1650,
        clientServicePrice: 1485,
        grossPayableBeforeWallet: 1485,
      })
    ).toBe(1650);
  });
});

describe('customer vs vendor economics (shared selling-price authority)', () => {
  it('SERVICE: vendor 1650 / commission 10% → customer 1650, vendor net 1485', () => {
    const customer = resolveVendorConfiguredSellingPrice({
      vendorCustomPrice: 1650,
      vendorPrice: 1650,
      adminDefaultPrice: 1650,
    });
    expect(customer).toBe(1650);
    expect(preferVendorSellingPriceOverClientUndercut(customer, 1485)).toBe(1650);
    expect(Math.round((customer - customer * 0.1) * 100) / 100).toBe(1485);
  });

  it('PACKAGE: vendor 10000 / commission 10% → customer 10000, not metadata 9000', () => {
    const customer = resolvePackageCustomerSellingPrice({
      vendorCustomPrice: 10000,
      vendorPrice: 10000,
      packageDetailsPrice: 9000,
    });
    expect(customer).toBe(10000);
    expect(Math.round((customer - customer * 0.1) * 100) / 100).toBe(9000);
  });

  it('CUSTOM OVERRIDE: Admin 2000 / vendor 900 → customer 900, vendor net 810', () => {
    const customer = resolveVendorConfiguredSellingPrice({
      vendorCustomPrice: 900,
      vendorPrice: 900,
      adminDefaultPrice: 2000,
    });
    expect(customer).toBe(900);
    expect(preferVendorSellingPriceOverClientUndercut(customer, 810)).toBe(900);
    expect(Math.round((customer - customer * 0.1) * 100) / 100).toBe(810);
  });

  it('CUSTOMER DISCOUNT: 1650 − 100 → taxable 1550 (commission is not a discount input)', () => {
    expect(customerTaxableAfterDiscount(1650, 100)).toBe(1550);
    expect(customerTaxableAfterDiscount(1650, 0)).toBe(1650);
  });

  it('GST INTRA on taxable 1650 @ 18%', () => {
    const snap = buildCanonicalGstSnapshot({
      taxableAmount: 1650,
      gstRate: 18,
      isInterState: false,
    });
    expect(snap.gstAmount).toBe(297);
    expect(snap.cgstAmount).toBe(148.5);
    expect(snap.sgstAmount).toBe(148.5);
    expect(snap.igstAmount).toBe(0);
  });

  it('GST INTER on taxable 1650 @ 18%', () => {
    const snap = buildCanonicalGstSnapshot({
      taxableAmount: 1650,
      gstRate: 18,
      isInterState: true,
    });
    expect(snap.gstAmount).toBe(297);
    expect(snap.cgstAmount).toBe(0);
    expect(snap.sgstAmount).toBe(0);
    expect(snap.igstAmount).toBe(297);
  });

  it('does not use Admin default when vendor has configured a price', () => {
    expect(
      resolveVendorConfiguredSellingPrice({
        vendorCustomPrice: 900,
        adminDefaultPrice: 2000,
      })
    ).toBe(900);
  });
});
