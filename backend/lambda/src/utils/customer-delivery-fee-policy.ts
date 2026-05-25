/**
 * Customer delivery fee policy — dynamic distance zones + order-value slabs + surges.
 * Persisted in platform_settings.setting_key = customer:delivery:fee_policy
 * v2: zones[] with distance bands. v1 (zoneA/zoneB) is normalized on read/validate.
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

export interface DeliveryFeeZoneSurgeConfig {
  weekend: boolean;
  festival: boolean;
  rain: boolean;
}

export interface DeliveryFeeZone {
  id: string;
  name: string;
  sortOrder: number;
  minDistanceKm: number;
  maxDistanceKm: number;
  slabs: OrderValueSlab[];
  surgeConfig: DeliveryFeeZoneSurgeConfig;
  description?: string;
  operationalRules?: string[];
}

export interface CustomerDeliveryFeeSurges {
  weekendInr: number;
  festivalMinInr: number;
  festivalMaxInr: number;
  rainMinInr: number;
  rainMaxInr: number;
  priorityNote?: string;
}

export interface CustomerDeliveryFeeRuntimeSignals {
  festivalActive: boolean;
  rainActive: boolean;
}

export interface CustomerDeliveryFeeContent {
  coverageSummary: string;
  surgeIntro?: string;
  rulesFreeDelivery: string[];
  importantNotes: string[];
}

export interface CustomerDeliveryFeePolicy {
  version: number;
  maxServiceRadiusKm: number;
  zones: DeliveryFeeZone[];
  surges: CustomerDeliveryFeeSurges;
  runtimeSignals?: CustomerDeliveryFeeRuntimeSignals;
  content: CustomerDeliveryFeeContent;
}

/** @deprecated v1 shape — normalized to v2 on read */
export interface CustomerDeliveryFeePolicyV1 {
  version: 1;
  maxServiceRadiusKm: number;
  zoneABoundaryKm: number;
  zones: { zoneA: OrderValueSlab[]; zoneB: OrderValueSlab[] };
  surges: CustomerDeliveryFeeSurges;
  zoneSurgeConfig?: {
    zoneA: DeliveryFeeZoneSurgeConfig;
    zoneB: DeliveryFeeZoneSurgeConfig;
  };
  runtimeSignals?: CustomerDeliveryFeeRuntimeSignals;
  content: {
    coverageSummary: string;
    zoneADescription?: string;
    zoneBDescription?: string;
    surgeIntro?: string;
    rulesFreeDelivery: string[];
    rulesBeyond5Km: string[];
    rulesBeyond8Km: string[];
    importantNotes: string[];
  };
}

const DEFAULT_SURGE_FLAGS: DeliveryFeeZoneSurgeConfig = {
  weekend: true,
  festival: true,
  rain: true,
};

const DEFAULT_ZONE_A_SLABS: OrderValueSlab[] = [
  { minOrderInr: 0, maxOrderInr: 1000, deliveryFeeInr: 99 },
  { minOrderInr: 1000, maxOrderInr: 1500, deliveryFeeInr: 49 },
  { minOrderInr: 1500, maxOrderInr: null, deliveryFeeInr: 0 },
];

const DEFAULT_ZONE_B_SLABS: OrderValueSlab[] = [
  { minOrderInr: 0, maxOrderInr: 1000, deliveryFeeInr: 149 },
  { minOrderInr: 1000, maxOrderInr: 1500, deliveryFeeInr: 99 },
  { minOrderInr: 1500, maxOrderInr: 2000, deliveryFeeInr: 49 },
  { minOrderInr: 2000, maxOrderInr: null, deliveryFeeInr: 0 },
];

