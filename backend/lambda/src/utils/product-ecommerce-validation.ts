/**
 * Shared Tier A validation for bulk and single ecommerce product uploads.
 */

import { normalizeEcommerceProductPricing } from './product-ecommerce-pricing';

/** Title is the row classifier — rows without a non-empty Title are ignored during bulk upload. */
export function getBulkProductTitle(raw: Record<string, unknown>): string {
  const name = raw.name ?? raw.title;
  return typeof name === 'string' ? name.trim() : '';
}

export const MAX_BULK_PRODUCT_ROWS = 500;

const GST_SLABS = [0, 5, 12, 18, 28] as const;

export type EcommerceValidationMode = 'bulk' | 'single';

export type ValidateEcommerceProductOpts = {
  mode: EcommerceValidationMode;
  /** Lowercase category names for bulk; single may pass resolved name after category_id lookup */
  validCategoryNames?: Set<string>;
  /** When set (single), category string is taken from resolved catalog name */
  resolvedCategoryName?: string | null;
  /** Bulk: require http(s) image URLs. Single: allow data URLs too */
  requireHttpImageUrls?: boolean;
};

export type NormalizedEcommerceProduct = {
  name: string;
  category: string | null;
  category_id?: string | null;
  stock: number;
  mrp: number;
  sellingPrice: number;
  hsn_code: string;
  gst_rate: number;
  imageUrls: string[];
  sku: string | null;
};

export type ValidationFailure = {
  ok: false;
  field: string;
  message: string;
};

export type ValidationSuccess = {
  ok: true;
  normalized: NormalizedEcommerceProduct;
};

export function countTitledBulkRows(products: unknown[]): number {
  if (!Array.isArray(products)) return 0;
  return products.filter(
    (p) => getBulkProductTitle(p as Record<string, unknown>).length > 0,
  ).length;
}

export function bulkRowLimitResponse(count: number): {
  success: false;
  error: string;
  limit: number;
  count: number;
} {
  return {
    success: false,
    error: `Maximum ${MAX_BULK_PRODUCT_ROWS} products per upload. Found ${count}. Split into multiple files.`,
    limit: MAX_BULK_PRODUCT_ROWS,
    count,
  };
}

export function exceedsBulkRowLimit(products: unknown[]): boolean {
  return countTitledBulkRows(products) > MAX_BULK_PRODUCT_ROWS;
}

/** Split images cell (string | string[]) into a deduped, trimmed list. */
export function parseProductImageList(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((u) => String(u ?? '').trim()).filter(Boolean))];
  }
  return [
    ...new Set(
      String(raw)
        .split(/[,\n]/)
        .map((u) => u.trim())
        .filter(Boolean),
    ),
  ];
}

export function isLikelyProductImageUrl(s: string): boolean {
  return /^https?:\/\/\S+/i.test(s) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(s);
}

function getSingleProductName(record: Record<string, unknown>): string {
  const name = record.name;
  return typeof name === 'string' ? name.trim() : '';
}

