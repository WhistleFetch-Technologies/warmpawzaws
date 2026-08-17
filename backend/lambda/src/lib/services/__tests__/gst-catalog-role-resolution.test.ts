import { describe, expect, test, jest, beforeEach } from '@jest/globals';

jest.mock('../../../database/rds-connection', () => ({
  query: jest.fn(),
}));

import { query } from '../../../database/rds-connection';
import {
  resolveGstRateForCatalogAndRole,
  missingServiceGstConfigError,
} from '../gst-catalog-role-resolution';

const mockedQuery = query as jest.MockedFunction<typeof query>;

const GROOMING_CAT = 'cat-grooming';
const SOLO_ROLE = 'role-groomer-solo';
const CENTER_ROLE = 'role-groomer-center';

function taxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tc-grooming-solo',
    catalog_category_id: GROOMING_CAT,
    default_gst_rate: 18,
    tax_rate: 0,
    is_active: true,
    gst_application_scope: 'service_booking',
    jcnt: 1,
    ...overrides,
  };
}

describe('resolveGstRateForCatalogAndRole', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  test('Grooming + Groomer (Solo) uses Admin default GST 18%', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [taxRow()] } as never)
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);

    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, SOLO_ROLE);
    expect(resolved.found).toBe(true);
    expect(resolved.rate).toBe(18);
    expect(resolved.taxCategoryId).toBe('tc-grooming-solo');
  });

  test('same category + different role can resolve a different Admin rate', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [taxRow({ id: 'tc-center', default_gst_rate: 12 })],
      } as never)
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);

    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, CENTER_ROLE);
    expect(resolved.found).toBe(true);
    expect(resolved.rate).toBe(12);
  });

  test('does not silently default to 18% when category exists but role does not match', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [taxRow({ jcnt: 1 })] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, 'role-unconfigured');
    expect(resolved.found).toBe(false);
    expect(resolved.rate).toBe(0);
    expect(resolved.reason).toMatch(/not for the vendor role/i);
  });

  test('does not silently default to 18% when no Admin tax category exists', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never);
    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, SOLO_ROLE);
    expect(resolved.found).toBe(false);
    expect(resolved.rate).toBe(0);
  });

  test('wildcard tax category (no roles) is used when Admin did not pin roles', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [taxRow({ id: 'tc-wild', jcnt: 0, default_gst_rate: 5 })],
    } as never);
    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, SOLO_ROLE);
    expect(resolved.found).toBe(true);
    expect(resolved.rate).toBe(5);
  });

  test('explicit 0% Admin rate is found and is not treated as missing', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [taxRow({ default_gst_rate: 0, tax_rate: 0 })],
      } as never)
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);
    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, SOLO_ROLE);
    expect(resolved.found).toBe(true);
    expect(resolved.rate).toBe(0);
  });

  test('prefers default_gst_rate when tax_rate is the schema default 0', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [taxRow({ tax_rate: 0, default_gst_rate: 18 })],
      } as never)
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);
    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, SOLO_ROLE);
    expect(resolved.rate).toBe(18);
  });

  test('missingServiceGstConfigError names category and role', () => {
    const err = missingServiceGstConfigError({
      catalogCategoryId: GROOMING_CAT,
      vendorRoleId: SOLO_ROLE,
    });
    expect(err.code).toBe('GST_CONFIGURATION_MISSING');
    expect(err.message).toContain(GROOMING_CAT);
    expect(err.message).toContain(SOLO_ROLE);
    expect(err.message).not.toMatch(/18%/);
  });
});
