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
