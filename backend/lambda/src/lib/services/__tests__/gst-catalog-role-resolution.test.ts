import { describe, expect, test, jest, beforeEach } from '@jest/globals';

jest.mock('../../../database/rds-connection', () => ({
  query: jest.fn(),
}));

import { query } from '../../../database/rds-connection';
import {
  resolveGstRateForCatalogAndRole,
  missingServiceGstConfigError,
} from '../gst-catalog-role-resolution';
import { aliasGstCatalogCategoryRef } from '../../../utils/resolve-service-booking-tax-item';

const mockedQuery = query as jest.MockedFunction<typeof query>;

const GROOMING_CAT = '4fbdc899-e4da-4219-952f-6d038a48981d';
const DIAGNOSTIC_CAT = 'cat-diagnostic';
const TRAINING_CAT = 'cat-training';
const PHYSIO_CAT = 'cat-physio';
const SOLO_ROLE = 'role-groomer-solo';
const CENTER_ROLE = 'role-groomer-center';
const VET_CLINIC_ROLE = 'e0473f0e-bc76-47fc-8378-3f0295fe6447';
const WALKER_ROLE = 'role-walker';

function taxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tc-grooming',
    catalog_category_id: GROOMING_CAT,
    default_gst_rate: 18,
    tax_rate: 18,
    is_active: true,
    gst_application_scope: 'service_booking',
    jcnt: 2,
    ...overrides,
  };
}

describe('resolveGstRateForCatalogAndRole — category-authoritative', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  test('TEST 1 — grooming + vet_clinic uses Grooming 18% without a role mapping', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [taxRow()] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, VET_CLINIC_ROLE);
    expect(resolved.found).toBe(true);
    expect(resolved.rate).toBe(18);
    expect(resolved.taxCategoryId).toBe('tc-grooming');
    expect(resolved.reason).toBeUndefined();
  });

  test('TEST 2 — grooming + groomer_solo still resolves 18%', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [taxRow()] } as never)
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);

    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, SOLO_ROLE);
    expect(resolved.found).toBe(true);
    expect(resolved.rate).toBe(18);
  });

  test('TEST 3 — grooming + unlisted role still resolves 18%', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [taxRow()] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, WALKER_ROLE);
    expect(resolved.found).toBe(true);
    expect(resolved.rate).toBe(18);
  });

  test('TEST 4 — no tax card fails closed without inventing 18%', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never);
    const resolved = await resolveGstRateForCatalogAndRole(PHYSIO_CAT, SOLO_ROLE);
    expect(resolved.found).toBe(false);
    expect(resolved.rate).toBe(0);
    expect(resolved.reason).toMatch(/No active Admin tax category/i);
  });

  test('TEST 6 — diagnostic card rate applies regardless of role', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [taxRow({ id: 'tc-diag', catalog_category_id: DIAGNOSTIC_CAT, tax_rate: 18, jcnt: 1 })],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const resolved = await resolveGstRateForCatalogAndRole(DIAGNOSTIC_CAT, VET_CLINIC_ROLE);
    expect(resolved.found).toBe(true);
    expect(resolved.rate).toBe(18);
  });

  test('TEST 7 — behavioral alias targets training (current config)', () => {
    expect(aliasGstCatalogCategoryRef('behavioral')).toBe('training');
    expect(aliasGstCatalogCategoryRef('behavioural')).toBe('training');
  });

  test('TEST 7b — training tax card resolves after behavioral alias', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [taxRow({ id: 'tc-training', catalog_category_id: TRAINING_CAT, tax_rate: 18, jcnt: 4 })],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const resolved = await resolveGstRateForCatalogAndRole(TRAINING_CAT, 'role-behaviorist-solo');
    expect(resolved.found).toBe(true);
    expect(resolved.rate).toBe(18);
  });

  test('TEST 8 — package uses the same category resolver (grooming + vet_clinic)', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [taxRow()] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, VET_CLINIC_ROLE);
    expect(resolved.found).toBe(true);
    expect(resolved.rate).toBe(18);
  });

  test('wildcard tax category (no roles) is used as the category default', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [taxRow({ id: 'tc-wild', jcnt: 0, default_gst_rate: 5, tax_rate: 5 })],
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
      .mockResolvedValueOnce({ rows: [] } as never);
    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, VET_CLINIC_ROLE);
    expect(resolved.found).toBe(true);
    expect(resolved.rate).toBe(0);
  });

  test('when several cards exist, a matching role is preferred but not required', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          taxRow({ id: 'tc-a', tax_rate: 18, jcnt: 1 }),
          taxRow({ id: 'tc-b', tax_rate: 12, default_gst_rate: 12, jcnt: 1 }),
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);

    const resolved = await resolveGstRateForCatalogAndRole(GROOMING_CAT, CENTER_ROLE);
    expect(resolved.found).toBe(true);
    expect(resolved.taxCategoryId).toBe('tc-b');
    expect(resolved.rate).toBe(12);
  });

  test('missingServiceGstConfigError names the catalogue category, not a silent 18%', () => {
    const err = missingServiceGstConfigError({
      catalogCategoryId: GROOMING_CAT,
      vendorRoleId: SOLO_ROLE,
    });
    expect(err.code).toBe('GST_CONFIGURATION_MISSING');
    expect(err.message).toContain(GROOMING_CAT);
    expect(err.message).not.toMatch(/18%/);
    expect(err.message).not.toMatch(/applicable role/i);
    expect(err.vendorRoleId).toBe(SOLO_ROLE);
  });
});
