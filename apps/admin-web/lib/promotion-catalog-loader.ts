import type { PromotionTargetCatalog, TargetOption } from '@warmpawz/promotion-management-ui';

type ApiClientLike = {
  get<T>(path: string): Promise<T>;
};

const DEFAULT_STYLES: TargetOption[] = [
  { id: 'at_home', label: 'At home' },
  { id: 'at_center', label: 'At center' },
  { id: 'tele', label: 'Tele consult' },
];

function mapCategoryOption(cat: Record<string, unknown>): TargetOption | null {
  const slug = String(cat.category_id ?? cat.categoryId ?? cat.slug ?? '').trim();
  const id = slug || String(cat.id ?? '').trim();
  if (!id) return null;
  return {
    id: slug || id,
    label: String(cat.name ?? cat.label ?? id),
    subtitle: cat.description ? String(cat.description) : undefined,
  };
}

function mapServiceOption(s: Record<string, unknown>): TargetOption | null {
  const uuid = String(s.id ?? '').trim();
  const textId = String(s.service_id ?? '').trim();
  const id = /^[0-9a-f-]{36}$/i.test(uuid) ? uuid : textId || uuid;
  if (!id) return null;
  const priceRaw = s.base_price ?? s.basePrice ?? s.price;
  const price =
    priceRaw != null && priceRaw !== '' && Number.isFinite(Number(priceRaw)) && Number(priceRaw) > 0
      ? Number(priceRaw)
      : undefined;
  const subtitleParts = [
    s.category_name ? String(s.category_name) : '',
    price != null ? `₹${price}` : '',
  ].filter(Boolean);
  return {
    id,
    label: String(s.display_name ?? s.service_name ?? s.name ?? id),
    subtitle: subtitleParts.length ? subtitleParts.join(' · ') : undefined,
    group: s.service_style ? String(s.service_style) : undefined,
    price,
  };
}

function mapPackageOption(p: Record<string, unknown>): TargetOption | null {
  const id = String(p.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    label: String(p.name ?? p.package_name ?? id),
    subtitle: p.region ? String(p.region) : p.region_id ? String(p.region_id) : undefined,
  };
}

function mapProductOption(p: Record<string, unknown>): TargetOption | null {
  const id = String(p.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    label: String(p.name ?? p.title ?? id),
    subtitle: p.sku ? String(p.sku) : p.category_name ? String(p.category_name) : undefined,
  };
}

function mapMealPlanOption(mp: Record<string, unknown>): TargetOption | null {
  const id = String(mp.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    label: String(mp.plan_name ?? mp.name ?? mp.meal_name ?? id),
    subtitle: mp.vendor_name ? String(mp.vendor_name) : undefined,
  };
}

function mapVendorOption(v: Record<string, unknown>): TargetOption | null {
  const id = String(v.id ?? v.vendor_id ?? '').trim();
  if (!id) return null;
  const label = String(
    v.business_name ??
      v.businessName ??
      v.full_name ??
      v.fullName ??
      v.owner_name ??
      v.ownerName ??
      v.name ??
      id
  ).trim();
  return {
    id,
    label: label || id,
    subtitle: v.city ? String(v.city) : v.roleDisplayName ? String(v.roleDisplayName) : undefined,
  };
}

function mapStyleOption(s: Record<string, unknown>): TargetOption | null {
  const id = String(s.value ?? s.id ?? s.service_style ?? s.style ?? '').trim();
  if (!id) return null;
  return {
    id,
    label: String(s.label ?? s.name ?? s.display_name ?? id),
  };
}

