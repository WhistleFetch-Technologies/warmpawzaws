import {
  DEFAULT_BENEFIT_CAP,
  normalizeBenefitCapConfig,
  validateBenefitCapInput,
  type BenefitCapConfig,
} from '../config';
import {
  applyBenefitCapToResult,
  buildBenefitCapNotice,
  renderBenefitCapMessage,
} from '../gate';
import { benefitCapResumeAt, benefitCapWindowStart, formatIstResumeTime } from '../window';
import type { EvaluateResult } from '../../types';

const cfg = (over: Partial<BenefitCapConfig> = {}): BenefitCapConfig => ({
  ...DEFAULT_BENEFIT_CAP,
  enabled: true,
  ...over,
});

/** IST wall clock → Date. */
const ist = (s: string) => new Date(`${s}+05:30`);

describe('benefit cap settings', () => {
  it('accepts a valid config and rejects bad values with readable errors', () => {
    expect(validateBenefitCapInput({ ...DEFAULT_BENEFIT_CAP })).toEqual([]);
    const errors = validateBenefitCapInput({
      max_benefit_payments: 0,
      window_type: 'monthly',
      window_length: 2,
      window_unit: 'weeks',
      reset_time: '25:00',
      block: 'all',
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Max benefit payments/),
        expect.stringMatching(/Window type/),
        expect.stringMatching(/Block must be/),
      ]),
    );
    expect(
      validateBenefitCapInput({ ...DEFAULT_BENEFIT_CAP, window_length: 5, window_unit: 'weeks' }),
    ).toEqual(['Window cannot be longer than 30 days']);
    expect(
      validateBenefitCapInput({ ...DEFAULT_BENEFIT_CAP, reset_time: '4:00' }),
    ).toEqual(['Reset time must be HH:MM (24-hour, IST)']);
  });

  it('reads stored JSON leniently and is off unless enabled is exactly true', () => {
    expect(normalizeBenefitCapConfig(null)).toEqual(DEFAULT_BENEFIT_CAP);
    expect(normalizeBenefitCapConfig({ enabled: 'true' }).enabled).toBe(false);
    const n = normalizeBenefitCapConfig({
      enabled: true,
      max_benefit_payments: 2,
      window_type: 'rolling',
      window_length: 24,
      window_unit: 'hours',
      block: 'discount',
      waive_platform_fee: false,
      message: '  Hold on  ',
    });
    expect(n).toMatchObject({
      enabled: true,
      max_benefit_payments: 2,
      window_type: 'rolling',
      window_length: 24,
      window_unit: 'hours',
      block: 'discount',
      waive_platform_fee: false,
      message: 'Hold on',
    });
  });
});

describe('benefit cap window', () => {
  const now = ist('2026-10-09T09:30:00'); // Friday

  it('calendar day resets at midnight IST', () => {
    expect(benefitCapWindowStart(now, cfg())).toEqual(ist('2026-10-09T00:00:00'));
    expect(benefitCapResumeAt(now, cfg(), [])).toEqual(ist('2026-10-10T00:00:00'));
  });

  it('calendar day with a 04:00 reset keeps 1 AM in the previous window', () => {
    const c = cfg({ reset_time: '04:00' });
    expect(benefitCapWindowStart(ist('2026-10-09T01:00:00'), c)).toEqual(ist('2026-10-08T04:00:00'));
    expect(benefitCapWindowStart(now, c)).toEqual(ist('2026-10-09T04:00:00'));
  });

  it('calendar week runs Monday to Monday', () => {
    const c = cfg({ window_unit: 'weeks' });
    expect(benefitCapWindowStart(now, c)).toEqual(ist('2026-10-05T00:00:00'));
    expect(benefitCapResumeAt(now, c, [])).toEqual(ist('2026-10-12T00:00:00'));
  });

  it('calendar 6 hours splits the day into fixed blocks from the reset time', () => {
    const c = cfg({ window_length: 6, window_unit: 'hours' });
    expect(benefitCapWindowStart(now, c)).toEqual(ist('2026-10-09T06:00:00'));
    expect(benefitCapResumeAt(now, c, [])).toEqual(ist('2026-10-09T12:00:00'));
  });

  it('rolling 24 hours looks back from now and resumes when the oldest counted payment ages out', () => {
    const c = cfg({ window_type: 'rolling', window_length: 24, window_unit: 'hours' });
    expect(benefitCapWindowStart(now, c)).toEqual(ist('2026-10-08T09:30:00'));
    const times = [ist('2026-10-09T09:24:00'), ist('2026-10-09T09:26:00'), ist('2026-10-09T09:28:00')];
    expect(benefitCapResumeAt(now, c, times)).toEqual(ist('2026-10-10T09:24:00'));
    // Four counted (one slipped through concurrently): two must age out.
    expect(benefitCapResumeAt(now, c, [...times, ist('2026-10-09T09:29:00')])).toEqual(
      ist('2026-10-10T09:26:00'),
    );
  });

  it('formats the resume time in IST', () => {
    expect(formatIstResumeTime(ist('2026-10-10T00:00:00'))).toBe('10 Oct at 12:00 AM');
    expect(formatIstResumeTime(ist('2026-10-10T13:05:00'))).toBe('10 Oct at 1:05 PM');
  });
});

