import type {
  PromoEngineBenefit,
  PromoEngineCondition,
  PromoEngineConditionGroup,
} from './types';

const FIELD_LABELS: Record<string, string> = {
  'transaction.service_category': 'booking service',
  'transaction.package': 'package',
  'transaction.amount': 'transaction amount',
};

function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const visit = field.match(/^user\.([a-z]+)_visit_count$/);
  if (visit) return `completed ${visit[1]} visits`;
  const days = field.match(/^user\.days_since_last_([a-z]+)$/);
  if (days) return `days since last ${days[1]}`;
  return field;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join('–');
  if (value && typeof value === 'object' && 'divisor' in (value as object)) {
    const v = value as { divisor?: number; offset?: number };
    return `every ${v.divisor ?? '?'} (offset ${v.offset ?? 0})`;
  }
  return String(value ?? '—');
}

export function describeCondition(condition: PromoEngineCondition): string {
  const field = fieldLabel(condition.field);
  switch (condition.operator) {
    case '=':
      return `${field} is ${formatValue(condition.value)}`;
    case '!=':
      return `${field} is not ${formatValue(condition.value)}`;
    case '>':
      return `${field} is greater than ${formatValue(condition.value)}`;
    case '>=':
      return `${field} is at least ${formatValue(condition.value)}`;
    case '<':
      return `${field} is less than ${formatValue(condition.value)}`;
    case '<=':
      return `${field} is at most ${formatValue(condition.value)}`;
    case 'IN':
      return `${field} is one of ${formatValue(condition.value)}`;
    case 'NOT_IN':
      return `${field} is not one of ${formatValue(condition.value)}`;
    case 'BETWEEN':
      return `${field} is between ${formatValue(condition.value)}`;
    case '%':
      return `${field} matches ${formatValue(condition.value)}`;
    default:
      return `${field} ${condition.operator} ${formatValue(condition.value)}`;
  }
}

export function isConditionGroup(
  node: PromoEngineCondition | PromoEngineConditionGroup,
): node is PromoEngineConditionGroup {
  return Boolean(node && typeof node === 'object' && 'conditions' in node && Array.isArray(node.conditions));
}

export function describeConditionGroup(group: PromoEngineConditionGroup): string {
  if (!group.conditions.length) return 'No audience rules yet';
  const parts = group.conditions.map((node) =>
    isConditionGroup(node) ? `(${describeConditionGroup(node)})` : describeCondition(node),
  );
  const joiner = group.operator === 'OR' ? ' or ' : ' and ';
  return parts.join(joiner);
}

export function describeBenefits(benefits: PromoEngineBenefit[]): string {
  if (!benefits.length) return 'No discount or cashback yet — set them on the Benefits step';
  return benefits
    .map((b) => {
      const mode = b.mode === 'PERCENT' ? '%' : '';
      const amount = b.value != null ? `${mode === '%' ? '' : '₹'}${b.value}${mode}` : '—';
      const max = b.maxAmount != null ? ` max ₹${b.maxAmount}` : '';
      const expiry = b.expiryDays != null ? ` · ${b.expiryDays} days` : '';
      const scope = b.redeemScope?.length ? ` · redeem ${b.redeemScope.join(', ')}` : '';
      return `${b.type} ${amount}${max}${expiry}${scope}`;
    })
    .join('; ');
}

export function describeRedeemScope(benefits: PromoEngineBenefit[]): string {
  const scopes = benefits.flatMap((b) => b.redeemScope ?? []);
  if (!scopes.length) return 'Any catalogue service (no redeem restriction)';
  return [...new Set(scopes)].join(', ');
}
