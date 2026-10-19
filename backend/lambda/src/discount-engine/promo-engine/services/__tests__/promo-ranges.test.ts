import {
  collapseToSingleRule,
  parseRangesInput,
  rangeBenefitMode,
  syncPromotionRanges,
  validateRangesInput,
} from '../promo-ranges';

const repo = {
  dbListRules: jest.fn(),
  dbInsertRangeRule: jest.fn(),
  dbUpdateRangeRule: jest.fn(),
  dbArchiveRules: jest.fn(),
  dbRuleUsageSummary: jest.fn(),
};

jest.mock('../../repos/promo-engine.repo', () => ({
  dbListRules: (...a: unknown[]) => repo.dbListRules(...a),
  dbInsertRangeRule: (...a: unknown[]) => repo.dbInsertRangeRule(...a),
  dbUpdateRangeRule: (...a: unknown[]) => repo.dbUpdateRangeRule(...a),
  dbArchiveRules: (...a: unknown[]) => repo.dbArchiveRules(...a),
  dbRuleUsageSummary: (...a: unknown[]) => repo.dbRuleUsageSummary(...a),
}));

const R1 = '11111111-1111-4111-8111-111111111111';
const R2 = '22222222-2222-4222-8222-222222222222';
const R3 = '33333333-3333-4333-8333-333333333333';

function body(ranges: unknown[]) {
  return parseRangesInput({ ranges })!;
}

const discount = (value: number) => ({ type: 'DISCOUNT', mode: 'FIXED', value, maxAmount: value });
const cashback = (value: number) => ({ type: 'CASHBACK', mode: 'FIXED', value, expiryDays: 30 });

describe('parseRangesInput / validateRangesInput', () => {
  it('returns undefined when the request has no ranges key', () => {
    expect(parseRangesInput({ benefitJson: [] })).toBeUndefined();
  });

  it('accepts contiguous ranges that share a boundary and an open last range', () => {
    const ranges = body([
      { minAmount: 500, maxAmount: 2000, benefitJson: [discount(125)] },
      { minAmount: 1, maxAmount: 500, benefitJson: [discount(55)] },
      { minAmount: 2000, maxAmount: null, benefitJson: [discount(250), cashback(100)] },
    ]);
    expect(validateRangesInput(ranges)).toEqual([]);
  });

  it('rejects overlaps, inverted bounds and an open range that is not last', () => {
    const errors = validateRangesInput(
      body([
        { minAmount: 0, maxAmount: null, benefitJson: [discount(10)] },
        { minAmount: 300, maxAmount: 200, benefitJson: [discount(10)] },
        { minAmount: 250, maxAmount: 900, benefitJson: [discount(10)] },
      ]),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        'Range 1: only the last range can have no maximum',
        'Range 2: maximum must be above the minimum',
      ]),
    );
    expect(errors.some((e) => e.includes('overlaps'))).toBe(true);
  });

  it('requires a benefit on active ranges but allows an empty switched-off range', () => {
    expect(validateRangesInput(body([{ minAmount: 0, maxAmount: 100, benefitJson: [] }]))).toEqual([
      'Range 1: add a discount or cashback (or switch the range off)',
    ]);
    expect(
      validateRangesInput(body([{ minAmount: 0, maxAmount: 100, active: false, benefitJson: [] }])),
    ).toEqual([]);
  });

  it('rejects bad limits, percentages over 100 and unknown copy placeholders', () => {
    const errors = validateRangesInput(
      body([
        {
          minAmount: 0,
          maxAmount: 100,
          benefitJson: [{ type: 'DISCOUNT', mode: 'PERCENT', value: 120 }],
          limits: { perUser: 1.5, budgetLimit: -1 },
          customerCopy: { earnLine: 'Get {bogus}' },
        },
      ]),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        'Range 1: discount % cannot exceed 100',
        'Range 1: per-customer limit must be a whole number of 0 or more',
        'Range 1: budget must be 0 or more',
      ]),
    );
    expect(errors.some((e) => e.includes('{bogus}'))).toBe(true);
  });

  it('derives the benefit mode from the values', () => {
    expect(rangeBenefitMode([discount(10), cashback(5)] as never)).toBe('both');
    expect(rangeBenefitMode([cashback(5)] as never)).toBe('cashback');
    expect(rangeBenefitMode([discount(0)] as never)).toBeNull();
  });
});

describe('syncPromotionRanges', () => {
  const target = {
    promotionId: 'p1',
    condition_json: { operator: 'AND' as const, conditions: [] },
    rule_type: 'CUSTOMER_JOURNEY' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo.dbListRules.mockResolvedValue([{ id: R1 }, { id: R2 }]);
    repo.dbUpdateRangeRule.mockImplementation(async (o: { ruleId: string }) => ({ id: o.ruleId }));
    repo.dbInsertRangeRule.mockResolvedValue({ id: R3 });
  });

  it('updates known ranges in bill order, inserts new ones and archives the rest', async () => {
    await syncPromotionRanges({
      ...target,
      ranges: body([
        { id: R2, minAmount: 500, maxAmount: null, benefitJson: [discount(125)] },
        { minAmount: 0, maxAmount: 500, label: 'Small', benefitJson: [discount(55)] },
      ]),
    });
    expect(repo.dbInsertRangeRule).toHaveBeenCalledWith(
      expect.objectContaining({
        range: expect.objectContaining({ sort_order: 1, label: 'Small', benefit_mode: 'discount' }),
      }),
    );
    expect(repo.dbUpdateRangeRule).toHaveBeenCalledWith(
      expect.objectContaining({ ruleId: R2, range: expect.objectContaining({ sort_order: 2 }) }),
    );
    expect(repo.dbArchiveRules).toHaveBeenCalledWith('p1', [R1]);
  });

  it('collapses back to one open rule with range settings cleared, reusing the first rule', async () => {
    await collapseToSingleRule({ ...target, benefit_json: [discount(80)] as never });
    expect(repo.dbUpdateRangeRule).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: R1,
        range: expect.objectContaining({
          min_amount: null,
          max_amount: null,
          benefit_mode: null,
          budget_limit: null,
        }),
      }),
    );
    expect(repo.dbArchiveRules).toHaveBeenCalledWith('p1', [R2]);
  });
});
