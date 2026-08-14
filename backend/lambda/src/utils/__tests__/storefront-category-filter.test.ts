import { buildStorefrontCategoryFilter } from '../storefront-category-filter';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
}));

import { query } from '../../database/rds-connection';

const mockedQuery = query as jest.MockedFunction<typeof query>;

describe('buildStorefrontCategoryFilter', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('filters subcategory via product_category_links when table exists', async () => {
    const childId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const parentId = '11111111-2222-3333-4444-555555555555';

    mockedQuery
      .mockResolvedValueOnce({
        rows: [{ id: childId, name: 'Dry Pet Food', parent_category_id: parentId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as never)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as never);

    const filter = await buildStorefrontCategoryFilter(childId, 1);
    expect(filter).not.toBeNull();
    expect(filter!.clause).toContain('product_category_links');
    expect(filter!.params).toEqual([childId]);
  });

  it('filters parent with category_id and children rollup', async () => {
    const parentId = '11111111-2222-3333-4444-555555555555';

    mockedQuery
      .mockResolvedValueOnce({
        rows: [{ id: parentId, name: 'Pet Food', parent_category_id: null }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as never)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as never);

    const filter = await buildStorefrontCategoryFilter(parentId, 1);
    expect(filter).not.toBeNull();
    expect(filter!.clause).toContain('parent_category_id');
    expect(filter!.params).toEqual([parentId]);
  });
});
