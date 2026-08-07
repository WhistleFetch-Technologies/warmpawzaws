/** @jest-environment node */

jest.mock('../../../../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
}));

jest.mock('../../../../../utils/schema-probes', () => ({
  columnExists: jest.fn(async (table: string, column: string) => {
    return table === 'vendors' && column === 'service_distance_km';
  }),
}));

import { columnExists } from '../../../../../utils/schema-probes';
import { vendorDistanceSelectColumnsSql } from '../legacy-helpers.repo';

describe('legacy-helpers vendorDistanceSelectColumnsSql', () => {
  it('uses local columnExists binding from schema-probes import', async () => {
    const sql = await vendorDistanceSelectColumnsSql('v');

    expect(columnExists).toHaveBeenCalledWith('vendors', 'service_distance_km');
    expect(sql).toBe('v.service_radius, v.service_distance_km');
  });

  it('falls back to NULL when service_distance_km column is absent', async () => {
    (columnExists as jest.Mock).mockResolvedValueOnce(false);

    const sql = await vendorDistanceSelectColumnsSql('v2');

    expect(sql).toBe('v2.service_radius, NULL::numeric AS service_distance_km');
  });
});
