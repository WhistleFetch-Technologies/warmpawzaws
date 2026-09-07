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

  it('counts draft and unpublished catalogue rows', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ total: 4 }] });
    const repo = new DashboardMetricsRepository({ query });

    await expect(repo.countDraftUnpublished()).resolves.toBe(4);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('warmpawz_pay_vendor_catalog');
    expect(sql).toContain('publish_status IS DISTINCT FROM');
    expect(params).toEqual([PUBLISHED]);
  });

  it('counts pay-enabled tiers from vendor_tiers', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ total: 6 }] });
    const repo = new DashboardMetricsRepository({ query });

    await expect(repo.countPayEnabledTiers()).resolves.toBe(6);

    const [sql] = query.mock.calls[0];
    expect(sql).toContain('vendor_tiers');
    expect(sql).toContain('warmpawz_pay_enabled');
  });

  it('returns zero for empty catalogue and tier counts', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repo = new DashboardMetricsRepository({ query });

    await expect(repo.countDraftUnpublished()).resolves.toBe(0);
    await expect(repo.countPayEnabledTiers()).resolves.toBe(0);
  });

  it('reads burn mode from convenience settings', async () => {
    const repo = new DashboardMetricsRepository(
      { query: jest.fn() },
      { getConvenienceSettings: jest.fn().mockResolvedValue({ burnMode: true }) },
    );

    await expect(repo.getBurnMode()).resolves.toBe(true);
  });

  it('delegates money totals to the payments aggregate helper', async () => {
    const totals = {
      payBillOrders: 2,
      customerPaid: 10,
      customerSaved: 1,
      platformRevenue: 3,
    };
    const paymentTotals = jest.fn().mockResolvedValue(totals);
    const db = { query: jest.fn() };
    const repo = new DashboardMetricsRepository(db, undefined, paymentTotals);

    await expect(repo.getPayBillMoneyTotals()).resolves.toEqual(totals);
    expect(paymentTotals).toHaveBeenCalledWith(db);
  });
});
