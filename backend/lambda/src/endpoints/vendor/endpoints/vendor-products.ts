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
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  presignProductRowForDisplay,
  presignS3GetUrlIfApplicable,
  stripPresignFromProductImagesJsonb,
} from '../../../utils/s3-media-presign';
import { resolveVendorById } from './vendorProfile.vendor';

// PHASE 1.3: S3 client for product image uploads
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
});
// Use consistent S3_UPLOADS_BUCKET env var (set by CDK lambda-stack)
const S3_BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || process.env.S3_BUCKET_NAME || 'warmpawz-dev-uploads';

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
    metadata: cols.has('metadata') ? 'p.metadata' : `'{}'::jsonb AS metadata`,
    status: cols.has('status') ? 'p.status' : 'NULL::text AS status',
  };
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

const AWS_REGION_EFFECTIVE = process.env.AWS_REGION || 'ap-south-1';

async function uploadProductImageBufferToS3(
  vendorId: string,
  buffer: Buffer,
  contentType: string,
  fileExtension: string,
): Promise<string> {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const ext = fileExtension.replace(/^\./, '') || 'jpg';
  const fileKey = `products/${vendorId}/${timestamp}_${randomStr}.${ext}`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: fileKey,
      Body: buffer,
      ContentType: contentType || 'image/jpeg',
    }),
  );
  return `https://${S3_BUCKET_NAME}.s3.${AWS_REGION_EFFECTIVE}.amazonaws.com/${fileKey}`;
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
      const { metadata: metadataSelect, status: statusSelect } = productsOptionalSelectExprs(cols);

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
          COALESCE(p.stock, 0) as stock,
          ${statusSelect},
          p.is_active,
          p.created_at,
          p.updated_at,
          p.images,
          p.tags,
          ${metadataSelect},
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
      const productsOut = await Promise.all(
        rows.map((row: Record<string, unknown>) => presignProductRowForDisplay(row)),
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

      this.validateRequired(body, ['name', 'price']);

      // ✅ FIX: Resolve vendor ID (handles vendor_identity auto-create)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor || !vendor.id) {
        console.error(`[VendorProducts] Vendor not found for ID: ${vendorId}`);
        return this.error('Vendor not found', 404);
      }
      const resolvedVendorId = vendor.id;

      // ✅ FIX: Use stock column (stock_quantity was renamed to stock in migration 013)
      const stockValue = parseInt(body.stock || body.stock_quantity || '0', 10);

      // Resolve category name (optional) so free-text `category` is populated alongside `category_id`
      let resolvedCategoryName: string | null = null;
      if (body.category_id) {
        try {
          const cat = await query('SELECT name FROM ecommerce_categories WHERE id = $1', [body.category_id]);
          resolvedCategoryName = cat.rows?.[0]?.name || null;
        } catch {
          resolvedCategoryName = null;
        }
      }

      // Prepare product data - only use columns that exist in DB
      // Approval lifecycle:
      // - status defaults to 'pending' at DB level (migration 700)
      // - keep product hidden until approved by admin (is_active = false)
      const productData: any = {
        vendor_id: resolvedVendorId,
        name: body.name,
        description: body.description || null,
        category_id: body.category_id || null,
        category: body.category ?? resolvedCategoryName ?? null,
        price: parseFloat(body.price),
        stock: stockValue, // ✅ FIX: Use stock column (migration 013 renamed stock_quantity to stock)
        sku: body.sku || null,
        // Visibility control: vendors cannot publish directly; admin approval required
        is_active: false,
      };

      const cols = await getProductsColumnSet();
      const hasMetadataCol = cols.has('metadata');

      // Approval: always persist explicit status when column exists; vendors cannot self-publish to active.
      let vendorLifecycleStatus = normalizeApprovalStatus(body.status);
      if (vendorLifecycleStatus === 'active') {
        vendorLifecycleStatus = 'pending';
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
        (body.variants !== undefined && body.variants !== null) ||
        body.images !== undefined ||
        (body.delivery_regions !== undefined && body.delivery_regions !== null);

      // PHASE 1.3: variants / images / delivery_regions — use metadata when migrated, else first-class columns
      if (hasExtraPayload) {
        if (hasMetadataCol) {
          productData.metadata = {
            ...(body.variants != null && { variants: body.variants }),
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
          if (body.variants !== undefined && body.variants !== null) {
            specPatch.variants = body.variants;
          }
          if (deliveryNorm !== undefined) {
            specPatch.delivery_regions = deliveryNorm;
          }
          if (Object.keys(specPatch).length > 0) {
            if (cols.has('specifications')) {
              productData.specifications = specPatch;
            } else {
              console.warn(
                '[VendorProducts] products.metadata column missing; variants/delivery_regions not stored (run db/migrations/034_add_metadata_columns.sql or add products.specifications)',
              );
            }
          }
        }
      }

      // Create product
      const newProduct = await insert('products', productData);
      const productOut = await presignProductRowForDisplay(newProduct[0] as Record<string, unknown>);

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
      const { metadata: metadataSelect, status: statusSelect } = productsOptionalSelectExprs(cols);

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
                COALESCE(p.stock, 0) as stock,
                ${statusSelect},
                p.is_active,
                p.created_at,
                p.updated_at,
                p.images,
                p.tags,
                ${metadataSelect},
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

      const product = await presignProductRowForDisplay(products.rows[0] as Record<string, unknown>);

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

      const cols = await getProductsColumnSet();
      const hasMetadataCol = cols.has('metadata');

      // Prepare update data
      const updateData: any = {};

      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.category_id !== undefined) updateData.category_id = body.category_id;
      if (body.category !== undefined) updateData.category = body.category;
      if (body.price !== undefined) updateData.price = parseFloat(body.price);
      // ✅ FIX: Use stock column (stock_quantity was renamed to stock in migration 013)
      if (body.stock !== undefined) {
        updateData.stock = parseInt(body.stock, 10);
      }
      if (body.stock_quantity !== undefined) {
        updateData.stock = parseInt(body.stock_quantity, 10); // ✅ FIX: Map stock_quantity to stock
      }
      if (body.sku !== undefined) updateData.sku = body.sku;
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
      if (body.gst_rate !== undefined) updateData.gst_rate = body.gst_rate ? parseFloat(body.gst_rate) : null;
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

      // PHASE 1.3: variants / images / delivery_regions
      if (body.variants !== undefined || body.images !== undefined || body.delivery_regions !== undefined) {
        if (hasMetadataCol) {
          const existingMetaRows = await query('SELECT metadata FROM products WHERE id = $1', [productId]);
          const existingMetadata = existingMetaRows.rows[0]?.metadata || {};
          updateData.metadata = {
            ...existingMetadata,
            ...(body.variants !== undefined && { variants: body.variants }),
            ...(body.images !== undefined && { images: normalizedImages }),
            ...(body.delivery_regions !== undefined && { delivery_regions: normalizedDelivery }),
          };
        } else if (
          (body.variants !== undefined || body.delivery_regions !== undefined) &&
          cols.has('specifications')
        ) {
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
          if (body.variants !== undefined) base.variants = body.variants;
          if (body.delivery_regions !== undefined) base.delivery_regions = normalizedDelivery;
          updateData.specifications = base;
        } else if (body.variants !== undefined || body.delivery_regions !== undefined) {
          console.warn(
            '[VendorProducts] products.metadata column missing; variants/delivery_regions not stored (run db/migrations/034_add_metadata_columns.sql or add products.specifications)',
          );
        }
      }

      updateData.updated_at = new Date().toISOString();

      // Update product
      const updated = await update('products', { id: productId, vendor_id: resolvedVendorId }, updateData);

      if (updated.length === 0) {
        return this.error('Failed to update product', 500);
      }

      const productOut = await presignProductRowForDisplay(updated[0] as Record<string, unknown>);

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

      if (parseInt(orders.rows[0]?.count || '0', 10) > 0) {
        // Soft delete - mark as inactive instead
        await update('products', { id: productId }, { is_active: false });
        return this.success({
          message: 'Product deactivated (has existing orders)',
        });
      }

      // Hard delete if no orders
      await deleteRows('products', { id: productId, vendor_id: resolvedVendorId });

      return this.success({
        message: 'Product deleted successfully',
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
  const deleteProductHandler = new DeleteVendorProductHandler();

  app.get('/vendor/:vendorId/products', async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      
      // Handle test IDs or invalid UUIDs gracefully
      if (!paramVendorId || paramVendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramVendorId)) {
        return c.json({
          products: [],
          total: 0,
          count: 0,
        }, 200);
      }

      // ✅ FIX: Resolve vendor ID (handles vendor_identity auto-create)
      const vendor = await resolveVendorById(paramVendorId);
      if (!vendor || !vendor.id) {
        console.error(`[VendorProducts] Vendor not found for ID: ${paramVendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      const vendorId = vendor.id;
      console.log(`[VendorProducts] Resolved vendorId ${paramVendorId} to ${vendorId}`);

      const cols = await getProductsColumnSet();
      const { metadata: metadataSelect, status: statusSelect } = productsOptionalSelectExprs(cols);

      // Get query parameters
      const search = c.req.query('search') || '';
      const category = c.req.query('category') || '';
      const status = c.req.query('status') || '';
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // ✅ FIX: Use stock column (stock_quantity was renamed to stock in migration 013)
      // No need to check - migration 013 renamed stock_quantity to stock

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
          COALESCE(p.stock, 0) as stock,
          ${statusSelect},
          p.is_active,
          p.created_at,
          p.updated_at,
          p.images,
          p.tags,
          ${metadataSelect},
          p.hsn_code,
          p.gst_rate,
          p.category,
          ec.name as category_name
        FROM products p
        LEFT JOIN ecommerce_categories ec ON p.category_id = ec.id
        WHERE p.vendor_id = $1
      `;

      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (search) {
        productQuery += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (category) {
        productQuery += ` AND (p.category_id::text = $${paramIndex} OR p.category = $${paramIndex})`;
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
        let countQuery = `SELECT COUNT(*) as total FROM products p WHERE p.vendor_id = $1`;
        const countParams: any[] = [vendorId]; // Use resolved vendorId from above
        const countResult = await query(countQuery, countParams);
        total = parseInt(countResult.rows?.[0]?.total || '0', 10);
      } catch (dbError: any) {
        console.error('Database error in vendor products:', dbError);
        // Handle table/column not existing errors
        if (dbError.message?.includes('relation') || 
            dbError.message?.includes('column') ||
            dbError.code === '42P01' || 
            dbError.code === '42703') {
          return c.json({
            products: [],
            total: 0,
            count: 0,
          }, 200);
        }
        throw dbError;
      }

      const rawRows = products?.rows || [];
      const productsOut = await Promise.all(
        rawRows.map((row: Record<string, unknown>) => presignProductRowForDisplay(row)),
      );

      return c.json({
        products: productsOut,
        count: productsOut.length,
        total,
        limit,
        offset,
      }, 200);
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
      const fileExtension = imageFile.name.split('.').pop() || 'jpg';
      const imageUrl = await uploadProductImageBufferToS3(
        vendorId,
        buffer,
        imageFile.type || 'image/jpeg',
        fileExtension,
      );
      const displayUrl = (await presignS3GetUrlIfApplicable(imageUrl)) ?? imageUrl;
      let fileKey = '';
      try {
        const u = new URL(imageUrl);
        fileKey = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
      } catch {
        fileKey = '';
      }

      return c.json({
        success: true,
        s3_url: imageUrl,
        image_url: displayUrl,
        url: displayUrl,
        fileKey,
        message: 'Image uploaded successfully',
      });
    } catch (error: any) {
      console.error('Error uploading product image:', error);
      return c.json({ error: error.message || 'Failed to upload image' }, 500);
    }
  });
}

