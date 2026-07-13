/**
 * ============================================================================
 * VENDOR PRODUCT MANAGEMENT ENDPOINTS
 * ============================================================================
 * 
 * Handles vendor product CRUD operations:
 * - List vendor products
 * - Create product
 * - Update product
 * - Delete product
 * - Update stock
 * 
 * Date: 2026-01-XX
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query, deleteRows } from '../../../database/rds-connection';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import {
  presignProductRowForDisplay,
  presignS3GetUrlIfApplicable,
  stripPresignFromProductImagesJsonb,
} from '../../../utils/s3-media-presign';
import {
  cleanupRemovedProductS3Images,
  collectAllProductImageUrls,
  deleteAllManagedProductImages,
  deleteManagedProductS3Image,
  extensionFromContentType,
  extractProductS3Key,
  uploadProductImageBufferToS3,
} from '../../../utils/product-s3-image';
import { ingestExternalProductImageUrl } from '../../../utils/product-image-ingest';
import {
  uploadDisplayImage,
  toUploadJsonResponse,
  ImageProcessingError,
} from '../../../services/image';
import { resolveVendorById } from './vendorProfile.vendor';
import {
  applyNormalizedPricingToDbPayload,
  normalizeEcommerceProductPricing,
} from '../../../utils/product-ecommerce-pricing';
import {
  generateVendorProductSku,
  validateEcommerceProductInput,
} from '../../../utils/product-ecommerce-validation';
import {
  loadProductSkus,
  loadProductSkusForProducts,
  syncProductSkus,
  updateProductSkuStock,
  type SkuInput,
} from '../../../utils/product-sku-service';
import { putSkuSyncDecision } from '../../../utils/put-sku-sync-decision';
import {
  metadataVariantsToSkus,
  normalizeImagesArray,
  mergeLegacyVariantImagesIntoSkus,
  aggregateParentStock,
} from '../../../utils/product-sku-resolve';
import { presignProductSkusForDisplay } from '../../../utils/s3-media-presign';
import { flattenProductForApiResponse, parseSpecificationsObject } from '../../../utils/product-storefront-normalize';
import {
  applyVendorProductExtrasToPayload,
  buildMetadataWithDeliveryRegions,
} from '../../../utils/product-vendor-persist';
import {
  validateAndApplyVendorDeclaredOwnership,
  isListingOwnershipRequiredError,
  getVendorCommissionModel,
} from '../../../utils/compute-listing-ownership';
import {
  generateProductGroupId,
  parseProductMetadata,
} from '../../../utils/product-group-identity';
import {
  getBulkVariantHintsForCategory,
  getVariantSuggestionsForCategory,
} from '@warmpawz/shared-types';
import { PRODUCT_STATUS } from '../../../utils/product-status-constants';

/** Cached information_schema snapshot so we avoid hitting metadata column when it is not migrated yet */
const PRODUCTS_COLUMN_CACHE: { until: number; cols: Set<string> | null } = { until: 0, cols: null };
const PRODUCTS_COLUMN_CACHE_TTL_MS = 60_000;

async function getProductsColumnSet(): Promise<Set<string>> {
  const now = Date.now();
  if (PRODUCTS_COLUMN_CACHE.cols && now < PRODUCTS_COLUMN_CACHE.until) {
    return PRODUCTS_COLUMN_CACHE.cols;
  }
  const r = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products'`,
  );
  const cols = new Set<string>((r.rows || []).map((row: { column_name: string }) => row.column_name));
  PRODUCTS_COLUMN_CACHE.cols = cols;
  PRODUCTS_COLUMN_CACHE.until = now + PRODUCTS_COLUMN_CACHE_TTL_MS;
  return cols;
}

function productsOptionalSelectExprs(cols: Set<string>) {
  return {
    metadata: cols.has('metadata') ? 'p.metadata' : "'{}'::jsonb AS metadata",
    status: cols.has('status') ? 'p.status' : 'NULL::text AS status',
    originalPrice: cols.has('compare_at_price')
      ? 'p.compare_at_price AS original_price'
      : 'NULL::numeric AS original_price',
    brand: cols.has('brand') ? 'p.brand' : 'NULL::text AS brand',
    weight: cols.has('weight') ? 'p.weight' : 'NULL::numeric AS weight',
    specifications: cols.has('specifications')
      ? 'p.specifications'
      : "'{}'::jsonb AS specifications",
    barcode: cols.has('barcode') ? 'p.barcode' : 'NULL::text AS barcode',
  };
}

async function resolveActiveCategoryName(categoryId: string): Promise<string | null> {
  try {
    const cat = await query(
      'SELECT name FROM ecommerce_categories WHERE id = $1 AND is_active = true',
      [categoryId],
    );
    return cat.rows?.[0]?.name ? String(cat.rows[0].name).trim() : null;
  } catch {
    return null;
  }
}

function buildSingleProductValidationRecord(
  body: Record<string, unknown>,
  prevRow?: Record<string, unknown>,
): Record<string, unknown> {
  const prev = prevRow || {};
  const images =
    body.images !== undefined && body.images !== null ? body.images : prev.images;
  return {
    name: body.name ?? prev.name,
    category_id: body.category_id ?? prev.category_id,
    // Single-price model: accept any legacy alias; normalizeEcommerceProductPricing resolves all.
    price:
      body.price ??
      body.selling_price ??
      body.sp ??
      body.original_price ??
      body.mrp ??
      prev.price,
    selling_price: body.selling_price ?? body.price ?? prev.price,
    stock: body.stock ?? body.stock_quantity ?? prev.stock,
    stock_quantity: body.stock_quantity ?? body.stock ?? prev.stock,
    hsn_code: body.hsn_code ?? prev.hsn_code,
    gst_rate: body.gst_rate ?? prev.gst_rate,
    images,
  };
}

function vendorProductValidationTouched(body: Record<string, unknown>): boolean {
  return (
    body.name !== undefined ||
    body.category_id !== undefined ||
    body.images !== undefined ||
    body.hsn_code !== undefined ||
    body.gst_rate !== undefined ||
    body.stock !== undefined ||
    body.stock_quantity !== undefined ||
    body.price !== undefined ||
    body.selling_price !== undefined ||
    body.compare_at_price !== undefined ||
    body.original_price !== undefined ||
    body.mrp !== undefined
  );
}

function applyBodyPricingToPayload(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
  cols: Set<string>,
): string | null {
  const normalized = normalizeEcommerceProductPricing(body);
  if (!normalized.ok) {
    return normalized.message;
  }
  applyNormalizedPricingToDbPayload(normalized.pricing, payload, cols);
  return null;
}

/** Client may send JSONB fields as strings; pg jsonb columns need valid JSON (see rds-connection insert). */
function normalizeProductJsonbField(raw: unknown, kind: 'images' | 'tags' | 'generic'): unknown {
  if (raw === null || raw === undefined) {
    return kind === 'generic' ? raw : [];
  }
  if (typeof raw === 'object') {
    return raw;
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (
      (t.startsWith('[') && t.endsWith(']')) ||
      (t.startsWith('{') && t.endsWith('}')) ||
      t.startsWith('"')
    ) {
      try {
        return JSON.parse(t);
      } catch {
        return kind === 'generic' ? raw : [raw];
      }
    }
    return kind === 'generic' ? raw : [raw];
  }
  return kind === 'generic' ? raw : [raw];
}

