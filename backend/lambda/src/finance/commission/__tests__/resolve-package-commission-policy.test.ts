import { resolvePackageCommissionPolicy } from '../resolve-package-commission-policy';
import { resolveVendorCommissionPolicy } from '../resolve-vendor-commission-policy';
import { resolveWpayPublicationCommission } from '../resolve-wpay-publication-commission';

jest.mock('../resolve-vendor-commission-policy', () => ({
  resolveVendorCommissionPolicy: jest.fn(),
}));
jest.mock('../resolve-wpay-publication-commission', () => ({
  resolveWpayPublicationCommission: jest.fn(),
}));

const mockedMarketplace = resolveVendorCommissionPolicy as jest.MockedFunction<
  typeof resolveVendorCommissionPolicy
>;
const mockedWpay = resolveWpayPublicationCommission as jest.MockedFunction<
  typeof resolveWpayPublicationCommission
>;

describe('resolvePackageCommissionPolicy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses Marketplace resolver for marketplace purchases even if Pay tier differs', async () => {
    mockedMarketplace.mockResolvedValue({
      vendorId: 'v1',
      commissionRate: 20,
      tier: { id: 'mkt', name: 'Gold', displayName: 'Gold', tierLevel: 2 },
      subscription: { active: false, tierId: null, tierName: null, expiresAt: null },
      tierSource: 'vendor_tier',
      subscriptionSource: 'none',
      fallbackSource: null,
    });
    mockedWpay.mockResolvedValue({
      vendorId: 'v1',
      commissionRate: 30,
      tierId: 'pay',
      tierName: 'Pay',
      source: 'wpay_publication_tier',
      found: true,
    });

    const policy = await resolvePackageCommissionPolicy('v1', 'marketplace');
    expect(policy.commissionRate).toBe(20);
    expect(policy.commissionSource).toBe('marketplace_tier');
    expect(mockedWpay).not.toHaveBeenCalled();
  });

  it('uses Pay publication tier for warmpawz_pay purchases even if Marketplace tier differs', async () => {
    mockedMarketplace.mockResolvedValue({
      vendorId: 'v1',
      commissionRate: 20,
      tier: { id: 'mkt', name: 'Gold', displayName: 'Gold', tierLevel: 2 },
      subscription: { active: false, tierId: null, tierName: null, expiresAt: null },
      tierSource: 'vendor_tier',
      subscriptionSource: 'none',
      fallbackSource: null,
    });
    mockedWpay.mockResolvedValue({
      vendorId: 'v1',
      commissionRate: 30,
      tierId: 'pay',
      tierName: 'Pay',
      source: 'wpay_publication_tier',
      found: true,
    });

    const policy = await resolvePackageCommissionPolicy('v1', 'warmpawz_pay');
    expect(policy.commissionRate).toBe(30);
    expect(policy.commissionSource).toBe('wpay_publication_tier');
    expect(mockedMarketplace).not.toHaveBeenCalled();
  });

  it('defaults missing commerce mode to Marketplace', async () => {
    mockedMarketplace.mockResolvedValue({
      vendorId: 'v1',
      commissionRate: 12,
      tier: { id: null, name: null, displayName: null, tierLevel: null },
      subscription: { active: false, tierId: null, tierName: null, expiresAt: null },
      tierSource: 'default_tier',
      subscriptionSource: 'none',
      fallbackSource: null,
    });
    const policy = await resolvePackageCommissionPolicy('v1');
    expect(policy.commerceMode).toBe('marketplace');
    expect(policy.commissionRate).toBe(12);
  });
});
