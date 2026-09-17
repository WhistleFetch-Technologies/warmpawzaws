import {
  dbAppendBehaviourEvent,
  dbGetBehaviour,
  dbUpsertBehaviour,
} from '../repos/promo-engine.repo';

function parseJson(v: unknown): Record<string, unknown> {
  if (v == null) return {};
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return v as Record<string, unknown>;
}

const SERVICE_KEYS = new Set([
  'grooming',
  'vet',
  'training',
  'boarding',
  'walking',
  'ecommerce',
]);

export function normalizeServiceKey(raw?: string | null): string | null {
  if (!raw) return null;
  const k = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (SERVICE_KEYS.has(k)) return k;
  if (k.includes('groom')) return 'grooming';
  if (k.includes('vet') || k.includes('clinic')) return 'vet';
  if (k.includes('train')) return 'training';
  if (k.includes('board') || k.includes('sitter')) return 'boarding';
  if (k.includes('walk')) return 'walking';
  if (k.includes('ecom') || k.includes('shop') || k.includes('product')) return 'ecommerce';
  return null;
}

/**
 * Upsert behaviour on SERVICE_COMPLETED / ORDER_COMPLETED.
 */
export async function recordBehaviourCompletion(opts: {
  userId: string;
  eventType: string;
  serviceCategory?: string | null;
  amount?: number;
  transactionId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const serviceKey = normalizeServiceKey(opts.serviceCategory);
  await dbAppendBehaviourEvent({
    userId: opts.userId,
    eventType: opts.eventType,
    serviceKey,
    payload: {
      ...opts.payload,
      amount: opts.amount,
      transaction_id: opts.transactionId,
    },
  });

  if (
    opts.eventType !== 'SERVICE_COMPLETED' &&
    opts.eventType !== 'ORDER_COMPLETED'
  ) {
    return;
  }

  const existing = await dbGetBehaviour(opts.userId);
  const overall = parseJson(existing?.overall);
  const services = parseJson(existing?.services) as Record<
    string,
    { completed_count?: number; last_completed_at?: string; total_spend?: number }
  >;

  const amount = Number(opts.amount || 0) || 0;
  const completed = Number(overall.completed_orders || 0) + 1;
  const totalSpend = Number(overall.total_spend || 0) + amount;
  overall.completed_orders = completed;
  overall.total_spend = totalSpend;
  overall.average_order_value = completed > 0 ? totalSpend / completed : 0;
  overall.last_completed_at = new Date().toISOString();

  if (serviceKey) {
    const slice = services[serviceKey] || {
      completed_count: 0,
      total_spend: 0,
      last_completed_at: null as string | null,
    };
    slice.completed_count = Number(slice.completed_count || 0) + 1;
    slice.total_spend = Number(slice.total_spend || 0) + amount;
    slice.last_completed_at = new Date().toISOString();
    services[serviceKey] = slice;
  }

  await dbUpsertBehaviour({
    userId: opts.userId,
    overall,
    services,
  });
}