function normalizeDeliveryRegions(raw: unknown): unknown {
  if (raw === null || raw === undefined) {
    return undefined;
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('[')) {
      try {
        return JSON.parse(t);
      } catch {
        return [raw];
      }
    }
    return [raw];
  }
  return [String(raw)];
}

/** Canonical lifecycle for vendor-submitted products (admin approves to active). */
function normalizeApprovalStatus(raw: unknown): 'pending' | 'active' | 'rejected' | 'draft' {
  const status = String(raw || '').trim().toLowerCase();
  if (status === 'active') return 'active';
  if (status === 'rejected') return 'rejected';
  if (status === 'draft') return 'draft';
  if (status === 'pending_approval' || status === 'submit_for_approval' || status === 'submitted') {
    return 'pending';
  }
  return 'pending';
}

function parseSkuInputsFromBody(body: Record<string, unknown>, parentPrice?: number): SkuInput[] | null {
  if (body.skus !== undefined && body.skus !== null) {
    if (!Array.isArray(body.skus)) return null;
    if (body.skus.length === 0) return [];
    return (body.skus as Record<string, unknown>[]).map((row, idx) => ({
      id:
        row.id != null && isValidUUID(String(row.id).trim())
          ? String(row.id).trim()
          : undefined,
      option_values: (row.option_values as Record<string, unknown>) ?? {
        size: row.size,
        color: row.color ?? row.colour,
      },
      price: row.price != null ? Number(row.price) : undefined,
      compare_at_price:
        row.compare_at_price != null
          ? Number(row.compare_at_price)
          : row.original_price != null
            ? Number(row.original_price)
            : row.mrp != null
              ? Number(row.mrp)
              : null,
      stock: row.stock != null ? Number(row.stock) : 0,
      barcode: row.barcode ? String(row.barcode) : null,
      images: row.images,
      sku: null,
      is_active: row.is_active !== false,
      sort_order: row.sort_order != null ? Number(row.sort_order) : idx,
    }));
  }
  if (body.variants !== undefined && body.variants !== null && Array.isArray(body.variants)) {
    const legacy = metadataVariantsToSkus(body.variants as unknown[], parentPrice);
    return legacy.map((row, idx) => ({
      option_values: row.option_values,
      price: row.price,
      compare_at_price: row.compare_at_price,
      stock: row.stock,
      sku: null,
      images: row.images,
      sort_order: idx,
    }));
  }
  return null;
}

/** True when PUT body only updates parent stock (inventory legacy quick-update). */
function isStockOnlyProductUpdate(body: Record<string, unknown>): boolean {
  const keys = Object.keys(body).filter((k) => body[k] !== undefined);
  if (keys.length === 0) return false;
  const allowed = new Set(['stock', 'stock_quantity']);
  return keys.every((k) => allowed.has(k));
}

async function enrichProductRowWithSkus(
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const normalizedRow: Record<string, unknown> = { ...row };
  if (typeof normalizedRow.metadata === 'string') {
    try {
      normalizedRow.metadata = JSON.parse(normalizedRow.metadata);
    } catch {
      normalizedRow.metadata = {};
    }
  }
  normalizedRow.specifications = parseSpecificationsObject(normalizedRow.specifications);

  const productOut = await presignProductRowForDisplay(normalizedRow);
  const productId = String(productOut.id ?? '');
  if (!productId) return productOut;

  let skus = await loadProductSkus(productId);
  const meta =
    productOut.metadata && typeof productOut.metadata === 'object'
      ? (productOut.metadata as Record<string, unknown>)
      : null;
  const legacyVariants =
    meta && Array.isArray(meta.variants) ? (meta.variants as unknown[]) : null;

  if (skus.length === 0 && legacyVariants) {
    const legacy = metadataVariantsToSkus(
      legacyVariants,
      Number(productOut.price) || undefined,
    );
    // Display-only fallback — no synthetic id (would break PUT sync if sent as sku id).
    skus = legacy.map((s, idx) => ({
      sku: s.sku ?? undefined,
      option_values: s.option_values,
      price: s.price,
      compare_at_price: s.compare_at_price,
      stock: s.stock,
      images: s.images,
      is_active: true,
      sort_order: idx,
    }));
  } else if (skus.length > 0 && legacyVariants) {
    skus = mergeLegacyVariantImagesIntoSkus(skus, legacyVariants);
  }

  const skusPresigned = await presignProductSkusForDisplay(
    skus.map((s) => ({
      ...s,
      images: normalizeImagesArray(s.images),
    })) as Record<string, unknown>[],
  );
  productOut.skus = skusPresigned;
  productOut.has_variants = skus.length > 0;
  if (skus.length > 0) {
    const aggregated = aggregateParentStock(skus);
    const parentStock = Number(row.stock) || 0;
    productOut.stock = aggregated > 0 ? aggregated : parentStock;
  }
  return flattenProductForApiResponse(productOut);
}

async function tryUploadDataImageUrlToS3(vendorId: string, dataUrl: string): Promise<string | null> {
  const m = dataUrl.match(/^data:image\/([\w.+-]+);base64,(.+)$/i);
  if (!m) {
    return null;
  }
  const mimeSubtype = m[1].toLowerCase();
  const ext = mimeSubtype === 'jpeg' || mimeSubtype === 'pjpeg' ? 'jpg' : mimeSubtype.split('+')[0] || 'jpg';
  const contentType = `image/${m[1]}`;
  try {
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length) {
      return null;
    }
    return await uploadProductImageBufferToS3(vendorId, buf, contentType, ext);
  } catch (e) {
    console.error('[VendorProducts] Failed to decode/upload data: image', e);
    return null;
  }
}

/**
 * Replace inline/base64 images with permanent S3 HTTPS URLs. Keeps existing http(s) URLs as-is.
 * Skips blob: URLs (not resolvable on the server).
 */
async function processProductImagesForS3Storage(vendorId: string, raw: unknown): Promise<unknown> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return raw;
  }
  const out: string[] = [];
  for (const item of raw) {
    const url = await resolveSingleProductImageToS3Url(vendorId, item);
    if (url) {
      out.push(url);
    }
  }
  return out;
}

