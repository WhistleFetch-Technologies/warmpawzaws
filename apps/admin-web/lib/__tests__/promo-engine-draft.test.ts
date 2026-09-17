import { applyBasicsToDraft, filterPromoEngineRows, validateBasicsDraft } from '../promo-engine/draft';
import { canTransition } from '../promo-engine/status';
import { createEmptyDraft, createEmptyBasics, type PromoEngineListItem } from '../promo-engine/types';

function item(partial: Partial<PromoEngineListItem>): PromoEngineListItem {
  return {
    id: '1',
    name: 'Grooming Win Back',
    code: 'PROMO-GRM-001',
    status: 'DRAFT',
    serviceCategories: ['GROOMING'],
    ruleType: 'CUSTOMER_JOURNEY',
    fundingType: 'WARMPAWZ',
    usageCount: 0,
    startAt: '',
    endAt: '',
    updatedAt: '2026-09-17T00:00:00.000Z',
    ...partial,
  };
}

describe('validateBasicsDraft', () => {
  it('requires a name', () => {
    expect(validateBasicsDraft(createEmptyBasics())).toContain('Promotion name is required');
  });

  it('rejects inverted dates', () => {
    const basics = createEmptyBasics();
    basics.name = 'Winback';
    basics.startAt = '2026-12-01T00:00';
    basics.endAt = '2026-01-01T00:00';
    expect(validateBasicsDraft(basics)).toContain('End date must be on or after start date');
  });

  it('requires shared split to total 100', () => {
    const basics = createEmptyBasics();
    basics.name = 'Shared';
    basics.fundingType = 'SHARED';
    basics.fundingSplit = { warmpawzPercent: 70, vendorPercent: 20 };
    expect(validateBasicsDraft(basics)).toContain('Shared funding split must add up to 100%');
  });

  it('accepts a valid draft', () => {
    const basics = createEmptyBasics();
    basics.name = 'Grooming Win Back';
    basics.priority = 80;
    expect(validateBasicsDraft(basics)).toEqual([]);
  });
});

describe('filterPromoEngineRows', () => {
  const rows = [
    item({ id: 'a', name: 'Grooming Win Back', code: 'PROMO-GRM-001' }),
    item({
      id: 'b',
      name: 'Vet first visit',
      code: 'PROMO-VET-001',
      status: 'ACTIVE',
      serviceCategories: ['VET'],
      ruleType: 'GENERIC',
    }),
  ];

  it('returns all rows with empty filters', () => {
    expect(filterPromoEngineRows(rows, { query: '', status: 'all', service: 'all', type: 'all' })).toHaveLength(2);
  });

  it('filters by search, status, service, and type', () => {
    expect(
      filterPromoEngineRows(rows, { query: 'vet', status: 'ACTIVE', service: 'VET', type: 'GENERIC' }).map((r) => r.id),
    ).toEqual(['b']);
  });

  it('returns empty when nothing matches', () => {
    expect(
      filterPromoEngineRows(rows, { query: 'boarding', status: 'all', service: 'all', type: 'all' }),
    ).toEqual([]);
  });
});

describe('applyBasicsToDraft + status', () => {
  it('trims name and updates timestamp', () => {
    const draft = createEmptyDraft('x', '2026-01-01T00:00:00.000Z');
    const basics = createEmptyBasics();
    basics.name = '  Winback  ';
    const next = applyBasicsToDraft(draft, basics);
    expect(next.basics.name).toBe('Winback');
    expect(next.updatedAt).not.toBe(draft.updatedAt);
  });

  it('allows draft to active and blocks archived to active', () => {
    expect(canTransition('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransition('ARCHIVED', 'ACTIVE')).toBe(false);
  });
});
