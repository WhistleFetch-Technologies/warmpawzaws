import { incrementCouponUsageCount } from '../vendor-promotion-usage';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  insert: jest.fn(),
}));

const { query } = jest.requireMock('../../database/rds-connection') as {
  query: jest.Mock;
};

describe('incrementCouponUsageCount', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('prefers uses_count (prod Admin Coupons column) before usage_count', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await incrementCouponUsageCount('c1');
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain('uses_count');
    expect(String(query.mock.calls[0][0])).not.toContain('usage_count');
  });

  it('falls back to usage_count when uses_count update matches no row', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await incrementCouponUsageCount('c1');
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[1][0])).toContain('usage_count');
  });
});