export const DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY: CustomerDeliveryFeePolicy = {
  version: 2,
  maxServiceRadiusKm: 10,
  zones: [
    {
      id: 'zone_near',
      name: 'Zone A',
      sortOrder: 0,
      minDistanceKm: 0,
      maxDistanceKm: 5,
      slabs: DEFAULT_ZONE_A_SLABS,
      surgeConfig: { ...DEFAULT_SURGE_FLAGS },
      description: 'Zone A: Up to 5 KM radius from fulfillment.',
      operationalRules: [
        'Subject to operational feasibility and rider availability',
        'Delivery timelines may extend up to 60–90 minutes',
        'Certain heavy, frozen, temperature-sensitive, or low-margin products may have delivery limitations',
      ],
    },
    {
      id: 'zone_mid',
      name: 'Zone B',
      sortOrder: 1,
      minDistanceKm: 5,
      maxDistanceKm: 10,
      slabs: DEFAULT_ZONE_B_SLABS,
      surgeConfig: { ...DEFAULT_SURGE_FLAGS },
      description: 'Zone B: Beyond 5 KM up to 10 KM radius.',
      operationalRules: [
        'May be serviced through scheduled delivery slots only',
        'COD availability may be restricted for low-value orders',
        'Delivery acceptance depends on live serviceability conditions',
      ],
    },
  ],
  surges: {
    weekendInr: 15,
    festivalMinInr: 25,
    festivalMaxInr: 40,
    rainMinInr: 10,
    rainMaxInr: 15,
    priorityNote:
      'Emergency / priority delivery may incur additional charges communicated at checkout.',
  },
  runtimeSignals: {
    festivalActive: false,
    rainActive: false,
  },
  content: {
    coverageSummary:
      'We currently offer deliveries within a maximum radius of 10 KM from the nearest fulfillment location.',
    surgeIntro: 'The following charges may apply during peak operational conditions:',
    rulesFreeDelivery: [
      'Order value meets the eligible slab',
      'Delivery address falls within the supported radius',
      'Standard delivery slot is selected',
      'Delivery partner availability is active',
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

function parseZoneSurgeFlags(raw: unknown): DeliveryFeeZoneSurgeConfig | null {
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
  return out.length ? out : null;
}

function isV1PolicyShape(raw: Record<string, unknown>): boolean {
  const zones = raw.zones;
  if (!zones || typeof zones !== 'object') return false;
  const z = zones as Record<string, unknown>;
  return Array.isArray(z.zoneA) || Array.isArray(z.zoneB) || isNum(raw.zoneABoundaryKm);
}

function isV2PolicyShape(raw: Record<string, unknown>): boolean {
  return Array.isArray(raw.zones) && raw.zones.length > 0;
}

export function migrateV1PolicyToV2(v1: CustomerDeliveryFeePolicyV1): CustomerDeliveryFeePolicy {
  const boundary = v1.zoneABoundaryKm;
  const max = v1.maxServiceRadiusKm;
  const surgeA = v1.zoneSurgeConfig?.zoneA || DEFAULT_SURGE_FLAGS;
  const surgeB = v1.zoneSurgeConfig?.zoneB || DEFAULT_SURGE_FLAGS;

  return {
    version: 2,
    maxServiceRadiusKm: max,
    zones: [
      {
        id: 'zone_near',
        name: 'Zone A',
        sortOrder: 0,
        minDistanceKm: 0,
        maxDistanceKm: boundary,
        slabs: v1.zones.zoneA,
        surgeConfig: surgeA,
        description: v1.content.zoneADescription,
        operationalRules: [...(v1.content.rulesBeyond5Km || [])],
      },
      {
        id: 'zone_mid',
        name: 'Zone B',
        sortOrder: 1,
        minDistanceKm: boundary,
        maxDistanceKm: max,
        slabs: v1.zones.zoneB,
        surgeConfig: surgeB,
        description: v1.content.zoneBDescription,
        operationalRules: [...(v1.content.rulesBeyond8Km || [])],
      },
    ],
    surges: v1.surges,
    runtimeSignals: v1.runtimeSignals || DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.runtimeSignals,
    content: {
      coverageSummary: v1.content.coverageSummary,
      surgeIntro: v1.content.surgeIntro,
      rulesFreeDelivery: v1.content.rulesFreeDelivery,
      importantNotes: v1.content.importantNotes,
    },
  };
}

function parseSurges(raw: unknown): CustomerDeliveryFeeSurges | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'surges object required' };
  }
  const surges = raw as Record<string, unknown>;
  const sKeys = ['weekendInr', 'festivalMinInr', 'festivalMaxInr', 'rainMinInr', 'rainMaxInr'] as const;
  for (const k of sKeys) {
    if (!isNum(surges[k]) || surges[k] < 0) {
      return { error: `surges.${k} must be a non-negative number` };
    }
  }
  const sr = surges as {
    festivalMinInr: number;
    festivalMaxInr: number;
    rainMinInr: number;
    rainMaxInr: number;
  };
  if (sr.festivalMinInr > sr.festivalMaxInr || sr.rainMinInr > sr.rainMaxInr) {
    return { error: 'surge min cannot exceed max for festival/rain bands' };
  }
  return {
    weekendInr: Math.round(surges.weekendInr as number),
    festivalMinInr: Math.round(surges.festivalMinInr as number),
    festivalMaxInr: Math.round(surges.festivalMaxInr as number),
    rainMinInr: Math.round(surges.rainMinInr as number),
    rainMaxInr: Math.round(surges.rainMaxInr as number),
    priorityNote: typeof surges.priorityNote === 'string' ? surges.priorityNote : undefined,
  };
}

