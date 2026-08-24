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
        customerLocation: { state: 'Karnataka' },
        vendorLocation: { state: 'Karnataka' },
      });
      throw new Error('expected GstConfigurationError');
    } catch (err) {
      expect(isGstConfigurationError(err)).toBe(true);
    }
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  test('TEST A — Karnataka + Karnataka on ₹1100 @ 18% is CGST+SGST', async () => {
    mockedResolve.mockResolvedValue({
      found: true,
      rate: 18,
      taxCategoryId: 'tc-grooming',
      catalogCategoryId: 'cat-grooming',
      vendorRoleId: 'role-groomer',
      applicationScope: 'service_booking',
    });
    const result = await taxCalculationService.calculateTax({
      items: [
        {
          id: 'svc',
          type: 'service',
          amount: 1100,
          catalogCategoryId: 'cat-grooming',
          roleId: 'role-groomer',
        },
      ],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });
    expect(result.isInterstate).toBe(false);
    expect(result.totalTax).toBeCloseTo(198, 2);
    expect(result.totalCGST).toBeCloseTo(99, 2);
    expect(result.totalSGST).toBeCloseTo(99, 2);
    expect(result.totalIGST).toBe(0);
  });

  test('TEST B — Karnataka + Tamil Nadu on ₹1100 @ 18% is IGST only', async () => {
    mockedResolve.mockResolvedValue({
      found: true,
      rate: 18,
      taxCategoryId: 'tc-grooming',
      catalogCategoryId: 'cat-grooming',
      vendorRoleId: 'role-groomer',
      applicationScope: 'service_booking',
    });
    const result = await taxCalculationService.calculateTax({
      items: [
        {
          id: 'svc',
          type: 'service',
          amount: 1100,
          catalogCategoryId: 'cat-grooming',
          roleId: 'role-groomer',
        },
      ],
      customerLocation: { state: 'Tamil Nadu' },
      vendorLocation: { state: 'Karnataka' },
    });
    expect(result.isInterstate).toBe(true);
    expect(result.totalTax).toBeCloseTo(198, 2);
    expect(result.totalCGST).toBe(0);
    expect(result.totalSGST).toBe(0);
    expect(result.totalIGST).toBeCloseTo(198, 2);
  });

  test('TEST C — KA vendor + Karnataka customer still intra-state', async () => {
    mockedResolve.mockResolvedValue({
      found: true,
      rate: 18,
      taxCategoryId: 'tc-grooming',
      catalogCategoryId: 'cat-grooming',
      vendorRoleId: 'role-groomer',
      applicationScope: 'service_booking',
    });
    const result = await taxCalculationService.calculateTax({
      items: [
        {
          id: 'svc',
          type: 'service',
          amount: 1100,
          catalogCategoryId: 'cat-grooming',
          roleId: 'role-groomer',
        },
      ],
      customerLocation: { state: 'Karnataka ' },
      vendorLocation: { state: 'KA', city: 'Bengaluru' },
    });
    expect(result.isInterstate).toBe(false);
    expect(result.totalIGST).toBe(0);
    expect(result.totalCGST).toBeCloseTo(99, 2);
  });

  test('TEST D — missing place of supply fail-closes for service booking', async () => {
    mockedResolve.mockResolvedValue({
      found: true,
      rate: 18,
      taxCategoryId: 'tc-grooming',
      catalogCategoryId: 'cat-grooming',
      vendorRoleId: 'role-groomer',
      applicationScope: 'service_booking',
    });
    await expect(
      taxCalculationService.calculateTax({
        items: [
          {
            id: 'svc',
            type: 'service',
            amount: 1100,
            catalogCategoryId: 'cat-grooming',
            roleId: 'role-groomer',
          },
        ],
        vendorLocation: { state: 'Karnataka' },
      }),
    ).rejects.toThrow(/place of supply/i);
  });

  test('Bangalore city-only on both sides is intra-state, not IGST', async () => {
    mockedResolve.mockResolvedValue({
      found: true,
      rate: 18,
      taxCategoryId: 'tc-grooming',
      catalogCategoryId: 'cat-grooming',
      vendorRoleId: 'role-groomer',
      applicationScope: 'service_booking',
    });
    const result = await taxCalculationService.calculateTax({
      items: [
        {
          id: 'svc',
          type: 'service',
          amount: 1100,
          catalogCategoryId: 'cat-grooming',
          roleId: 'role-groomer',
        },
      ],
      customerLocation: { state: '', city: 'Bengaluru' },
      vendorLocation: { state: '', city: 'Bangalore' },
    });
    expect(result.isInterstate).toBe(false);
    expect(result.totalCGST).toBeCloseTo(99, 2);
    expect(result.totalSGST).toBeCloseTo(99, 2);
    expect(result.totalIGST).toBe(0);
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

describe('mixed-service GST is calculated per taxable line, then aggregated', () => {
  beforeEach(() => {
    mockedResolve.mockReset();
    mockedResolve.mockImplementation(async (catalogCategoryId) => {
      const id = String(catalogCategoryId || '');
      const rate = id === 'cat-veterinary' ? 0 : 18;
      return {
        found: true,
        rate,
        taxCategoryId: `tc-${id}`,
        catalogCategoryId: id,
        vendorRoleId: 'role-clinic',
        applicationScope: 'service_booking',
      };
    });
  });

  function serviceLine(
    id: string,
    amount: number,
    catalogCategoryId: string,
    category: string,
  ) {
    return {
      id,
      type: 'service' as const,
      amount,
      quantity: 1,
      catalogCategoryId,
      category,
      roleId: 'role-clinic',
      gstApplicationScope: 'service_booking' as const,
    };
  }

  test('CASE 1 — Vet ₹1000 @ 0% + Diagnostic ₹1000 @ 18% = GST ₹180, not ₹360', async () => {
    const result = await taxCalculationService.calculateTax({
      items: [
        serviceLine('vet', 1000, 'cat-veterinary', 'Veterinary'),
        serviceLine('diag', 1000, 'cat-diagnostic', 'Diagnostic'),
      ],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });

    expect(result.items[0]).toMatchObject({ gstRate: 0, totalTax: 0, baseAmount: 1000 });
    expect(result.items[1]).toMatchObject({ gstRate: 18, totalTax: 180, baseAmount: 1000 });
    expect(result.subtotal).toBeCloseTo(2000, 2);
    expect(result.totalTax).toBeCloseTo(180, 2);
    expect(result.grandTotal).toBeCloseTo(2180, 2);
    expect(result.totalCGST).toBeCloseTo(90, 2);
    expect(result.totalSGST).toBeCloseTo(90, 2);
    expect(result.totalIGST).toBe(0);
    expect(mockedResolve).toHaveBeenCalledTimes(2);
  });

  test('CASE 2 — Vet ₹500 @ 0% + Grooming ₹1500 @ 18% = GST ₹270, not ₹360', async () => {
    const result = await taxCalculationService.calculateTax({
      items: [
        serviceLine('vet', 500, 'cat-veterinary', 'Veterinary'),
        serviceLine('groom', 1500, 'cat-grooming', 'Grooming'),
      ],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });
    expect(result.items[0].totalTax).toBeCloseTo(0, 2);
    expect(result.items[1].totalTax).toBeCloseTo(270, 2);
    expect(result.totalTax).toBeCloseTo(270, 2);
    expect(result.grandTotal).toBeCloseTo(2270, 2);
  });

  test('CASE 3 — Vet ₹1000 @ 0% + Diagnostic ₹2000 @ 18% = GST ₹360, not ₹540', async () => {
    const result = await taxCalculationService.calculateTax({
      items: [
        serviceLine('vet', 1000, 'cat-veterinary', 'Veterinary'),
        serviceLine('diag', 2000, 'cat-diagnostic', 'Diagnostic'),
      ],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });
    expect(result.totalTax).toBeCloseTo(360, 2);
    expect(result.grandTotal).toBeCloseTo(3360, 2);
  });

  test('A–H mixed category matrix keeps 0% lines at GST 0', async () => {
    const mixes: Array<{ name: string; a: string; b: string; aAmt: number; bAmt: number; gst: number }> = [
      { name: 'Vet+Diagnostic', a: 'cat-veterinary', b: 'cat-diagnostic', aAmt: 1000, bAmt: 1000, gst: 180 },
      { name: 'Vet+Grooming', a: 'cat-veterinary', b: 'cat-grooming', aAmt: 1000, bAmt: 1000, gst: 180 },
      { name: 'Vet+Training', a: 'cat-veterinary', b: 'cat-training', aAmt: 1000, bAmt: 1000, gst: 180 },
      { name: 'Vet+Boarding', a: 'cat-veterinary', b: 'cat-boarding', aAmt: 1000, bAmt: 1000, gst: 180 },
      { name: 'Vet+PetSitting', a: 'cat-veterinary', b: 'cat-pet-sitting', aAmt: 1000, bAmt: 1000, gst: 180 },
      { name: 'Diagnostic+Grooming', a: 'cat-diagnostic', b: 'cat-grooming', aAmt: 1000, bAmt: 1000, gst: 360 },
      { name: 'Two 18% categories', a: 'cat-training', b: 'cat-walking', aAmt: 800, bAmt: 1200, gst: 360 },
      { name: 'Two Veterinary 0%', a: 'cat-veterinary', b: 'cat-veterinary', aAmt: 700, bAmt: 300, gst: 0 },
    ];

    for (const mix of mixes) {
      const result = await taxCalculationService.calculateTax({
        items: [
          serviceLine(`${mix.name}-a`, mix.aAmt, mix.a, mix.a),
          serviceLine(`${mix.name}-b`, mix.bAmt, mix.b, mix.b),
        ],
        customerLocation: { state: 'Karnataka' },
        vendorLocation: { state: 'Karnataka' },
      });
      expect(result.totalTax).toBeCloseTo(mix.gst, 2);
      if (mix.a === 'cat-veterinary') {
        expect(result.items[0].totalTax).toBeCloseTo(0, 2);
        expect(result.items[0].gstRate).toBe(0);
      }
    }
  });

  test('I — mixed-service intra-state is CGST+SGST per taxable line', async () => {
    const result = await taxCalculationService.calculateTax({
      items: [
        serviceLine('vet', 1000, 'cat-veterinary', 'Veterinary'),
        serviceLine('diag', 1000, 'cat-diagnostic', 'Diagnostic'),
      ],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });
    expect(result.isInterstate).toBe(false);
    expect(result.items[0]).toMatchObject({ cgstAmount: 0, sgstAmount: 0, igstAmount: 0 });
    expect(result.items[1].cgstAmount).toBeCloseTo(90, 2);
    expect(result.items[1].sgstAmount).toBeCloseTo(90, 2);
    expect(result.items[1].igstAmount).toBe(0);
    expect(result.totalIGST).toBe(0);
  });

  test('J — mixed-service inter-state is IGST per taxable line', async () => {
    const result = await taxCalculationService.calculateTax({
      items: [
        serviceLine('vet', 1000, 'cat-veterinary', 'Veterinary'),
        serviceLine('diag', 1000, 'cat-diagnostic', 'Diagnostic'),
      ],
      customerLocation: { state: 'Maharashtra' },
      vendorLocation: { state: 'Karnataka' },
    });
    expect(result.isInterstate).toBe(true);
    expect(result.items[0]).toMatchObject({ cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalTax: 0 });
    expect(result.items[1]).toMatchObject({ cgstAmount: 0, sgstAmount: 0 });
    expect(result.items[1].igstAmount).toBeCloseTo(180, 2);
    expect(result.totalCGST).toBe(0);
    expect(result.totalSGST).toBe(0);
    expect(result.totalIGST).toBeCloseTo(180, 2);
  });

  test('K — mixed service + package lines keep independent GST', async () => {
    const result = await taxCalculationService.calculateTax({
      items: [
        serviceLine('vet-service', 1000, 'cat-veterinary', 'Veterinary'),
        serviceLine('diag-package', 5000, 'cat-diagnostic', 'Diagnostic'),
      ],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });
    expect(result.items[0].totalTax).toBeCloseTo(0, 2);
    expect(result.items[1].totalTax).toBeCloseTo(900, 2);
    expect(result.totalTax).toBeCloseTo(900, 2);
    expect(result.grandTotal).toBeCloseTo(6900, 2);
  });

  test('L/M — package GST is one line amount, not multiplied by sessions', async () => {
    const result = await taxCalculationService.calculateTax({
      items: [serviceLine('diag-package', 5000, 'cat-diagnostic', 'Diagnostic')],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });
    expect(result.totalTax).toBeCloseTo(900, 2);
    expect(result.items[0].quantity).toBe(1);
  });

  test('N/O — commission / vendor net must not be the GST taxable base', async () => {
    const customerPrice = 1000;
    const result = await taxCalculationService.calculateTax({
      items: [serviceLine('vet', customerPrice, 'cat-veterinary', 'Veterinary')],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });
    expect(result.subtotal).toBeCloseTo(1000, 2);
    expect(result.totalTax).toBe(0);
    expect(result.items[0].baseAmount).not.toBe(900);
  });

  test('CRITICAL — Diagnostic-first and Vet-first produce the same GST total', async () => {
    const vetFirst = await taxCalculationService.calculateTax({
      items: [
        serviceLine('vet', 1000, 'cat-veterinary', 'Veterinary'),
        serviceLine('diag', 1000, 'cat-diagnostic', 'Diagnostic'),
      ],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });
    const diagFirst = await taxCalculationService.calculateTax({
      items: [
        serviceLine('diag', 1000, 'cat-diagnostic', 'Diagnostic'),
        serviceLine('vet', 1000, 'cat-veterinary', 'Veterinary'),
      ],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });
    expect(vetFirst.totalTax).toBeCloseTo(180, 2);
    expect(diagFirst.totalTax).toBeCloseTo(180, 2);
    expect(vetFirst.totalTax).toBeCloseTo(diagFirst.totalTax, 2);
  });

  test('collapsed combined line is not used when items are sent separately', async () => {
    const collapsed = await taxCalculationService.calculateTax({
      items: [serviceLine('first-diagnostic', 2000, 'cat-diagnostic', 'Diagnostic')],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });
    expect(collapsed.totalTax).toBeCloseTo(360, 2);

    const perLine = await taxCalculationService.calculateTax({
      items: [
        serviceLine('vet', 1000, 'cat-veterinary', 'Veterinary'),
        serviceLine('diag', 1000, 'cat-diagnostic', 'Diagnostic'),
      ],
      customerLocation: { state: 'Karnataka' },
      vendorLocation: { state: 'Karnataka' },
    });
    expect(perLine.totalTax).toBeCloseTo(180, 2);
    expect(collapsed.totalTax).not.toBeCloseTo(perLine.totalTax, 2);
  });
});
