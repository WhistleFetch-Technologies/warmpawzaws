import {
  resolveBulkUploadGroupKey,
  findExistingProductByWarmpawzId,
  findValidWarmpawzProductIdsForVendor,
} from '../product-group-identity';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
}));

import { query } from '../../database/rds-connection';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('product-group-identity (bulk upload)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('resolveBulkUploadGroupKey prefers Warmpawz Product ID', () => {
    expect(
      resolveBulkUploadGroupKey({
        warmpawz_product_id: 'abc-123',
        product_group_id: 'grp-1',
        rowNum: 5,
      }),
    ).toBe('wpid::abc-123');
  });

  it('resolveBulkUploadGroupKey uses upload-scoped Product Group ID when no Warmpawz ID', () => {
    expect(
      resolveBulkUploadGroupKey({
        product_group_id: 'grp-1',
        rowNum: 5,
      }),
    ).toBe('pgid::grp-1');
  });

  it('resolveBulkUploadGroupKey falls back to row number for single-row products', () => {
    expect(resolveBulkUploadGroupKey({ rowNum: 7 })).toBe('row::7');
  });

  it('findExistingProductByWarmpawzId queries vendor_id + products.id', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'prod-1', sku: 'WP-1', category_id: 'cat-1', metadata: {}, images: [] }],
    } as any);

    const found = await findExistingProductByWarmpawzId('vendor-1', 'prod-1');
    expect(found?.id).toBe('prod-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE vendor_id = $1 AND id = $2'),
      ['vendor-1', 'prod-1'],
    );
  });

  it('findValidWarmpawzProductIdsForVendor returns ids owned by vendor', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'prod-a' }, { id: 'prod-b' }],
    } as any);

    const valid = await findValidWarmpawzProductIdsForVendor('vendor-1', [
      'prod-a',
      'prod-c',
      'prod-b',
    ]);
    expect(valid).toEqual(new Set(['prod-a', 'prod-b']));
  });
});