function parseContent(raw: unknown): CustomerDeliveryFeeContent | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'content object required' };
  }
  const content = raw as Record<string, unknown>;
  if (typeof content.coverageSummary !== 'string') {
    return { error: 'content.coverageSummary must be a string' };
  }
  const arr = (k: string) =>
    Array.isArray(content[k]) && (content[k] as unknown[]).every((x) => typeof x === 'string');
  if (!arr('rulesFreeDelivery') || !arr('importantNotes')) {
    return { error: 'content rulesFreeDelivery and importantNotes must be arrays of strings' };
  }
  return {
    coverageSummary: content.coverageSummary,
    surgeIntro: typeof content.surgeIntro === 'string' ? content.surgeIntro : undefined,
    rulesFreeDelivery: content.rulesFreeDelivery as string[],
    importantNotes: content.importantNotes as string[],
  };
}

function validateV1Policy(raw: Record<string, unknown>): {
  ok: true;
  policy: CustomerDeliveryFeePolicy;
} | { ok: false; error: string } {
  if (!isNum(raw.maxServiceRadiusKm) || raw.maxServiceRadiusKm <= 0) {
    return { ok: false, error: 'maxServiceRadiusKm must be > 0' };
  }
  if (
    !isNum(raw.zoneABoundaryKm) ||
    raw.zoneABoundaryKm <= 0 ||
    raw.zoneABoundaryKm > raw.maxServiceRadiusKm
  ) {
    return { ok: false, error: 'zoneABoundaryKm must be between 0 and maxServiceRadiusKm' };
  }
  const zones = raw.zones as Record<string, unknown> | undefined;
  if (!zones || typeof zones !== 'object') {
    return { ok: false, error: 'zones object required' };
  }
  const zA = normalizeSlabs(zones.zoneA);
  const zB = normalizeSlabs(zones.zoneB);
  if (!zA?.length || !zB?.length) {
    return { ok: false, error: 'zones.zoneA and zones.zoneB must be non-empty slab arrays' };
  }
  const surgesParsed = parseSurges(raw.surges);
  if ('error' in surgesParsed) {
    return { ok: false, error: surgesParsed.error };
  }
  const contentRaw = raw.content as Record<string, unknown> | undefined;
  if (!contentRaw || typeof contentRaw !== 'object') {
    return { ok: false, error: 'content object required' };
  }
  const arr = (k: string) =>
    Array.isArray(contentRaw[k]) && (contentRaw[k] as unknown[]).every((x) => typeof x === 'string');
  if (
    !arr('rulesFreeDelivery') ||
    !arr('rulesBeyond5Km') ||
    !arr('rulesBeyond8Km') ||
    !arr('importantNotes')
  ) {
    return { ok: false, error: 'content rules/notes must be arrays of strings' };
  }
  if (typeof contentRaw.coverageSummary !== 'string') {
    return { ok: false, error: 'content.coverageSummary must be a string' };
  }

  const zoneSurgeRaw = raw.zoneSurgeConfig as Record<string, unknown> | undefined;
  const zoneSurgeConfig = {
    zoneA:
      parseZoneSurgeFlags(zoneSurgeRaw?.zoneA) ||
      DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.zones[0].surgeConfig,
    zoneB:
      parseZoneSurgeFlags(zoneSurgeRaw?.zoneB) ||
      DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.zones[1].surgeConfig,
  };

  const v1: CustomerDeliveryFeePolicyV1 = {
    version: 1,
    maxServiceRadiusKm: raw.maxServiceRadiusKm,
    zoneABoundaryKm: raw.zoneABoundaryKm,
    zones: { zoneA: zA, zoneB: zB },
    surges: surgesParsed,
    zoneSurgeConfig,
    runtimeSignals:
      parseRuntimeSignals(raw.runtimeSignals) ||
      DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.runtimeSignals,
    content: {
      coverageSummary: contentRaw.coverageSummary as string,
      zoneADescription:
        typeof contentRaw.zoneADescription === 'string' ? contentRaw.zoneADescription : undefined,
      zoneBDescription:
        typeof contentRaw.zoneBDescription === 'string' ? contentRaw.zoneBDescription : undefined,
      surgeIntro: typeof contentRaw.surgeIntro === 'string' ? contentRaw.surgeIntro : undefined,
      rulesFreeDelivery: contentRaw.rulesFreeDelivery as string[],
      rulesBeyond5Km: contentRaw.rulesBeyond5Km as string[],
      rulesBeyond8Km: contentRaw.rulesBeyond8Km as string[],
      importantNotes: contentRaw.importantNotes as string[],
    },
  };

  return { ok: true, policy: migrateV1PolicyToV2(v1) };
}

