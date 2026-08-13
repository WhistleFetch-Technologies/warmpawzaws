import { describe, expect, test } from '@jest/globals';
import { gstFinancialIdentity, inferExclusiveGstFromChargedDelta, reconstructGstSplit, splitGstAmount } from '../gst-split';

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
    expect(split).toEqual({ cgstAmount: 90, sgstAmount: 90, igstAmount: 0, gstTotal: 180 });
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
});
