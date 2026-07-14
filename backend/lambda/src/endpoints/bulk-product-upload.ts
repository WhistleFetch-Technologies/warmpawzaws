/**
 * ============================================================================
 * BULK PRODUCT UPLOAD ENDPOINTS
 * ============================================================================
 * 
 * Features:
 * - Excel/CSV file parsing
 * - Bulk product creation/update
 * - Validation and error reporting
 * - Progress tracking
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import {
  loadActiveEcommerceCategoryMap,
  resolveEcommerceCategoryByName,
} from '../utils/ecommerce-category-resolve';
import {
  buildBulkProductTemplateBuffer,
  getBulkProductTitle,
  parseBulkProductXlsxBuffer,
} from './bulk-product-xlsx';
import { normalizeEcommerceProductPricing } from '../utils/product-ecommerce-pricing';
import {
  bulkRowLimitResponse,
  collectFragileImageWarnings,
  countTitledBulkRows,
  exceedsBulkRowLimit,
  generateVendorProductSku,
  parseProductImageList,
  validateEcommerceProductInput,
} from '../utils/product-ecommerce-validation';
import { syncProductSkus } from '../utils/product-sku-service';
import { resolveVendorPetTypeInput } from '@warmpawz/shared-types';
import {
  groupBulkRows,
  buildSkuInputsFromGroup,
  validateVariantGroup,
  rowHasVariantAxes,
  aggregateGroupStock,
  pickGroupParentImages,
  bulkGroupExtrasSource,
  listingPriceFromGroup,
  type BulkVariantRow,
} from '../utils/bulk-product-variant-builder';
import {
  findExistingProductByGroupKey,
  generateProductGroupId,
  parseProductMetadata,
  resolveBulkGroupKey,
} from '../utils/product-group-identity';
import {
  applyVendorProductExtrasToPayload,
  vendorExtrasFromBulkRow,
  getProductsColumnSet,
  filterProductPayloadToColumns,
} from '../utils/product-vendor-persist';
import { validateAndApplyVendorDeclaredOwnership } from '../utils/compute-listing-ownership';
import { cleanupRemovedProductS3Images, collectImageUrlsFromJsonb } from '../utils/product-s3-image';

/**
 * Represents one row from the bulk product upload spreadsheet.
 *
 * VARIANT LIMITATION: Bulk upload creates a single simple product per row — it does NOT
 * create multiple product_skus rows for variant combinations. After import, open the product
 * in ProductFormModal (Seller Hub) to add size/color/weight variants via the inline SKU editor.
 *
 * size_variant / colour / variant_attr_* columns are accepted but currently stored in metadata
 * only; they do not automatically create separate SKU rows via product_skus.
 */
interface BulkProductRow {
  name: string;
  description?: string | null;
  category?: string | null;
  sku?: string | null;
  price: number;
  compare_at_price?: number | null;
  stock_quantity: number;
  hsn_code?: string | null;
  gst_rate?: number | null;
  weight?: number | null;
  dimensions?: string | null;
  material?: string | null;
  brand?: string | null;
  tags?: string | null;
  images?: string | null;
  is_active?: boolean;
  status?: string;
  rowNum?: number;
  size_variant?: string | null;
  colour?: string | null;
  variant_attr_1?: string | null;
  variant_value_1?: string | null;
  variant_attr_2?: string | null;
  variant_value_2?: string | null;
  variant_attr_3?: string | null;
  variant_value_3?: string | null;
  product_group_id?: string | null;
  barcode?: string | null;
  key_features?: string | null;
  product_specifications?: string | null;
  length_cm?: string | number | null;
  breadth_cm?: string | number | null;
  height_cm?: string | number | null;
  pet_type?: string | null;
  pet_type_other?: string | null;
  manufacturing_details?: string | null;
  delivery_regions?: string[] | string | null;
  listing_ownership?: string | null;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
}

interface ValidationWarning {
  row: number;
  field: string;
  message: string;
  value?: any;
}

