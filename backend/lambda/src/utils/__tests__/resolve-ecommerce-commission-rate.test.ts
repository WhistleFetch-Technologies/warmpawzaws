import { query } from '../../database/rds-connection';
import {
  resolveProductCommission,
  resolveOrderCommission,
} from '../resolve-ecommerce-commission-rate';
import { CommissionConfigurationError } from '../commission-configuration-error';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('resolveProductCommission V2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses vendor category rate in category model', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('vendor_commission_config')) {
        return { rows: [{ commission_model: 'category', default_commission_rate: null }] } as any;
      }
      if (String(sql).includes('vendor_category_commission_rates')) {
        return { rows: [{ commission_rate: '8' }] } as any;
      }
      return { rows: [] } as any;
    });

    const result = await resolveProductCommission({
      vendorId: 'vendor-1',
      productId: 'prod-1',
      categoryId: 'cat-1',
    });

    expect(result.rate).toBe(8);
    expect(result.source).toBe('vendor_category');
  });

  it('does not use category matrix in ownership model', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('vendor_commission_config')) {
        return {
          rows: [
            {
              commission_model: 'ownership',
              default_commission_rate: null,
              own_brand_commission_rate: '7',
              third_party_commission_rate: '12',
            },
          ],
        } as any;
      }
      if (String(sql).includes('vendor_category_commission_rates')) {
        return { rows: [{ commission_rate: '99' }] } as any;
      }
      if (String(sql).includes('listing_ownership')) {
        return { rows: [{ listing_ownership: 'own_brand' }] } as any;
      }
      return { rows: [] } as any;
    });

    const result = await resolveProductCommission({
      vendorId: 'vendor-1',
      productId: 'prod-1',
      categoryId: 'cat-1',
    });

    expect(result.rate).toBe(7);
    expect(result.source).toBe('vendor_own_brand');
  });

  it('throws when commission model missing', async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }) as any);

    await expect(
      resolveProductCommission({ vendorId: 'vendor-1', categoryId: 'cat-1' })
    ).rejects.toBeInstanceOf(CommissionConfigurationError);
  });

  it('falls through to category default', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('vendor_commission_config')) {
        return { rows: [{ commission_model: 'category', default_commission_rate: null }] } as any;
      }
      if (String(sql).includes('vendor_category_commission_rates')) return { rows: [] } as any;
      if (String(sql).includes('ecommerce_categories')) {
        return { rows: [{ default_commission_rate: '14' }] } as any;
      }
      return { rows: [] } as any;
    });

    const result = await resolveProductCommission({
      vendorId: 'vendor-1',
      categoryId: 'cat-1',
    });

    expect(result.rate).toBe(14);
    expect(result.source).toBe('category_default');
  });

  it('falls through to configured platform default', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('vendor_commission_config')) {
        return { rows: [{ commission_model: 'category', default_commission_rate: null }] } as any;
      }
      if (String(sql).includes('vendor_category_commission_rates')) return { rows: [] } as any;
      if (String(sql).includes('ecommerce_categories')) return { rows: [] } as any;
      if (String(sql).includes('ecommerce_commission_settings')) {
        return { rows: [{ default_rate: '15' }] } as any;
      }
      return { rows: [] } as any;
    });

    const result = await resolveProductCommission({
      vendorId: 'vendor-1',
      categoryId: 'cat-1',
    });

    expect(result.rate).toBe(15);
    expect(result.source).toBe('platform_default');
  });

  it('uses platform default when vendor config is missing', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('ecommerce_categories')) return { rows: [] } as any;
      if (String(sql).includes('ecommerce_commission_settings')) {
        return { rows: [{ default_rate: '13' }] } as any;
      }
      return { rows: [] } as any;
    });

    const result = await resolveProductCommission({
      vendorId: 'vendor-1',
      categoryId: 'cat-1',
    });

    expect(result.rate).toBe(13);
    expect(result.source).toBe('platform_default');
  });
});

describe('resolveOrderCommission', () => {
  beforeEach(() => jest.clearAllMocks());

  it('computes weighted commission across lines', async () => {
    let categoryCall = 0;
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('vendor_commission_config')) {
        return { rows: [{ commission_model: 'category', default_commission_rate: null }] } as any;
      }
      if (String(sql).includes('vendor_category_commission_rates')) return { rows: [] } as any;
      if (String(sql).includes('ecommerce_categories')) {
        categoryCall += 1;
        return {
          rows: [{ default_commission_rate: categoryCall === 1 ? '10' : '20' }],
        } as any;
      }
      return { rows: [] } as any;
    });

    const result = await resolveOrderCommission('vendor-1', [
      { lineSubtotal: 1000, productId: 'p1', categoryId: 'cat-a' },
      { lineSubtotal: 500, productId: 'p2', categoryId: 'cat-b' },
    ]);

    expect(result.commissionAmount).toBe(200);
    expect(result.effectiveRate).toBe(13.33);
    expect(result.lineBreakdown).toHaveLength(2);
  });
});
