import { dbWpayAdminPaymentsDashboardTotals } from '../wpay-payments-admin.repository';

describe('dbWpayAdminPaymentsDashboardTotals', () => {
  it('sums completed Pay Bill amounts using the shared success filter', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          pay_bill_orders: 7,
          customer_paid: '1234.5',
          customer_saved: '80.25',
          platform_revenue: '40.1',
        },
      ],
    });

    await expect(dbWpayAdminPaymentsDashboardTotals({ query })).resolves.toEqual({
      payBillOrders: 7,
      customerPaid: 1234.5,
      customerSaved: 80.25,
      platformRevenue: 40.1,
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql] = query.mock.calls[0];
    expect(sql).toContain("payment_source = 'warmpawz_pay'");
    expect(sql).toContain("payment_status = 'completed'");
    expect(sql).toContain('completed_at IS NOT NULL');
    expect(sql).toContain('SUM(p.amount)');
    expect(sql).toContain('SUM(p.discount_amount)');
    expect(sql).toContain("settlement_breakup->>'wpayRevenueAmount'");
    expect(sql).not.toContain('pending');
    expect(sql).not.toContain('failed');
    expect(query.mock.calls[0][1]).toEqual([]);
  });

  it('applies the shared IST month filter on completed_at', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ pay_bill_orders: 2, customer_paid: '10', customer_saved: '1', platform_revenue: '2' }],
    });

    await dbWpayAdminPaymentsDashboardTotals(
      { query },
      { mode: 'month', year: 2026, month: 8 },
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("payment_source = 'warmpawz_pay'");
    expect(sql).toContain('completed_at');
    expect(sql).toContain("AT TIME ZONE 'Asia/Kolkata'");
    expect(params).toEqual(['2026-08-01', '2026-09-01']);
  });

  it('returns zeros when no completed payments exist', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });

    await expect(dbWpayAdminPaymentsDashboardTotals({ query })).resolves.toEqual({
      payBillOrders: 0,
      customerPaid: 0,
      customerSaved: 0,
      platformRevenue: 0,
    });
  });
});