export function registerBulkProductUploadEndpoints(app: Hono) {

  // ============================================================================
  // GET TEMPLATE - Download CSV/Excel template
  // ============================================================================

  app.get('/vendor/:vendorId/products/bulk/template', async (c) => {
    void c.req.param('vendorId');
    const catResult = await query(
      `SELECT name FROM ecommerce_categories WHERE is_active = true ORDER BY display_order NULLS LAST, name ASC`
    );
    const seen = new Set<string>();
    const categoryNames: string[] = [];
    for (const row of catResult.rows as { name: string }[]) {
      const n = String(row.name ?? '').trim();
      if (!n) continue;
      const key = n.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      categoryNames.push(n);
    }
    const buf = await buildBulkProductTemplateBuffer(categoryNames);
    return c.body(new Uint8Array(buf), 200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="product_upload_template.xlsx"',
    });
  });

  // ============================================================================
  // VALIDATE BULK UPLOAD
  // ============================================================================

  app.post('/vendor/:vendorId/products/bulk/validate', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const body = await c.req.json();
      const { products } = body;

      if (!Array.isArray(products) || products.length === 0) {
        return c.json({ 
          success: false, 
          error: 'No products provided. Expected array of product objects.',
          example: {
            products: [
              { name: 'Product Name', price: 100, stock_quantity: 10 }
            ]
          }
        }, 400);
      }

      const rowsToValidate = products.filter(
        (p: Record<string, unknown>) => getBulkProductTitle(p).length > 0
      );
      if (rowsToValidate.length === 0) {
        return c.json({ success: false, error: 'No rows with a Title found' }, 400);
      }

      const titledCount = countTitledBulkRows(products);
      if (exceedsBulkRowLimit(products)) {
        return c.json(bulkRowLimitResponse(titledCount), 400);
      }

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const validProducts: BulkProductRow[] = [];

      // Get valid categories
      const categories = await select('ecommerce_categories', { is_active: true });
      const validCategories = new Set(
        categories.map((c: any) => String(c.name ?? '').trim().toLowerCase()).filter(Boolean)
      );

      rowsToValidate.forEach((product: any, index: number) => {
        const rowNum = index + 1;
        const rowErrors: ValidationError[] = [];
        const push = (field: string, message: string, value?: unknown) =>
          rowErrors.push({ row: rowNum, field, message, value });

        const validation = validateEcommerceProductInput(product as Record<string, unknown>, {
          mode: 'bulk',
          validCategoryNames: validCategories,
          requireHttpImageUrls: true,
        });
        if (!validation.ok) {
          push(validation.field, validation.message, product[validation.field]);
        }

        for (const fw of collectFragileImageWarnings(product as Record<string, unknown>)) {
          warnings.push({
            row: rowNum,
            field: fw.field,
            message: fw.message,
            value: fw.value,
          });
        }

        if (product.weight !== undefined && product.weight !== null && product.weight !== '') {
          const w = Number(product.weight);
          if (isNaN(w) || w < 0) push('weight', 'Weight must be a number ≥ 0', product.weight);
        }

        // ── Build the cleaned product if no errors ──────────────────────
        if (rowErrors.length === 0 && validation.ok) {
          const { normalized } = validation;
          validProducts.push({
            name: normalized.name,
            description: product.description?.trim() || null,
            category: normalized.category,
            price: normalized.price,
            stock_quantity: normalized.stock,
            hsn_code: normalized.hsn_code,
            gst_rate: normalized.gst_rate,
            weight:
              product.weight !== undefined && product.weight !== null && product.weight !== ''
                ? Number(product.weight)
                : null,
            dimensions: product.dimensions?.trim() || null,
            material: product.material?.trim() || null,
            brand: product.brand?.trim() || null,
            tags: product.tags?.trim() || null,
            images: normalized.imageUrls.join(', '),
            is_active: false,
            status: 'pending',
            rowNum,
            size_variant: product.size_variant != null ? String(product.size_variant).trim() : null,
            colour: product.colour != null ? String(product.colour).trim() : (product.color != null ? String(product.color).trim() : null),
            variant_attr_1: product.variant_attr_1 != null ? String(product.variant_attr_1).trim() : null,
            variant_value_1: product.variant_value_1 != null ? String(product.variant_value_1).trim() : null,
            variant_attr_2: product.variant_attr_2 != null ? String(product.variant_attr_2).trim() : null,
            variant_value_2: product.variant_value_2 != null ? String(product.variant_value_2).trim() : null,
            variant_attr_3: product.variant_attr_3 != null ? String(product.variant_attr_3).trim() : null,
            variant_value_3: product.variant_value_3 != null ? String(product.variant_value_3).trim() : null,
            product_group_id:
              product.product_group_id != null ? String(product.product_group_id).trim() : null,
            barcode: product.barcode?.trim() || null,
            key_features: product.key_features?.trim() || null,
            product_specifications: product.product_specifications?.trim() || null,
            length_cm: product.length_cm ?? null,
            breadth_cm: product.breadth_cm ?? null,
            height_cm: product.height_cm ?? null,
            ...(() => {
              const resolved = resolveVendorPetTypeInput(
                product.pet_type,
                product.pet_type_other,
              );
              return {
                pet_type: resolved.pet_type,
                pet_type_other: resolved.pet_type_other,
              };
            })(),
            manufacturing_details: product.manufacturing_details?.trim() || null,
            delivery_regions: product.delivery_regions ?? null,
          });
        }

        errors.push(...rowErrors);
      });

      const groups = groupBulkRows(validProducts as BulkVariantRow[], vendorId);
      const invalidRowSet = new Set<number>();
      for (const group of groups) {
        const groupErrors = validateVariantGroup(group);
        if (groupErrors.length > 0) {
          for (const rowNum of group.rowNums) {
            invalidRowSet.add(rowNum);
          }
          for (const ge of groupErrors) {
            errors.push({
              row: ge.row ?? group.rowNums[0] ?? 0,
              field: ge.field,
              message: ge.message,
            });
          }
        }
      }

      for (const e of errors) {
        if (e.row) invalidRowSet.add(e.row);
      }

      const fullyValidProducts = validProducts.filter(
        (p) => !invalidRowSet.has(p.rowNum ?? 0),
      );

      return c.json({
        success: true,
        validation: {
          totalRows: rowsToValidate.length,
          validRows: fullyValidProducts.length,
          invalidRows: errors.length > 0 ? [...new Set(errors.map(e => e.row))].length : 0,
          errors: errors.slice(0, 100), // Limit errors returned
          warnings: warnings.slice(0, 100),
          hasMoreErrors: errors.length > 100,
          hasMoreWarnings: warnings.length > 100,
        },
        validProducts: fullyValidProducts,
        productGroups: groups.map((g) => ({
          name: g.name,
          category: g.category,
          product_group_id: g.product_group_id,
          variantCount: g.variants.length,
          rowNums: g.rowNums,
        })),
        canProceed: errors.length === 0 && fullyValidProducts.length > 0,
      });
    } catch (error: any) {
      console.error('Error validating bulk upload:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // PROCESS BULK UPLOAD
  // ============================================================================

  app.post('/vendor/:vendorId/products/bulk/upload', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const body = await c.req.json();
      const { products, skipValidation = false } = body;

      if (!Array.isArray(products) || products.length === 0) {
        return c.json({ success: false, error: 'No products provided' }, 400);
      }

      const uploadTitledCount = countTitledBulkRows(products);
      if (exceedsBulkRowLimit(products)) {
        return c.json(bulkRowLimitResponse(uploadTitledCount), 400);
      }

      // Verify vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }

      const results = {
        created: 0,
        updated: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string }>,
      };

      const categoryMap = await loadActiveEcommerceCategoryMap();
      const productCols = await getProductsColumnSet();

      const rowsWithNum: BulkVariantRow[] = [];
      let titledRowNum = 0;
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        if (!getBulkProductTitle(product)) continue;
        titledRowNum++;
        rowsWithNum.push({ ...(product as BulkVariantRow), rowNum: product.rowNum ?? titledRowNum });
      }

      const groups = groupBulkRows(rowsWithNum, vendorId);

      for (const group of groups) {
        const primaryRowNum = group.rowNums[0] ?? 1;
        try {
          const groupErrors = validateVariantGroup(group);
          if (groupErrors.length > 0) {
            throw new Error(groupErrors[0].message);
          }

          const categoryTrim = group.category.trim();
          const resolvedCategory = resolveEcommerceCategoryByName(categoryMap, categoryTrim);
          if (!resolvedCategory) {
            throw new Error(
              categoryTrim
                ? `Unknown or inactive category: "${categoryTrim}". Use an exact name from the template category list.`
                : 'Category is required (must match an active catalog name).',
            );
          }

          const productTitle = group.name.trim();
          const groupKey =
            resolveBulkGroupKey(vendorId, {
              product_group_id: group.product_group_id,
              name: productTitle,
              brand: group.parent.brand,
              category_id: resolvedCategory.id,
            }) ?? group.groupKey;

          let existingProduct: {
            id: string;
            sku?: string;
            category_id?: string;
            metadata?: unknown;
            images?: unknown;
          } | null = await findExistingProductByGroupKey(vendorId, groupKey);

          if (
            existingProduct?.category_id &&
            String(existingProduct.category_id) !== String(resolvedCategory.id)
          ) {
            throw new Error(
              'Category cannot change for an existing Product Group ID — create a new group ID for a different category',
            );
          }

          const firstRow = group.variants[0];
          const hasVariants = group.variants.some((r) => rowHasVariantAxes(r));

          let productGroupId =
            group.product_group_id ?? String(firstRow.product_group_id ?? '').trim();
          if (hasVariants && !productGroupId) {
            productGroupId = generateProductGroupId();
          }

          const listingPricing = hasVariants
            ? listingPriceFromGroup(group)
            : {
                price: Number(firstRow.price) || Number(firstRow.compare_at_price) || 0,
                compare_at_price:
                  firstRow.compare_at_price != null ? Number(firstRow.compare_at_price) : null,
              };

          const stockValue = hasVariants
            ? aggregateGroupStock(group)
            : Number(firstRow.stock_quantity) || 0;

          const rawParentImages = hasVariants
            ? pickGroupParentImages(group)
            : parseProductImageList(firstRow.images ?? firstRow.image_urls);
          // Bulk upload stores vendor image URLs as-is; customer app loads them directly.
          const parentImages = rawParentImages;
          const prevParentImages = existingProduct ? collectImageUrlsFromJsonb(existingProduct.images) : [];

          const productData: Record<string, unknown> = {
            vendor_id: vendorId,
            name: productTitle,
            description: group.parent.description || null,
            category_id: resolvedCategory.id,
            category: resolvedCategory.name,
            price: listingPricing.price,
            stock: stockValue,
            hsn_code: group.parent.hsn_code || null,
            gst_rate: group.parent.gst_rate != null ? Number(group.parent.gst_rate) : null,
            images: parentImages,
            updated_at: new Date().toISOString(),
          };

          applyVendorProductExtrasToPayload(
            productData,
            vendorExtrasFromBulkRow(bulkGroupExtrasSource(group)),
            productCols,
          );

          await validateAndApplyVendorDeclaredOwnership(
            vendorId,
            productData,
            productCols,
            group.parent.listing_ownership ?? null
          );

          if (!productData.metadata) {
            productData.metadata = {
              bulk_uploaded: true,
              upload_date: new Date().toISOString(),
            };
          } else {
            productData.metadata = {
              ...(productData.metadata as Record<string, unknown>),
              bulk_uploaded: true,
              upload_date: new Date().toISOString(),
            };
          }
          if (productGroupId) {
            productData.metadata = {
              ...(productData.metadata as Record<string, unknown>),
              product_group_id: productGroupId,
            };
          }
          if (existingProduct) {
            const existingMeta = parseProductMetadata(existingProduct.metadata);
            if (existingMeta.product_group_id) {
              productData.metadata = {
                ...(productData.metadata as Record<string, unknown>),
                product_group_id: existingMeta.product_group_id,
              };
            }
          }
          if (typeof productData.metadata === 'object' && productData.metadata !== null) {
            productData.metadata = JSON.stringify(productData.metadata);
          }
          if (productData.specifications && typeof productData.specifications === 'object') {
            productData.specifications = JSON.stringify(productData.specifications);
          }

          let savedProductId: string | null = existingProduct?.id ?? null;

          const persistPayload = filterProductPayloadToColumns(productData, productCols);

          if (existingProduct) {
            const updatePayload = { ...persistPayload };
            if (!existingProduct.sku?.trim()) {
              updatePayload.sku = generateVendorProductSku(vendorId, String(primaryRowNum));
            }
            await update('products', { id: existingProduct.id }, updatePayload);
            savedProductId = existingProduct.id;
            results.updated++;
            // Eviction: delete any of this vendor's S3 objects that were on the
            // product before this upload but are no longer referenced, so
            // replacing an image never leaves an orphaned file in the bucket.
            if (prevParentImages.length > 0) {
              await cleanupRemovedProductS3Images(prevParentImages, parentImages, vendorId);
            }
          } else {
            const inserted = await insert('products', {
              ...persistPayload,
              sku: generateVendorProductSku(vendorId, String(primaryRowNum)),
              is_active: false,
              status: 'pending',
              created_at: new Date().toISOString(),
            });
            savedProductId = String(inserted[0]?.id ?? '');
            results.created++;
          }

          if (savedProductId && hasVariants) {
            const skuInputs = buildSkuInputsFromGroup(group);
            await syncProductSkus(vendorId, savedProductId, skuInputs, undefined, {
              skipImageIngest: true,
            });
          }
        } catch (error: any) {
          results.failed += group.rowNums.length;
          for (const rowNum of group.rowNums) {
            results.errors.push({
              row: rowNum,
              error: error.message || 'Unknown error',
            });
          }
        }
      }

      return c.json({
        success: true,
        message: `Bulk upload completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
        results,
      });
    } catch (error: any) {
      console.error('Error processing bulk upload:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // PARSE CSV/EXCEL FILE
  // ============================================================================

  app.post('/vendor/:vendorId/products/bulk/parse', async (c) => {
    try {
      void c.req.param('vendorId');
      const body = await c.req.json();
      const { csvContent, fileBase64, fileName = '', format = 'csv' } = body;

      const wantsXlsx =
        typeof fileBase64 === 'string' &&
        fileBase64.length > 0 &&
        (format === 'xlsx' ||
          format === 'excel' ||
          String(fileName).toLowerCase().endsWith('.xlsx'));

      if (wantsXlsx) {
        let buf: Buffer;
        try {
          buf = Buffer.from(fileBase64 as string, 'base64');
        } catch {
          return c.json({ success: false, error: 'Invalid base64 file payload' }, 400);
        }
        if (buf.length === 0) {
          return c.json({ success: false, error: 'Empty file' }, 400);
        }
        const { headers: mappedHeaders, products } = await parseBulkProductXlsxBuffer(buf);
        const normalized = products.map((p) => normalizeParsedProductRow(p));
        const parseTitledCount = countTitledBulkRows(normalized);
        if (exceedsBulkRowLimit(normalized)) {
          return c.json(bulkRowLimitResponse(parseTitledCount), 400);
        }
        return c.json({
          success: true,
          parsed: {
            headers: mappedHeaders,
            rowCount: normalized.length,
            products: normalized,
          },
          message: `Parsed ${normalized.length} products from XLSX file`,
        });
      }

      if (!csvContent || typeof csvContent !== 'string') {
        return c.json({ success: false, error: 'No file content provided' }, 400);
      }

      // Parse CSV content
      const lines = csvContent.split('\n').filter((line: string) => line.trim());
      if (lines.length < 2) {
        return c.json({ success: false, error: 'File must contain header row and at least one data row' }, 400);
      }

      // Parse header. Normalize the same way as the XLSX path so a vendor can
      // copy any header from the Excel template (incl. `Image (1000X1000px)`,
      // `Type (Category)`, `Title*`) into a CSV without breaking the mapping.
      const headerLine = lines[0];
      const headers = parseCSVLine(headerLine).map((h: string) =>
        h
          .replace(/\u00a0/g, ' ')
          .toLowerCase()
          .replace(/\*/g, '')
          .replace(/\s+/g, '')
          .replace(/_/g, '')
          .replace(/[()]/g, '')
      );

      // Map CSV headers → internal field names. Aliases mirror the XLSX header
      // map so vendors can use the same column names in either format.
      const fieldMap: Record<string, string> = {
        'name': 'name',
        'productname': 'name',
        'title': 'name',
        'description': 'description',
        'desc': 'description',
        'category': 'category',
        'categoryname': 'category',
        'typecategory': 'category',
        'barcodeean': 'barcode',
        'price': 'price',
        'sellingprice': 'price',
        'sp': 'price',
        'selling_price': 'price',
        'mrp': 'compare_at_price',
        'compareatprice': 'compare_at_price',
        'compare_at_price': 'compare_at_price',
        'originalprice': 'compare_at_price',
        'stock': 'stock_quantity',
        'stockquantity': 'stock_quantity',
        'quantity': 'stock_quantity',
        'inventory': 'stock_quantity',
        'hsncode': 'hsn_code',
        'hsn': 'hsn_code',
        'gstrate': 'gst_rate',
        'gst': 'gst_rate',
        'tax': 'gst_rate',
        'weight': 'weight',
        'weightkg': 'weight',
        'dimensions': 'dimensions',
        'size': 'dimensions',
        'sizevariant': 'size_variant',
        'colour': 'colour',
        'color': 'colour',
        'variantattribute1': 'variant_attr_1',
        'variantvalue1': 'variant_value_1',
        'variantattribute2': 'variant_attr_2',
        'variantvalue2': 'variant_value_2',
        'variantattribute3': 'variant_attr_3',
        'variantvalue3': 'variant_value_3',
        'productgroupid': 'product_group_id',
        'productgroup': 'product_group_id',
        'material': 'material',
        'materials': 'material',
        'ingredients': 'material',
        'brand': 'brand',
        'brandname': 'brand',
        'tags': 'tags',
        'keywords': 'tags',
        'images': 'images',
        'imageurls': 'images',
        'image': 'images',
        'image1000x1000px': 'images',
        'pettype': 'pet_type',
        'pettypeother': 'pet_type_other',
        'listingownership': 'listing_ownership',
        'productownership': 'listing_ownership',
        'isactive': 'is_active',
        'active': 'is_active',
        'status': 'is_active',
      };

      const mappedHeaders = headers.map((h: string) => fieldMap[h] || h);

      // Parse data rows
      const products: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0 || values.every((v: string) => !v.trim())) continue;

        const product: Record<string, any> = {};
        mappedHeaders.forEach((header: string, index: number) => {
          let value: string | boolean | number | null = values[index]?.trim() || '';

          if (header === 'is_active') {
            const s = String(value).toLowerCase();
            value = s === 'true' || value === '1' || s === 'yes';
          } else if (['price', 'compare_at_price', 'stock_quantity', 'gst_rate', 'weight'].includes(header)) {
            value = value ? parseFloat(String(value)) : null;
          }

          product[header] = value;
        });

        if (getBulkProductTitle(product)) {
          const resolvedPet = resolveVendorPetTypeInput(
            product.pet_type,
            product.pet_type_other,
          );
          product.pet_type = resolvedPet.pet_type;
          product.pet_type_other = resolvedPet.pet_type_other;
          products.push(product);
        }
      }

      const csvTitledCount = countTitledBulkRows(products);
      if (exceedsBulkRowLimit(products)) {
        return c.json(bulkRowLimitResponse(csvTitledCount), 400);
      }

      return c.json({
        success: true,
        parsed: {
          headers: mappedHeaders,
          rowCount: products.length,
          products,
        },
        message: `Parsed ${products.length} products from ${format.toUpperCase()} file`,
      });
    } catch (error: any) {
      console.error('Error parsing file:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // EXPORT PRODUCTS TO CSV
  // ============================================================================

  app.get('/vendor/:vendorId/products/export', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const format = c.req.query('format') || 'csv';

      // Fetch all vendor products
      const result = await query(
        `SELECT * FROM products WHERE vendor_id = $1 ORDER BY created_at DESC`,
        [vendorId]
      );

      const products = result.rows || [];

      if (format === 'json') {
        return c.json({
          success: true,
          products,
          count: products.length,
        });
      }

      // Generate CSV
      const headers = [
        'name', 'description', 'category', 'sku', 'mrp', 'selling_price',
        'stock_quantity', 'hsn_code', 'gst_rate', 'weight', 'dimensions',
        'material', 'brand', 'tags', 'image_urls', 'is_active'
      ];

      const rows = products.map((p: any) => {
        const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata || '{}') : (p.metadata || {});
        const images = typeof p.images === 'string' ? JSON.parse(p.images || '[]') : (p.images || []);
        const tags = typeof p.tags === 'string' ? JSON.parse(p.tags || '[]') : (p.tags || []);
        
        return [
          escapeCsvValue(p.name),
          escapeCsvValue(p.description),
          escapeCsvValue(p.category),
          escapeCsvValue(p.sku),
          p.compare_at_price ?? p.price,
          p.price,
          p.stock_quantity || p.stock,
          escapeCsvValue(p.hsn_code),
          p.gst_rate,
          p.weight,
          escapeCsvValue(p.dimensions),
          escapeCsvValue(metadata.material),
          escapeCsvValue(metadata.brand),
          escapeCsvValue(Array.isArray(tags) ? tags.join(',') : ''),
          escapeCsvValue(Array.isArray(images) ? images.join(',') : ''),
          p.is_active
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');

      return c.text(csvContent, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="products_export_${vendorId}_${Date.now()}.csv"`
      });
    } catch (error: any) {
      console.error('Error exporting products:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function normalizeParsedProductRow(raw: Record<string, unknown>): Record<string, any> {
  const product: Record<string, any> = { ...raw };
  if (product.is_active !== undefined && typeof product.is_active !== 'boolean') {
    const v = String(product.is_active).toLowerCase();
    product.is_active = v === 'true' || v === '1' || v === 'yes';
  }
  for (const key of ['price', 'compare_at_price', 'stock_quantity', 'gst_rate', 'weight'] as const) {
    if (product[key] === undefined || product[key] === null || product[key] === '') continue;
    if (typeof product[key] === 'number' && !isNaN(product[key])) continue;
    const n = parseFloat(String(product[key]).replace(/,/g, ''));
    product[key] = isNaN(n) ? product[key] : n;
  }
  return product;
}
