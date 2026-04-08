/**
 * Shared fee calculation from Admin → Finance (admin_settings).
 * Used by GET /config/fees and payment creation so UI totals match charged amounts.
 */

import { query } from '../database/rds-connection';

export type FeeTransactionType = 'booking' | 'order';

export interface CalculateFinalFeesParams {
  /** Amount used as platform-fee basis (subtotal before tax, same as Universal Payment Page baseAmount). */
  amount: number;
  type: FeeTransactionType;
  serviceStyle?: string;
  /** Business line: veterinary, grooming, boarding, training, pet_store, etc. */
  businessServiceType?: string;
}

export interface FinalFeesResult {
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  packagingFee: number;
  total: number;
}

const DEFAULT_PLATFORM_PCT = 2;
const DEFAULT_PLATFORM_FLAT = 0;
const DEFAULT_MAX_PLATFORM = 500;
const DEFAULT_DELIVERY_BASE = 30;
const DEFAULT_FREE_DELIVERY_THRESHOLD = 500;

/** Map UI / catalog labels to admin_settings override prefix (FeeConfigurationManager ids). */
export function resolveOverrideServiceType(raw?: string | null): string {
  if (raw == null || String(raw).trim() === '') return '';
  const x = String(raw).trim().toLowerCase();
  const aliases: Record<string, string> = {
    vet: 'veterinary',
    veterinarian: 'veterinary',
    ecommerce: 'pet_store',
    ecom: 'pet_store',
    shop: 'pet_store',
    pet_sitting: 'boarding',
    sitting: 'boarding',
    daycare: 'boarding',
    walking: 'walking',
    behaviourist: 'training',
    diagnostics: 'veterinary',
    nutrition: 'nutritionist',
  };
  return aliases[x] ?? x;
}

type OverrideFields = Record<string, string>;

function parseOverrideRows(rows: { setting_key: string; setting_value: unknown }[]): {
  globals: Record<string, string>;
  overridesByService: Record<string, OverrideFields>;
} {
  const globals: Record<string, string> = {};
  const overridesByService: Record<string, OverrideFields> = {};

  for (const row of rows) {
    const key = row.setting_key;
    const val = row.setting_value != null ? String(row.setting_value) : '';

    if (key.startsWith('fee_override_')) {
      const rest = key.replace('fee_override_', '');
      const parts = rest.split('_');
      const st = parts[0];
      const field = parts.slice(1).join('_');
      if (!st) continue;
      if (!overridesByService[st]) overridesByService[st] = {};
      overridesByService[st][field] = val;
    } else {
      globals[key] = val;
    }
  }

  return { globals, overridesByService };
}

function applyPlatformOverride(
  overrides: OverrideFields | undefined,
  enabled: boolean
): number | null {
  if (!enabled || !overrides) return null;
  const raw = overrides['platform_fee'];
  if (raw === undefined || raw === '') return null;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : null;
}

function applyConvenienceOverride(
  overrides: OverrideFields | undefined,
  enabled: boolean
): number | null {
  if (!enabled || !overrides) return null;
  const raw = overrides['convenience_fee'];
  if (raw === undefined || raw === '') return null;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : null;
}

function isOverrideEnabled(overrides: OverrideFields | undefined): boolean {
  if (!overrides) return false;
  const e = overrides['enabled'];
  return e === 'true' || e === '1';
}

/**
 * Best-effort map from service_catalog / booking category strings to business override key.
 */
export function mapCatalogCategoryToBusinessType(serviceCategory?: string | null): string {
  if (!serviceCategory) return '';
  const n = String(serviceCategory).toLowerCase();
  if (n.includes('groom')) return 'grooming';
  if (n.includes('vet') || n.includes('veterinar') || n.includes('clinic')) return 'veterinary';
  if (n.includes('board') || n.includes('daycare') || n.includes('sitting') || n.includes('resort')) return 'boarding';
  if (n.includes('train')) return 'training';
  if (n.includes('pharmacy') || n.includes('medicine')) return 'pharmacy';
  if (n.includes('cafe')) return 'cafe';
  if (n.includes('nutrition') || n.includes('meal')) return 'nutritionist';
  if (n.includes('store') || n.includes('product') || n.includes('shop') || n.includes('ecom')) return 'pet_store';
  return '';
}