async function resolveSingleProductImageToS3Url(vendorId: string, item: unknown): Promise<string | null> {
  if (typeof item === 'string') {
    const s = item.trim();
    if (!s) {
      return null;
    }
    if (s.startsWith('blob:')) {
      console.warn('[VendorProducts] Skipping blob: URL (client-only; cannot upload from Lambda)');
      return null;
    }
    if (s.startsWith('data:image/')) {
      return tryUploadDataImageUrlToS3(vendorId, s);
    }
    if (/^https?:\/\//i.test(s)) {
      return ingestExternalProductImageUrl(vendorId, s);
    }
    return s;
  }
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    const dataUrl =
      typeof o.dataUrl === 'string'
        ? o.dataUrl
        : typeof o.data_url === 'string'
          ? o.data_url
          : null;
    const existing =
      typeof o.url === 'string' ? o.url : typeof o.src === 'string' ? o.src : typeof o.image_url === 'string' ? o.image_url : null;
    if (dataUrl?.startsWith('data:image/')) {
      return tryUploadDataImageUrlToS3(vendorId, dataUrl);
    }
    if (existing?.startsWith('data:image/')) {
      return tryUploadDataImageUrlToS3(vendorId, existing);
    }
    const b64 = typeof o.base64 === 'string' ? o.base64 : typeof o.photo === 'string' ? o.photo : null;
    if (b64 && (!existing || !/^https?:\/\//i.test(existing))) {
      const payload = b64.includes(',') ? (b64.split(',').pop() || '').trim() : b64.trim();
      try {
        const buf = Buffer.from(payload, 'base64');
        if (buf.length > 32) {
          return await uploadProductImageBufferToS3(vendorId, buf, 'image/jpeg', 'jpg');
        }
      } catch {
        /* fall through */
      }
    }
    if (existing && /^https?:\/\//i.test(existing)) {
      return ingestExternalProductImageUrl(vendorId, existing);
    }
    if (existing && typeof existing === 'string') {
      return existing.trim() || null;
    }
  }
  return null;
}

// ============================================================================
// GET /vendor/:vendorId/products - List vendor products
// ============================================================================

class GetVendorProductsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const search = context.event.queryStringParameters?.search;
      const category = context.event.queryStringParameters?.category;
      const status = context.event.queryStringParameters?.status;
      const limit = parseInt(context.event.queryStringParameters?.limit || '50', 10);
      const offset = parseInt(context.event.queryStringParameters?.offset || '0', 10);

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      // Handle test IDs - return empty result instead of error
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return this.success({
          products: [],
          total: 0,
          count: 0,
        });
      }

      // ✅ FIX: Resolve vendor ID (handles vendor_identity auto-create)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor || !vendor.id) {
        console.error(`[VendorProducts] Vendor not found for ID: ${vendorId}`);
        return this.error('Vendor not found', 404);
      }
      const resolvedVendorId = vendor.id;
      if (resolvedVendorId !== vendorId) {
        console.log(`[VendorProducts] Resolved vendorId ${vendorId} to ${resolvedVendorId}`);
      }

      const cols = await getProductsColumnSet();
      const {
        metadata: metadataSelect,
        status: statusSelect,
        originalPrice: originalPriceSelect,
        brand: brandSelect,
        weight: weightSelect,
        specifications: specificationsSelect,
        barcode: barcodeSelect,
      } = productsOptionalSelectExprs(cols);

      // Build query - use stock column (stock_quantity was renamed to stock in migration 013)
      // Use explicit column selection to avoid issues with p.* and missing columns
      let productQuery = `
        SELECT 
          p.id,
          p.vendor_id,
          p.category_id,
          p.name,
          p.description,
          p.sku,
          p.price,
          ${originalPriceSelect},
          COALESCE(p.stock, 0) as stock,
          ${statusSelect},
          p.is_active,
          p.created_at,
          p.updated_at,
          p.images,
          p.tags,
          ${metadataSelect},
          ${brandSelect},
          ${weightSelect},
          ${specificationsSelect},
          ${barcodeSelect},
          p.hsn_code,
          p.gst_rate,
          p.category,
          ec.name as category_name
        FROM products p
        LEFT JOIN ecommerce_categories ec ON p.category_id = ec.id
        WHERE p.vendor_id = $1
      `;

      const params: any[] = [resolvedVendorId];
      let paramIndex = 2;

      if (search) {
        productQuery += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (category) {
        productQuery += ` AND (p.category_id = $${paramIndex} OR p.category = $${paramIndex})`;
        params.push(category);
        paramIndex++;
      }

      if (status === 'active') {
        productQuery += ` AND p.is_active = true`;
      } else if (status === 'inactive') {
        productQuery += ` AND p.is_active = false`;
      }

      productQuery += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      let products;
      let total = 0;
      try {
        products = await query(productQuery, params);

        // Get total count
        let countQuery = `
          SELECT COUNT(*) as total
          FROM products p
          WHERE p.vendor_id = $1
        `;
        const countParams: any[] = [resolvedVendorId];
        let countParamIndex = 2;

        if (search) {
          countQuery += ` AND (p.name ILIKE $${countParamIndex} OR p.description ILIKE $${countParamIndex})`;
          countParams.push(`%${search}%`);
          countParamIndex++;
        }

        if (category) {
          countQuery += ` AND (p.category_id = $${countParamIndex} OR p.category = $${countParamIndex})`;
          countParams.push(category);
          countParamIndex++;
        }

        if (status === 'active') {
          countQuery += ` AND p.is_active = true`;
        } else if (status === 'inactive') {
          countQuery += ` AND p.is_active = false`;
        }

        const countResult = await query(countQuery, countParams);
        total = parseInt(countResult.rows[0]?.total || '0', 10);
      } catch (error: any) {
        // Handle table not existing, column not existing, or invalid UUID
        if (error.message?.includes('invalid input syntax for type uuid') ||
            error.message?.includes('relation "products" does not exist') ||
            error.message?.includes('column') ||
            error.code === '42P01' || // undefined_table
            error.code === '42703') { // undefined_column
          return this.success({
            products: [],
            total: 0,
            count: 0,
            message: 'No products available yet'
          });
        }
        throw error;
      }

      const rows = products.rows || [];
      const skuMap = await loadProductSkusForProducts(
        rows.map((r: Record<string, unknown>) => String(r.id ?? '')).filter(Boolean),
      );
      const productsOut = await Promise.all(
        rows.map(async (row: Record<string, unknown>) => {
          const base = await presignProductRowForDisplay(row);
          const pid = String(base.id ?? '');
          let skus = skuMap.get(pid) ?? [];
          const meta =
            base.metadata && typeof base.metadata === 'object'
              ? (base.metadata as Record<string, unknown>)
              : null;
          const legacyVariants =
            meta && Array.isArray(meta.variants) ? (meta.variants as unknown[]) : null;
          if (skus.length > 0 && legacyVariants) {
            skus = mergeLegacyVariantImagesIntoSkus(skus, legacyVariants);
          }
          const skusPresigned = await presignProductSkusForDisplay(
            skus.map((s) => ({
              ...s,
              images: normalizeImagesArray(s.images),
            })) as Record<string, unknown>[],
          );
          base.skus = skusPresigned;
          base.has_variants = skus.length > 0;
          if (skus.length > 0) {
            base.stock = aggregateParentStock(skus);
          }
          return base;
        }),
      );

      return this.success({
        products: productsOut,
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error fetching vendor products:', error);
      return this.error(error.message || 'Failed to fetch products', 500);
    }
  }
}

