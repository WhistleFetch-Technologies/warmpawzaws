import {
  buildAdminEcommerceOrderFilterSql,
  normalizeAdminOrderStatusCounts,
  resolveAdminOrderPeriodDays,
  formatAdminOrderDeliveryAddress,
  enrichAdminEcommerceOrderDetail,
} from '../admin-ecommerce-orders-sql';

describe('admin-ecommerce-orders-sql', () => {
  it('resolves period days', () => {
    expect(resolveAdminOrderPeriodDays('7d')).toBe(7);
    expect(resolveAdminOrderPeriodDays('30d')).toBe(30);
    expect(resolveAdminOrderPeriodDays('90d')).toBe(90);
    expect(resolveAdminOrderPeriodDays('all')).toBeNull();
    expect(resolveAdminOrderPeriodDays(null)).toBeNull();
  });

  it('builds status and search filters with parameterized search', () => {
    const parts = buildAdminEcommerceOrderFilterSql({
      status: 'confirmed',
      period: '30d',
      search: 'abc',
    });

    expect(parts.whereClauses.join(' ')).toContain('COALESCE(o.order_status, o.status)');
    expect(parts.whereClauses.join(' ')).toContain('ILIKE');
    expect(parts.params).toEqual(['confirmed', '%abc%']);
  });

  it('normalizes status counts with all total', () => {
    const counts = normalizeAdminOrderStatusCounts([
      { status: 'confirmed', count: 2 },
      { status: 'delivered', count: 3 },
    ]);
    expect(counts.all).toBe(5);
    expect(counts.confirmed).toBe(2);
    expect(counts.delivered).toBe(3);
  });

  it('formats delivery address and enriches detail fields', () => {
    const address = formatAdminOrderDeliveryAddress({
      shipping_address: '12 Main St',
      shipping_city: 'Mumbai',
      shipping_state: 'MH',
      shipping_pincode: '400001',
    });
    expect(address).toContain('12 Main St');
    expect(address).toContain('Mumbai');

    const enriched = enrichAdminEcommerceOrderDetail({
      order_status: 'shipped',
      shipping_amount: 49,
      shipping_address: '12 Main St',
      shipment_tracking_number: 'AWB123',
      shipment_carrier_name: 'Delhivery',
    });
    expect(enriched.shipping_fee).toBe(49);
    expect(enriched.tracking_number).toBe('AWB123');
    expect(enriched.carrier).toBe('Delhivery');
  });
});