function validateZoneArray(
  zonesRaw: unknown,
  maxServiceRadiusKm: number
): { ok: true; zones: DeliveryFeeZone[] } | { ok: false; error: string } {
  if (!Array.isArray(zonesRaw) || zonesRaw.length === 0) {
    return { ok: false, error: 'zones must be a non-empty array' };
  }

  const zones: DeliveryFeeZone[] = [];
  const ids = new Set<string>();

  for (let i = 0; i < zonesRaw.length; i++) {
    const raw = zonesRaw[i];
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: `zones[${i}] must be an object` };
    }
    const z = raw as Record<string, unknown>;
    const id = typeof z.id === 'string' ? z.id.trim() : '';
    const name = typeof z.name === 'string' ? z.name.trim() : '';
    if (!id) return { ok: false, error: `zones[${i}].id is required` };
    if (!name) return { ok: false, error: `zones[${i}].name is required` };
    if (ids.has(id)) return { ok: false, error: `Duplicate zone id: ${id}` };
    ids.add(id);

    if (!isNum(z.sortOrder) || z.sortOrder < 0) {
      return { ok: false, error: `zones[${i}].sortOrder must be >= 0` };
    }
    if (!isNum(z.minDistanceKm) || z.minDistanceKm < 0) {
      return { ok: false, error: `zones[${i}].minDistanceKm must be >= 0` };
    }
    if (!isNum(z.maxDistanceKm) || z.maxDistanceKm <= z.minDistanceKm) {
      return { ok: false, error: `zones[${i}].maxDistanceKm must be > minDistanceKm` };
    }

    const slabs = normalizeSlabs(z.slabs);
    if (!slabs?.length) {
      return { ok: false, error: `zones[${i}].slabs must be a non-empty array` };
    }

    const surgeConfig =
      parseZoneSurgeFlags(z.surgeConfig) ||
      DEFAULT_SURGE_FLAGS;

    const operationalRules = Array.isArray(z.operationalRules)
      ? (z.operationalRules as unknown[]).filter((x) => typeof x === 'string')
      : undefined;

    zones.push({
      id,
      name,
      sortOrder: z.sortOrder,
      minDistanceKm: z.minDistanceKm,
      maxDistanceKm: z.maxDistanceKm,
      slabs,
      surgeConfig,
      description: typeof z.description === 'string' ? z.description : undefined,
      operationalRules,
    });
  }

  const sorted = [...zones].sort((a, b) => a.sortOrder - b.sortOrder);
  if (sorted[0].minDistanceKm !== 0) {
    return { ok: false, error: 'First zone must start at minDistanceKm 0' };
  }
  if (sorted[sorted.length - 1].maxDistanceKm !== maxServiceRadiusKm) {
    return {
      ok: false,
      error: `Last zone maxDistanceKm must equal maxServiceRadiusKm (${maxServiceRadiusKm})`,
    };
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1].minDistanceKm !== sorted[i].maxDistanceKm) {
      return {
        ok: false,
        error: `Zone "${sorted[i].name}" maxDistanceKm must equal next zone minDistanceKm (${sorted[i].maxDistanceKm})`,
      };
    }
  }

  return { ok: true, zones: sorted };
}