// ============================================================================
// POST /vendor/:vendorId/products - Create product
// ============================================================================

class CreateVendorProductHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const body = this.parseBody(context.event);

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      // ✅ FIX: Resolve vendor ID (handles vendor_identity auto-create)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor || !vendor.id) {
        console.error(`[VendorProducts] Vendor not found for ID: ${vendorId}`);
        return this.error('Vendor not found', 404);
      }
      const resolvedVendorId = vendor.id;

      const categoryId = body.category_id ? String(body.category_id).trim() : '';
      const resolvedCategoryName = categoryId
        ? await resolveActiveCategoryName(categoryId)
        : null;
      if (categoryId && !resolvedCategoryName) {
        return this.error('Category is required and must be an active catalog category', 400);
      }

      let imagesNormForValidation =
        body.images !== undefined && body.images !== null
          ? normalizeProductJsonbField(body.images, 'images')
          : undefined;
      if (
        Array.isArray(imagesNormForValidation) &&
        imagesNormForValidation.length === 0
      ) {
        return this.error('At least one product image is required', 400);
      }

      const validationRecord = buildSingleProductValidationRecord({
        ...body,
        ...(imagesNormForValidation !== undefined ? { images: imagesNormForValidation } : {}),
      });
      const tierA = validateEcommerceProductInput(validationRecord, {
        mode: 'single',
        resolvedCategoryName,
        requireHttpImageUrls: false,
      });
      if (!tierA.ok) {
        return this.error(tierA.message, 400);
      }
      const { normalized } = tierA;

      const sku = generateVendorProductSku(resolvedVendorId);

      // Prepare product data - only use columns that exist in DB
      // Approval lifecycle:
      // - status defaults to 'pending' at DB level (migration 700)
      // - keep product hidden until approved by admin (is_active = false)
      const productData: any = {
        vendor_id: resolvedVendorId,
        name: normalized.name,
        description: body.description || null,
        category_id: normalized.category_id || categoryId || null,
        category: body.category ?? resolvedCategoryName ?? null,
        stock: normalized.stock,
        sku,
        hsn_code: normalized.hsn_code,
        gst_rate: normalized.gst_rate,
        is_active: false,
      };

      const cols = await getProductsColumnSet();
      const hasMetadataCol = cols.has('metadata');

      applyNormalizedPricingToDbPayload(
        { price: normalized.price },
        productData,
        cols,
      );

      // Approval: always persist explicit status when column exists; vendors cannot self-publish to active.
      let vendorLifecycleStatus = normalizeApprovalStatus(body.status);
      if (vendorLifecycleStatus === 'active') {
        vendorLifecycleStatus = 'pending';
      }

      // Auto-draft: products with zero stock are held as drafts until restocked.
      const simpleStockForDraftCheck = normalized.stock;
      const skuInputsForDraftCheck = parseSkuInputsFromBody(body as Record<string, unknown>, normalized.price);
      const totalStockForDraftCheck =
        skuInputsForDraftCheck && skuInputsForDraftCheck.length > 0
          ? skuInputsForDraftCheck.reduce((s, sku) => s + (Number(sku.stock) || 0), 0)
          : simpleStockForDraftCheck;
      if (totalStockForDraftCheck === 0 && vendorLifecycleStatus !== PRODUCT_STATUS.INACTIVE) {
        vendorLifecycleStatus = PRODUCT_STATUS.DRAFT;
      }

      if (cols.has('status')) {
        productData.status = vendorLifecycleStatus;
      }
      productData.is_active = false;

      const deliveryNorm =
        body.delivery_regions !== undefined && body.delivery_regions !== null
          ? normalizeDeliveryRegions(body.delivery_regions)
          : undefined;
      let imagesNorm =
        body.images !== undefined && body.images !== null
          ? normalizeProductJsonbField(body.images, 'images')
          : undefined;
      if (imagesNorm !== undefined && Array.isArray(imagesNorm) && imagesNorm.length > 0) {
        imagesNorm = await processProductImagesForS3Storage(resolvedVendorId, imagesNorm);
      }
      if (imagesNorm !== undefined) {
        imagesNorm = stripPresignFromProductImagesJsonb(imagesNorm);
      }

      const hasExtraPayload =
        body.images !== undefined ||
        (body.delivery_regions !== undefined && body.delivery_regions !== null);

      // images / delivery_regions in metadata when column exists
      if (hasExtraPayload) {
        if (hasMetadataCol) {
          productData.metadata = {
            ...(imagesNorm !== undefined && { images: imagesNorm }),
            ...(deliveryNorm !== undefined && { delivery_regions: deliveryNorm }),
          };
          // Match PUT handler: list/grid read `products.images`; metadata-only broke create thumbnails.
          if (imagesNorm !== undefined && cols.has('images')) {
            productData.images = imagesNorm;
          }
        } else {
          if (imagesNorm !== undefined && cols.has('images')) {
            productData.images = imagesNorm;
          }
          const specPatch: Record<string, unknown> = {};
          if (deliveryNorm !== undefined) {
            specPatch.delivery_regions = deliveryNorm;
          }
          if (Object.keys(specPatch).length > 0) {
            if (cols.has('specifications')) {
              productData.specifications = specPatch;
            }
          }
        }
      }

      const variantAxesMeta =
        body.metadata &&
        typeof body.metadata === 'object' &&
        !Array.isArray(body.metadata) &&
        (body.metadata as Record<string, unknown>).variant_axes;
      if (hasMetadataCol && variantAxesMeta) {
        productData.metadata = {
          ...((productData.metadata as Record<string, unknown> | undefined) ?? {}),
          variant_axes: variantAxesMeta,
        };
      }

      applyVendorProductExtrasToPayload(
        productData,
        body as Record<string, unknown>,
        cols,
        null,
        (productData.metadata as Record<string, unknown> | undefined) ?? null,
      );

      try {
        await validateAndApplyVendorDeclaredOwnership(
          resolvedVendorId,
          productData,
          cols,
          body.listing_ownership ?? body.listingOwnership
        );
      } catch (ownershipErr) {
        if (isListingOwnershipRequiredError(ownershipErr)) {
          return this.error(ownershipErr.message, 400);
        }
        throw ownershipErr;
      }

      const skuInputsPreview = parseSkuInputsFromBody(
        body as Record<string, unknown>,
        normalized.price,
      );
      if (hasMetadataCol && skuInputsPreview && skuInputsPreview.length > 0) {
        const bodyMeta =
          body.metadata &&
          typeof body.metadata === 'object' &&
          !Array.isArray(body.metadata)
            ? (body.metadata as Record<string, unknown>)
            : {};
        const pgid =
          String(bodyMeta.product_group_id ?? '').trim() || generateProductGroupId();
        productData.metadata = {
          ...((productData.metadata as Record<string, unknown>) ?? {}),
          product_group_id: pgid,
        };
      }

      // Create product
      const newProduct = await insert('products', productData);
      const newProductId = String(newProduct[0]?.id ?? '');
      const skuInputs = skuInputsPreview;
      if (newProductId && skuInputs && skuInputs.length > 0) {
        await syncProductSkus(resolvedVendorId, newProductId, skuInputs);
      }
      const productOut = await enrichProductRowWithSkus(newProduct[0] as Record<string, unknown>);

      return this.success({
        product: productOut,
        message: 'Product created successfully',
      });
    } catch (error: any) {
      console.error('Error creating product:', error);
      return this.error(error.message || 'Failed to create product', 500);
    }
  }
}

