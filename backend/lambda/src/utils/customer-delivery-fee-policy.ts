/**
 * Customer delivery fee policy — Zone A/B by distance + order-value slabs, optional surges.
 * Persisted in platform_settings.setting_key = customer:delivery:fee_policy
 */

import { query } from '../database/rds-connection';

const POLICY_KEY = 'customer:delivery:fee_policy';

export interface OrderValueSlab {
  /** Inclusive lower bound (INR) */
  minOrderInr: number;
  /** Exclusive upper bound; null = infinity */
  maxOrderInr: number | null;
  deliveryFeeInr: number;
}

export interface CustomerDeliveryFeeZones {
  zoneA: OrderValueSlab[];
  zoneB: OrderValueSlab[];
}

export interface CustomerDeliveryFeeSurges {
  weekendInr: number;
  festivalMinInr: number;
  festivalMaxInr: number;
  rainMinInr: number;
  rainMaxInr: number;
  priorityNote?: string;
}

export interface CustomerDeliveryFeeZoneSurgeFlags {
  weekend: boolean;
  festival: boolean;
  rain: boolean;
}

export interface CustomerDeliveryFeeZoneSurgeConfig {
  zoneA: CustomerDeliveryFeeZoneSurgeFlags;
  zoneB: CustomerDeliveryFeeZoneSurgeFlags;
}

export interface CustomerDeliveryFeeContent {
  coverageSummary: string;
  zoneADescription?: string;
  zoneBDescription?: string;
  surgeIntro?: string;
  rulesFreeDelivery: string[];
  rulesBeyond5Km: string[];
  rulesBeyond8Km: string[];
  importantNotes: string[];
}

export interface CustomerDeliveryFeeRuntimeSignals {
  festivalActive: boolean;
  rainActive: boolean;
}

export interface CustomerDeliveryFeePolicy {
  version: number;
  maxServiceRadiusKm: number;
  zoneABoundaryKm: number;
  zones: CustomerDeliveryFeeZones;
  surges: CustomerDeliveryFeeSurges;
  zoneSurgeConfig?: CustomerDeliveryFeeZoneSurgeConfig;
  runtimeSignals?: CustomerDeliveryFeeRuntimeSignals;
  content: CustomerDeliveryFeeContent;
}

export const DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY: CustomerDeliveryFeePolicy = {
  version: 1,
  maxServiceRadiusKm: 10,
  zoneABoundaryKm: 5,
  zones: {
    zoneA: [
      { minOrderInr: 0, maxOrderInr: 1000, deliveryFeeInr: 99 },
      { minOrderInr: 1000, maxOrderInr: 1500, deliveryFeeInr: 49 },
      { minOrderInr: 1500, maxOrderInr: null, deliveryFeeInr: 0 },
    ],
    zoneB: [
      { minOrderInr: 0, maxOrderInr: 1000, deliveryFeeInr: 149 },
      { minOrderInr: 1000, maxOrderInr: 1500, deliveryFeeInr: 99 },
      { minOrderInr: 1500, maxOrderInr: 2000, deliveryFeeInr: 49 },
      { minOrderInr: 2000, maxOrderInr: null, deliveryFeeInr: 0 },
    ],
  },
  surges: {
    weekendInr: 15,
    festivalMinInr: 25,
    festivalMaxInr: 40,
    rainMinInr: 10,
    rainMaxInr: 15,
    priorityNote:
      'Emergency / priority delivery may incur additional charges communicated at checkout.',
  },
  zoneSurgeConfig: {
    zoneA: { weekend: true, festival: true, rain: true },
    zoneB: { weekend: true, festival: true, rain: true },
  },
  runtimeSignals: {
    festivalActive: false,
    rainActive: false,
  },
  content: {
    coverageSummary:
      'We currently offer deliveries within a maximum radius of 10 KM from the nearest fulfillment location.',
    zoneADescription: 'Zone A: Up to 5 KM radius from fulfillment.',
    zoneBDescription: 'Zone B: Beyond 5 KM up to 10 KM radius.',
    surgeIntro: 'The following charges may apply during peak operational conditions:',
    rulesFreeDelivery: [
      'Order value meets the eligible slab',
      'Delivery address falls within the supported radius',
      'Standard delivery slot is selected',
      'Delivery partner availability is active',
    ],
    rulesBeyond5Km: [
      'Subject to operational feasibility and rider availability',
      'Delivery timelines may extend up to 60–90 minutes',
      'Certain heavy, frozen, temperature-sensitive, or low-margin products may have delivery limitations',
    ],
    rulesBeyond8Km: [
      'May be serviced through scheduled delivery slots only',
      'COD availability may be restricted for low-value orders',
      'Delivery acceptance depends on live serviceability conditions',
    ],
    importantNotes: [
      'Delivery timelines are indicative and may vary due to weather, traffic, festivals, or operational demand.',
      'The company reserves the right to modify delivery charges, service radius, delivery timelines, or operational policies without prior notice.',
    ],
  },
};