export async function calculateFinalFees(params: CalculateFinalFeesParams): Promise<FinalFeesResult> {
  const amount = Math.max(0, Number(params.amount) || 0);
  const type = params.type;
  const serviceStyle = params.serviceStyle || '';
  const businessRaw = params.businessServiceType || '';
  const primaryOverrideKey = resolveOverrideServiceType(businessRaw);

  const rows = await query(
    `SELECT setting_key, setting_value
     FROM admin_settings
     WHERE (
       setting_key IN (
         'platform_fee_percentage', 'platform_fee_flat', 'max_platform_fee',
         'convenience_fee_booking', 'convenience_fee_order', 'convenience_fee_tele',
         'delivery_fee_base', 'delivery_fee_per_km', 'free_delivery_threshold',
         'packaging_fee_enabled', 'packaging_fee_amount'
       )
       AND (service_type IS NULL OR service_type = 'all')
     )
     OR setting_key LIKE 'fee_override_%'`,
    []
  ).catch(() => ({ rows: [] as { setting_key: string; setting_value: unknown }[] }));

  const { globals, overridesByService } = parseOverrideRows(rows.rows || []);

  let platformPct = parseFloat(globals['platform_fee_percentage'] ?? '');
  if (!Number.isFinite(platformPct)) platformPct = DEFAULT_PLATFORM_PCT;

  let platformFlat = parseFloat(globals['platform_fee_flat'] ?? '');
  if (!Number.isFinite(platformFlat)) platformFlat = DEFAULT_PLATFORM_FLAT;

  let maxPlatform = parseFloat(globals['max_platform_fee'] ?? '');
  if (!Number.isFinite(maxPlatform)) maxPlatform = DEFAULT_MAX_PLATFORM;

  if (primaryOverrideKey) {
    const ov = overridesByService[primaryOverrideKey];
    if (isOverrideEnabled(ov)) {
      const pct = applyPlatformOverride(ov, true);
      if (pct !== null) {
        platformPct = pct;
      }
    }
  }

  let platformFee = Math.round((amount * platformPct) / 100) + platformFlat;
  if (maxPlatform > 0 && platformFee > maxPlatform) {
    platformFee = maxPlatform;
  }
  if (platformFee < 0) platformFee = 0;

  let convenienceFee = 0;
  if (type === 'order') {
    let conv = parseFloat(globals['convenience_fee_order'] ?? '');
    if (!Number.isFinite(conv)) conv = 0;

    if (primaryOverrideKey) {
      const ov = overridesByService[primaryOverrideKey];
      if (isOverrideEnabled(ov)) {
        const c = applyConvenienceOverride(ov, true);
        if (c !== null) {
          conv = c;
        }
      }
    }
    convenienceFee = Math.max(0, conv);
  }

  let deliveryFee = 0;
  if (serviceStyle === 'at_home' || type === 'order') {
    const threshold = parseFloat(globals['free_delivery_threshold'] ?? '');
    const th = Number.isFinite(threshold) ? threshold : DEFAULT_FREE_DELIVERY_THRESHOLD;
    if (amount < th || th === 0) {
      const base = parseFloat(globals['delivery_fee_base'] ?? '');
      deliveryFee = Number.isFinite(base) ? base : DEFAULT_DELIVERY_BASE;
    }
  }
  if (deliveryFee < 0) deliveryFee = 0;

  let packagingFee = 0;
  if (type === 'order') {
    const packagingEnabled =
      globals['packaging_fee_enabled'] === 'true' || globals['packaging_fee_enabled'] === '1';
    if (packagingEnabled) {
      const p = parseFloat(globals['packaging_fee_amount'] ?? '');
      packagingFee = Number.isFinite(p) ? p : 0;
    }
  }
  if (packagingFee < 0) packagingFee = 0;

  const total = platformFee + convenienceFee + deliveryFee + packagingFee;

  return {
    platformFee,
    convenienceFee,
    deliveryFee,
    packagingFee,
    total,
  };
}
