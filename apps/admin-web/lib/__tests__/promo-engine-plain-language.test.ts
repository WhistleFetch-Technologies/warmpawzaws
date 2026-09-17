import { compileJourneyTemplate } from '../promo-engine/journey-templates';
import {
  describeBenefits,
  describeConditionGroup,
  describeRedeemScope,
} from '../promo-engine/plain-language';

describe('describeConditionGroup', () => {
  it('describes a winback template in plain language', () => {
    const group = compileJourneyTemplate({ template: 'winback_30d', serviceCategory: 'GROOMING' });
    const text = describeConditionGroup(group);
    expect(text).toContain('booking service is GROOMING');
    expect(text).toContain('completed grooming visits is at least 1');
    expect(text).toContain('days since last grooming is at least 30');
  });

  it('returns empty copy when no conditions', () => {
    expect(describeConditionGroup({ operator: 'AND', conditions: [] })).toBe('No audience rules yet');
  });
});

describe('describeBenefits / redeem', () => {
  it('notes missing benefits for Phase 4', () => {
    expect(describeBenefits([])).toContain('Phase 4');
    expect(describeRedeemScope([])).toContain('Phase 4');
  });

  it('formats discount and cashback', () => {
    const text = describeBenefits([
      { type: 'DISCOUNT', mode: 'PERCENT', value: 20, maxAmount: 300 },
      { type: 'CASHBACK', mode: 'FIXED', value: 150, expiryDays: 30, redeemScope: ['VET', 'TRAINING'] },
    ]);
    expect(text).toContain('DISCOUNT 20%');
    expect(text).toContain('max ₹300');
    expect(text).toContain('CASHBACK ₹150');
    expect(describeRedeemScope([
      { type: 'CASHBACK', redeemScope: ['VET', 'TRAINING'] },
    ])).toBe('VET, TRAINING');
  });
});