// ============================================================================
// GET /vendor/:vendorId/products/:productId - Get product details
// ============================================================================

class GetVendorProductHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const productId = context.event.pathParameters?.productId;

      if (!vendorId || !productId) {
        return this.error('Vendor ID and Product ID are required', 400);
      }

      // ✅ FIX: Resolve vendor ID (handles vendor_identity auto-create)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor || !vendor.id) {
        console.error(`[VendorProducts] Vendor not found for ID: ${vendorId}`);
        return this.error('Vendor not found', 404);
      }
      const resolvedVendorId = vendor.id;

      const cols = await getProductsColumnSet();
      const {
        metadata: metadataSelect,
        status: statusSelect,
        originalPrice: originalPriceSelect,
        brand: brandSelect,
        weight: weightSelect,
        specifications: specificationsSelect,
        barcode: barcodeSelect,
      } = productsOptionalSelectExprs(cols);

      // ✅ FIX: Use explicit column selection to avoid stock_quantity column error
      const products = await query(
        `SELECT 
                p.id,
                p.vendor_id,
                p.category_id,
                p.name,
                p.description,
                p.sku,
                p.price,
                ${originalPriceSelect},
                COALESCE(p.stock, 0) as stock,
                ${statusSelect},
                p.is_active,
                p.created_at,
                p.updated_at,
                p.images,
                p.tags,
                ${metadataSelect},
                ${brandSelect},
                ${weightSelect},
                ${specificationsSelect},
                ${barcodeSelect},
                p.hsn_code,
                p.gst_rate,
                p.category,
                ec.name as category_name
         FROM products p
         LEFT JOIN ecommerce_categories ec ON p.category_id = ec.id
         WHERE p.id = $1 AND p.vendor_id = $2`,
        [productId, resolvedVendorId]
      );

      if (products.rows.length === 0) {
        return this.error('Product not found', 404);
      }

      const product = await enrichProductRowWithSkus(products.rows[0] as Record<string, unknown>);

      return this.success({
        product,
      });
    } catch (error: any) {
      console.error('Error fetching product:', error);
      return this.error(error.message || 'Failed to fetch product', 500);
    }
  }
}

// ============================================================================
// PUT /vendor/:vendorId/products/:productId - Update product
// ============================================================================

class UpdateVendorProductHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const productId = context.event.pathParameters?.productId;
      const body = this.parseBody(context.event);

      if (!vendorId || !productId) {
        return this.error('Vendor ID and Product ID are required', 400);
      }

      // ✅ FIX: Resolve vendor ID (handles vendor_identity auto-create)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor || !vendor.id) {
        console.error(`[VendorProducts] Vendor not found for ID: ${vendorId}`);
        return this.error('Vendor not found', 404);
      }
      const resolvedVendorId = vendor.id;

      // Verify product belongs to vendor
      const existingProducts = await select('products', { id: productId, vendor_id: resolvedVendorId });
      if (existingProducts.length === 0) {
        return this.error('Product not found or access denied', 404);
      }

      const prevRow = existingProducts[0] as Record<string, unknown>;
      const prevStatus = String(prevRow.status || '').trim().toLowerCase();
      const existingSkus = await loadProductSkus(productId);
      const hasSkuRows = existingSkus.length > 0;
      const prevImageUrls = collectAllProductImageUrls(prevRow, existingSkus);

      const cols = await getProductsColumnSet();
      const hasMetadataCol = cols.has('metadata');

      if (vendorProductValidationTouched(body)) {
        const mergeRecord = buildSingleProductValidationRecord(body, prevRow);
        const categoryIdForVal = mergeRecord.category_id
          ? String(mergeRecord.category_id).trim()
          : '';
        const resolvedCategoryName = categoryIdForVal
          ? await resolveActiveCategoryName(categoryIdForVal)
          : null;
        if (categoryIdForVal && !resolvedCategoryName) {
          return this.error('Category must be an active catalog category', 400);
        }
        const tierA = validateEcommerceProductInput(mergeRecord, {
          mode: 'single',
          resolvedCategoryName,
          requireHttpImageUrls: false,
        });
        if (!tierA.ok) {
          return this.error(tierA.message, 400);
        }
      }

      // Prepare update data
      const updateData: any = {};

      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.category_id !== undefined) updateData.category_id = body.category_id;
      if (body.category !== undefined) updateData.category = body.category;
      // Pricing: accept price/selling_price/sp/mrp/original_price — all map to the single price field.
      // compare_at_price is NOT accepted from vendor input; it is managed by the promotion engine.
      const pricingTouched =
        body.price !== undefined ||
        body.selling_price !== undefined ||
        body.original_price !== undefined ||
        body.mrp !== undefined ||
        body.sp !== undefined;
      if (pricingTouched) {
        const mergeBody: Record<string, unknown> = {
          ...prevRow,
          ...body,
          price:
            body.price ??
            body.selling_price ??
            body.sp ??
            body.original_price ??
            body.mrp ??
            prevRow.price,
        };
        const pricingErr = applyBodyPricingToPayload(mergeBody, updateData, cols);
        if (pricingErr) {
          return this.error(pricingErr, 400);
        }
      }
      // Stock: simple products update parent row; variant products use SKU PATCH or skus[] sync
      const stockTouched = body.stock !== undefined || body.stock_quantity !== undefined;
      if (stockTouched && hasSkuRows) {
        if (isStockOnlyProductUpdate(body as Record<string, unknown>)) {
          return this.error(
            'Use PATCH /vendor/:vendorId/products/:productId/skus/:skuId/stock for variant products',
            400,
          );
        }
      } else if (body.stock !== undefined) {
        updateData.stock = parseInt(body.stock, 10);
      } else if (body.stock_quantity !== undefined) {
        updateData.stock = parseInt(body.stock_quantity, 10);
      }
      // SKU is system-assigned; vendors cannot change it. Backfill legacy rows with null SKU on save.
      const prevSku = prevRow.sku != null ? String(prevRow.sku).trim() : '';
      if (!prevSku) {
        updateData.sku = generateVendorProductSku(resolvedVendorId);
      }
      if (body.status !== undefined && cols.has('status')) {
        let st = normalizeApprovalStatus(body.status);
        // Block privilege escalation: only already-approved rows may stay active via vendor updates.
        if (st === 'active' && prevStatus !== 'active') {
          st = 'pending';
        }
        updateData.status = st;
        updateData.is_active = st === 'active';
      }
      if (body.hsn_code !== undefined) updateData.hsn_code = body.hsn_code;
      if (body.gst_rate !== undefined) {
        if (body.gst_rate === null || body.gst_rate === '') {
          updateData.gst_rate = null;
        } else {
          const gstNum = parseFloat(String(body.gst_rate));
          updateData.gst_rate = Number.isFinite(gstNum) ? gstNum : null;
        }
      }

      let existingSpecs: Record<string, unknown> | null = null;
      const rawSpecs = prevRow.specifications;
      if (rawSpecs && typeof rawSpecs === 'object' && !Array.isArray(rawSpecs)) {
        existingSpecs = { ...(rawSpecs as Record<string, unknown>) };
      } else if (typeof rawSpecs === 'string' && rawSpecs.trim()) {
        try {
          const parsed = JSON.parse(rawSpecs);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            existingSpecs = parsed as Record<string, unknown>;
          }
        } catch {
          existingSpecs = null;
        }
      }

      const existingMetaForExtras =
        prevRow.metadata && typeof prevRow.metadata === 'object' && !Array.isArray(prevRow.metadata)
          ? (prevRow.metadata as Record<string, unknown>)
          : null;

      applyVendorProductExtrasToPayload(
        updateData,
        body as Record<string, unknown>,
        cols,
        existingSpecs,
        existingMetaForExtras,
        { partial: true },
      );

      try {
        const declaredOwnership =
          body.listing_ownership ??
          body.listingOwnership ??
          (prevRow.listing_ownership != null ? prevRow.listing_ownership : undefined);
        await validateAndApplyVendorDeclaredOwnership(
          resolvedVendorId,
          updateData,
          cols,
          declaredOwnership
        );
      } catch (ownershipErr) {
        if (isListingOwnershipRequiredError(ownershipErr)) {
          return this.error(ownershipErr.message, 400);
        }
        throw ownershipErr;
      }

      let normalizedImages: unknown | undefined;
      if (body.images !== undefined) {
        normalizedImages =
          body.images === null ? [] : normalizeProductJsonbField(body.images, 'images');
        if (Array.isArray(normalizedImages) && normalizedImages.length > 0) {
          normalizedImages = await processProductImagesForS3Storage(resolvedVendorId, normalizedImages);
        }
        if (normalizedImages !== undefined) {
          normalizedImages = stripPresignFromProductImagesJsonb(normalizedImages);
        }
        updateData.images = normalizedImages;
      }
      if (body.is_active !== undefined) {
        const effStatus =
          updateData.status !== undefined
            ? String(updateData.status).trim().toLowerCase()
            : prevStatus;
        if (effStatus === 'active') {
          updateData.is_active = body.is_active === true;
        } else {
          updateData.is_active = false;
        }
      } else if (updateData.status !== undefined) {
        const st = String(updateData.status).trim().toLowerCase();
        updateData.is_active = st === 'active';
      }

      let normalizedDelivery: unknown | undefined;
      if (body.delivery_regions !== undefined) {
        normalizedDelivery =
          body.delivery_regions === null ? null : normalizeDeliveryRegions(body.delivery_regions);
      }

      // delivery_regions in metadata (variants now live in product_skus)
      if (body.delivery_regions !== undefined || body.images !== undefined) {
        if (hasMetadataCol) {
          const existingMetaRows = await query('SELECT metadata FROM products WHERE id = $1', [productId]);
          const existingMetadata = existingMetaRows.rows[0]?.metadata || {};
          updateData.metadata = {
            ...existingMetadata,
            ...(body.images !== undefined && { images: normalizedImages }),
            ...(body.delivery_regions !== undefined && { delivery_regions: normalizedDelivery }),
          };
        } else if (body.delivery_regions !== undefined && cols.has('specifications')) {
          const specRes = await query('SELECT specifications FROM products WHERE id = $1', [productId]);
          let base: Record<string, unknown> = {};
          const raw = specRes.rows[0]?.specifications;
          if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            base = { ...(raw as Record<string, unknown>) };
          } else if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                base = parsed as Record<string, unknown>;
              }
            } catch {
              /* keep base */
            }
          }
          if (body.delivery_regions !== undefined) base.delivery_regions = normalizedDelivery;
          updateData.specifications = base;
        }
      }

      const variantAxesMeta =
        body.metadata &&
        typeof body.metadata === 'object' &&
        !Array.isArray(body.metadata) &&
        (body.metadata as Record<string, unknown>).variant_axes;
      if (hasMetadataCol && variantAxesMeta) {
        const existingMetaRows = await query('SELECT metadata FROM products WHERE id = $1', [productId]);
        const existingMetadata = existingMetaRows.rows[0]?.metadata || {};
        updateData.metadata = {
          ...(updateData.metadata ?? existingMetadata),
          variant_axes: variantAxesMeta,
        };
      }

      updateData.updated_at = new Date().toISOString();

      // Update product
      const updated = await update('products', { id: productId, vendor_id: resolvedVendorId }, updateData);

      if (updated.length === 0) {
        return this.error('Failed to update product', 500);
      }

      const skuInputs = parseSkuInputsFromBody(
        body as Record<string, unknown>,
        Number(updated[0]?.price) || undefined,
      );
      const syncDecision = putSkuSyncDecision(skuInputs, hasSkuRows);
      if (syncDecision === 'reject_empty_with_variants') {
        return this.error(
          'Product contains existing variants. Empty skus payload is not allowed.',
          400,
        );
      }
      if (syncDecision === 'run' && skuInputs !== null) {
        if (skuInputs.length > 0 && hasMetadataCol) {
          const existingMetaRows = await query('SELECT metadata FROM products WHERE id = $1', [
            productId,
          ]);
          const existingMeta = parseProductMetadata(existingMetaRows.rows[0]?.metadata);
          if (!existingMeta.product_group_id) {
            const bodyMeta =
              body.metadata &&
              typeof body.metadata === 'object' &&
              !Array.isArray(body.metadata)
                ? (body.metadata as Record<string, unknown>)
                : {};
            const pgid =
              String(bodyMeta.product_group_id ?? '').trim() || generateProductGroupId();
            await update('products', { id: productId }, {
              metadata: { ...existingMeta, product_group_id: pgid },
              updated_at: new Date().toISOString(),
            });
          }
        }
        await syncProductSkus(resolvedVendorId, productId, skuInputs);
      }

      const nextProductRows = await select('products', { id: productId, vendor_id: resolvedVendorId });
      const nextSkus = await loadProductSkus(productId);
      const nextImageUrls = collectAllProductImageUrls(
        (nextProductRows[0] ?? updated[0]) as Record<string, unknown>,
        nextSkus,
      );
      await cleanupRemovedProductS3Images(prevImageUrls, nextImageUrls, resolvedVendorId);

      // Auto-draft / auto-restore: recalculate total stock after update and SKU sync.
      if (cols.has('status')) {
        const nextRow = (nextProductRows[0] ?? updated[0]) as Record<string, unknown>;
        const currentStatus = String(nextRow.status || '').trim().toLowerCase();
        const totalStock =
          nextSkus.length > 0
            ? nextSkus.reduce((s, sku) => s + (Number((sku as Record<string, unknown>).stock) || 0), 0)
            : Number(nextRow.stock) || 0;

        let autoStatus: string | null = null;
        if (totalStock === 0 && currentStatus !== PRODUCT_STATUS.INACTIVE && currentStatus !== PRODUCT_STATUS.DRAFT) {
          autoStatus = PRODUCT_STATUS.DRAFT;
        } else if (totalStock > 0 && currentStatus === PRODUCT_STATUS.DRAFT) {
          // Restock: move back to pending for admin re-approval.
          autoStatus = PRODUCT_STATUS.PENDING;
        }

        if (autoStatus !== null) {
          await update('products', { id: productId, vendor_id: resolvedVendorId }, {
            status: autoStatus,
            is_active: autoStatus === PRODUCT_STATUS.ACTIVE,
            updated_at: new Date().toISOString(),
          });
          // Reflect the auto-status in the row returned to the caller.
          (nextProductRows[0] as Record<string, unknown>).status = autoStatus;
        }
      }

      const productOut = await enrichProductRowWithSkus(
        (nextProductRows[0] ?? updated[0]) as Record<string, unknown>,
      );

      return this.success({
        product: productOut,
        message: 'Product updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating product:', error);
      return this.error(error.message || 'Failed to update product', 500);
    }
  }
}

