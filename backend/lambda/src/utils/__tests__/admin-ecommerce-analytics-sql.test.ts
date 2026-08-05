import {
  calcPeriodGrowthPercent,
  clampAnalyticsDays,
  buildDailyRevenueSql,
  buildPeriodTotalsSql,
  buildProductStatsSql,
  buildSellersWithOrdersSql,
  stripAllStatusKey,
} from '../admin-ecommerce-analytics-sql';
import { buildAdminEcommerceOrderStatusCountsSqlForDays } from '../admin-ecommerce-orders-sql';

describe('admin-ecommerce-analytics-sql', () => {
  it('calculates period growth percent', () => {
    expect(calcPeriodGrowthPercent(150, 100)).toBe(50);
    expect(calcPeriodGrowthPercent(50, 100)).toBe(-50);
    expect(calcPeriodGrowthPercent(0, 0)).toBe(0);
    expect(calcPeriodGrowthPercent(10, 0)).toBe(100);
  });

  it('clamps analytics days', () => {
    expect(clampAnalyticsDays('30')).toBe(30);
    expect(clampAnalyticsDays('0')).toBe(30);
    expect(clampAnalyticsDays('999')).toBe(365);
    expect(clampAnalyticsDays(null)).toBe(30);
  });

  it('builds daily revenue SQL scoped to shop orders', () => {
    const { sql } = buildDailyRevenueSql();
    expect(sql).toContain("order_type");
    expect(sql).toContain('gmv');
    expect(sql).toContain('delivered_revenue');
    expect(sql).toContain('created_at >= $1');
  });

  it('builds period totals SQL for current and previous windows', () => {
    const { sql } = buildPeriodTotalsSql();
    expect(sql).toContain('current_gmv');
    expect(sql).toContain('previous_gmv');
    expect(sql).toContain('created_at >= $1');
    expect(sql).toContain('created_at >= $2');
  });

  it('builds product stats SQL with low stock threshold param', () => {
    const { sql, params } = buildProductStatsSql(10);
    expect(sql).toContain('low_stock');
    expect(params).toEqual([10]);
  });

  it('builds sellers-with-orders SQL for a bounded period', () => {
    const { sql } = buildSellersWithOrdersSql();
    expect(sql).toContain('COUNT(DISTINCT o.vendor_id)');
    expect(sql).toContain('created_at >= $1');
    expect(sql).toContain('created_at < $2');
  });

  it('strips all status key for chart payloads', () => {
    expect(stripAllStatusKey({ all: 5, confirmed: 2, delivered: 3 })).toEqual({
      confirmed: 2,
      delivered: 3,
    });
  });
});

describe('buildAdminEcommerceOrderStatusCountsSqlForDays', () => {
  it('builds status counts for arbitrary day windows', () => {
    const { sql } = buildAdminEcommerceOrderStatusCountsSqlForDays(45);
    expect(sql).toContain("INTERVAL '45 days'");
    expect(sql).toContain('order_status');
  });

  it('falls back to 30 days for invalid input', () => {
    const { sql } = buildAdminEcommerceOrderStatusCountsSqlForDays(0);
    expect(sql).toContain("INTERVAL '30 days'");
  });
});
