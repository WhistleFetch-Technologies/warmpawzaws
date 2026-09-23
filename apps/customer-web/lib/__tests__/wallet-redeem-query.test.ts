import {
  buildCustomerWalletPath,
  inferBookingSpendChannel,
} from '../wallet-redeem-query';

describe('buildCustomerWalletPath', () => {
  it('sends channel and vendor so GET wallet can apply admin redeem rules', () => {
    expect(
      buildCustomerWalletPath('9876543210', {
        serviceCategory: 'vet',
        channel: 'paybill',
        vendorId: 'vendor-1',
      })
    ).toBe(
      '/customer/wallet?phone=9876543210&serviceCategory=vet&channel=paybill&vendorId=vendor-1'
    );
  });
});

describe('inferBookingSpendChannel', () => {
  it('maps tele styles to tele', () => {
    expect(inferBookingSpendChannel({ serviceStyle: 'tele' })).toBe('tele');
    expect(inferBookingSpendChannel({ serviceStyle: 'video_consultation' })).toBe('tele');
  });

  it('maps WAPPT slot checkout to appointment', () => {
    expect(inferBookingSpendChannel({ serviceType: 'grooming', isWapptAppointment: true })).toBe(
      'appointment'
    );
  });
});