function validateV2Policy(raw: Record<string, unknown>): {
  ok: true;
  policy: CustomerDeliveryFeePolicy;
} | { ok: false; error: string } {
  if (!isNum(raw.version) || raw.version < 2) {
    return { ok: false, error: 'version must be >= 2 for dynamic zones' };
  }
  if (!isNum(raw.maxServiceRadiusKm) || raw.maxServiceRadiusKm <= 0) {
    return { ok: false, error: 'maxServiceRadiusKm must be > 0' };
  }

  const zonesParsed = validateZoneArray(raw.zones, raw.maxServiceRadiusKm);
  if (!zonesParsed.ok) {
    return { ok: false, error: zonesParsed.error };
  }

  const surgesParsed = parseSurges(raw.surges);
  if ('error' in surgesParsed) {
    return { ok: false, error: surgesParsed.error };
  }

  const contentParsed = parseContent(raw.content);
  if ('error' in contentParsed) {
    return { ok: false, error: contentParsed.error };
  }

  return {
    ok: true,
    policy: {
      version: Math.max(2, Math.round(raw.version)),
      maxServiceRadiusKm: raw.maxServiceRadiusKm,
      zones: zonesParsed.zones,
      surges: surgesParsed,
      runtimeSignals:
        parseRuntimeSignals(raw.runtimeSignals) ||
        DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.runtimeSignals,
      content: contentParsed,
    },
  };
}

export function validateCustomerDeliveryFeePolicy(raw: unknown): {
  ok: true;
  policy: CustomerDeliveryFeePolicy;
} | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Policy must be a JSON object' };
  }
  const p = raw as Record<string, unknown>;

  if (isV2PolicyShape(p)) {
    return validateV2Policy(p);
  }
  if (isV1PolicyShape(p)) {
    return validateV1Policy(p);
  }

  return { ok: false, error: 'Policy must be v2 (zones array) or legacy v1 (zoneA/zoneB)' };
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

export function resolveDeliveryFeeZone(
  policy: CustomerDeliveryFeePolicy,
  distanceKm: number
): DeliveryFeeZone | null {
  const d = Math.max(0, distanceKm);
  if (d > policy.maxServiceRadiusKm) return null;

  const sorted = [...policy.zones].sort((a, b) => a.sortOrder - b.sortOrder);
  for (let i = 0; i < sorted.length; i++) {
    const z = sorted[i];
    const next = sorted[i + 1];
    const isLast = i === sorted.length - 1;

    if (d < z.minDistanceKm) continue;

    if (isLast) {
      if (d <= z.maxDistanceKm) return z;
      continue;
    }

    if (d < z.maxDistanceKm) return z;
    if (d === z.maxDistanceKm && next && next.minDistanceKm === z.maxDistanceKm) return z;
  }
  return null;
}

export type DeliveryFeeZoneLabel = 'zone_a' | 'zone_b' | 'out_of_coverage' | string;

export function legacyZoneLabel(
  zone: DeliveryFeeZone,
  sortedZones: DeliveryFeeZone[]
): DeliveryFeeZoneLabel {
  const idx = sortedZones.findIndex((z) => z.id === zone.id);
  if (idx === 0) return 'zone_a';
  if (idx === 1) return 'zone_b';
  return zone.id;
}

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
  zoneId?: string;
  zoneName?: string;
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
  const sortedZones = [...policy.zones].sort((a, b) => a.sortOrder - b.sortOrder);

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

  const matched = resolveDeliveryFeeZone(policy, d);
  if (!matched) {
    return {
      success: false,
      zone: 'out_of_coverage',
      baseDeliveryFeeInr: 0,
      surgeWeekendInr: 0,
      surgeFestivalInr: 0,
      surgeRainInr: 0,
      totalDeliveryFeeInr: 0,
      outOfCoverage: true,
      message: 'No delivery zone matches this distance.',
    };
  }

  const zoneLabel = legacyZoneLabel(matched, sortedZones);
  const base = feeFromSlabs(orderSubtotalInr, matched.slabs);
  if (base === null) {
    return {
      success: false,
      zone: zoneLabel,
      zoneId: matched.id,
      zoneName: matched.name,
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
  const zoneSurgeFlags = matched.surgeConfig;

  if (input.weekend && zoneSurgeFlags.weekend) {
    surgeW = policy.surges.weekendInr;
  }
  const rs = policy.runtimeSignals;
  const festivalAllowed = zoneSurgeFlags.festival || !!rs?.festivalActive;
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
    zone: zoneLabel,
    zoneId: matched.id,
    zoneName: matched.name,
    baseDeliveryFeeInr: base,
    surgeWeekendInr: surgeW,
    surgeFestivalInr: surgeF,
    surgeRainInr: surgeR,
    totalDeliveryFeeInr: total,
  };
}
