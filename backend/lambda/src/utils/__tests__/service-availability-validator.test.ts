import { validateServiceAvailability } from '../service-availability-validator';
import { query, select } from '../../database/rds-connection';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedSelect = select as jest.MockedFunction<typeof select>;

describe('validateServiceAvailability vendor scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows booking when target vendor service is enabled even if another vendor has disabled row for same service_id', async () => {
    mockedQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM vendor_services WHERE id = $1::uuid AND vendor_id = $2::uuid')) {
        return { rows: [] } as any;
      }
      if (sql.includes('FROM vendor_services WHERE service_id = $1::uuid AND vendor_id = $2::uuid')) {
        if (params?.[1] === 'vendor-enabled-0000-4000-8000-000000000001') {
          return {
            rows: [{ id: 'vs-enabled', service_id: params?.[0], vendor_id: params?.[1], is_enabled: true }],
          } as any;
        }
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    mockedSelect.mockImplementation(async (table: string) => {
      if (table === 'services') return [] as any;
      if (table === 'platform_settings') return [] as any;
      if (table === 'roles') return [] as any;
      return [] as any;
    });

    const result = await validateServiceAvailability(
      'service-0000-4000-8000-000000000001',
      'role-0000-4000-8000-000000000001',
      'vendor-enabled-0000-4000-8000-000000000001',
      'customer-0000-4000-8000-000000000001'
    );

    expect(result.available).toBe(true);
    expect(result.code).toBeUndefined();
  });

  it('returns SERVICE_DISABLED when target vendor service is disabled', async () => {
    mockedQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM vendor_services WHERE id = $1::uuid AND vendor_id = $2::uuid')) {
        return { rows: [] } as any;
      }
      if (sql.includes('FROM vendor_services WHERE service_id = $1::uuid AND vendor_id = $2::uuid')) {
        if (params?.[1] === 'vendor-disabled-0000-4000-8000-000000000002') {
          return {
            rows: [{ id: 'vs-disabled', service_id: params?.[0], vendor_id: params?.[1], is_enabled: false }],
          } as any;
        }
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    mockedSelect.mockImplementation(async (table: string) => {
      if (table === 'services') return [] as any;
      if (table === 'platform_settings') return [] as any;
      if (table === 'roles') return [] as any;
      return [] as any;
    });

    const result = await validateServiceAvailability(
      'service-0000-4000-8000-000000000002',
      'role-0000-4000-8000-000000000002',
      'vendor-disabled-0000-4000-8000-000000000002',
      'customer-0000-4000-8000-000000000002'
    );

    expect(result.available).toBe(false);
    expect(result.code).toBe('SERVICE_DISABLED');
    expect(result.reason).toBe('Service is currently disabled');
  });
});
