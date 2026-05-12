import { normalizeProductsTableRowForPg } from '../rds-connection';

describe('normalizeProductsTableRowForPg (migration 013: stock_quantity → stock)', () => {
  it('maps legacy stock_quantity to stock and removes stock_quantity', () => {
    const row = { name: 'x', stock_quantity: 12 };
    const out = normalizeProductsTableRowForPg(row) as Record<string, unknown>;
    expect(out.stock).toBe(12);
    expect('stock_quantity' in out).toBe(false);
    expect(row.stock_quantity).toBe(12);
  });

  it('keeps stock when both stock and stock_quantity are set', () => {
    const out = normalizeProductsTableRowForPg({ stock: 3, stock_quantity: 99 }) as Record<string, unknown>;
    expect(out.stock).toBe(3);
    expect('stock_quantity' in out).toBe(false);
  });

  it('treats stock 0 as usable (does not overwrite from stock_quantity)', () => {
    const out = normalizeProductsTableRowForPg({ stock: 0, stock_quantity: 10 }) as Record<string, unknown>;
    expect(out.stock).toBe(0);
    expect('stock_quantity' in out).toBe(false);
  });
});