describe('benefit cap gate', () => {
  const evaluated: Omit<EvaluateResult, 'evaluation_id'> = {
    eligible: true,
    winner_promotion_id: 'promo-v2',
    customer_copy: { earnLine: 'Earn' },
    benefits: [
      { promotion_id: 'promo-v2', rule_id: 'rule-1', benefit_type: 'DISCOUNT', amount: 350, benefit_index: 0 },
      { promotion_id: 'promo-v2', rule_id: 'rule-1', benefit_type: 'CASHBACK', amount: 50, benefit_index: 1 },
    ],
    summary: { gross_amount: 4000, discount: 350, payable: 3650, cashback: 50 },
    explain: { failures: [], matched_promotions: ['promo-v2'], rejected_promotions: [] },
  };
  const notice = (block: BenefitCapConfig['block'], channel = 'paybill') =>
    buildBenefitCapNotice({
      cfg: cfg({ block }),
      used: 3,
      resumeAt: ist('2026-10-10T00:00:00'),
      channel,
    });

  it('both: no discount, no cashback, full payable, winner cleared, reason recorded', () => {
    const out = applyBenefitCapToResult(evaluated, notice('both'));
    expect(out.benefits).toEqual([]);
    expect(out.summary).toEqual({ gross_amount: 4000, discount: 0, payable: 4000, cashback: 0 });
    expect(out.eligible).toBe(false);
    expect(out.winner_promotion_id).toBeNull();
    expect(out.explain.rejected_promotions).toContainEqual({
      promotion_id: 'promo-v2',
      reason: 'BENEFIT_CAP_REACHED',
    });
    expect(out.benefit_cap?.blocked).toEqual({ discount: true, cashback: true, wallet: true });
  });

  it('discount: cashback still earned, bill paid in full', () => {
    const out = applyBenefitCapToResult(evaluated, notice('discount'));
    expect(out.summary).toEqual({ gross_amount: 4000, discount: 0, payable: 4000, cashback: 50 });
    expect(out.eligible).toBe(true);
    expect(out.winner_promotion_id).toBe('promo-v2');
    expect(out.benefit_cap?.blocked).toEqual({ discount: true, cashback: false, wallet: false });
  });

  it('cashback: discount kept, no cashback and no wallet', () => {
    const out = applyBenefitCapToResult(evaluated, notice('cashback'));
    expect(out.summary).toEqual({ gross_amount: 4000, discount: 350, payable: 3650, cashback: 0 });
    expect(out.benefit_cap?.blocked).toEqual({ discount: false, cashback: true, wallet: true });
  });

  it('never touches the input result', () => {
    applyBenefitCapToResult(evaluated, notice('both'));
    expect(evaluated.benefits).toHaveLength(2);
    expect(evaluated.summary.discount).toBe(350);
  });

  it('waives the platform fee on Pay Bill only', () => {
    expect(notice('both', 'paybill').platformFeeWaived).toBe(true);
    expect(notice('both', 'appointment').platformFeeWaived).toBe(false);
    expect(
      buildBenefitCapNotice({ cfg: cfg({ waive_platform_fee: false }), used: 3, resumeAt: null, channel: 'paybill' })
        .platformFeeWaived,
    ).toBe(false);
  });

  it('tells the customer what is blocked and when offers resume', () => {
    expect(notice('both').message).toBe(
      "You've used 3 offer payments in this period. This payment won't get a discount, cashback or wallet use. The platform fee is waived on this payment. Offers resume on 10 Oct at 12:00 AM.",
    );
    expect(notice('discount', 'ecommerce').message).toBe(
      "You've used 3 offer payments in this period. This payment won't get a discount. Offers resume on 10 Oct at 12:00 AM.",
    );
    expect(
      renderBenefitCapMessage('Limit {cap} hit ({used}). No {blocked}. Back {resume_at}. {unknown}', {
        ...notice('cashback', 'tele'),
      }),
    ).toBe('Limit 3 hit (3). No cashback or wallet use. Back on 10 Oct at 12:00 AM. {unknown}');
  });
});
