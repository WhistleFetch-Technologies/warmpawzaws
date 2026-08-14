import {
  resolveBookingListPrice,
  resolvePersistedBookingBasePrice,
  resolvePromoValidationAmount,
  sumSelectedServicesListPrice,
} from '../resolve-booking-list-price';

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