function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function parseZoneSurgeFlags(raw: unknown): CustomerDeliveryFeeZoneSurgeFlags | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.weekend !== 'boolean') return null;
  if (typeof o.festival !== 'boolean') return null;
  if (typeof o.rain !== 'boolean') return null;
  return {
    weekend: o.weekend,
    festival: o.festival,
    rain: o.rain,
  };
}

function parseRuntimeSignals(raw: unknown): CustomerDeliveryFeeRuntimeSignals | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.festivalActive !== 'boolean') return null;
  if (typeof o.rainActive !== 'boolean') return null;
  return {
    festivalActive: o.festivalActive,
    rainActive: o.rainActive,
  };
}

function normalizeSlabs(slabs: unknown): OrderValueSlab[] | null {
  if (!Array.isArray(slabs)) return null;
  const out: OrderValueSlab[] = [];
  for (const s of slabs) {
    if (!s || typeof s !== 'object') return null;
    const o = s as Record<string, unknown>;
    if (!isNum(o.minOrderInr) || !isNum(o.deliveryFeeInr)) return null;
    const max =
      o.maxOrderInr === null || o.maxOrderInr === undefined
        ? null
        : isNum(o.maxOrderInr)
          ? o.maxOrderInr
          : null;
    if (o.maxOrderInr !== null && o.maxOrderInr !== undefined && max === null) return null;
    out.push({
      minOrderInr: o.minOrderInr,
      maxOrderInr: max,
      deliveryFeeInr: Math.round(o.deliveryFeeInr),
    });
  }
  return out;
}

