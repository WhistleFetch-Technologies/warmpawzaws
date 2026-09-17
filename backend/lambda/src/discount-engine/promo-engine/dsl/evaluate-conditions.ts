import type {
  ConditionExplainFailure,
  PromoEngineCondition,
  PromoEngineConditionGroup,
} from '../types';

function isGroup(
  node: PromoEngineCondition | PromoEngineConditionGroup
): node is PromoEngineConditionGroup {
  return (
    node != null &&
    typeof node === 'object' &&
    'operator' in node &&
    Array.isArray((node as PromoEngineConditionGroup).conditions)
  );
}

function getByPath(ctx: Record<string, unknown>, field: string): unknown {
  if (Object.prototype.hasOwnProperty.call(ctx, field)) {
    return ctx[field];
  }
  const parts = field.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function reasonCode(field: string, op: string): string {
  const f = field.replace(/\./g, '_').toUpperCase();
  return `${f}_${op === '>=' ? 'LT_REQUIRED' : op === '=' ? 'NE_REQUIRED' : 'FAILED'}`;
}

export function evaluateLeaf(
  condition: PromoEngineCondition,
  ctx: Record<string, unknown>
): { pass: boolean; failure?: ConditionExplainFailure } {
  const actual = getByPath(ctx, condition.field);
  const op = (condition.operator || '=').toUpperCase() === 'IN'
    ? 'IN'
    : condition.operator;
  const required = condition.value;

  const fail = (reason: string): { pass: false; failure: ConditionExplainFailure } => ({
    pass: false,
    failure: {
      field: condition.field,
      operator: condition.operator,
      required,
      actual: actual ?? null,
      reason,
    },
  });

  switch (op) {
    case '=':
    case '==': {
      const an = toNumber(actual);
      const rn = toNumber(required);
      if (an != null && rn != null) {
        return an === rn ? { pass: true } : fail(reasonCode(condition.field, '='));
      }
      return String(actual) === String(required)
        ? { pass: true }
        : fail(reasonCode(condition.field, '='));
    }
    case '!=': {
      const an = toNumber(actual);
      const rn = toNumber(required);
      if (an != null && rn != null) {
        return an !== rn ? { pass: true } : fail(reasonCode(condition.field, '!='));
      }
      return String(actual) !== String(required)
        ? { pass: true }
        : fail(reasonCode(condition.field, '!='));
    }
    case '>':
    case '>=':
    case '<':
    case '<=': {
      const an = toNumber(actual);
      const rn = toNumber(required);
      if (an == null || rn == null) return fail(reasonCode(condition.field, op));
      const ok =
        op === '>'
          ? an > rn
          : op === '>='
            ? an >= rn
            : op === '<'
              ? an < rn
              : an <= rn;
      return ok ? { pass: true } : fail(reasonCode(condition.field, op));
    }
    case 'IN': {
      const list = Array.isArray(required) ? required : [required];
      return list.map(String).includes(String(actual))
        ? { pass: true }
        : fail(reasonCode(condition.field, 'IN'));
    }
    case 'NOT_IN': {
      const list = Array.isArray(required) ? required : [required];
      return !list.map(String).includes(String(actual))
        ? { pass: true }
        : fail(reasonCode(condition.field, 'NOT_IN'));
    }
    case 'BETWEEN': {
      const an = toNumber(actual);
      const arr = Array.isArray(required) ? required : [];
      const lo = toNumber(arr[0]);
      const hi = toNumber(arr[1]);
      if (an == null || lo == null || hi == null) return fail(reasonCode(condition.field, 'BETWEEN'));
      return an >= lo && an <= hi ? { pass: true } : fail(reasonCode(condition.field, 'BETWEEN'));
    }
    case '%': {
      // value: { divisor, remainder, offset } — offset added to actual before modulo (visit+1)
      const an = toNumber(actual);
      const cfg =
        required && typeof required === 'object'
          ? (required as { divisor?: number; remainder?: number; offset?: number })
          : { divisor: toNumber(required) ?? 0, remainder: 0, offset: 0 };
      const divisor = Number(cfg.divisor) || 0;
      const remainder = Number(cfg.remainder ?? 0);
      const offset = Number(cfg.offset ?? 0);
      if (an == null || divisor <= 0) return fail(reasonCode(condition.field, '%'));
      return (an + offset) % divisor === remainder
        ? { pass: true }
        : fail(reasonCode(condition.field, '%'));
    }
    default:
      return fail(`UNSUPPORTED_OPERATOR_${condition.operator}`);
  }
}

export function evaluateConditionGroup(
  group: PromoEngineConditionGroup,
  ctx: Record<string, unknown>
): { pass: boolean; failures: ConditionExplainFailure[] } {
  const failures: ConditionExplainFailure[] = [];
  if (!group?.conditions?.length) {
    return { pass: true, failures };
  }

  if (group.operator === 'OR') {
    for (const node of group.conditions) {
      if (isGroup(node)) {
        const nested = evaluateConditionGroup(node, ctx);
        if (nested.pass) return { pass: true, failures: [] };
        failures.push(...nested.failures);
      } else {
        const leaf = evaluateLeaf(node, ctx);
        if (leaf.pass) return { pass: true, failures: [] };
        if (leaf.failure) failures.push(leaf.failure);
      }
    }
    return { pass: false, failures };
  }

  // AND
  for (const node of group.conditions) {
    if (isGroup(node)) {
      const nested = evaluateConditionGroup(node, ctx);
      if (!nested.pass) {
        failures.push(...nested.failures);
        return { pass: false, failures };
      }
    } else {
      const leaf = evaluateLeaf(node, ctx);
      if (!leaf.pass) {
        if (leaf.failure) failures.push(leaf.failure);
        return { pass: false, failures };
      }
    }
  }
  return { pass: true, failures: [] };
}

/**
 * Flatten behaviour profile + transaction into dotted context keys used by DSL.
 */
export function buildEvalContext(input: {
  userId: string;
  transaction: Record<string, unknown>;
  behaviour?: {
    overall?: Record<string, unknown>;
    services?: Record<string, { completed_count?: number; last_completed_at?: string | null; total_spend?: number }>;
  };
  wallet?: { balance?: number; cashback_balance?: number };
  now?: Date;
}): Record<string, unknown> {
  const now = input.now ?? new Date();
  const services = input.behaviour?.services ?? {};
  const overall = input.behaviour?.overall ?? {};
  const tx = input.transaction ?? {};

  const ctx: Record<string, unknown> = {
    'user.user_id': input.userId,
    'user.id': input.userId,
    'user.total_orders': overall.completed_orders ?? overall.total_orders ?? 0,
    'user.completed_orders': overall.completed_orders ?? 0,
    'user.total_spend': overall.total_spend ?? 0,
    'user.average_order_value': overall.average_order_value ?? 0,
    'transaction.type': tx.type,
    'transaction.service_category': tx.service_category,
    'transaction.service_type': tx.service_type,
    'transaction.vendor_id': tx.vendor_id,
    'transaction.city': tx.city,
    'transaction.state': tx.state,
    'transaction.order_value': tx.amount ?? tx.order_value,
    'transaction.amount': tx.amount,
    'transaction.package': tx.package,
    'transaction.quantity': tx.quantity ?? 1,
    'wallet.wallet_balance': input.wallet?.balance ?? 0,
    'wallet.cashback_balance': input.wallet?.cashback_balance ?? 0,
  };

  for (const [key, slice] of Object.entries(services)) {
    const k = key.toLowerCase();
    const count = Number(slice?.completed_count ?? 0);
    ctx[`user.${k}_visit_count`] = count;
    ctx[`user.service_visit_count`] = ctx[`user.service_visit_count`] ?? count;
    const last = slice?.last_completed_at ? new Date(slice.last_completed_at) : null;
    if (last && !Number.isNaN(last.getTime())) {
      const days = Math.floor((now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));
      ctx[`user.days_since_last_${k}`] = days;
      ctx[`user.last_${k}_date`] = slice.last_completed_at;
    } else {
      ctx[`user.days_since_last_${k}`] = null;
    }
    ctx[`user.${k}_total_spend`] = slice?.total_spend ?? 0;
  }

  // Also expose nested objects for path lookup
  ctx.user = {
    user_id: input.userId,
    ...Object.fromEntries(
      Object.entries(ctx).filter(([k]) => k.startsWith('user.')).map(([k, v]) => [k.slice(5), v])
    ),
  };
  ctx.transaction = { ...tx };
  ctx.wallet = input.wallet ?? {};

  return ctx;
}