/** Load promotion target catalog from existing admin APIs (no new endpoints). */
export async function loadPromotionTargetCatalog(
  apiClient: ApiClientLike
): Promise<PromotionTargetCatalog> {
  const [
    categoriesRes,
    servicesRes,
    packagesRes,
    productsRes,
    vendorsRes,
    stylesRes,
    mealPlansRes,
    bannerDestRes,
  ] = await Promise.all([
    apiClient.get<any>('/admin/catalog/categories').catch(() => ({ categories: [] })),
    apiClient.get<any>('/admin/catalog/services').catch(() => ({ services: [] })),
    apiClient.get<any>('/admin/catalog/regional-packages').catch(() => ({ packages: [] })),
    apiClient.get<any>('/admin/catalog/products').catch(() => ({ products: [] })),
    apiClient.get<any>('/admin/vendors?limit=200').catch(() => ({ vendors: [] })),
    apiClient.get<any>('/admin/catalog/service-styles').catch(() => ({ serviceStyles: [] })),
    apiClient.get<any>('/meal-plans/search').catch(() => ({ mealPlans: [] })),
    apiClient.get<any>('/admin/banners/destination-options').catch(() => ({ categories: [] })),
  ]);

  const categoryRows = [
    ...(Array.isArray(categoriesRes.categories) ? categoriesRes.categories : []),
    ...(Array.isArray(bannerDestRes.categories) ? bannerDestRes.categories : []),
  ];

  const categories = categoryRows
    .map((c) =>
      mapCategoryOption({
        ...c,
        category_id: c.categoryId ?? c.category_id ?? c.id,
        name: c.name ?? c.label,
      })
    )
    .filter(Boolean) as TargetOption[];

  const uniqueCategories = Array.from(
    new Map(categories.map((c) => [c.id, c])).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  const services = (Array.isArray(servicesRes.services) ? servicesRes.services : [])
    .map(mapServiceOption)
    .filter(Boolean) as TargetOption[];

  const packages = (Array.isArray(packagesRes.packages) ? packagesRes.packages : [])
    .map(mapPackageOption)
    .filter(Boolean) as TargetOption[];

  const products = (Array.isArray(productsRes.products) ? productsRes.products : [])
    .map(mapProductOption)
    .filter(Boolean) as TargetOption[];

  const vendorsRaw = vendorsRes.vendors ?? vendorsRes.data ?? [];
  const vendors = (Array.isArray(vendorsRaw) ? vendorsRaw : [])
    .map(mapVendorOption)
    .filter(Boolean) as TargetOption[];

  const styleRows = stylesRes.serviceStyles ?? stylesRes.service_styles ?? [];
  let styles = (Array.isArray(styleRows) ? styleRows : [])
    .map(mapStyleOption)
    .filter(Boolean) as TargetOption[];

  if (styles.length === 0) {
    styles = DEFAULT_STYLES;
  }

  const mealPlans = (Array.isArray(mealPlansRes.mealPlans) ? mealPlansRes.mealPlans : [])
    .map(mapMealPlanOption)
    .filter(Boolean) as TargetOption[];

  return {
    categories: uniqueCategories,
    services,
    packages,
    products,
    vendors,
    styles,
    mealPlans,
  };
}

export type PromotionCatalogLoadResult = {
  catalog: PromotionTargetCatalog;
  errors: string[];
};

export async function loadPromotionTargetCatalogWithErrors(
  apiClient: ApiClientLike
): Promise<PromotionCatalogLoadResult> {
  const errors: string[] = [];
  const wrap = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      errors.push(label);
      console.warn(`[PromotionCatalog] ${label} failed`, e);
      return fallback;
    }
  };

  const [
    categoriesRes,
    servicesRes,
    packagesRes,
    productsRes,
    vendorsRes,
    stylesRes,
    mealPlansRes,
    bannerDestRes,
  ] = await Promise.all([
    wrap('categories', () => apiClient.get<any>('/admin/catalog/categories'), { categories: [] }),
    wrap('services', () => apiClient.get<any>('/admin/catalog/services'), { services: [] }),
    wrap('packages', () => apiClient.get<any>('/admin/catalog/regional-packages'), { packages: [] }),
    wrap('products', () => apiClient.get<any>('/admin/catalog/products'), { products: [] }),
    wrap('vendors', () => apiClient.get<any>('/admin/vendors?limit=200'), { vendors: [] }),
    wrap('service-styles', () => apiClient.get<any>('/admin/catalog/service-styles'), {
      serviceStyles: [],
    }),
    wrap('meal-plans', () => apiClient.get<any>('/meal-plans/search'), { mealPlans: [] }),
    wrap('banner-destinations', () => apiClient.get<any>('/admin/banners/destination-options'), {
      categories: [],
    }),
  ]);

  const categoryRows = [
    ...(Array.isArray(categoriesRes.categories) ? categoriesRes.categories : []),
    ...(Array.isArray(bannerDestRes.categories) ? bannerDestRes.categories : []),
  ];

  const categories = categoryRows
    .map((c) =>
      mapCategoryOption({
        ...c,
        category_id: c.categoryId ?? c.category_id ?? c.id,
        name: c.name ?? c.label,
      })
    )
    .filter(Boolean) as TargetOption[];

  const uniqueCategories = Array.from(
    new Map(categories.map((c) => [c.id, c])).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  const services = (Array.isArray(servicesRes.services) ? servicesRes.services : [])
    .map(mapServiceOption)
    .filter(Boolean) as TargetOption[];

  const packages = (Array.isArray(packagesRes.packages) ? packagesRes.packages : [])
    .map(mapPackageOption)
    .filter(Boolean) as TargetOption[];

  const products = (Array.isArray(productsRes.products) ? productsRes.products : [])
    .map(mapProductOption)
    .filter(Boolean) as TargetOption[];

  const vendorsRaw = vendorsRes.vendors ?? vendorsRes.data ?? [];
  const vendors = (Array.isArray(vendorsRaw) ? vendorsRaw : [])
    .map(mapVendorOption)
    .filter(Boolean) as TargetOption[];

  const styleRows = stylesRes.serviceStyles ?? stylesRes.service_styles ?? [];
  let styles = (Array.isArray(styleRows) ? styleRows : [])
    .map(mapStyleOption)
    .filter(Boolean) as TargetOption[];
  if (styles.length === 0) styles = DEFAULT_STYLES;

  const mealPlans = (Array.isArray(mealPlansRes.mealPlans) ? mealPlansRes.mealPlans : [])
    .map(mapMealPlanOption)
    .filter(Boolean) as TargetOption[];

  // Optional catalog slices — API may fail on dev or when tables are empty; fallbacks cover styles.
  const userFacingErrors = errors.filter((label) => {
    if (label === 'service-styles') return false;
    if (label === 'packages') return false;
    if (label === 'meal-plans' && mealPlans.length === 0) return false;
    return true;
  });

  return {
    catalog: {
      categories: uniqueCategories,
      services,
      packages,
      products,
      vendors,
      styles,
      mealPlans,
    },
    errors: userFacingErrors,
  };
}

