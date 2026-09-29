import {
  applyBasicsToDraft,
  filterPromoEngineRows,
  validateBasicsDraft,
  validateCustomerCopyDraft,
  validateGoLiveSchedule,
  validateLimitsDraft,
} from '../promo-engine/draft';
import { canTransition } from '../promo-engine/status';
import {
  createEmptyDraft,
  createEmptyBasics,
  effectivePromoStatus,
  type PromoEngineListItem,
} from '../promo-engine/types';

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
    expect(validateBasicsDraft(basics)).toContain('End date must be after start date');
  });

  it('rejects an end date equal to the start date', () => {
    const basics = createEmptyBasics();
    basics.name = 'Same minute';
    basics.startAt = '2026-09-29T14:52';
    basics.endAt = '2026-09-29T14:52';
    expect(validateBasicsDraft(basics)).toContain('End date must be after start date');
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

describe('expiry + limits + customer copy', () => {
  const now = new Date('2026-09-29T09:30:00.000Z'); // 15:00 IST

  it('shows ACTIVE / PAUSED past their IST end as EXPIRED and leaves future ones alone', () => {
    expect(effectivePromoStatus(item({ status: 'ACTIVE', endAt: '2026-09-29T14:59' }), now)).toBe('EXPIRED');
    expect(effectivePromoStatus(item({ status: 'PAUSED', endAt: '2026-09-28T23:59' }), now)).toBe('EXPIRED');
    expect(effectivePromoStatus(item({ status: 'ACTIVE', endAt: '2026-09-29T15:01' }), now)).toBe('ACTIVE');
    expect(effectivePromoStatus(item({ status: 'DRAFT', endAt: '2026-09-01T00:00' }), now)).toBe('DRAFT');
    expect(effectivePromoStatus(item({ status: 'ACTIVE', endAt: '' }), now)).toBe('ACTIVE');
  });

  it('filters by effective status so Expired includes past-end ACTIVE rows', () => {
    const rows = [
      item({ id: 'live', status: 'ACTIVE', endAt: '2099-01-01T00:00' }),
      item({ id: 'ended', status: 'ACTIVE', endAt: '2020-01-01T00:00' }),
    ];
    const f = { query: '', service: 'all', type: 'all' };
    expect(filterPromoEngineRows(rows, { ...f, status: 'EXPIRED' }).map((r) => r.id)).toEqual(['ended']);
    expect(filterPromoEngineRows(rows, { ...f, status: 'ACTIVE' }).map((r) => r.id)).toEqual(['live']);
  });

  it('blocks activation when the end date has passed', () => {
    const basics = createEmptyBasics();
    basics.endAt = '2026-09-29T14:00';
    expect(validateGoLiveSchedule(basics, now)).toHaveLength(1);
    basics.endAt = '2026-10-31T23:59';
    expect(validateGoLiveSchedule(basics, now)).toEqual([]);
  });

  it('requires whole-number counts', () => {
    expect(validateLimitsDraft({ perUser: 1.5 })).toEqual(['Per user must be a whole number (0 or more)']);
    expect(validateLimitsDraft({ dailyLimit: -1 })).toHaveLength(1);
    expect(validateLimitsDraft({ perUser: 1, campaignLimit: 0, budgetLimit: 999.5 })).toEqual([]);
  });

  it('rejects unknown placeholders in customer copy', () => {
    expect(validateCustomerCopyDraft({ earnLine: 'Get ₹{amount} back' })).toEqual([]);
    expect(validateCustomerCopyDraft({ earnLine: 'Hi {name}' })[0]).toContain('unknown placeholder {name}');
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
