import { pickShopOrderTrackingUrl } from '@/lib/ecommerce/open-shop-order-tracking';

describe('pickShopOrderTrackingUrl', () => {
  it('prefers order.trackingUrl', () => {
    expect(
      pickShopOrderTrackingUrl({
        order: { trackingUrl: 'https://courier.example/track/1' },
        tracking: { trackingUrl: 'https://other.example' },
      }),
    ).toBe('https://courier.example/track/1');
  });

  it('falls back to tracking.trackingUrl', () => {
    expect(
      pickShopOrderTrackingUrl({
        tracking: { trackingUrl: ' https://vendor.example/awb ' },
      }),
    ).toBe('https://vendor.example/awb');
  });

  it('returns null when no url', () => {
    expect(pickShopOrderTrackingUrl({ order: {}, tracking: {} })).toBeNull();
    expect(pickShopOrderTrackingUrl(null)).toBeNull();
  });
});
