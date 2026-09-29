import {
  cashbackAllowedWithinBudget,
  checkPromoLimits,
  countLimitExceededAfterInsert,
  istDayStart,
  normalizePromoLimitsInput,
  validatePromoLimitsInput,
} from '../promo-limits';
import type { PromoEnginePromotionRow } from '../../types';

function promo(partial: Partial<PromoEnginePromotionRow> = {}): PromoEnginePromotionRow {
  return {
    id: 'p1',
    code: null,
    name: 'P1',
    status: 'ACTIVE',
    priority: 10,
    start_at: null,
    end_at: null,
    stacking_policy: null,
    funding_type: null,
    funding_split: {},
    budget_limit: null,
    budget_consumed: 0,
    commercial_campaign_id: null,
    service_categories: [],
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

const noLimits = {
  promotion_id: 'p1',
  per_user: null,
  per_transaction: null,
  daily_limit: null,
  campaign_limit: null,
  budget_limit: null,
};

describe('istDayStart', () => {
  it('returns IST midnight (18:30Z previous day) for an early-morning IST instant', () => {
    // 02:00 IST on 30 Sep = 20:30Z on 29 Sep
    expect(istDayStart(new Date('2026-09-29T20:30:00Z')).toISOString()).toBe('2026-09-29T18:30:00.000Z');
  });

  it('returns same-day IST midnight for an afternoon IST instant', () => {
    // 15:00 IST on 29 Sep = 09:30Z
    expect(istDayStart(new Date('2026-09-29T09:30:00Z')).toISOString()).toBe('2026-09-28T18:30:00.000Z');
  });
});

describe('checkPromoLimits (evaluate time, usage excludes current txn)', () => {
  it('passes with no limits', () => {
    expect(checkPromoLimits({ promo: promo(), limits: noLimits, usage: undefined }).ok).toBe(true);
  });

  it('blocks per user once the count reaches the limit', () => {
    const r = checkPromoLimits({
      promo: promo(),
      limits: { ...noLimits, per_user: 1 },
      usage: { user: 1, campaign: 1, daily: 1 },
    });
    expect(r).toEqual({ ok: false, reason: 'PER_USER_LIMIT' });
  });

  it('allows per user below the limit', () => {
    const r = checkPromoLimits({
      promo: promo(),
      limits: { ...noLimits, per_user: 2 },
      usage: { user: 1, campaign: 5, daily: 1 },
    });
    expect(r.ok).toBe(true);
  });

  it('blocks campaign total and daily limits', () => {
    expect(
      checkPromoLimits({
        promo: promo(),
        limits: { ...noLimits, campaign_limit: 2 },
        usage: { user: 0, campaign: 2, daily: 0 },
      }).reason,
    ).toBe('CAMPAIGN_LIMIT');
    expect(
      checkPromoLimits({
        promo: promo(),
        limits: { ...noLimits, daily_limit: 1 },
        usage: { user: 0, campaign: 3, daily: 1 },
      }).reason,
    ).toBe('DAILY_LIMIT');
  });

  it('blocks when budget consumed reaches the cap (limits row wins over promotion column)', () => {
    expect(
      checkPromoLimits({
        promo: promo({ budget_limit: 1000, budget_consumed: 300 }),
        limits: { ...noLimits, budget_limit: 300 },
        usage: undefined,
      }).reason,
    ).toBe('BUDGET_EXHAUSTED');
  });

  it('per_transaction = 0 disables the promotion', () => {
    expect(
      checkPromoLimits({ promo: promo(), limits: { ...noLimits, per_transaction: 0 }, usage: undefined }).reason,
    ).toBe('PER_TRANSACTION_LIMIT');
  });
});

describe('countLimitExceededAfterInsert (commit time, usage includes own row)', () => {
  it('is fine when the own row brings the count exactly to the limit', () => {
    expect(countLimitExceededAfterInsert({ ...noLimits, per_user: 1 }, { user: 1, campaign: 1, daily: 1 })).toBeNull();
  });

  it('flags a concurrent overshoot', () => {
    expect(countLimitExceededAfterInsert({ ...noLimits, per_user: 1 }, { user: 2, campaign: 2, daily: 2 })).toBe(
      'PER_USER_LIMIT',
    );
    expect(countLimitExceededAfterInsert({ ...noLimits, campaign_limit: 2 }, { user: 1, campaign: 3, daily: 1 })).toBe(
      'CAMPAIGN_LIMIT',
    );
  });
});

describe('cashbackAllowedWithinBudget', () => {
  it('keeps full cashback under the cap', () => {
    expect(cashbackAllowedWithinBudget({ budgetCap: 300, consumedAfter: 300, cashback: 150 })).toBe(150);
  });

  it('trims cashback by the overshoot', () => {
    expect(cashbackAllowedWithinBudget({ budgetCap: 300, consumedAfter: 400, cashback: 150 })).toBe(50);
  });

  it('withholds all cashback when overshoot exceeds it', () => {
    expect(cashbackAllowedWithinBudget({ budgetCap: 300, consumedAfter: 600, cashback: 150 })).toBe(0);
  });

  it('ignores budget when uncapped', () => {
    expect(cashbackAllowedWithinBudget({ budgetCap: null, consumedAfter: 99999, cashback: 150 })).toBe(150);
  });
});

describe('validatePromoLimitsInput', () => {
  it('accepts blanks, nulls and whole numbers', () => {
    expect(
      validatePromoLimitsInput({ per_user: 1, per_transaction: null, daily_limit: '', campaign_limit: 10, budget_limit: 500.5 }),
    ).toEqual([]);
  });

  it('rejects decimals and negatives on count limits', () => {
    const errors = validatePromoLimitsInput({ per_user: 1.5, campaign_limit: -1 });
    expect(errors).toHaveLength(2);
  });

  it('rejects negative budget', () => {
    expect(validatePromoLimitsInput({ budget_limit: -10 })).toHaveLength(1);
  });

  it('normalises blanks to null', () => {
    expect(normalizePromoLimitsInput({ per_user: '' as unknown as number, daily_limit: 3 })).toEqual({
      per_user: null,
      per_transaction: null,
      daily_limit: 3,
      campaign_limit: null,
      budget_limit: null,
    });
  });
});