export function validateEcommerceProductInput(
  record: Record<string, unknown>,
  opts: ValidateEcommerceProductOpts,
): ValidationSuccess | ValidationFailure {
  const title =
    opts.mode === 'bulk' ? getBulkProductTitle(record) : getSingleProductName(record);

  if (!title) {
    return {
      ok: false,
      field: 'name',
      message: opts.mode === 'bulk' ? 'Title is required' : 'Product name is required',
    };
  }
  if (title.length > 255) {
    return { ok: false, field: 'name', message: 'Title must be ≤ 255 characters' };
  }

  const pricingNorm = normalizeEcommerceProductPricing(record);
  if (!pricingNorm.ok) {
    return {
      ok: false,
      field: pricingNorm.field,
      message: pricingNorm.message,
    };
  }

  const qtyRaw = record.stock_quantity ?? record.stock;
  const stockNum = Number(qtyRaw);
  if (qtyRaw === undefined || qtyRaw === null || qtyRaw === '') {
    return { ok: false, field: 'stock_quantity', message: 'Quantity is required' };
  }
  if (isNaN(stockNum) || stockNum < 0) {
    return { ok: false, field: 'stock_quantity', message: 'Quantity must be a number ≥ 0' };
  }
  if (!Number.isInteger(stockNum)) {
    return { ok: false, field: 'stock_quantity', message: 'Quantity must be a whole number' };
  }

  let categoryStr = '';
  if (opts.mode === 'bulk') {
    categoryStr = record.category ? String(record.category).trim() : '';
    if (!categoryStr) {
      return {
        ok: false,
        field: 'category',
        message: 'Category is required (pick from the dropdown)',
      };
    }
    if (opts.validCategoryNames && !opts.validCategoryNames.has(categoryStr.toLowerCase())) {
      const list = opts.validCategoryNames.size
        ? [...opts.validCategoryNames].join(', ')
        : 'no active categories';
      return {
        ok: false,
        field: 'category',
        message: `Category must match an active catalog: ${list}`,
      };
    }
  } else {
    const categoryId = record.category_id ? String(record.category_id).trim() : '';
    if (!categoryId) {
      return { ok: false, field: 'category_id', message: 'Category is required' };
    }
    categoryStr = opts.resolvedCategoryName?.trim() || '';
    if (!categoryStr && opts.validCategoryNames?.size) {
      return {
        ok: false,
        field: 'category_id',
        message: 'Category must match an active catalog',
      };
    }
  }

  const hsnStr = record.hsn_code ? String(record.hsn_code).trim() : '';
  if (!hsnStr) {
    return { ok: false, field: 'hsn_code', message: 'HSN is required for invoicing' };
  }
  if (!/^\d{4,8}$/.test(hsnStr)) {
    return { ok: false, field: 'hsn_code', message: 'HSN must be 4–8 digits (numbers only)' };
  }

  const gstNum = Number(record.gst_rate);
  if (record.gst_rate === undefined || record.gst_rate === null || record.gst_rate === '') {
    return { ok: false, field: 'gst_rate', message: 'Tax (GST %) is required' };
  }
  if (isNaN(gstNum) || !GST_SLABS.includes(gstNum as (typeof GST_SLABS)[number])) {
    return { ok: false, field: 'gst_rate', message: 'Tax must be 0, 5, 12, 18 or 28' };
  }

  const imageUrls = parseProductImageList(record.images ?? record.image_urls);
  if (imageUrls.length === 0) {
    return {
      ok: false,
      field: 'images',
      message: 'At least one product image is required',
    };
  }

  const requireHttp = opts.requireHttpImageUrls ?? opts.mode === 'bulk';
  if (requireHttp && !imageUrls.every(isLikelyProductImageUrl)) {
    return {
      ok: false,
      field: 'images',
      message: 'Image must be an http(s) URL (1000×1000 px recommended)',
    };
  }
  if (!requireHttp && !imageUrls.every(isLikelyProductImageUrl)) {
    return {
      ok: false,
      field: 'images',
      message: 'Image must be a valid URL or uploaded image',
    };
  }

  const skuRaw = record.sku ?? record.vendor_product_id;
  const sku =
    skuRaw != null && String(skuRaw).trim() !== '' ? String(skuRaw).trim() : null;

  return {
    ok: true,
    normalized: {
      name: title,
      category: categoryStr || null,
      category_id:
        opts.mode === 'single' && record.category_id
          ? String(record.category_id).trim()
          : null,
      stock: stockNum,
      mrp: pricingNorm.pricing.mrp,
      sellingPrice: pricingNorm.pricing.sellingPrice,
      hsn_code: hsnStr,
      gst_rate: gstNum,
      imageUrls,
      sku,
    },
  };
}

/** Vendor-scoped SKU when vendor does not supply one */
export function generateVendorProductSku(vendorId: string): string {
  const prefix = String(vendorId).replace(/-/g, '').slice(0, 8);
  return `WP-${prefix}-${Date.now()}`;
}
