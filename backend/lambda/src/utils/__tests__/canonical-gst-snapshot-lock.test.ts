import {
  hasCompleteGstSplit,
  isBackendAuthoritativeGstLock,
  readAuthoritativeGst,
} from '../canonical-gst-snapshot';

describe('isBackendAuthoritativeGstLock', () => {
  test('locks backend-authoritative 0% GST snapshot (complete zero split)', () => {
    const lockedSnap = readAuthoritativeGst({
      gstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      isInterState: false,
      taxableAmount: 1000,
      gstRate: 0,
    });
    expect(lockedSnap.splitAvailable).toBe(true);
    expect(lockedSnap.gstAmount).toBe(0);
    expect(
      isBackendAuthoritativeGstLock({
        gstAuthority: 'backend',
        lockedSnap,
        gstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
      }),
    ).toBe(true);
  });

  test('complete zero split is accepted by hasCompleteGstSplit', () => {
    expect(
      hasCompleteGstSplit({ gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 }),
    ).toBe(true);
  });

  test('missing gstAuthority does not lock even when GST happens to be 0', () => {
    const lockedSnap = readAuthoritativeGst({
      gstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxableAmount: 1000,
    });
    expect(
      isBackendAuthoritativeGstLock({
        gstAuthority: null,
        lockedSnap,
        gstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
      }),
    ).toBe(false);
  });

  test('locks 18% intra-state snapshot', () => {
    const lockedSnap = readAuthoritativeGst({
      gstAmount: 180,
      cgstAmount: 90,
      sgstAmount: 90,
      igstAmount: 0,
      isInterState: false,
      taxableAmount: 1000,
      gstRate: 18,
    });
    expect(
      isBackendAuthoritativeGstLock({
        gstAuthority: 'backend',
        lockedSnap,
        gstAmount: 180,
        cgstAmount: 90,
        sgstAmount: 90,
        igstAmount: 0,
      }),
    ).toBe(true);
  });

  test('locks 18% inter-state snapshot', () => {
    const lockedSnap = readAuthoritativeGst({
      gstAmount: 180,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 180,
      isInterState: true,
      taxableAmount: 1000,
      gstRate: 18,
    });
    expect(
      isBackendAuthoritativeGstLock({
        gstAuthority: 'backend',
        lockedSnap,
        gstAmount: 180,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 180,
      }),
    ).toBe(true);
  });

  test('incomplete split does not lock', () => {
    expect(
      hasCompleteGstSplit({
        gstAmount: 180,
        cgstAmount: 180,
        sgstAmount: 0,
        igstAmount: 0,
      }),
    ).toBe(false);
    expect(
      isBackendAuthoritativeGstLock({
        gstAuthority: 'backend',
        lockedSnap: { splitAvailable: true, gstAmount: 180 },
        gstAmount: 180,
        cgstAmount: 180,
        sgstAmount: 0,
        igstAmount: 0,
      }),
    ).toBe(false);
  });
});
