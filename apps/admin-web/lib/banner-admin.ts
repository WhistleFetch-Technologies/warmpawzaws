/**
 * Admin GET /admin/banners returns DB column `type` (e.g. main, home_top, home_middle, category, checkout).
 * UI uses `position` with legacy `main` shown as `home_top`.
 */

export function adminBannerPositionFromRow(row: { type?: string; position?: string }): string {
  const t = (row.type ?? row.position ?? 'main').toString().toLowerCase();
  if (t === 'main') return 'home_top';
  return t;
}

export function normalizeAdminBannerRow<T extends Record<string, unknown>>(row: T): T & { position: string; type: string } {
  const t = String(row.type ?? row.position ?? 'main');
  const position = adminBannerPositionFromRow({ type: t, position: row.position as string | undefined });
  const target_state = normalizeLocationValue(row.target_state ?? row.targetState);
  const target_city = normalizeLocationValue(row.target_city ?? row.targetCity);
  return { ...row, type: t, position, target_state, target_city };
}

export function normalizeAdminBannersList(banners: unknown[] | null | undefined): (Record<string, unknown> & { position: string; type: string })[] {
  if (!Array.isArray(banners)) return [];
  return banners.map((b) => normalizeAdminBannerRow(b as Record<string, unknown>));
}

export function formatAdminBannerPlacementLabel(position: string | undefined): string {
  return (position || 'home_top').replace(/_/g, ' ');
}

export function normalizeLocationValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length ? normalized : null;
}

export function formatAdminBannerLocationLabel(targetState?: unknown, targetCity?: unknown): string {
  const state = normalizeLocationValue(targetState);
  const city = normalizeLocationValue(targetCity);
  if (!state && !city) return 'All locations';
  if (state && city) return `${city}, ${state}`;
  if (state) return `All cities, ${state}`;
  return `${city}`;
}

/** Radix Select sentinel — clears category / type / vendor selection. */
export const BANNER_SELECT_EMPTY = '__select__';

export type BannerTargetLevel = 'category' | 'service_type' | 'vendor';

export type BannerDestinationCategory = {
  id: string;
  categoryId: string;
  name: string;
  customerScreen: string;
  displayOrder?: number;
};

export type BannerDestinationServiceStyle = {
  value: string;
  label: string;
};

export type BannerDestinationVendor = {
  id: string;
  businessName: string;
  category?: string | null;
  roleName?: string | null;
};

export type BannerTargetMetadata = {
  categoryId: string;
  customerScreen: string;
  targetLevel: BannerTargetLevel;
  serviceStyle?: string;
  vendorId?: string;
  vendorName?: string;
  vendorServiceId?: string | null;
  /** Legacy alias kept for deep-link display paths */
  persona?: string;
};

export function buildBannerCtaLink(customerScreen: string, vendorName: string): string {
  const p = String(customerScreen ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  const name = String(vendorName ?? '').trim();
  if (!p || !name) return '';
  return `/${p}/${name}`;
}

export function buildBannerMetadata(opts: {
  gradientFrom: string;
  gradientTo: string;
  bannerTarget?: BannerTargetMetadata | null;
}): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    gradient_from: opts.gradientFrom,
    gradient_to: opts.gradientTo,
  };
  if (opts.bannerTarget) {
    meta.bannerTarget = {
      categoryId: opts.bannerTarget.categoryId,
      customerScreen: opts.bannerTarget.customerScreen,
      targetLevel: opts.bannerTarget.targetLevel,
      serviceStyle: opts.bannerTarget.serviceStyle ?? null,
      vendorId: opts.bannerTarget.vendorId ?? null,
      vendorName: opts.bannerTarget.vendorName ?? null,
      vendorServiceId: opts.bannerTarget.vendorServiceId ?? null,
      persona: opts.bannerTarget.persona ?? opts.bannerTarget.customerScreen,
    };
  }
  return meta;
}

