/** @jest-environment node */

const informationSchemaCalls: string[] = [];
let totalQueryCalls = 0;

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(async (sql: string, params?: unknown[]) => {
    totalQueryCalls += 1;
    if (sql.includes('information_schema.columns')) {
      const table = String(params?.[0] ?? '');
      const column = String(params?.[1] ?? '');
      informationSchemaCalls.push(`${table}.${column}`);
      return {
        rows: [{ exists: table === 'vendor_services' && column === 'category_id' }],
      };
    }
    if (sql.includes('service_categories')) {
      return { rows: [{ id: '00000000-0000-4000-8000-000000000001' }] };
    }
    return { rows: [] };
  }),
  select: jest.fn(async () => []),
  insert: jest.fn(async () => ({ rows: [] })),
}));

import { columnExists } from '../schema-probes';
import { buildDiscoveryVendorExistsSql } from '../../lib/discovery-vendor-query';

describe('schema-probes columnExists dedup (Phase 0.5A)', () => {
  beforeEach(() => {
    informationSchemaCalls.length = 0;
    totalQueryCalls = 0;
  });

  it('discover-services flow hits information_schema once for vendor_services.category_id', async () => {
    await columnExists('vendor_services', 'category_id');
    await buildDiscoveryVendorExistsSql({
      category: 'boarding',
      roleId: 'pet_boarding',
      serviceStyle: 'at_center',
      paramOffset: 1,
    });

    const vsCategoryIdProbes = informationSchemaCalls.filter(
      (k) => k === 'vendor_services.category_id'
    );
    expect(vsCategoryIdProbes).toHaveLength(1);
  });
});
