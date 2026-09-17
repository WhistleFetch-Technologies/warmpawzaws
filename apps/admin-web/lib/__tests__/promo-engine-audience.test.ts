import {
  applyAudienceToDraft,
  buildAudienceCondition,
  defaultAudienceState,
  validateAudience,
} from '../promo-engine/audience';
import { createEmptyDraft } from '../promo-engine/types';

describe('buildAudienceCondition', () => {
  it('compiles winback and appends package extra with AND', () => {
    const group = buildAudienceCondition({
      ...defaultAudienceState(),
      serviceCategory: 'GROOMING',
      template: 'winback_30d',
      packageName: 'Full Groom',
      extras: [],
      groupOperator: 'AND',
      n: 3,
      m: 5,
    });
    expect(group.operator).toBe('AND');
    expect(group.conditions).toContainEqual({
      field: 'transaction.package',
      operator: '=',
      value: 'Full Groom',
    });
    expect(group.conditions).toContainEqual({
      field: 'user.days_since_last_grooming',
      operator: '>=',
      value: 30,
    });
  });
});

describe('applyAudienceToDraft + validate', () => {
  it('sets CUSTOMER_JOURNEY and service chip', () => {
    const draft = createEmptyDraft('x');
    const next = applyAudienceToDraft(draft, {
      ...defaultAudienceState(draft),
      serviceCategory: 'VET',
      template: 'first',
    });
    expect(next.ruleType).toBe('CUSTOMER_JOURNEY');
    expect(next.basics.serviceCategories).toContain('VET');
    expect(next.conditionJson.conditions.length).toBeGreaterThan(0);
    expect(validateAudience(next)).toEqual([]);
  });

  it('rejects empty audience', () => {
    expect(validateAudience(createEmptyDraft('x'))).toEqual([
      'Pick a catalogue service so the rule can match bookings',
    ]);
  });
});
