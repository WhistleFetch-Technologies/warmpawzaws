import { dbListWapptDiscoveryByCategory } from '../discovery_by_category_get.repo';

jest.mock('../../../../../database/rds-connection', () => ({
  query: jest.fn(),
}));

jest.mock('../../../discovery/repos/legacy-helpers.repo', () => ({
  resolveSpecializationDiscoveryKeys: jest.fn(),
  specializationDiscoveryIlikePatterns: jest.fn((keys: string[]) =>
    keys.map((k) => `%${k}%`),
  ),
  sqlVendorMatchesDeclaredSpecialization: jest.fn((paramBase: number) =>
    `AND (vendor_specializations filter $${paramBase})`,
  ),
}));

const { query } = jest.requireMock('../../../../../database/rds-connection') as {
  query: jest.Mock;
};

const {
  resolveSpecializationDiscoveryKeys,
  sqlVendorMatchesDeclaredSpecialization,
} = jest.requireMock('../../../discovery/repos/legacy-helpers.repo') as {
  resolveSpecializationDiscoveryKeys: jest.Mock;
  sqlVendorMatchesDeclaredSpecialization: jest.Mock;
};

describe('dbListWapptDiscoveryByCategory specialization filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
    (resolveSpecializationDiscoveryKeys as jest.Mock).mockResolvedValue(['vaccination']);
  });

  it('appends declared-specialization SQL when specialization resolves to keys', async () => {
    const result = await dbListWapptDiscoveryByCategory({
      category: 'vet',
      serviceStyle: 'at_center',
      specialization: 'vaccination',
      limit: 3,
      offset: 0,
    });

    expect(resolveSpecializationDiscoveryKeys).toHaveBeenCalledWith('vaccination');
    expect(sqlVendorMatchesDeclaredSpecialization).toHaveBeenCalled();
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain('vendor_specializations filter');
    expect(params).toEqual(
      expect.arrayContaining([['vaccination'], expect.arrayContaining(['%vaccination%'])]),
    );
    expect(result.specializationApplied).toBe('vaccination');
  });

  it('skips specialization filter when keys resolve empty', async () => {
    (resolveSpecializationDiscoveryKeys as jest.Mock).mockResolvedValue([]);

    const result = await dbListWapptDiscoveryByCategory({
      category: 'vet',
      serviceStyle: 'at_home',
      specialization: 'unknown_tile',
      limit: 3,
      offset: 0,
    });

    expect(sqlVendorMatchesDeclaredSpecialization).not.toHaveBeenCalled();
    expect(result.specializationApplied).toBeNull();
  });
});
