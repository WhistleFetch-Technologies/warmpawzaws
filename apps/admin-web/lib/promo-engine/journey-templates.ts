import type { PromoEngineConditionGroup, ServiceCategory } from './types';

export const JOURNEY_TEMPLATE_IDS = [
  'first',
  'second',
  'third',
  'nth',
  'first_n',
  'every',
  'every_nth',
  'gte_n',
  'between',
  'winback_30d',
] as const;

export type JourneyTemplateId = (typeof JOURNEY_TEMPLATE_IDS)[number];

export const JOURNEY_TEMPLATE_LABELS: Record<JourneyTemplateId, string> = {
  first: 'First visit',
  second: 'Second visit',
  third: 'Third visit',
  nth: 'Nth visit',
  first_n: 'First N visits',
  every: 'Every visit',
  every_nth: 'Every Nth visit',
  gte_n: 'Visits >= N',
  between: 'Visits between N–M',
  winback_30d: 'Winback 30 days',
};

function behaviourKey(service: ServiceCategory): string {
  return (
    String(service)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'service'
  );
}

function visitField(service: ServiceCategory): string {
  return `user.${behaviourKey(service)}_visit_count`;
}

function daysSinceField(service: ServiceCategory): string {
  return `user.days_since_last_${behaviourKey(service)}`;
}

function categoryCondition(service: ServiceCategory) {
  return { field: 'transaction.service_category', operator: '=', value: service };
}

/**
 * Visit count at evaluate = completed visits (HLD §10).
 * First visit ⇒ completed count = 0.
 */
export function compileJourneyTemplate(opts: {
  template: JourneyTemplateId;
  serviceCategory: ServiceCategory;
  n?: number;
  m?: number;
}): PromoEngineConditionGroup {
  const { template, serviceCategory } = opts;
  const visit = visitField(serviceCategory);
  const category = categoryCondition(serviceCategory);
  const n = opts.n ?? 3;
  const m = opts.m ?? 5;

  const extra: PromoEngineConditionGroup['conditions'] = [];

  switch (template) {
    case 'first':
      extra.push({ field: visit, operator: '=', value: 0 });
      break;
    case 'second':
      extra.push({ field: visit, operator: '=', value: 1 });
      break;
    case 'third':
      extra.push({ field: visit, operator: '=', value: 2 });
      break;
    case 'nth':
      extra.push({ field: visit, operator: '=', value: Math.max(0, n - 1) });
      break;
    case 'first_n':
      extra.push({ field: visit, operator: 'BETWEEN', value: [0, Math.max(0, n - 1)] });
      break;
    case 'every':
      extra.push({ field: visit, operator: '>=', value: 0 });
      break;
    case 'every_nth':
      extra.push({ field: visit, operator: '%', value: { divisor: n, remainder: 0, offset: 1 } });
      break;
    case 'gte_n':
      extra.push({ field: visit, operator: '>=', value: n });
      break;
    case 'between':
      extra.push({ field: visit, operator: 'BETWEEN', value: [n, m] });
      break;
    case 'winback_30d':
      extra.push({ field: visit, operator: '>=', value: 1 });
      extra.push({ field: daysSinceField(serviceCategory), operator: '>=', value: 30 });
      break;
    default:
      break;
  }

  return { operator: 'AND', conditions: [category, ...extra] };
}