export function parseBannerTargetFromAdminRow(row: Record<string, unknown>): BannerTargetMetadata | null {
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const raw = meta.bannerTarget ?? meta.banner_target;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const bt = raw as Record<string, unknown>;

  const categoryId = String(bt.categoryId ?? bt.category_id ?? bt.persona ?? '').trim();
  const customerScreen = String(bt.customerScreen ?? bt.customer_screen ?? bt.persona ?? categoryId).trim();
  const targetLevelRaw = String(bt.targetLevel ?? bt.target_level ?? '').trim();
  const vendorId = String(bt.vendorId ?? bt.vendor_id ?? '').trim();
  const serviceStyleRaw = bt.serviceStyle ?? bt.service_style;

  let targetLevel: BannerTargetLevel | null = null;
  if (targetLevelRaw === 'category' || targetLevelRaw === 'service_type' || targetLevelRaw === 'vendor') {
    targetLevel = targetLevelRaw;
  } else if (vendorId) {
    targetLevel = 'vendor';
  } else if (serviceStyleRaw != null && String(serviceStyleRaw).trim()) {
    targetLevel = 'service_type';
  } else if (categoryId) {
    targetLevel = 'category';
  }

  if (!categoryId || !customerScreen || !targetLevel) return null;

  const vendorServiceIdRaw = bt.vendorServiceId ?? bt.vendor_service_id;

  return {
    categoryId,
    customerScreen,
    targetLevel,
    serviceStyle:
      serviceStyleRaw != null && String(serviceStyleRaw).trim()
        ? normalizeBannerServiceStyle(serviceStyleRaw)
        : undefined,
    vendorId: vendorId || undefined,
    vendorName: String(bt.vendorName ?? bt.vendor_name ?? '').trim() || undefined,
    vendorServiceId:
      vendorServiceIdRaw != null && String(vendorServiceIdRaw).trim() !== ''
        ? String(vendorServiceIdRaw).trim()
        : null,
    persona: String(bt.persona ?? customerScreen).trim() || undefined,
  };
}

export function labelForBannerCategory(
  categoryId: string,
  categories: BannerDestinationCategory[]
): string {
  const found = categories.find((c) => c.categoryId === categoryId);
  return found?.name ?? categoryId;
}

export function labelForBannerServiceStyle(style: string, styles?: BannerDestinationServiceStyle[]): string {
  const key = normalizeBannerServiceStyle(style);
  const found = styles?.find((s) => s.value === key);
  if (found) return found.label;
  switch (key) {
    case 'at_center':
      return 'Clinic visit / At center';
    case 'at_home':
      return 'Home / At home';
    case 'tele':
      return 'Tele consultation';
    default:
      return key;
  }
}

export function shortLabelForBannerServiceStyle(style: string): string {
  switch (normalizeBannerServiceStyle(style)) {
    case 'at_center':
      return 'Clinic visit';
    case 'at_home':
      return 'Home service';
    case 'tele':
      return 'Tele consult';
    default:
      return labelForBannerServiceStyle(style);
  }
}

/** Align stored DB / legacy values with admin picker options. */
export function normalizeBannerServiceStyle(raw: unknown): string {
  const style = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!style) return 'at_center';
  if (style === 'clinic' || style === 'center' || style === 'at_clinic') return 'at_center';
  if (style === 'home' || style === 'home_visit') return 'at_home';
  if (style === 'online') return 'tele';
  if (style === 'tele' || style === 'at_home' || style === 'at_center') return style;
  return style;
}

export function vendorDisplayName(vendor: Record<string, unknown>): string {
  return String(
    vendor.businessName || vendor.business_name || vendor.fullName || vendor.name || 'Vendor'
  ).trim();
}

export function validateBannerSaveTarget(opts: {
  position: string;
  categoryId: string;
  targetMode: 'none' | 'service_type' | 'vendor';
  serviceStyle: string;
  vendorId: string;
}): { ok: true } | { ok: false; message: string } {
  if (opts.position === 'checkout') {
    return { ok: true };
  }
  if (!opts.categoryId.trim()) {
    return { ok: false, message: 'Select a service category for this banner destination.' };
  }
  if (opts.targetMode === 'service_type' && !opts.serviceStyle.trim()) {
    return { ok: false, message: 'Select a service type for this banner.' };
  }
  if (opts.targetMode === 'vendor' && !opts.vendorId.trim()) {
    return { ok: false, message: 'Select a vendor for this banner.' };
  }
  return { ok: true };
}

export function isCheckoutBannerPosition(position: string | undefined): boolean {
  return String(position ?? '').trim().toLowerCase() === 'checkout';
}
