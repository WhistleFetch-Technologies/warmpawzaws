/**
 * Resolves admin banner navigation targets.
 *
 * Primary: metadata.bannerTarget { categoryId, customerScreen, targetLevel, serviceStyle?, vendorId? }
 * Legacy: metadata.bannerTarget { persona, serviceStyle, vendorId } or CTA `/persona/vendor-name`
 */

import {
  mapCatalogCategoryIdToCustomerHomeScreen,
  normalizeBannerServiceStyle as sharedNormalizeBannerServiceStyle,
  resolveCustomerScreenForCategoryAndStyle,
} from '@warmpawz/service-launch-mappings';
import { query } from '../database/rds-connection';

export type BannerNavTarget =
  | { kind: 'screen'; screen: string; data: Record<string, unknown> }
  | { kind: 'path'; path: string };

export type BannerTargetLevel =
  | 'category'
  | 'service_type'
  | 'vendor'
  | 'article'
  | 'informational';

export type BannerTarget = {
  categoryId?: string;
  customerScreen?: string;
  targetLevel?: BannerTargetLevel;
  articleSlug?: string;
  articlePageId?: string;
  articleTitle?: string;
  /** Legacy alias for customerScreen */
  persona?: string;
  serviceStyle?: string;
  vendorId?: string;
  vendorName?: string;
  vendorServiceId?: string | null;
};

export function buildArticleBannerPath(slug: string): string {
  const s = String(slug ?? '').trim();
  if (!s) return '';
  return `/articles?slug=${encodeURIComponent(s)}`;
}

export type ParsedBannerCta = {
  persona: string;
  vendorName: string;
};

type PersonaConfig = {
  bookingScreen: string;
  landingScreen: string;
  categoryAliases: string[];
  roleAliases: string[];
};

const PERSONA_CONFIG: Record<string, PersonaConfig> = {
  vet: {
    bookingScreen: 'vet-booking',
    landingScreen: 'vet',
    categoryAliases: ['vet', 'veterinary', 'veterinarian', 'vet_clinic', 'vet_clinic_center'],
    roleAliases: ['vet', 'veterinarian', 'veterinary'],
  },
  grooming: {
    bookingScreen: 'create-booking',
    landingScreen: 'grooming',
    categoryAliases: ['grooming', 'groomer', 'pet_groomer'],
    roleAliases: ['groomer', 'grooming', 'pet_groomer'],
  },
  training: {
    bookingScreen: 'training-booking',
    landingScreen: 'training',
    categoryAliases: ['training', 'trainer', 'pet_trainer'],
    roleAliases: ['trainer', 'training', 'pet_trainer'],
  },
  boarding: {
    bookingScreen: 'create-booking',
    landingScreen: 'boarding',
    categoryAliases: ['boarding', 'boarder', 'pet_boarding', 'petboarding'],
    roleAliases: ['boarder', 'boarding', 'pet_boarding'],
  },
  walker: {
    bookingScreen: 'create-booking',
    landingScreen: 'walker',
    categoryAliases: ['walker', 'walking', 'pet_walker'],
    roleAliases: ['walker', 'walking', 'pet_walker'],
  },
  nutritionist: {
    bookingScreen: 'create-booking',
    landingScreen: 'nutritionist',
    categoryAliases: ['nutritionist', 'nutrition', 'pet_nutritionist'],
    roleAliases: ['nutritionist', 'nutrition'],
  },
};

