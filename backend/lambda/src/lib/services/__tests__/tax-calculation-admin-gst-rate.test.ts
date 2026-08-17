import { describe, expect, test, jest, beforeEach } from '@jest/globals';

jest.mock('../gst-catalog-role-resolution', () => {
  const actual = jest.requireActual('../gst-catalog-role-resolution') as typeof import('../gst-catalog-role-resolution');
  return {
    ...actual,
    resolveGstRateForCatalogAndRole: jest.fn(),
  };
});

import { taxCalculationService } from '../tax-calculation-service';
import {
  isGstConfigurationError,
  resolveGstRateForCatalogAndRole,
} from '../gst-catalog-role-resolution';
import { buildCanonicalGstSnapshot, readAuthoritativeGst } from '../../../utils/canonical-gst-snapshot';

const mockedResolve = resolveGstRateForCatalogAndRole as jest.MockedFunction<
  typeof resolveGstRateForCatalogAndRole
>;

describe('Admin tax category is authoritative GST rate', () => {
  beforeEach(() => {
    mockedResolve.mockReset();
  });

  test('Premium Grooming ₹2000 + Groomer Solo 18% intra = 360 / 180 / 180 / 0', async () => {
    mockedResolve.mockResolvedValue({
      found: true,
      rate: 18,
      taxCategoryId: 'tc-grooming-solo',
      catalogCategoryId: 'cat-grooming',
      vendorRoleId: 'role-groomer-solo',
      applicationScope: 'service_booking',
    });

    const result = await taxCalculationService.calculateTax({
      items: [
        {
          id: 'premium-grooming',
          type: 'service',
          amount: 2000,
          quantity: 1,
          catalogCategoryId: 'cat-grooming',
          category: 'Grooming',
          roleId: 'role-groomer-solo',
          gstApplicationScope: 'service_booking',
        },
      ],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'KA' },
    });

    expect(mockedResolve).toHaveBeenCalledWith('cat-grooming', 'role-groomer-solo', 'service_booking');
    expect(result.items[0].gstRate).toBe(18);
    expect(result.totalTax).toBeCloseTo(360, 2);
    expect(result.totalCGST).toBeCloseTo(180, 2);
    expect(result.totalSGST).toBeCloseTo(180, 2);
    expect(result.totalIGST).toBe(0);
    expect(result.isInterstate).toBe(false);
  });

  test('same service inter-state uses the Admin rate as IGST only', async () => {
    mockedResolve.mockResolvedValue({
      found: true,
      rate: 18,
      taxCategoryId: 'tc-grooming-solo',
      catalogCategoryId: 'cat-grooming',
      vendorRoleId: 'role-groomer-solo',
      applicationScope: 'service_booking',
    });

    const result = await taxCalculationService.calculateTax({
      items: [
        {
          id: 'premium-grooming',
          type: 'service',
          amount: 2000,
          catalogCategoryId: 'cat-grooming',
          roleId: 'role-groomer-solo',
        },
      ],
      customerLocation: { state: 'Maharashtra' },
      vendorLocation: { state: 'Karnataka' },
    });

    expect(result.totalTax).toBeCloseTo(360, 2);
    expect(result.totalCGST).toBe(0);
    expect(result.totalSGST).toBe(0);
    expect(result.totalIGST).toBeCloseTo(360, 2);
    expect(result.isInterstate).toBe(true);
  });

  test('grooming + vet_clinic uses the category Admin rate (role does not block)', async () => {
    mockedResolve.mockResolvedValue({
      found: true,
      rate: 18,
      taxCategoryId: 'tc-grooming',
      catalogCategoryId: '4fbdc899-e4da-4219-952f-6d038a48981d',
      vendorRoleId: 'e0473f0e-bc76-47fc-8378-3f0295fe6447',
      applicationScope: 'service_booking',
    });

    const result = await taxCalculationService.calculateTax({
      items: [
        {
          id: 'clinic-grooming',
          type: 'service',
          amount: 1100,
          catalogCategoryId: '4fbdc899-e4da-4219-952f-6d038a48981d',
          roleId: 'e0473f0e-bc76-47fc-8378-3f0295fe6447',
        },
      ],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });

    expect(result.items[0].gstRate).toBe(18);
    expect(result.totalTax).toBeCloseTo(198, 2);
    expect(result.totalCGST).toBeCloseTo(99, 2);
    expect(result.totalSGST).toBeCloseTo(99, 2);
    expect(result.totalIGST).toBe(0);
  });

  test('missing Admin tax category does not invent 18%', async () => {
    mockedResolve.mockResolvedValue({
      found: false,
      rate: 0,
      taxCategoryId: null,
      catalogCategoryId: 'cat-physio',
      vendorRoleId: 'role-vet-clinic',
      applicationScope: 'service_booking',
      reason: 'No active Admin tax category for this catalogue category and GST scope',
    });

    await expect(
      taxCalculationService.calculateTax({
        items: [
          {
            id: 'physio',
            type: 'service',
            amount: 2000,
            catalogCategoryId: 'cat-physio',
            roleId: 'role-vet-clinic',
          },
        ],
        customerLocation: { state: 'Karnataka' },
        vendorLocation: { state: 'Karnataka' },
      }),
    ).rejects.toThrow(/Missing GST configuration/);
  });

  test('service without catalogue category does not default to 18%', async () => {
    try {
      await taxCalculationService.calculateTax({
        items: [{ id: 'custom', type: 'service', amount: 2000, roleId: 'role-groomer-solo' }],
      });
      throw new Error('expected GstConfigurationError');
    } catch (err) {
      expect(isGstConfigurationError(err)).toBe(true);
    }
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  test('Admin rate change affects a new snapshot only; paid snapshot stays 18%', () => {
    const paid = buildCanonicalGstSnapshot({ taxableAmount: 2000, gstRate: 18, isInterState: false });
    expect(paid).toMatchObject({
      gstRate: 18,
      gstAmount: 360,
      cgstAmount: 180,
      sgstAmount: 180,
      igstAmount: 0,
    });

    const laterAdminRate = 12;
    const newTxn = buildCanonicalGstSnapshot({
      taxableAmount: 2000,
      gstRate: laterAdminRate,
      isInterState: false,
    });
    expect(newTxn.gstRate).toBe(12);
    expect(newTxn.gstAmount).toBe(240);

    const rereadPaid = readAuthoritativeGst({
      taxable_amount: paid.taxableAmount,
      gst_rate: paid.gstRate,
      gst_amount: paid.gstAmount,
      cgst_amount: paid.cgstAmount,
      sgst_amount: paid.sgstAmount,
      igst_amount: paid.igstAmount,
      is_inter_state: paid.isInterState,
    });
    expect(rereadPaid.gstRate).toBe(18);
    expect(rereadPaid.gstAmount).toBe(360);
    expect(rereadPaid.cgstAmount).toBe(180);
    expect(rereadPaid.igstAmount).toBe(0);
  });
});
