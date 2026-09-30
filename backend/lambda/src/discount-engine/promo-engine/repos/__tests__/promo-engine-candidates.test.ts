import { dbFindActiveCandidates } from '../promo-engine.repo';

jest.mock('../../../../database/rds-connection', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
}));

import { query } from '../../../../database/rds-connection';

const mockedQuery = query as jest.MockedFunction<typeof query>;

describe('dbFindActiveCandidates', () => {
  it('matches VET checkout token to veterinary aliases', async () => {
    await dbFindActiveCandidates({ now: new Date('2026-09-18T12:00:00Z'), serviceCategory: 'VET' });
    const params = mockedQuery.mock.calls[0]?.[1] as unknown[];
    expect(params[1]).toEqual(expect.arrayContaining(['veterinary', 'vet', 'VET']));
    expect(params[2]).toBeNull();
    expect(params[3]).toBeNull();
  });

  it('matches VCF publish lists by containment as well as the singular id', async () => {
    mockedQuery.mockClear();
    await dbFindActiveCandidates({
      now: new Date('2026-09-18T12:00:00Z'),
      vendorId: 'vendor-1',
      categoryId: 'cat-train',
    });
    const [sql, params] = mockedQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(`metadata->'vcf'->'publish'->>'vendorId' = $2::text`);
    expect(sql).toContain(
      `COALESCE(metadata->'vcf'->'publish'->'vendorIds', '[]'::jsonb)\n                 @> jsonb_build_array($2::text)`
    );
    expect(sql).toContain(`metadata->'vcf'->'publish'->>'categoryId' = $3::text`);
    expect(sql).toContain(`@> jsonb_build_array($3::text)`);
    expect(params).toEqual([expect.any(String), 'vendor-1', 'cat-train']);
  });
});
