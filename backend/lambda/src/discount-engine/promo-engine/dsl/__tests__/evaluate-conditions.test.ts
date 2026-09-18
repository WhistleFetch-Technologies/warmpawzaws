import {
  buildEvalContext,
  evaluateConditionGroup,
  evaluateLeaf,
} from '../evaluate-conditions';

describe('promo-engine DSL', () => {
  const baseTx = {
    type: 'BOOKING',
    service_category: 'GROOMING',
    amount: 1500,
  };

  it('passes winback conditions when visits>=1 and days>=30', () => {
    const ctx = buildEvalContext({
      userId: 'U1',
      transaction: baseTx,
      behaviour: {
        overall: { completed_orders: 5, total_spend: 8000 },
        services: {
          grooming: {
            completed_count: 5,
            last_completed_at: new Date(Date.now() - 45 * 86400000).toISOString(),
            total_spend: 4500,
          },
        },
      },
    });

    const group = {
      operator: 'AND' as const,
      conditions: [
        { field: 'transaction.service_category', operator: '=', value: 'GROOMING' },
        { field: 'user.grooming_visit_count', operator: '>=', value: 1 },
        { field: 'user.days_since_last_grooming', operator: '>=', value: 30 },
      ],
    };

    const result = evaluateConditionGroup(group, ctx);
    expect(result.pass).toBe(true);
  });

  it('fails winback when days < 30 and explains', () => {
    const ctx = buildEvalContext({
      userId: 'U1',
      transaction: baseTx,
      behaviour: {
        services: {
          grooming: {
            completed_count: 2,
            last_completed_at: new Date(Date.now() - 18 * 86400000).toISOString(),
          },
        },
      },
    });

    const leaf = evaluateLeaf(
      { field: 'user.days_since_last_grooming', operator: '>=', value: 30 },
      ctx
    );
    expect(leaf.pass).toBe(false);
    expect(leaf.failure?.actual).toBe(18);
  });

  it('treats missing behaviour profile as first visit (visit_count = 0)', () => {
    const ctx = buildEvalContext({
      userId: 'U1',
      transaction: { type: 'BOOKING', service_category: 'VET', amount: 699 },
    });
    const leaf = evaluateLeaf(
      { field: 'user.veterinary_visit_count', operator: '=', value: 0 },
      ctx
    );
    expect(leaf.pass).toBe(true);
    expect(ctx['transaction.service_category']).toBe('veterinary');
  });

  it('matches VET checkout token to veterinary condition', () => {
    const ctx = buildEvalContext({
      userId: 'U1',
      transaction: { type: 'BOOKING', service_category: 'VET', amount: 699 },
    });
    const leaf = evaluateLeaf(
      { field: 'transaction.service_category', operator: '=', value: 'veterinary' },
      ctx
    );
    expect(leaf.pass).toBe(true);
  });

  it('treats first visit as grooming_visit_count = 0', () => {
    const ctx = buildEvalContext({
      userId: 'U1',
      transaction: baseTx,
      behaviour: { services: { grooming: { completed_count: 0 } } },
    });
    const leaf = evaluateLeaf(
      { field: 'user.grooming_visit_count', operator: '=', value: 0 },
      ctx
    );
    expect(leaf.pass).toBe(true);
  });

  it('supports every Nth via % operator with offset', () => {
    const ctx = buildEvalContext({
      userId: 'U1',
      transaction: baseTx,
      behaviour: { services: { grooming: { completed_count: 2 } } },
    });
    // visit 3 at booking: completed=2, offset+1 → 3 % 3 === 0
    const leaf = evaluateLeaf(
      {
        field: 'user.grooming_visit_count',
        operator: '%',
        value: { divisor: 3, remainder: 0, offset: 1 },
      },
      ctx
    );
    expect(leaf.pass).toBe(true);
  });
});
