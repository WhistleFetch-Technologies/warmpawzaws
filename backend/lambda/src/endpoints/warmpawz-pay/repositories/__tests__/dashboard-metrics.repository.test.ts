import { DashboardMetricsRepository } from '../dashboard-metrics.repository';
import { PUBLISHED } from '../../constants/publish-status';

describe('DashboardMetricsRepository', () => {
  it('counts published merchants from catalogue table', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ total: 7 }] });
    const repo = new DashboardMetricsRepository({ query });

    await expect(repo.countPublishedMerchants()).resolves.toBe(7);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('warmpawz_pay_vendor_catalog');
    expect(sql).toContain('publish_status');
    expect(params).toEqual([PUBLISHED]);
  });

  it('returns zero when no published merchants', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ total: 0 }] });
    const repo = new DashboardMetricsRepository({ query });

    await expect(repo.countPublishedMerchants()).resolves.toBe(0);
  });

  it('returns average active percentage discount from pricing table', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ average_discount: 8.3 }] });
    const repo = new DashboardMetricsRepository({ query });

    await expect(repo.getAverageDiscountPercent()).resolves.toBe(8.3);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql] = query.mock.calls[0];
    expect(sql).toContain('warmpawz_pay_merchant_pricing');
  });
});
