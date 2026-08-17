import { describe, expect, test } from '@jest/globals';
import {
  gstFinancialIdentity,
  inferExclusiveGstFromChargedDelta,
  inferInclusiveGstFromListedPrice,
  isZeroRatedHealthcareHint,
  reconstructGstSplit,
  splitGstAmount,
} from '../gst-split';

describe('gst-split', () => {
  test('splits intra-state GST into CGST/SGST (ed864719)', () => {
    expect(splitGstAmount(2288.16, false)).toEqual({ cgst: 1144.08, sgst: 1144.08, igst: 0 });
  });

  test('assigns inter-state GST to IGST', () => {
    expect(splitGstAmount(180, true)).toEqual({ cgst: 0, sgst: 0, igst: 180 });
  });

  test('reconstructGstSplit keeps an existing split', () => {
    const split = reconstructGstSplit({
      cgstAmount: 90,
      sgstAmount: 90,
      igstAmount: 0,
      gstTotal: 180,
    });
    expect(split).toEqual({
      cgstAmount: 90,
      sgstAmount: 90,
      igstAmount: 0,
      gstTotal: 180,
      splitAvailable: true,
    });
  });

  test('reconstructGstSplit uses gst_amount when CGST/SGST/IGST are 0', () => {
    const split = reconstructGstSplit({
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      gstTotal: 2288.16,
      isInterState: false,
    });
    expect(split.gstTotal).toBe(2288.16);
    expect(split.cgstAmount).toBe(1144.08);
    expect(split.sgstAmount).toBe(1144.08);
    expect(split.igstAmount).toBe(0);
  });

  test('gstFinancialIdentity prefers payment id then parent booking', () => {
    expect(gstFinancialIdentity({ paymentId: 'pay-1', parentBookingId: 'parent', bookingId: 'child' })).toBe(
      'payment:pay-1',
    );
    expect(gstFinancialIdentity({ parentBookingId: 'parent', bookingId: 'child' })).toBe('parent:parent');
    expect(gstFinancialIdentity({ bookingId: 'normal' })).toBe('booking:normal');
  });

  test('inferExclusiveGstFromChargedDelta recovers Sara Pets 18% GST baked into charged total', () => {
    const split = inferExclusiveGstFromChargedDelta({
      taxableValue: 1485,
      chargedTotal: 1752.3,
      isInterState: false,
    });
    expect(split.gstTotal).toBe(267.3);
    expect(split.cgstAmount).toBe(133.65);
    expect(split.sgstAmount).toBe(133.65);
    expect(split.igstAmount).toBe(0);
  });

  test('inferExclusiveGstFromChargedDelta stays 0 when charged equals taxable', () => {
    const split = inferExclusiveGstFromChargedDelta({
      taxableValue: 400,
      chargedTotal: 400,
    });
    expect(split.gstTotal).toBe(0);
  });

  test('inferExclusiveGstFromChargedDelta ignores a delta that is not a GST rate', () => {
    const split = inferExclusiveGstFromChargedDelta({
      taxableValue: 1593,
      chargedTotal: 1620,
    });
    expect(split.gstTotal).toBe(0);
  });

  test('reconstructGstSplit does not invent 50/50 when jurisdiction is unknown', () => {
    const split = reconstructGstSplit({
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      gstTotal: 324,
    });
    expect(split.gstTotal).toBe(324);
    expect(split.cgstAmount).toBe(0);
    expect(split.sgstAmount).toBe(0);
    expect(split.igstAmount).toBe(0);
    expect(split.splitAvailable).toBe(false);
  });

  test('inferInclusiveGstFromListedPrice extracts Pawsome inclusive GST from vendor gross', () => {
    const split = inferInclusiveGstFromListedPrice({
      taxableValue: 1593,
      vendorGross: 1350,
      isInterState: false,
    });
    expect(split.gstTotal).toBe(243);
    expect(split.cgstAmount).toBe(121.5);
    expect(split.sgstAmount).toBe(121.5);
  });

  test('inferInclusiveGstFromListedPrice keeps total only when jurisdiction is unknown', () => {
    const split = inferInclusiveGstFromListedPrice({
      taxableValue: 1593,
      vendorGross: 1350,
    });
    expect(split.gstTotal).toBe(243);
    expect(split.cgstAmount).toBe(0);
    expect(split.sgstAmount).toBe(0);
    expect(split.igstAmount).toBe(0);
    expect(split.splitAvailable).toBe(false);
  });

  test('inferInclusiveGstFromListedPrice extracts K9 inclusive GST from listed 1800', () => {
    const split = inferInclusiveGstFromListedPrice({
      taxableValue: 1800,
    });
    expect(split.gstTotal).toBe(274.58);
  });

  test('inferInclusiveGstFromListedPrice stays 0 for veterinary 0% catalogue', () => {
    expect(
      inferInclusiveGstFromListedPrice({
        taxableValue: 350,
        catalogGstRate: 0,
      }).gstTotal,
    ).toBe(0);
    expect(
      inferInclusiveGstFromListedPrice({
        taxableValue: 350,
        zeroRated: true,
      }).gstTotal,
    ).toBe(0);
  });

  test('isZeroRatedHealthcareHint skips vet consults but not grooming under a vet vendor', () => {
    expect(isZeroRatedHealthcareHint({ categoryName: 'Veterinary' })).toBe(true);
    expect(isZeroRatedHealthcareHint({ catalogGstRate: 0 })).toBe(true);
    expect(isZeroRatedHealthcareHint({ categoryName: 'Grooming', vsCategory: 'vet_clinic' })).toBe(false);
    expect(isZeroRatedHealthcareHint({ categoryName: 'Boarding' })).toBe(false);
  });
});