// ============================================================================
// PATCH /vendor/:vendorId/products/:productId/skus/:skuId/stock - Update SKU stock
// ============================================================================

class PatchVendorProductSkuStockHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const productId = context.event.pathParameters?.productId;
      const skuId = context.event.pathParameters?.skuId;
      const body = this.parseBody(context.event);

      if (!vendorId || !productId || !skuId) {
        return this.error('Vendor ID, Product ID, and SKU ID are required', 400);
      }

      const vendor = await resolveVendorById(vendorId);
      if (!vendor || !vendor.id) {
        return this.error('Vendor not found', 404);
      }
      const resolvedVendorId = vendor.id;

      const existingProducts = await select('products', {
        id: productId,
        vendor_id: resolvedVendorId,
      });
      if (existingProducts.length === 0) {
        return this.error('Product not found or access denied', 404);
      }

      if (body.stock === undefined && body.stock_quantity === undefined) {
        return this.error('stock is required', 400);
      }

      const stockRaw = body.stock !== undefined ? body.stock : body.stock_quantity;
      const { sku, parent_stock } = await updateProductSkuStock(
        resolvedVendorId,
        productId,
        skuId,
        Number(stockRaw),
      );

      const skuPresigned = await presignProductSkusForDisplay([
        {
          ...sku,
          images: normalizeImagesArray(sku.images),
        } as Record<string, unknown>,
      ]);

      return this.success({
        sku: skuPresigned[0],
        parent_stock,
        message: 'SKU stock updated successfully',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found') || msg.includes('access denied')) {
        return this.error(msg, 404);
      }
      if (msg.includes('Invalid') || msg.includes('non-negative')) {
        return this.error(msg, 400);
      }
      console.error('Error updating SKU stock:', error);
      return this.error(msg || 'Failed to update SKU stock', 500);
    }
  }
}

// ============================================================================
// DELETE /vendor/:vendorId/products/:productId - Delete product
// ============================================================================

class DeleteVendorProductHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const productId = context.event.pathParameters?.productId;

      if (!vendorId || !productId) {
        return this.error('Vendor ID and Product ID are required', 400);
      }

      // ✅ FIX: Resolve vendor ID (handles vendor_identity auto-create)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor || !vendor.id) {
        console.error(`[VendorProducts] Vendor not found for ID: ${vendorId}`);
        return this.error('Vendor not found', 404);
      }
      const resolvedVendorId = vendor.id;

      // Verify product belongs to vendor
      const existingProducts = await select('products', { id: productId, vendor_id: resolvedVendorId });
      if (existingProducts.length === 0) {
        return this.error('Product not found or access denied', 404);
      }

      // Check if product has orders
      const orders = await query(
        'SELECT COUNT(*) as count FROM order_items WHERE product_id = $1',
        [productId]
      );

      const orderCount = parseInt(orders.rows[0]?.count || '0', 10);
      if (orderCount > 0) {
        // Soft delete: hide from catalog but keep row for order history
        const cols = await getProductsColumnSet();
        const deactivatePayload: Record<string, unknown> = { is_active: false };
        if (cols.has('status')) {
          deactivatePayload.status = 'inactive';
        }
        await update('products', { id: productId }, deactivatePayload);
        return this.success({
          action: 'deactivated',
          deactivated: true,
          message:
            'Product removed from your catalog. It has past orders, so it was archived for order history and is no longer visible to customers.',
        });
      }

      const existingSkus = await loadProductSkus(productId);
      const productRow = existingProducts[0] as Record<string, unknown>;
      const imageUrls = collectAllProductImageUrls(productRow, existingSkus);
      await deleteAllManagedProductImages(imageUrls, resolvedVendorId);

      // Hard delete if no orders
      await deleteRows('products', { id: productId, vendor_id: resolvedVendorId });

      return this.success({
        action: 'deleted',
        deactivated: false,
        message: 'Product deleted successfully.',
      });
    } catch (error: any) {
      console.error('Error deleting product:', error);
      return this.error(error.message || 'Failed to delete product', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerVendorProductsEndpoints(app: Hono) {
  const getProductsHandler = new GetVendorProductsHandler();
  const createProductHandler = new CreateVendorProductHandler();
  const getProductHandler = new GetVendorProductHandler();
  const updateProductHandler = new UpdateVendorProductHandler();
  const patchSkuStockHandler = new PatchVendorProductSkuStockHandler();
  const deleteProductHandler = new DeleteVendorProductHandler();

  app.get('/vendor/:vendorId/ecommerce/commission-model', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      if (!isValidUUID(vendorId)) {
        return c.json({ success: false, error: 'Invalid vendor ID' }, 400);
      }
      const commissionModel = await getVendorCommissionModel(vendorId);
      return c.json({ success: true, commissionModel });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.get('/vendor/:vendorId/ecommerce/categories/:categoryId/variant-presets', async (c) => {
    try {
      const categoryId = c.req.param('categoryId');
      const rows = await select('ecommerce_categories', { id: categoryId, is_active: true });
      const category = rows[0] as { id?: string; name?: string } | undefined;
      if (!category?.id) {
        return c.json({ success: false, error: 'Category not found' }, 404);
      }
      const categoryName = String(category.name ?? '').trim();
      return c.json({
        success: true,
        category_id: categoryId,
        category_name: categoryName,
        suggestions: getVariantSuggestionsForCategory(categoryId, categoryName),
        bulk_hints: getBulkVariantHintsForCategory(categoryId, categoryName),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.get('/vendor/:vendorId/products', async (c) => {
    try {
      const response = await getProductsHandler.handle({
        event: {
          pathParameters: c.req.param(),
          queryStringParameters: c.req.query(),
        } as any,
      } as HandlerContext);
      const body = JSON.parse(response.body);
      if (body.products && body.count === undefined) {
        body.count = body.products.length;
      }
      return c.json(body, response.statusCode as 200 | 400 | 404 | 500);
    } catch (error: any) {
      console.error('Error in vendor products endpoint:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  app.post('/vendor/:vendorId/products', async (c) => {
    try {
      const body = await c.req.json();
      const response = await createProductHandler.handle({
        event: {
          pathParameters: c.req.param(),
          body: JSON.stringify(body), // Pass as string for parseBody to work
        } as any,
      } as HandlerContext);
      return c.json(JSON.parse(response.body), response.statusCode as 200 | 400 | 500);
    } catch (error: any) {
      console.error('Error creating product:', error);
      return c.json({ error: error.message || 'Failed to create product' }, 500);
    }
  });

  app.get('/vendor/:vendorId/products/:productId', async (c) => {
    try {
      const response = await getProductHandler.handle({
        event: {
          pathParameters: c.req.param(),
        } as any,
      } as HandlerContext);
      return c.json(JSON.parse(response.body), response.statusCode as 200 | 400 | 404 | 500);
    } catch (error: any) {
      console.error('Error getting product:', error);
      return c.json({ error: error.message || 'Failed to get product' }, 500);
    }
  });

  app.put('/vendor/:vendorId/products/:productId', async (c) => {
    try {
      const body = await c.req.json();
      const response = await updateProductHandler.handle({
        event: {
          pathParameters: c.req.param(),
          body: JSON.stringify(body), // Pass as string for parseBody to work
        } as any,
      } as HandlerContext);
      return c.json(JSON.parse(response.body), response.statusCode as 200 | 400 | 404 | 500);
    } catch (error: any) {
      console.error('Error updating product:', error);
      return c.json({ error: error.message || 'Failed to update product' }, 500);
    }
  });

  app.patch('/vendor/:vendorId/products/:productId/skus/:skuId/stock', async (c) => {
    try {
      const body = await c.req.json();
      const response = await patchSkuStockHandler.handle({
        event: {
          pathParameters: c.req.param(),
          body: JSON.stringify(body),
        } as any,
      } as HandlerContext);
      return c.json(JSON.parse(response.body), response.statusCode as 200 | 400 | 404 | 500);
    } catch (error: any) {
      console.error('Error updating SKU stock:', error);
      return c.json({ error: error.message || 'Failed to update SKU stock' }, 500);
    }
  });

  app.delete('/vendor/:vendorId/products/:productId', async (c) => {
    try {
      const response = await deleteProductHandler.handle({
        event: {
          pathParameters: c.req.param(),
        } as any,
      } as HandlerContext);
      return c.json(JSON.parse(response.body), response.statusCode as 200 | 404 | 500);
    } catch (error: any) {
      console.error('Error deleting product:', error);
      return c.json({ error: error.message || 'Failed to delete product' }, 500);
    }
  });

  // GET /vendor/:vendorId/products/low-stock - Get products with low stock
  app.get('/vendor/:vendorId/products/low-stock', async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const threshold = parseInt(c.req.query('threshold') || '10', 10);

      // Handle test vendor IDs
      if (!paramVendorId || paramVendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramVendorId)) {
        return c.json({
          success: true,
          products: [],
          count: 0,
          threshold,
        });
      }

      // ✅ FIX: Resolve vendor ID (handles vendor_identity auto-create)
      const vendor = await resolveVendorById(paramVendorId);
      if (!vendor || !vendor.id) {
        console.error(`[VendorProducts] Vendor not found for ID: ${paramVendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      const vendorId = vendor.id;

      // ✅ FIX: Use stock column (stock_quantity was renamed to stock in migration 013)
      const result = await query(`
        SELECT 
          p.id,
          p.name,
          p.sku,
          COALESCE(p.stock, 0) as stock,
          p.price,
          p.is_active
        FROM products p
        WHERE p.vendor_id = $1 
          AND COALESCE(p.stock, 0) <= $2
          AND p.is_active = true
        ORDER BY COALESCE(p.stock, 0) ASC
      `, [vendorId, threshold]);

      const products = result.rows || [];

      return c.json({
        success: true,
        products,
        count: products.length,
        threshold,
      });
    } catch (error: any) {
      console.error('Error fetching low stock products:', error);
      // Return empty array on error instead of 500
      if (error.message?.includes('does not exist') || error.message?.includes('invalid input syntax')) {
        return c.json({
          success: true,
          products: [],
          count: 0,
          threshold: 10,
        });
      }
      return c.json({ error: error.message || 'Failed to fetch low stock products' }, 500);
    }
  });

  // PHASE 1.3 FIX: Product Image Upload Endpoint
  app.post('/vendor/:vendorId/products/images', async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      
      // ✅ FIX: Resolve vendor ID (handles vendor_identity auto-create)
      const vendor = await resolveVendorById(paramVendorId);
      if (!vendor || !vendor.id) {
        console.error(`[VendorProducts] Vendor not found for ID: ${paramVendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      const vendorId = vendor.id;
      
      const formData = await c.req.formData();
      const imageFile = formData.get('image') as File;

      if (!imageFile) {
        return c.json({ error: 'Image file is required' }, 400);
      }

      const buffer = Buffer.from(await imageFile.arrayBuffer());
      if (buffer.length === 0) {
        return c.json({ error: 'Image file is empty' }, 400);
      }

      const asset = await uploadDisplayImage({
        buffer,
        declaredContentType: imageFile.type || undefined,
        assetType: 'product',
        ownerId: vendorId,
        vendorId,
      });

      const payload = toUploadJsonResponse(asset);
      return c.json({
        ...payload,
        s3_url: asset.imageKey,
        image_url: asset.url,
        url: asset.url,
        fileKey: asset.imageKey,
        thumbKey: asset.thumbKey,
        thumbUrl: asset.thumbUrl,
        message: 'Image uploaded successfully',
      });
    } catch (error: any) {
      if (error instanceof ImageProcessingError) {
        return c.json({ error: error.message }, error.statusCode);
      }
      console.error('Error uploading product image:', error);
      return c.json({ error: error.message || 'Failed to upload image' }, 500);
    }
  });

  app.delete('/vendor/:vendorId/products/images', async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendor = await resolveVendorById(paramVendorId);
      if (!vendor?.id) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      const body = await c.req.json().catch(() => ({}));
      const fileKey = String(body?.fileKey ?? '').trim();
      if (!fileKey) {
        return c.json({ error: 'fileKey is required' }, 400);
      }
      if (!extractProductS3Key(fileKey, resolvedVendorId)) {
        return c.json({ error: 'Invalid or unauthorized file key' }, 403);
      }

      await deleteManagedProductS3Image(fileKey, resolvedVendorId);
      return c.json({ success: true, message: 'Image deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting product image:', error);
      return c.json({ error: error.message || 'Failed to delete image' }, 500);
    }
  });
}

