const capRepo = {
  dbGetBenefitCapSettings: jest.fn(),
  dbListBenefitPaymentsSince: jest.fn(),
  dbSaveBenefitCapSettings: jest.fn(),
  dbTransactionHasUsage: jest.fn(),
};
const mockAudit = jest.fn();

jest.mock('../../repos/benefit-cap.repo', () => ({
  dbGetBenefitCapSettings: (...a: unknown[]) => capRepo.dbGetBenefitCapSettings(...a),
  dbListBenefitPaymentsSince: (...a: unknown[]) => capRepo.dbListBenefitPaymentsSince(...a),
  dbSaveBenefitCapSettings: (...a: unknown[]) => capRepo.dbSaveBenefitCapSettings(...a),
  dbTransactionHasUsage: (...a: unknown[]) => capRepo.dbTransactionHasUsage(...a),
}));
jest.mock('../../repos/promo-engine.repo', () => ({
  dbInsertAudit: (...a: unknown[]) => mockAudit(...a),
}));

import {
  clearBenefitCapConfigCache,
  resolveBenefitCapNotice,
  resolveWalletBenefitCap,
  saveBenefitCapSettings,
} from '../benefit-cap.service';

const CUSTOMER = '9c6f3ba6-efdc-408b-86c4-2c2c3ce1e318';
const ist = (s: string) => new Date(`${s}+05:30`);
const settings = (over: Record<string, unknown> = {}) => ({
  benefit_cap: {
    enabled: true,
    max_benefit_payments: 3,
    window_type: 'calendar',
    window_length: 1,
    window_unit: 'days',
    reset_time: '00:00',
    block: 'both',
    waive_platform_fee: true,
    ...over,
  },
  updated_by: null,
  updated_at: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  clearBenefitCapConfigCache();
  capRepo.dbGetBenefitCapSettings.mockResolvedValue(settings());
});

describe('resolveBenefitCapNotice', () => {
  it('replays the split-bill case: payments 4 and 5 of the day are capped', async () => {
    const paid = ['09:24', '09:26', '09:29', '09:31'].map((t, i) => ({
      ref: `pay-${i + 1}`,
      at: ist(`2026-10-09T${t}:00`),
    }));
    const results = [];
    for (let n = 0; n < 5; n += 1) {
      capRepo.dbListBenefitPaymentsSince.mockResolvedValueOnce(paid.slice(0, n));
      results.push(
        await resolveBenefitCapNotice({ userId: CUSTOMER, channel: 'paybill', now: ist('2026-10-09T09:33:00') }),
      );
    }
    expect(results.map((r) => (r ? r.used : null))).toEqual([null, null, null, 3, 4]);
    expect(results[3]).toMatchObject({
      code: 'BENEFIT_CAP_REACHED',
      cap: 3,
      platformFeeWaived: true,
      resumeAt: ist('2026-10-10T00:00:00').toISOString(),
    });
    expect(capRepo.dbListBenefitPaymentsSince).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: CUSTOMER, since: ist('2026-10-09T00:00:00') }),
    );
  });

  it('next day starts a fresh window', async () => {
    capRepo.dbListBenefitPaymentsSince.mockResolvedValue([]);
    const notice = await resolveBenefitCapNotice({ userId: CUSTOMER, now: ist('2026-10-10T08:00:00') });
    expect(notice).toBeNull();
    expect(capRepo.dbListBenefitPaymentsSince).toHaveBeenCalledWith(
      expect.objectContaining({ since: ist('2026-10-10T00:00:00') }),
    );
  });

  it('is off when disabled, for non-customer ids, and when the count fails', async () => {
    capRepo.dbGetBenefitCapSettings.mockResolvedValue(settings({ enabled: false }));
    expect(await resolveBenefitCapNotice({ userId: CUSTOMER })).toBeNull();
    expect(capRepo.dbListBenefitPaymentsSince).not.toHaveBeenCalled();

    expect(await resolveBenefitCapNotice({ userId: 'admin-sim' })).toBeNull();

    clearBenefitCapConfigCache();
    capRepo.dbGetBenefitCapSettings.mockResolvedValue(settings());
    capRepo.dbListBenefitPaymentsSince.mockRejectedValue(new Error('db down'));
    expect(await resolveBenefitCapNotice({ userId: CUSTOMER })).toBeNull();
  });

  it('treats a missing settings table as cap off', async () => {
    capRepo.dbGetBenefitCapSettings.mockRejectedValue(new Error('relation does not exist'));
    expect(await resolveBenefitCapNotice({ userId: CUSTOMER })).toBeNull();
  });

  it('wallet is only blocked when the cap blocks cashback', async () => {
    const three = [1, 2, 3].map((i) => ({ ref: `p${i}`, at: new Date() }));
    capRepo.dbListBenefitPaymentsSince.mockResolvedValue(three);
    capRepo.dbGetBenefitCapSettings.mockResolvedValue(settings({ block: 'discount' }));
    expect(await resolveWalletBenefitCap({ userId: CUSTOMER })).toBeNull();

    clearBenefitCapConfigCache();
    capRepo.dbGetBenefitCapSettings.mockResolvedValue(settings({ block: 'cashback' }));
    expect((await resolveWalletBenefitCap({ userId: CUSTOMER }))?.blocked.wallet).toBe(true);
  });
});

describe('saveBenefitCapSettings', () => {
  it('rejects invalid input without writing', async () => {
    const res = await saveBenefitCapSettings({ max_benefit_payments: -1 }, 'admin-1');
    expect(res.ok).toBe(false);
    expect(capRepo.dbSaveBenefitCapSettings).not.toHaveBeenCalled();
  });

  it('saves the normalized config, audits before/after and refreshes the cache', async () => {
    const input = settings({ max_benefit_payments: 2, window_type: 'rolling', window_length: 24, window_unit: 'hours' })
      .benefit_cap;
    const res = await saveBenefitCapSettings(input, 'admin-1');
    expect(res).toMatchObject({ ok: true, benefitCap: { max_benefit_payments: 2, window_type: 'rolling' } });
    expect(capRepo.dbSaveBenefitCapSettings).toHaveBeenCalledWith(
      expect.objectContaining({ max_benefit_payments: 2, window_unit: 'hours' }),
      'admin-1',
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'BENEFIT_CAP_SETTINGS_UPDATED' }),
    );
  });
});
