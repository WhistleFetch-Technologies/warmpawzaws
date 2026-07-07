import { query } from '../../../database/rds-connection';
import { DEFAULT_COMMISSION_RATE } from '../../../lib/constants/commission';
import { resolveVendorCommissionPolicy } from '../resolve-vendor-commission-policy';

jest.mock('../../../database/rds-connection', () => ({
  query: jest.fn(),
}));

const mockQuery = query as jest.Mock;

const VENDOR_ID = '109ac8bc-9709-45a6-a7f8-c6ed7c63571c';

beforeEach(() => {
  mockQuery.mockReset();
});

describe('resolveVendorCommissionPolicy', () => {
  it('returns active subscription tier rate', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            tier_id: 'sub-tier-1',
            tier_name: 'Premium',
            display_name: 'Premium',
            tier_level: 3,
            commission_rate: '7.00',
            end_date: '2099-01-01',
          },
        ],
      });

    const policy = await resolveVendorCommissionPolicy(VENDOR_ID);

    expect(policy.commissionRate).toBe(7);
    expect(policy.tierSource).toBe('subscription');
    expect(policy.subscription.active).toBe(true);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('falls through to vendor Basic tier when no subscription rows', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'basic-tier',
            tier_name: 'Basic',
            display_name: 'Basic',
            tier_level: 1,
            commission_rate: '20.00',
          },
        ],
      });

    const policy = await resolveVendorCommissionPolicy(VENDOR_ID);

    expect(policy.commissionRate).toBe(20);
    expect(policy.tierSource).toBe('vendor_tier');
    expect(policy.tier.name).toBe('Basic');
  });

  it('uses Premium vendor tier when assigned', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'premium-tier',
            tier_name: 'Premium',
            commission_rate: '7.00',
          },
        ],
      });

    const policy = await resolveVendorCommissionPolicy(VENDOR_ID);

    expect(policy.commissionRate).toBe(7);
    expect(policy.tierSource).toBe('vendor_tier');
  });

  it('uses default tier when vendor tier missing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ commission_rate: null }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'default-tier',
            tier_name: 'Basic',
            commission_rate: '20.00',
          },
        ],
      });

    const policy = await resolveVendorCommissionPolicy(VENDOR_ID);

    expect(policy.commissionRate).toBe(20);
    expect(policy.tierSource).toBe('default_tier');
  });

  it('returns DEFAULT_COMMISSION_RATE when all lookups empty', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const policy = await resolveVendorCommissionPolicy(VENDOR_ID);

    expect(policy.commissionRate).toBe(DEFAULT_COMMISSION_RATE);
    expect(policy.tierSource).toBe('fallback');
  });

  it('continues to vendor tier when subscription query throws (invalid column)', async () => {
    mockQuery
      .mockRejectedValueOnce(new Error('column vts.expires_at does not exist'))
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'basic-tier',
            tier_name: 'Basic',
            commission_rate: '20.00',
          },
        ],
      });

    const policy = await resolveVendorCommissionPolicy(VENDOR_ID);

    expect(policy.commissionRate).toBe(20);
    expect(policy.tierSource).toBe('vendor_tier');
  });

  it('continues to default tier when subscription and vendor tier queries fail', async () => {
    mockQuery
      .mockRejectedValueOnce(new Error('subscription table missing'))
      .mockRejectedValueOnce(new Error('vendor join failed'))
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'bronze',
            tier_name: 'Bronze',
            commission_rate: '20.00',
          },
        ],
      });

    const policy = await resolveVendorCommissionPolicy(VENDOR_ID);

    expect(policy.commissionRate).toBe(20);
    expect(policy.tierSource).toBe('default_tier');
  });
});