export function validateCustomerDeliveryFeePolicy(raw: unknown): {
  ok: true;
  policy: CustomerDeliveryFeePolicy;
} | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Policy must be a JSON object' };
  }
  const p = raw as Record<string, unknown>;
  if (!isNum(p.version) || p.version < 1) {
    return { ok: false, error: 'version must be a positive number' };
  }
  if (!isNum(p.maxServiceRadiusKm) || p.maxServiceRadiusKm <= 0) {
    return { ok: false, error: 'maxServiceRadiusKm must be > 0' };
  }
  if (
    !isNum(p.zoneABoundaryKm) ||
    p.zoneABoundaryKm <= 0 ||
    p.zoneABoundaryKm > p.maxServiceRadiusKm
  ) {
    return { ok: false, error: 'zoneABoundaryKm must be between 0 and maxServiceRadiusKm' };
  }
  const zones = p.zones as Record<string, unknown> | undefined;
  if (!zones || typeof zones !== 'object') {
    return { ok: false, error: 'zones object required' };
  }
  const zA = normalizeSlabs(zones.zoneA);
  const zB = normalizeSlabs(zones.zoneB);
  if (!zA?.length || !zB?.length) {
    return { ok: false, error: 'zones.zoneA and zones.zoneB must be non-empty slab arrays' };
  }
  const surges = p.surges as Record<string, unknown> | undefined;
  if (!surges || typeof surges !== 'object') {
    return { ok: false, error: 'surges object required' };
  }
  const sKeys = ['weekendInr', 'festivalMinInr', 'festivalMaxInr', 'rainMinInr', 'rainMaxInr'] as const;
  for (const k of sKeys) {
    if (!isNum(surges[k]) || surges[k] < 0) {
      return { ok: false, error: `surges.${k} must be a non-negative number` };
    }
  }
      const sr = surges as {
        festivalMinInr: number;
        festivalMaxInr: number;
        rainMinInr: number;
        rainMaxInr: number;
      };
      if (sr.festivalMinInr > sr.festivalMaxInr || sr.rainMinInr > sr.rainMaxInr) {
        return { ok: false, error: 'surge min cannot exceed max for festival/rain bands' };
      }
  const content = p.content as Record<string, unknown> | undefined;
  if (!content || typeof content !== 'object') {
    return { ok: false, error: 'content object required' };
  }
  if (typeof content.coverageSummary !== 'string') {
    return { ok: false, error: 'content.coverageSummary must be a string' };
  }
  const arr = (k: string) =>
    Array.isArray(content[k]) && (content[k] as unknown[]).every((x) => typeof x === 'string');
  if (
    !arr('rulesFreeDelivery') ||
    !arr('rulesBeyond5Km') ||
    !arr('rulesBeyond8Km') ||
    !arr('importantNotes')
  ) {
    return {
      ok: false,
      error: 'content rules/notes must be arrays of strings',
    };
  }

  const zoneSurgeRaw = p.zoneSurgeConfig as Record<string, unknown> | undefined;
  const zoneSurgeConfig: CustomerDeliveryFeeZoneSurgeConfig =
    zoneSurgeRaw && typeof zoneSurgeRaw === 'object'
      ? {
          zoneA:
            parseZoneSurgeFlags(zoneSurgeRaw.zoneA) ||
            DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.zoneSurgeConfig!.zoneA,
          zoneB:
            parseZoneSurgeFlags(zoneSurgeRaw.zoneB) ||
            DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.zoneSurgeConfig!.zoneB,
        }
      : DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.zoneSurgeConfig!;
  const runtimeSignals =
    parseRuntimeSignals((p as Record<string, unknown>).runtimeSignals) ||
    DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.runtimeSignals!;

  const policy: CustomerDeliveryFeePolicy = {
    version: p.version,
    maxServiceRadiusKm: p.maxServiceRadiusKm,
    zoneABoundaryKm: p.zoneABoundaryKm,
    zones: { zoneA: zA, zoneB: zB },
    surges: {
      weekendInr: Math.round(surges.weekendInr as number),
      festivalMinInr: Math.round(surges.festivalMinInr as number),
      festivalMaxInr: Math.round(surges.festivalMaxInr as number),
      rainMinInr: Math.round(surges.rainMinInr as number),
      rainMaxInr: Math.round(surges.rainMaxInr as number),
      priorityNote: typeof surges.priorityNote === 'string' ? surges.priorityNote : undefined,
    },
    zoneSurgeConfig,
    runtimeSignals,
    content: {
      coverageSummary: content.coverageSummary,
      zoneADescription:
        typeof content.zoneADescription === 'string' ? content.zoneADescription : undefined,
      zoneBDescription:
        typeof content.zoneBDescription === 'string' ? content.zoneBDescription : undefined,
      surgeIntro: typeof content.surgeIntro === 'string' ? content.surgeIntro : undefined,
      rulesFreeDelivery: content.rulesFreeDelivery as string[],
      rulesBeyond5Km: content.rulesBeyond5Km as string[],
      rulesBeyond8Km: content.rulesBeyond8Km as string[],
      importantNotes: content.importantNotes as string[],
    },
  };

  return { ok: true, policy };
}

export async function fetchCustomerDeliveryFeePolicy(): Promise<CustomerDeliveryFeePolicy> {
  try {
    const r = await query(
      `SELECT setting_value FROM platform_settings WHERE setting_key = $1 LIMIT 1`,
      [POLICY_KEY]
    );
    if (r.rows.length === 0) {
      return DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY;
    }
    const row = r.rows[0] as { setting_value: unknown };
    const parsed = validateCustomerDeliveryFeePolicy(row.setting_value);
    if (parsed.ok) {
      return parsed.policy;
    }
    console.warn('[delivery-fee-policy] Invalid DB policy, using defaults:', parsed.error);
    return DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY;
  } catch (e) {
    console.warn('[delivery-fee-policy] DB read failed, using defaults', e);
    return DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY;
  }
}

