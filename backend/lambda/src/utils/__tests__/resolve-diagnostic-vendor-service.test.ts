/**
 * Unit tests for diagnostic vendor_services resolution (no first-VS fallback).
 */

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
}));

import { query } from '../../database/rds-connection';
import {
  findDiagnosticVendorServiceId,
  isGenericDiagnosticsServiceId,
  resolveOrEnsureDiagnosticVendorService,
} from '../resolve-diagnostic-vendor-service';

const mockedQuery = query as jest.MockedFunction<typeof query>;

describe('resolve-diagnostic-vendor-service', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  test('isGenericDiagnosticsServiceId detects legacy literals', () => {
    expect(isGenericDiagnosticsServiceId('diagnostics')).toBe(true);
    expect(isGenericDiagnosticsServiceId('diagnostic')).toBe(true);
    expect(isGenericDiagnosticsServiceId('a1b2c3d4-e5f6-4789-a012-345678901234')).toBe(false);
  });

  test('findDiagnosticVendorServiceId returns diagnostic VS and never invents first-VS', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          vs_id: 'vs-diag-1',
          catalog_service_id: 'sc-diag-1',
          vs_category: 'diagnostic',
          sc_category_id: 'lab-diagnostics',
        },
      ],
    } as never);

    const found = await findDiagnosticVendorServiceId('vendor-1');
    expect(found).toEqual({
      vendorServiceId: 'vs-diag-1',
      catalogServiceId: 'sc-diag-1',
    });
    const sql = String(mockedQuery.mock.calls[0][0]);
    expect(sql).toMatch(/lab-diagnostics|diagnostic/);
    expect(sql).not.toMatch(/ORDER BY created_at ASC LIMIT 1/);
  });

  test('resolveOrEnsure does not select an unrelated first vendor service', async () => {
    // find returns empty
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never);
    // has diagnostic_tests
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'test-1', price: 500 }],
    } as never);
    // catalog category id
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'cat-diagnostic-uuid', category_id: 'diagnostic' }],
    } as never);
    // services upsert
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never);
    // vendor_services insert
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never);
    // find after ensure
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          vs_id: 'vs-lab-created',
          catalog_service_id: 'a1b2c3d4-e5f6-4789-a012-345678901234',
          vs_category: 'diagnostic',
          sc_category_id: 'diagnostic',
        },
      ],
    } as never);

    const resolved = await resolveOrEnsureDiagnosticVendorService('vendor-vet');
    expect(resolved?.vendorServiceId).toBe('vs-lab-created');
    // Never queried "all vendor_services ORDER BY created_at ASC"
    for (const call of mockedQuery.mock.calls) {
      const sql = String(call[0]);
      expect(sql).not.toMatch(/ORDER BY created_at ASC LIMIT 1/);
    }
  });

  test('resolveOrEnsure returns null when vendor has no diagnostic tests', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never); // find
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never); // diagnostic_tests
    const resolved = await resolveOrEnsureDiagnosticVendorService('vendor-empty');
    expect(resolved).toBeNull();
  });
});