function norm(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

/** Normalize admin / DB service style to canonical tele | at_home | at_center. */
export function normalizeBannerServiceStyle(raw: unknown): string {
  return sharedNormalizeBannerServiceStyle(raw);
}

function normalizeText(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^\w\s+/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  return normalizeText(s)
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function scoreNameMatch(query: string, candidate: string): number {
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.startsWith(q) || q.startsWith(c)) return 92;
  if (c.includes(q) || q.includes(c)) return 85;

  const qTokens = tokenize(q);
  const cTokens = tokenize(c);
  if (qTokens.length === 0) return 0;

  const matched = qTokens.filter((t) =>
    cTokens.some((ct) => ct === t || ct.includes(t) || t.includes(ct))
  );
  if (matched.length === 0) return 0;
  return Math.round((matched.length / qTokens.length) * 78);
}

function parseMetadataObject(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return typeof o === 'object' && o != null && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  return {};
}

function resolveCustomerScreenFromTarget(bt: Record<string, unknown>): string {
  const fromField = String(bt.customerScreen ?? bt.customer_screen ?? '').trim();
  if (fromField) return fromField;
  const categoryId = String(bt.categoryId ?? bt.category_id ?? '').trim();
  if (categoryId) return mapCatalogCategoryIdToCustomerHomeScreen(categoryId);
  const persona = norm(String(bt.persona ?? bt.category ?? ''));
  if (persona && PERSONA_CONFIG[persona]) return PERSONA_CONFIG[persona].landingScreen;
  if (persona) return mapCatalogCategoryIdToCustomerHomeScreen(persona) || persona;
  return '';
}

function inferTargetLevel(bt: Record<string, unknown>): BannerTargetLevel | null {
  const explicit = String(bt.targetLevel ?? bt.target_level ?? '').trim() as BannerTargetLevel;
  if (
    explicit === 'category' ||
    explicit === 'service_type' ||
    explicit === 'vendor' ||
    explicit === 'article' ||
    explicit === 'informational'
  ) {
    return explicit;
  }
  const vendorId = String(bt.vendorId ?? bt.vendor_id ?? '').trim();
  const serviceStyle = String(bt.serviceStyle ?? bt.service_style ?? '').trim();
  if (vendorId) return 'vendor';
  if (serviceStyle) return 'service_type';
  if (bt.categoryId || bt.category_id || bt.persona) return 'category';
  return null;
}

/** Extract bannerTarget from banner metadata (snake or camel). */
export function parseBannerTargetFromMetadata(metadata: unknown): BannerTarget | null {
  const meta = parseMetadataObject(metadata);
  const raw = meta.bannerTarget ?? meta.banner_target;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const bt = raw as Record<string, unknown>;
  const targetLevel = inferTargetLevel(bt);
  const articleSlug = String(bt.articleSlug ?? bt.article_slug ?? '').trim();

  if (targetLevel === 'informational') {
    return { targetLevel: 'informational' };
  }

  if (targetLevel === 'article') {
    if (!articleSlug) return null;
    const articlePageId = String(bt.articlePageId ?? bt.article_page_id ?? '').trim();
    const articleTitle = String(bt.articleTitle ?? bt.article_title ?? '').trim();
    return {
      targetLevel: 'article',
      articleSlug,
      articlePageId: articlePageId || undefined,
      articleTitle: articleTitle || undefined,
    };
  }

  const customerScreen = resolveCustomerScreenFromTarget(bt);
  const categoryId = String(bt.categoryId ?? bt.category_id ?? bt.persona ?? '').trim();
  const vendorId = String(bt.vendorId ?? bt.vendor_id ?? '').trim();
  const persona = norm(String(bt.persona ?? customerScreen ?? ''));

  if (!targetLevel && !customerScreen && !persona) return null;

  const vendorServiceIdRaw = bt.vendorServiceId ?? bt.vendor_service_id;
  const vendorServiceId =
    vendorServiceIdRaw != null && String(vendorServiceIdRaw).trim() !== ''
      ? String(vendorServiceIdRaw).trim()
      : null;

  const serviceStyleRaw = bt.serviceStyle ?? bt.service_style;

  return {
    categoryId: categoryId || undefined,
    customerScreen: customerScreen || undefined,
    targetLevel: targetLevel ?? undefined,
    persona: persona || undefined,
    serviceStyle:
      serviceStyleRaw != null && String(serviceStyleRaw).trim()
        ? normalizeBannerServiceStyle(serviceStyleRaw)
        : undefined,
    vendorId: vendorId || undefined,
    vendorName: String(bt.vendorName ?? bt.vendor_name ?? '').trim() || undefined,
    vendorServiceId,
  };
}

/** Parse `/persona/vendor name` or `persona/vendor name` (optional leading slash). */
export function parseBannerCtaLink(ctaLink: unknown): ParsedBannerCta | null {
  const raw = String(ctaLink ?? '').trim();
  if (!raw || /^https?:\/\//i.test(raw)) return null;

  const pathOnly = raw.split('?')[0].split('#')[0].trim();
  const withoutLeading = pathOnly.replace(/^\/+/, '');
  const segments = withoutLeading.split('/').map((s) => decodeURIComponent(s.trim())).filter(Boolean);
  if (segments.length < 2) return null;

  const persona = norm(segments[0]);
  const vendorName = segments.slice(1).join('/').trim();
  if (!persona || !vendorName) return null;

  const screen = PERSONA_CONFIG[persona]?.landingScreen ?? mapCatalogCategoryIdToCustomerHomeScreen(persona);
  if (!screen) return null;

  return { persona, vendorName };
}

function personaMatchesVendor(persona: string, category: string | null, roleName: string | null): boolean {
  const cfg = PERSONA_CONFIG[persona];
  if (!cfg) return false;
  const cat = norm(category || '');
  const role = norm(roleName || '');
  if (cat && cfg.categoryAliases.some((a) => cat.includes(a) || a.includes(cat))) return true;
  if (role && cfg.roleAliases.some((a) => role.includes(a) || a.includes(role))) return true;
  return false;
}

function resolvePersonaKey(target: BannerTarget): string {
  const screen = target.customerScreen || target.persona || '';
  if (PERSONA_CONFIG[screen]) return screen;
  if (target.persona && PERSONA_CONFIG[target.persona]) return target.persona;
  return screen;
}

function parseVendorServiceMetadata(raw: unknown): Record<string, unknown> {
  return parseMetadataObject(raw);
}

function isPackageService(metadata: Record<string, unknown>, serviceName: string): boolean {
  if (metadata.isPackage === true || metadata.type === 'package' || metadata.packageDetails) return true;
  return /\bpackage\b/i.test(serviceName);
}

function mapVendorServiceRow(row: Record<string, unknown>) {
  const rawPrice =
    row.custom_price != null && row.custom_price !== ''
      ? parseFloat(String(row.custom_price))
      : parseFloat(String(row.price ?? 0));
  const duration = Number(row.custom_duration ?? row.duration_minutes ?? 30) || 30;

  return {
    id: String(row.id),
    service_id: String(row.service_id),
    service_name: String(row.service_name),
    service_style: String(row.service_style || 'at_center'),
    price: Number.isFinite(rawPrice) ? rawPrice : 0,
    duration,
    metadata: parseVendorServiceMetadata(row.metadata),
  };
}

export function buildBookingNavTarget(
  persona: string,
  vendor: { id: string; business_name: string },
  service: {
    id: string;
    service_id: string;
    service_name: string;
    service_style: string;
    price: number;
    duration: number;
    metadata: Record<string, unknown>;
  }
): BannerNavTarget {
  const cfg = PERSONA_CONFIG[persona];
  const bookingScreen = cfg?.bookingScreen ?? 'create-booking';
  const style = normalizeBannerServiceStyle(service.service_style);

  if (isPackageService(service.metadata, service.service_name)) {
    return {
      kind: 'screen',
      screen: 'purchase-package',
      data: {
        vendorId: vendor.id,
        vendorName: vendor.business_name,
        vendorServiceId: service.id,
        serviceId: service.service_id,
        serviceName: service.service_name,
        serviceStyle: style,
        serviceTypeCategory: persona === 'vet' ? 'vet' : persona,
      },
    };
  }

  const bookingData: Record<string, unknown> = {
    vendorId: vendor.id,
    vendorName: vendor.business_name,
    doctorId: vendor.id,
    serviceId: service.id,
    serviceName: service.service_name,
    serviceStyle: style,
    serviceType: persona === 'vet' ? style : persona,
    price: service.price,
    duration: service.duration,
    service: {
      id: service.id,
      serviceId: service.service_id,
      name: service.service_name,
      price: service.price,
      duration: service.duration,
      serviceStyle: style,
      metadata: service.metadata,
    },
  };

  if (persona === 'vet' && style === 'tele') {
    bookingData.teleInstantPay = true;
  }

  return {
    kind: 'screen',
    screen: bookingScreen,
    data: bookingData,
  };
}

export function buildVendorProfileNavTarget(
  persona: string,
  vendor: { id: string; business_name: string },
  serviceStyle?: string
): BannerNavTarget {
  const cfg = PERSONA_CONFIG[persona];
  const screenKey = cfg?.landingScreen ?? persona;
  const style = normalizeBannerServiceStyle(serviceStyle || 'at_center');

  if (screenKey === 'vet' || persona === 'vet') {
    return {
      kind: 'screen',
      screen: 'vet-services-by-style',
      data: {
        vendorId: vendor.id,
        vendorName: vendor.business_name,
        serviceStyle: style,
        serviceTypeName: vendor.business_name,
        category: 'vet',
      },
    };
  }

  if (screenKey === 'grooming' || screenKey === 'training') {
    return {
      kind: 'screen',
      screen: screenKey,
      data: {
        vendorId: vendor.id,
        vendorName: vendor.business_name,
        serviceStyle: style,
      },
    };
  }

  return {
    kind: 'screen',
    screen: screenKey,
    data: {
      vendorId: vendor.id,
      vendorName: vendor.business_name,
      serviceStyle: style,
    },
  };
}

function buildCategoryNavTarget(target: BannerTarget): BannerNavTarget | null {
  const customerScreen = target.customerScreen || resolveCustomerScreenFromTarget(target as Record<string, unknown>);
  if (!customerScreen) return null;
  return {
    kind: 'screen',
    screen: customerScreen,
    data: {
      categoryId: target.categoryId ?? null,
    },
  };
}

function buildServiceTypeNavTarget(target: BannerTarget): BannerNavTarget | null {
  const customerScreen = target.customerScreen || resolveCustomerScreenFromTarget(target as Record<string, unknown>);
  if (!customerScreen) return null;
  const style = normalizeBannerServiceStyle(target.serviceStyle || 'at_center');
  const screen = resolveCustomerScreenForCategoryAndStyle(customerScreen, style) || customerScreen;
  return {
    kind: 'screen',
    screen,
    data: {
      categoryId: target.categoryId ?? null,
      serviceStyle: style,
    },
  };
}

async function findVendorById(vendorId: string) {
  const { rows } = await query(
    `SELECT v.id, v.business_name, v.category, r.name AS role_name
     FROM vendors v
     LEFT JOIN roles r ON r.id = v.role_id
     WHERE v.id = $1
       AND v.is_active = true
       AND v.status IN ('approved', 'active')
     LIMIT 1`,
    [vendorId]
  );
  return (rows[0] as { id: string; business_name: string } | undefined) ?? null;
}

async function findVendorByName(persona: string, vendorName: string) {
  const pattern = `%${vendorName.replace(/%/g, '\\%')}%`;
  const exact = vendorName.trim();

  const { rows } = await query(
    `SELECT v.id, v.business_name, v.category, r.name AS role_name
     FROM vendors v
     LEFT JOIN roles r ON r.id = v.role_id
     WHERE v.is_active = true
       AND v.status IN ('approved', 'active')
       AND (
         LOWER(TRIM(v.business_name)) = LOWER(TRIM($1))
         OR v.business_name ILIKE $2
       )
     ORDER BY
       CASE WHEN LOWER(TRIM(v.business_name)) = LOWER(TRIM($1)) THEN 0 ELSE 1 END,
       LENGTH(v.business_name) ASC
     LIMIT 12`,
    [exact, pattern]
  );

  if (rows.length === 0) return null;

  const personaMatches = rows.filter((r: any) =>
    personaMatchesVendor(persona, r.category, r.role_name)
  );
  const pool = personaMatches.length > 0 ? personaMatches : rows;

  let best = pool[0] as { id: string; business_name: string };
  let bestScore = scoreNameMatch(vendorName, best.business_name);
  for (const row of pool.slice(1)) {
    const score = scoreNameMatch(vendorName, row.business_name);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best;
}

async function findVendorServiceById(
  vendorId: string,
  vendorServiceId: string,
  expectedStyle?: string
) {
  const { rows } = await query(
    `SELECT
       vs.id,
       vs.service_id,
       vs.service_name,
       vs.service_style,
       vs.price,
       vs.custom_price,
       vs.duration_minutes,
       vs.custom_duration,
       vs.metadata
     FROM vendor_services vs
     WHERE vs.vendor_id = $1
       AND vs.id = $2
       AND vs.is_enabled = true
       AND (
         vs.publish_status IS NULL
         OR LOWER(TRIM(COALESCE(vs.publish_status::text, ''))) IN ('published', 'auto_published', 'draft')
       )
     LIMIT 1`,
    [vendorId, vendorServiceId]
  );

  if (rows.length === 0) return null;

  const mapped = mapVendorServiceRow(rows[0] as Record<string, unknown>);
  if (expectedStyle) {
    const want = normalizeBannerServiceStyle(expectedStyle);
    const got = normalizeBannerServiceStyle(mapped.service_style);
    if (want !== got) return null;
  }
  return mapped;
}

async function findBestVendorService(
  vendorId: string,
  serviceName: string,
  serviceStyle?: string
) {
  const styleFilter = serviceStyle ? normalizeBannerServiceStyle(serviceStyle) : null;

  const { rows } = await query(
    `SELECT
       vs.id,
       vs.service_id,
       vs.service_name,
       vs.service_style,
       vs.price,
       vs.custom_price,
       vs.duration_minutes,
       vs.custom_duration,
       vs.metadata
     FROM vendor_services vs
     WHERE vs.vendor_id = $1
       AND vs.is_enabled = true
       AND (
         vs.publish_status IS NULL
         OR LOWER(TRIM(COALESCE(vs.publish_status::text, ''))) IN ('published', 'auto_published', 'draft')
       )
       ${styleFilter ? 'AND vs.service_style = $2' : ''}
     ORDER BY vs.updated_at DESC NULLS LAST, vs.created_at DESC`,
    styleFilter ? [vendorId, styleFilter] : [vendorId]
  );

  if (rows.length === 0) return null;

  let best: (typeof rows)[0] | null = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = scoreNameMatch(serviceName, row.service_name);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }

  if (!best || bestScore < 40) return null;
  return mapVendorServiceRow(best as Record<string, unknown>);
}

async function resolveFromBannerTarget(target: BannerTarget): Promise<BannerNavTarget | null> {
  try {
    const level =
      target.targetLevel ??
      (target.vendorId ? 'vendor' : target.serviceStyle ? 'service_type' : 'category');

    if (level === 'informational') {
      return null;
    }

    if (level === 'article') {
      const slug = String(target.articleSlug ?? '').trim();
      if (!slug) return null;
      const path = buildArticleBannerPath(slug);
      return path ? { kind: 'path', path } : null;
    }

    if (level === 'category') {
      return buildCategoryNavTarget(target);
    }

    if (level === 'service_type') {
      return buildServiceTypeNavTarget(target);
    }

    if (level === 'vendor') {
      const persona = resolvePersonaKey(target);
      if (!target.vendorId) return null;

      const vendor =
        (await findVendorById(target.vendorId)) ??
        (target.vendorName && persona
          ? await findVendorByName(persona, target.vendorName)
          : null);

      if (!vendor) return null;

      const style = normalizeBannerServiceStyle(target.serviceStyle || 'at_center');

      if (target.vendorServiceId) {
        const service = await findVendorServiceById(vendor.id, target.vendorServiceId, style);
        if (service) {
          return buildBookingNavTarget(persona, vendor, service);
        }
      }

      return buildVendorProfileNavTarget(persona, vendor, style);
    }

    return null;
  } catch (err) {
    console.warn('[banner-cta-resolver] bannerTarget resolve failed:', err);
    return null;
  }
}

export async function resolveBannerCtaNavigation(input: {
  ctaLink?: unknown;
  title?: unknown;
  subtitle?: unknown;
  metadata?: unknown;
  bannerTarget?: BannerTarget | null;
  vendorId?: string;
  vendorServiceId?: string;
  serviceStyle?: string;
}): Promise<BannerNavTarget | null> {
  const fromMeta = input.bannerTarget ?? parseBannerTargetFromMetadata(input.metadata);
  if (fromMeta) {
    const resolved = await resolveFromBannerTarget(fromMeta);
    if (resolved) return resolved;
  }

  if (input.vendorId && input.serviceStyle) {
    const inlineTarget: BannerTarget = {
      persona: norm(String(parseBannerCtaLink(input.ctaLink)?.persona ?? 'vet')),
      vendorId: String(input.vendorId).trim(),
      serviceStyle: normalizeBannerServiceStyle(input.serviceStyle),
      vendorServiceId: input.vendorServiceId ? String(input.vendorServiceId).trim() : null,
      targetLevel: 'vendor',
    };
    const resolved = await resolveFromBannerTarget(inlineTarget);
    if (resolved) return resolved;
  }

  const parsed = parseBannerCtaLink(input.ctaLink);
  if (!parsed) return null;

  const serviceName = String(input.title ?? '').trim();
  const legacyStyle = input.serviceStyle ? normalizeBannerServiceStyle(input.serviceStyle) : undefined;

  try {
    const vendor = await findVendorByName(parsed.persona, parsed.vendorName);
    if (!vendor) return null;

    if (serviceName) {
      const service = await findBestVendorService(String(vendor.id), serviceName, legacyStyle);
      if (service) {
        return buildBookingNavTarget(parsed.persona, vendor, service);
      }
    }

    return buildVendorProfileNavTarget(parsed.persona, vendor, legacyStyle || 'at_center');
  } catch (err) {
    console.warn('[banner-cta-resolver] legacy resolve failed:', err);
    return null;
  }
}

function isCheckoutBanner(banner: Record<string, unknown>): boolean {
  const type = String(banner.type ?? banner.position ?? '').trim().toLowerCase();
  return type === 'checkout';
}

function isInformationalHomeBanner(banner: Record<string, unknown>): boolean {
  const target = parseBannerTargetFromMetadata(banner.metadata);
  return target?.targetLevel === 'informational';
}

/** Batch-resolve nav targets for banner rows (best-effort, skips failures). */
export async function enrichBannersWithNavTargets<
  T extends {
    ctaLink?: unknown;
    cta_link?: unknown;
    title?: unknown;
    subtitle?: unknown;
    metadata?: unknown;
    type?: unknown;
    position?: unknown;
  }
>(banners: T[]): Promise<(T & { navTarget?: BannerNavTarget })[]> {
  return Promise.all(
    banners.map(async (banner) => {
      const row = banner as Record<string, unknown>;
      if (isCheckoutBanner(row) || isInformationalHomeBanner(row)) {
        return banner;
      }
      const navTarget = await resolveBannerCtaNavigation({
        ctaLink: banner.ctaLink ?? banner.cta_link,
        title: banner.title,
        subtitle: banner.subtitle,
        metadata: banner.metadata,
      });
      if (!navTarget) return banner;
      return { ...banner, navTarget };
    })
  );
}

/** Admin helper: build CTA path from persona + vendor business name. */
export function buildBannerCtaLink(persona: string, vendorName: string): string {
  const p = norm(persona);
  const name = String(vendorName ?? '').trim();
  if (!p || !name) return '';
  return `/${p}/${name}`;
}

export const BANNER_CTA_PERSONAS = Object.keys(PERSONA_CONFIG);

/** List published vendor services for admin banner service picker. */
export async function listVendorServicesForBannerPicker(opts: {
  vendorId: string;
  serviceStyle?: string;
  category?: string;
}) {
  const vendorId = String(opts.vendorId ?? '').trim();
  if (!vendorId) return [];

  const style = opts.serviceStyle ? normalizeBannerServiceStyle(opts.serviceStyle) : null;

  const { rows } = await query(
    `SELECT
       vs.id,
       vs.service_id,
       vs.service_name,
       vs.service_style,
       vs.price,
       vs.custom_price,
       vs.duration_minutes,
       vs.category
     FROM vendor_services vs
     WHERE vs.vendor_id = $1
       AND vs.is_enabled = true
       AND (
         vs.publish_status IS NULL
         OR LOWER(TRIM(COALESCE(vs.publish_status::text, ''))) IN ('published', 'auto_published', 'draft')
       )
       ${style ? 'AND vs.service_style = $2' : ''}
     ORDER BY vs.service_name ASC`,
    style ? [vendorId, style] : [vendorId]
  );

  return rows.map((row: Record<string, unknown>) => {
    const rawPrice =
      row.custom_price != null && row.custom_price !== ''
        ? parseFloat(String(row.custom_price))
        : parseFloat(String(row.price ?? 0));
    return {
      id: String(row.id),
      serviceId: String(row.service_id),
      name: String(row.service_name),
      serviceName: String(row.service_name),
      serviceStyle: String(row.service_style || 'at_center'),
      price: Number.isFinite(rawPrice) ? rawPrice : 0,
      duration: Number(row.duration_minutes ?? 30) || 30,
      category: row.category != null ? String(row.category) : null,
    };
  });
}

