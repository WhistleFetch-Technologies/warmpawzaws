import {
  APP_REVIEW_DEMO_PHONE,
  filterAccountMenuForReviewAccount,
  filterComingSoonBannersForReviewAccount,
  filterHomeServiceTilesForReviewAccount,
  filterWhatsNewAnnouncementsForReviewAccount,
  isAppReviewDemoAccount,
  isLoyaltyUiVisibleForAccount,
  isReviewBlockedUrlPath,
  isShopUiVisibleForAccount,
  normalizePhoneForGate,
} from '../app-review-demo-account';

describe('app-review-demo-account', () => {
  it('normalizes phone to last 10 digits', () => {
    expect(normalizePhoneForGate('+91 9606901515')).toBe('9606901515');
    expect(normalizePhoneForGate('919606901515')).toBe('9606901515');
  });

  it('detects demo account only for 9606901515', () => {
    expect(isAppReviewDemoAccount('9606901515')).toBe(true);
    expect(isAppReviewDemoAccount('+919606901515')).toBe(true);
    expect(isAppReviewDemoAccount('9845299005')).toBe(false);
    expect(isAppReviewDemoAccount(null)).toBe(false);
  });

  it('hides shop and loyalty UI for demo account only', () => {
    expect(isShopUiVisibleForAccount('9606901515')).toBe(false);
    expect(isLoyaltyUiVisibleForAccount('9606901515')).toBe(false);
    expect(isLoyaltyUiVisibleForAccount('9845299005')).toBe(true);
  });

  it('filters account menu for demo account', () => {
    const items = [
      { action: 'wallet', label: 'Wallet' },
      { action: 'rewards-loyalty', label: 'Rewards' },
      { action: 'orders', label: 'Orders' },
      { view: 'cart', label: 'Cart' },
      { action: 'profile', label: 'Profile' },
    ];
    const filtered = filterAccountMenuForReviewAccount(items, APP_REVIEW_DEMO_PHONE);
    expect(filtered.map((i) => i.label)).toEqual(['Wallet', 'Profile']);
    expect(filterAccountMenuForReviewAccount(items, '9845299005')).toEqual(items);
  });

  it('filters coming-soon and under-build home tiles for demo account', () => {
    const tiles = [
      { screen: 'vet', label: 'Vet' },
      { screen: 'insurance', label: 'Insurance', isComingSoon: true },
      { screen: 'cafes', label: 'Cafes' },
    ];
    const filtered = filterHomeServiceTilesForReviewAccount(tiles, APP_REVIEW_DEMO_PHONE);
    expect(filtered.map((t) => t.screen)).toEqual(['vet']);
  });

  it('blocks marketplace URL paths for demo account', () => {
    expect(isReviewBlockedUrlPath('/shop', APP_REVIEW_DEMO_PHONE)).toBe(true);
    expect(isReviewBlockedUrlPath('/rewards', APP_REVIEW_DEMO_PHONE)).toBe(true);
    expect(isReviewBlockedUrlPath('/bookings', APP_REVIEW_DEMO_PHONE)).toBe(false);
    expect(isReviewBlockedUrlPath('/shop', '9845299005')).toBe(false);
  });

  it('filters coming-soon whats-new and banners for demo account', () => {
    const announcements = [
      { id: 'ai', title: 'AI' },
      { id: 'sos', title: 'Ambulance', comingSoon: true, announcementType: 'emergency' },
      { id: 'premium', title: 'Plus', announcementType: 'premium' },
    ];
    expect(
      filterWhatsNewAnnouncementsForReviewAccount(announcements, APP_REVIEW_DEMO_PHONE).map((a) => a.id)
    ).toEqual(['ai']);

    const banners = [
      { id: '1', title: 'Live', comingSoon: false },
      { id: '2', title: 'Soon', comingSoon: true },
    ];
    expect(
      filterComingSoonBannersForReviewAccount(banners, APP_REVIEW_DEMO_PHONE).map((b) => b.id)
    ).toEqual(['1']);
    expect(filterComingSoonBannersForReviewAccount(banners, '9845299005')).toEqual(banners);
  });
});
