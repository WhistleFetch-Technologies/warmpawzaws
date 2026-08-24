import { describe, expect, test } from '@jest/globals';
import {
  correctLedgerFromFundingSnapshot,
  resolveStoredGstPercent,
} from '../funding-aware-ledger-correction';

describe('correctLedgerFromFundingSnapshot', () => {
  test('Chandrali COLLABCODE uses snapshot vendor settlement 1799.10', () => {
    const corrected = correctLedgerFromFundingSnapshot(
      { gross: 40, commission: 4, net: 36 },
      {
        available: true,
        fundingType: 'PLATFORM',
        winningOfferType: 'PLATFORM_COUPON',
        platformCoupon: 1999,
        commissionBase: 1999,
        commissionAmount: 199.9,
        vendorSettlement: 1799.1,
      },
      40,
    );
    expect(corrected).toEqual({ gross: 1999, commission: 199.9, net: 1799.1 });
  });

  test('does not change Pawsome when ledger already matches service gross', () => {
    const ledger = { gross: 1350, commission: 135, net: 1215 };
    expect(
      correctLedgerFromFundingSnapshot(
        ledger,
        {
          available: true,
          fundingType: null,
          winningOfferType: null,
          platformCoupon: 0,
          commissionBase: 1350,
          commissionAmount: 135,
          vendorSettlement: 1215,
        },
        1620,
      ),
    ).toEqual(ledger);
  });

  test('does not change Dr Manu when ledger net already matches snapshot', () => {
    const ledger = { gross: 400, commission: 40, net: 360 };
    expect(
      correctLedgerFromFundingSnapshot(
        ledger,
        {
          available: true,
          fundingType: 'PLATFORM',
          winningOfferType: 'PLATFORM_COUPON',
          platformCoupon: 400,
          commissionBase: 400,
          commissionAmount: 40,
          vendorSettlement: 360,
        },
        0,
      ),
    ).toEqual(ledger);
  });

  test('rejects inconsistent snapshot so GST-unrelated money is not invented', () => {
    expect(
      correctLedgerFromFundingSnapshot(
        { gross: 40, commission: 4, net: 36 },
        {
          available: true,
          fundingType: 'PLATFORM',
          winningOfferType: 'PLATFORM_COUPON',
          platformCoupon: 1999,
          commissionBase: 1999,
          commissionAmount: 1,
          vendorSettlement: 1799.1,
        },
        40,
      ),
    ).toEqual({ gross: 40, commission: 4, net: 36 });
  });
});

describe('resolveStoredGstPercent', () => {
  test('is 0 when no GST was collected even if a catalog rate exists', () => {
    expect(resolveStoredGstPercent({ gstRate: 18, gstTotal: 0, taxableValue: 1620 })).toBe(0);
  });

  test('uses stored gst_rate when GST amount is present', () => {
    expect(resolveStoredGstPercent({ gstRate: 18, gstTotal: 324, taxableValue: 1800 })).toBe(18);
  });

  test('derives percent from stored GST over taxable when rate column is empty', () => {
    expect(resolveStoredGstPercent({ gstTotal: 267.3, taxableValue: 1485 })).toBe(18);
  });
});
