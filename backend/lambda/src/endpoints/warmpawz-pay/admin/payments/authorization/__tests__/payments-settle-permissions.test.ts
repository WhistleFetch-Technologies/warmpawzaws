import {
  hasWpayPaymentsSettlePermission,
  WPAY_PAYMENTS_SETTLE,
} from '../permissions';
import { WPAY_LEGACY_FULL_ACCESS } from '../../../catalogue/authorization/permissions';

describe('hasWpayPaymentsSettlePermission', () => {
  it('grants admin.full_access', () => {
    expect(hasWpayPaymentsSettlePermission(['admin.full_access'], WPAY_PAYMENTS_SETTLE)).toBe(
      true,
    );
  });

  it('grants legacy admin.warmpawz_pay', () => {
    expect(
      hasWpayPaymentsSettlePermission([WPAY_LEGACY_FULL_ACCESS], WPAY_PAYMENTS_SETTLE),
    ).toBe(true);
  });

  it('grants granular settle permission', () => {
    expect(hasWpayPaymentsSettlePermission([WPAY_PAYMENTS_SETTLE], WPAY_PAYMENTS_SETTLE)).toBe(
      true,
    );
  });

  it('denies dashboard.view alone', () => {
    expect(
      hasWpayPaymentsSettlePermission(['admin.warmpawz_pay.dashboard.view'], WPAY_PAYMENTS_SETTLE),
    ).toBe(false);
  });
});
