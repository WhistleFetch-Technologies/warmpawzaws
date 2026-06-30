import { resolveSearchEntityIds, hasFtsEntityIds } from '../sql-search-fts';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
}));

import { query } from '../../database/rds-connection';

const mockQuery = query as jest.Mock;

describe('resolveSearchEntityIds', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns empty sets for blank tokens', async () => {
    const result = await resolveSearchEntityIds([]);
    expect(result).toEqual({ vendorIds: [], serviceIds: [], productIds: [] });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('partitions entity types from search_index FTS query', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { entity_type: 'vendor', entity_id: 'v-1' },
        { entity_type: 'service', entity_id: 's-1' },
        { entity_type: 'product', entity_id: 'p-1' },
      ],
    });

    const result = await resolveSearchEntityIds(['dog', 'grooming']);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('search_index'),
      ['dog grooming']
    );
    expect(result.vendorIds).toEqual(['v-1']);
    expect(result.serviceIds).toEqual(['s-1']);
    expect(result.productIds).toEqual(['p-1']);
    expect(hasFtsEntityIds(result)).toBe(true);
  });

  it('returns empty sets when query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    const result = await resolveSearchEntityIds(['vet']);
    expect(result).toEqual({ vendorIds: [], serviceIds: [], productIds: [] });
    expect(hasFtsEntityIds(result)).toBe(false);
  });
});