function feeFromSlabs(orderSubtotalInr: number, slabs: OrderValueSlab[]): number | null {
  const x = Math.max(0, orderSubtotalInr);
  for (const slab of slabs) {
    const upperOk = slab.maxOrderInr === null || x < slab.maxOrderInr;
    if (x >= slab.minOrderInr && upperOk) {
      return slab.deliveryFeeInr;
    }
  }
  return null;
}

export type DeliveryFeeZoneLabel = 'zone_a' | 'zone_b' | 'out_of_coverage';

export interface CalculateCustomerDeliveryFeeInput {
  policy: CustomerDeliveryFeePolicy;
  orderSubtotalInr: number;
  distanceKm: number;
  weekend?: boolean;
  festival?: boolean;
  rain?: boolean;
}

export interface CalculateCustomerDeliveryFeeResult {
  success: boolean;
  zone: DeliveryFeeZoneLabel;
  baseDeliveryFeeInr: number;
  surgeWeekendInr: number;
  surgeFestivalInr: number;
  surgeRainInr: number;
  totalDeliveryFeeInr: number;
  outOfCoverage?: boolean;
  message?: string;
}

export function calculateCustomerDeliveryFee(
  input: CalculateCustomerDeliveryFeeInput
): CalculateCustomerDeliveryFeeResult {
  const { policy, orderSubtotalInr, distanceKm } = input;
  const d = Math.max(0, distanceKm);

  if (d > policy.maxServiceRadiusKm) {
    return {
      success: false,
      zone: 'out_of_coverage',
      baseDeliveryFeeInr: 0,
      surgeWeekendInr: 0,
      surgeFestivalInr: 0,
      surgeRainInr: 0,
      totalDeliveryFeeInr: 0,
      outOfCoverage: true,
      message: `Delivery is only offered within ${policy.maxServiceRadiusKm} KM.`,
    };
  }

  const zone: DeliveryFeeZoneLabel = d <= policy.zoneABoundaryKm ? 'zone_a' : 'zone_b';
  const slabs = zone === 'zone_a' ? policy.zones.zoneA : policy.zones.zoneB;
  const base = feeFromSlabs(orderSubtotalInr, slabs);
  if (base === null) {
    return {
      success: false,
      zone,
      baseDeliveryFeeInr: 0,
      surgeWeekendInr: 0,
      surgeFestivalInr: 0,
      surgeRainInr: 0,
      totalDeliveryFeeInr: 0,
      message: 'No matching order-value slab for delivery fee.',
    };
  }

  let surgeW = 0;
  let surgeF = 0;
  let surgeR = 0;
  const zoneKey = zone === 'zone_a' ? 'zoneA' : 'zoneB';
  const zoneSurgeFlags =
    policy.zoneSurgeConfig?.[zoneKey] ||
    DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.zoneSurgeConfig![zoneKey];

  if (input.weekend && zoneSurgeFlags.weekend) {
    surgeW = policy.surges.weekendInr;
  }
  const rs = policy.runtimeSignals;
  const festivalAllowed =
    zoneSurgeFlags.festival || !!rs?.festivalActive;
  const rainAllowed = zoneSurgeFlags.rain || !!rs?.rainActive;
  if (input.festival && festivalAllowed) {
    surgeF = policy.surges.festivalMaxInr;
  }
  if (input.rain && rainAllowed) {
    surgeR = policy.surges.rainMaxInr;
  }

  const total = Math.max(0, base + surgeW + surgeF + surgeR);

  return {
    success: true,
    zone,
    baseDeliveryFeeInr: base,
    surgeWeekendInr: surgeW,
    surgeFestivalInr: surgeF,
    surgeRainInr: surgeR,
    totalDeliveryFeeInr: total,
  };
}
