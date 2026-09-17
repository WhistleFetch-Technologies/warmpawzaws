import { compileJourneyTemplate } from '../promo-engine/journey-templates';

describe('compileJourneyTemplate', () => {
  it('compiles first grooming visit as category + visit_count = 0', () => {
    const group = compileJourneyTemplate({ template: 'first', serviceCategory: 'GROOMING' });
    expect(group.operator).toBe('AND');
    expect(group.conditions).toEqual([
      { field: 'transaction.service_category', operator: '=', value: 'GROOMING' },
      { field: 'user.grooming_visit_count', operator: '=', value: 0 },
    ]);
  });

  it('compiles second visit as completed count = 1', () => {
    const group = compileJourneyTemplate({ template: 'second', serviceCategory: 'VET' });
    expect(group.conditions).toContainEqual({
      field: 'user.vet_visit_count',
      operator: '=',
      value: 1,
    });
  });

  it('compiles nth visit as n-1 completed counts', () => {
    const group = compileJourneyTemplate({
      template: 'nth',
      serviceCategory: 'TRAINING',
      n: 4,
    });
    expect(group.conditions).toContainEqual({
      field: 'user.training_visit_count',
      operator: '=',
      value: 3,
    });
  });

  it('compiles winback 30d with visits >= 1 and days since last', () => {
    const group = compileJourneyTemplate({
      template: 'winback_30d',
      serviceCategory: 'GROOMING',
    });
    expect(group.conditions).toEqual([
      { field: 'transaction.service_category', operator: '=', value: 'GROOMING' },
      { field: 'user.grooming_visit_count', operator: '>=', value: 1 },
      { field: 'user.days_since_last_grooming', operator: '>=', value: 30 },
    ]);
  });

  it('compiles catalogue slugs with hyphens into behaviour keys', () => {
    const group = compileJourneyTemplate({
      template: 'first',
      serviceCategory: 'vet-care',
    });
    expect(group.conditions).toEqual([
      { field: 'transaction.service_category', operator: '=', value: 'vet-care' },
      { field: 'user.vet_care_visit_count', operator: '=', value: 0 },
    ]);
  });

  it('compiles every Nth with modulo payload', () => {
    const group = compileJourneyTemplate({
      template: 'every_nth',
      serviceCategory: 'BOARDING',
      n: 3,
    });
    expect(group.conditions).toContainEqual({
      field: 'user.boarding_visit_count',
      operator: '%',
      value: { divisor: 3, remainder: 0, offset: 1 },
    });
  });
});
