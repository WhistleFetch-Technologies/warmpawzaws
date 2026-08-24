import { describe, expect, test } from '@jest/globals';
import {
  allocateTaxableAcrossLines,
  aggregateGstLines,
  gstLinesFromEngineItems,
  invoiceItemsFromGstLines,
  parseGstLines,
  selectedServiceLineAmount,
  type AuthoritativeGstLine,
} from '../gst-tax-lines';

function line(
  category: string,
  taxable: number,
  rate: number,
  extras: Partial<AuthoritativeGstLine> = {},
): AuthoritativeGstLine {
  const gstAmount = Math.round(((taxable * rate) / 100) * 100) / 100;
  const half = Math.round((gstAmount / 2) * 100) / 100;
  const inter = extras.igst != null && extras.igst > 0;
  return {
    category,
    gstRate: rate,
    taxableAmount: taxable,
    gstAmount,
    cgst: inter ? 0 : half,
    sgst: inter ? 0 : Math.round((gstAmount - half) * 100) / 100,
    igst: inter ? gstAmount : 0,
    ...extras,
  };
}

describe('multi-service GST lines', () => {
  test('CASE 1 — Vet ₹1000 @ 0% + Diagnostic ₹1000 @ 18% = GST ₹180, not ₹360', () => {
    const aggregated = aggregateGstLines(
      [line('veterinary', 1000, 0), line('diagnostic', 1000, 18)],
      false,
    );
    expect(aggregated.taxableAmount).toBe(2000);
    expect(aggregated.gstAmount).toBe(180);
    expect(aggregated.cgstAmount).toBe(90);
    expect(aggregated.sgstAmount).toBe(90);
    expect(aggregated.igstAmount).toBe(0);
    expect(aggregated.gstAmount).not.toBe(360);
  });

  test('CASE 2 — Vet ₹500 @ 0% + Grooming ₹1500 @ 18% = GST ₹270', () => {
    const aggregated = aggregateGstLines(
      [line('veterinary', 500, 0), line('grooming', 1500, 18)],
      false,
    );
    expect(aggregated.gstAmount).toBe(270);
    expect(aggregated.gstAmount).not.toBe(360);
  });

  test('CASE 3 — Vet ₹1000 @ 0% + Diagnostic ₹2000 @ 18% = GST ₹360, not ₹540', () => {
    const aggregated = aggregateGstLines(
      [line('veterinary', 1000, 0), line('diagnostic', 2000, 18)],
      false,
    );
    expect(aggregated.gstAmount).toBe(360);
    expect(aggregated.gstAmount).not.toBe(540);
  });

  test('CRITICAL — same services different order produce the same GST total', () => {
    const vetFirst = aggregateGstLines(
      [line('veterinary', 1000, 0), line('diagnostic', 1000, 18)],
      false,
    );
    const diagFirst = aggregateGstLines(
      [line('diagnostic', 1000, 18), line('veterinary', 1000, 0)],
      false,
    );
    expect(vetFirst.gstAmount).toBe(180);
    expect(diagFirst.gstAmount).toBe(180);
    expect(vetFirst.gstAmount).toBe(diagFirst.gstAmount);
    expect(vetFirst.cgstAmount).toBe(diagFirst.cgstAmount);
    expect(vetFirst.sgstAmount).toBe(diagFirst.sgstAmount);
  });

  test('Vet + Training / Boarding / Pet Sitting keep 0% on the vet line', () => {
    for (const category of ['training', 'boarding', 'pet-sitting']) {
      const lines = [line('veterinary', 1000, 0), line(category, 1000, 18)];
      const aggregated = aggregateGstLines(lines, false);
      expect(lines[0].gstAmount).toBe(0);
      expect(aggregated.gstAmount).toBe(180);
    }
  });

  test('Diagnostic + Grooming and two 18% services sum independently', () => {
    expect(
      aggregateGstLines([line('diagnostic', 1000, 18), line('grooming', 1000, 18)], false).gstAmount,
    ).toBe(360);
    expect(
      aggregateGstLines([line('training', 800, 18), line('walking', 1200, 18)], false).gstAmount,
    ).toBe(360);
  });

  test('two Veterinary 0% services stay GST 0', () => {
    const aggregated = aggregateGstLines(
      [line('veterinary', 700, 0), line('veterinary', 300, 0)],
      false,
    );
    expect(aggregated.gstAmount).toBe(0);
    expect(aggregated.cgstAmount).toBe(0);
    expect(aggregated.sgstAmount).toBe(0);
  });

  test('intra-state mixed-category booking is CGST+SGST per line', () => {
    const lines = [line('veterinary', 1000, 0), line('diagnostic', 1000, 18)];
    expect(lines[0]).toMatchObject({ cgst: 0, sgst: 0, igst: 0 });
    expect(lines[1]).toMatchObject({ cgst: 90, sgst: 90, igst: 0 });
    expect(aggregateGstLines(lines, false).igstAmount).toBe(0);
  });

  test('inter-state mixed-category booking is IGST per line', () => {
    const lines = [
      line('veterinary', 1000, 0, { igst: 0, cgst: 0, sgst: 0, gstAmount: 0 }),
      line('diagnostic', 1000, 18, { igst: 180, cgst: 0, sgst: 0, gstAmount: 180 }),
    ];
    const aggregated = aggregateGstLines(lines, true);
    expect(aggregated.igstAmount).toBe(180);
    expect(aggregated.cgstAmount).toBe(0);
    expect(aggregated.sgstAmount).toBe(0);
  });

  test('commission / vendor net never become the taxable base', () => {
    expect(selectedServiceLineAmount({ price: 1000, quantity: 1 })).toBe(1000);
    expect(selectedServiceLineAmount({ originalPrice: 1000, price: 900 })).toBe(1000);
    const allocated = allocateTaxableAcrossLines([1000, 1000], 2000);
    expect(allocated).toEqual([1000, 1000]);
    expect(allocated.some((amount) => amount === 900)).toBe(false);
  });

  test('discount allocation preserves two-decimal remainder on the last line', () => {
    expect(allocateTaxableAcrossLines([1000, 1000], 1900)).toEqual([950, 950]);
    expect(allocateTaxableAcrossLines([1000, 2000], 2500)).toEqual([833.33, 1666.67]);
    const odd = allocateTaxableAcrossLines([1000, 1000, 1000], 1000);
    expect(odd.reduce((sum, n) => Math.round((sum + n) * 100) / 100, 0)).toBe(1000);
    expect(odd[0]).toBe(333.33);
    expect(odd[1]).toBe(333.33);
    expect(odd[2]).toBe(333.34);
    const leftover = allocateTaxableAcrossLines([1000, 1000], 1999.99);
    expect(leftover.reduce((sum, n) => Math.round((sum + n) * 100) / 100, 0)).toBe(1999.99);
    expect(leftover[0]).toBe(1000);
    expect(leftover[1]).toBe(999.99);
  });

  test('discounted mixed lines keep 0% on Vet and 18% only on Diagnostic', () => {
    const allocated = allocateTaxableAcrossLines([1000, 1000], 1900);
    const mapped = gstLinesFromEngineItems(
      [
        { gstRate: 0, baseAmount: allocated[0], totalTax: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 },
        { gstRate: 18, baseAmount: allocated[1], totalTax: 171, cgstAmount: 85.5, sgstAmount: 85.5, igstAmount: 0 },
      ],
      [
        { serviceId: 'vet', listAmount: 1000, category: 'veterinary' },
        { serviceId: 'diag', listAmount: 1000, category: 'diagnostic' },
      ],
    );
    expect(mapped[0].taxableAmount).toBe(950);
    expect(mapped[0].gstAmount).toBe(0);
    expect(mapped[1].taxableAmount).toBe(950);
    expect(mapped[1].gstAmount).toBe(171);
    expect(aggregateGstLines(mapped, false).gstAmount).toBe(171);
    expect(aggregateGstLines(mapped, false).gstAmount).not.toBe(342);
  });

  test('checkout→booking→invoice lineage keeps per-line GST and historical fallback', () => {
    const checkoutAmounts = allocateTaxableAcrossLines([1000, 1000], 2000);
    const bookingLines = gstLinesFromEngineItems(
      [
        { gstRate: 0, baseAmount: checkoutAmounts[0], totalTax: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 },
        { gstRate: 18, baseAmount: checkoutAmounts[1], totalTax: 180, cgstAmount: 90, sgstAmount: 90, igstAmount: 0 },
      ],
      [
        { serviceId: 'vet', vendorServiceId: 'vet', listAmount: 1000, category: 'veterinary' },
        { serviceId: 'diag', vendorServiceId: 'diag', listAmount: 1000, category: 'diagnostic' },
      ],
    );
    const invoice = invoiceItemsFromGstLines({
      gstLines: bookingLines,
      selectedServices: [
        { id: 'vet', name: 'Consultation' },
        { id: 'diag', name: 'Blood test' },
      ],
    });
    expect(invoice![0]).toMatchObject({ gstRate: 0, cgst: 0, total: 1000 });
    expect(invoice![1]).toMatchObject({ gstRate: 18, cgst: 90, total: 1180 });
    expect(parseGstLines(undefined)).toEqual([]);
    expect(invoiceItemsFromGstLines({ gstLines: [] })).toBeNull();
  });

  test('package GST is one line amount, not multiplied by sessions', () => {
    const aggregated = aggregateGstLines(
      [line('veterinary', 1000, 0), line('diagnostic', 5000, 18)],
      false,
    );
    expect(aggregated.gstAmount).toBe(900);
  });

  test('engine items map 1:1 and do not collapse into one rate', () => {
    const mapped = gstLinesFromEngineItems(
      [
        { itemId: 'vet', gstRate: 0, baseAmount: 1000, totalTax: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 },
        { itemId: 'diag', gstRate: 18, baseAmount: 1000, totalTax: 180, cgstAmount: 90, sgstAmount: 90, igstAmount: 0 },
      ],
      [
        { serviceId: 'vet', vendorServiceId: 'vet', listAmount: 1000, category: 'veterinary' },
        { serviceId: 'diag', vendorServiceId: 'diag', listAmount: 1000, category: 'diagnostic' },
      ],
    );
    expect(mapped[0].gstAmount).toBe(0);
    expect(mapped[1].gstAmount).toBe(180);
    expect(aggregateGstLines(mapped, false).gstAmount).toBe(180);
  });

  test('invoice uses gstLines for new bookings', () => {
    const items = invoiceItemsFromGstLines({
      gstLines: [
        { serviceId: 'vet', vendorServiceId: 'vet', category: 'veterinary', gstRate: 0, taxableAmount: 1000, gstAmount: 0, cgst: 0, sgst: 0, igst: 0 },
        { serviceId: 'diag', vendorServiceId: 'diag', category: 'diagnostic', gstRate: 18, taxableAmount: 1000, gstAmount: 180, cgst: 90, sgst: 90, igst: 0 },
      ],
      selectedServices: [
        { id: 'vet', name: 'Consultation', price: 1000, quantity: 1 },
        { id: 'diag', name: 'Blood test', price: 1000, quantity: 1 },
      ],
    });
    expect(items).not.toBeNull();
    expect(items![0]).toMatchObject({ name: 'Consultation', gstRate: 0, cgst: 0, sgst: 0, total: 1000 });
    expect(items![1]).toMatchObject({ name: 'Blood test', gstRate: 18, cgst: 90, sgst: 90, total: 1180 });
    expect(items![0].cgst + items![1].cgst).toBe(90);
  });

  test('historical invoice without gstLines keeps the previous path', () => {
    expect(parseGstLines(undefined)).toEqual([]);
    expect(parseGstLines([])).toEqual([]);
    expect(invoiceItemsFromGstLines({ gstLines: [] })).toBeNull();
  });
});