function mapEcommerceCategoryOption(cat: Record<string, unknown>): TargetOption | null {
  const id = String(cat.id ?? cat.slug ?? cat.category_id ?? cat.categoryId ?? '').trim();
  if (!id) return null;
  return {
    id,
    label: String(cat.name ?? cat.label ?? id),
    subtitle: cat.description ? String(cat.description) : undefined,
  };
}

/** Lightweight catalog for Smart Context — categories, partners, styles only (no bulk inventory). */
export async function loadSmartTargetBaseCatalogWithErrors(
  apiClient: ApiClientLike,
  surface?: 'marketing' | 'ecommerce'
): Promise<PromotionCatalogLoadResult> {
  const errors: string[] = [];
  const wrap = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      errors.push(label);
      console.warn(`[PromotionCatalog] ${label} failed`, e);
      return fallback;
    }
  };

  if (surface === 'ecommerce') {
    const [categoriesRes, vendorsRes] = await Promise.all([
      wrap('categories', () => apiClient.get<any>('/admin/ecommerce/categories'), {
        categories: [],
        data: { categories: [] },
      }),
      wrap('vendors', () => apiClient.get<any>('/admin/vendors?limit=200'), { vendors: [] }),
    ]);

    const categoryRows =
      categoriesRes?.data?.categories ??
      categoriesRes?.categories ??
      (Array.isArray(categoriesRes) ? categoriesRes : []);

    const categories = (Array.isArray(categoryRows) ? categoryRows : [])
      .map(mapEcommerceCategoryOption)
      .filter(Boolean) as TargetOption[];

    const uniqueCategories = Array.from(
      new Map(categories.map((c) => [c.id, c])).values()
    ).sort((a, b) => a.label.localeCompare(b.label));

    const vendorsRaw = vendorsRes.vendors ?? vendorsRes.data ?? [];
    const vendors = (Array.isArray(vendorsRaw) ? vendorsRaw : [])
      .map(mapVendorOption)
      .filter(Boolean) as TargetOption[];

    return {
      catalog: {
        categories: uniqueCategories,
        vendors,
      },
      errors,
    };
  }

  const [categoriesRes, vendorsRes, stylesRes, bannerDestRes] = await Promise.all([
    wrap('categories', () => apiClient.get<any>('/admin/catalog/categories'), { categories: [] }),
    wrap('vendors', () => apiClient.get<any>('/admin/vendors?limit=200'), { vendors: [] }),
    wrap('service-styles', () => apiClient.get<any>('/admin/catalog/service-styles'), {
      serviceStyles: [],
    }),
    wrap('banner-destinations', () => apiClient.get<any>('/admin/banners/destination-options'), {
      categories: [],
    }),
  ]);

  const categoryRows = [
    ...(Array.isArray(categoriesRes.categories) ? categoriesRes.categories : []),
    ...(Array.isArray(bannerDestRes.categories) ? bannerDestRes.categories : []),
  ];

  const categories = categoryRows
    .map((c) =>
      mapCategoryOption({
        ...c,
        category_id: c.categoryId ?? c.category_id ?? c.id,
        name: c.name ?? c.label,
      })
    )
    .filter(Boolean) as TargetOption[];

  const uniqueCategories = Array.from(
    new Map(categories.map((c) => [c.id, c])).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  const vendorsRaw = vendorsRes.vendors ?? vendorsRes.data ?? [];
  const vendors = (Array.isArray(vendorsRaw) ? vendorsRaw : [])
    .map(mapVendorOption)
    .filter(Boolean) as TargetOption[];

  const styleRows = stylesRes.serviceStyles ?? stylesRes.service_styles ?? [];
  let styles = (Array.isArray(styleRows) ? styleRows : [])
    .map(mapStyleOption)
    .filter(Boolean) as TargetOption[];
  if (styles.length === 0) styles = DEFAULT_STYLES;

  const userFacingErrors = errors.filter((label) => label !== 'service-styles');

  return {
    catalog: {
      categories: uniqueCategories,
      vendors,
      styles,
    },
    errors: userFacingErrors,
  };
}
