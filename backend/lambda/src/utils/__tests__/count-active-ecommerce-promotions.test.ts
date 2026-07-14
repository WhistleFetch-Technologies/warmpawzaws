import { query } from '../../database/rds-connection';
import { countActiveEcommerceAdminPromotions } from '../count-active-ecommerce-promotions';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('countActiveEcommerceAdminPromotions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns union count from SQL', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] } as never);
    await expect(countActiveEcommerceAdminPromotions()).resolves.toBe(3);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = String(mockQuery.mock.calls[0][0]);
    expect(sql).toContain('ecommerce_admin_promotions');
    expect(sql).toContain('promotions');
    expect(sql).toContain('UNION');
    expect(sql).toContain('COALESCE(published, false) = true');
    expect(sql).not.toContain('vendor_promotions');
  });

  it('returns 0 when query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    await expect(countActiveEcommerceAdminPromotions()).resolves.toBe(0);
  });
});
