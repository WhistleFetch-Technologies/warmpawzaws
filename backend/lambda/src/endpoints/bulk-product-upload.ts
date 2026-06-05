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
  countTitledBulkRows,
  exceedsBulkRowLimit,
  generateVendorProductSku,
  parseProductImageList,
  validateEcommerceProductInput,
} from '../utils/product-ecommerce-validation';

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
}

interface ValidationError {
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
            price: normalized.sellingPrice,
            compare_at_price: normalized.mrp,
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
          });
        }

        errors.push(...rowErrors);
      });

      return c.json({
        success: true,
        validation: {
          totalRows: rowsToValidate.length,
          validRows: validProducts.length,
          invalidRows: errors.length > 0 ? [...new Set(errors.map(e => e.row))].length : 0,
          errors: errors.slice(0, 100), // Limit errors returned
          hasMoreErrors: errors.length > 100,
        },
        validProducts,
        canProceed: errors.length === 0 && validProducts.length > 0,
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

      // Process each product (skip rows without a Title)
      let titledRowNum = 0;
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        if (!getBulkProductTitle(product)) continue;
        titledRowNum++;
        const rowNum = titledRowNum;

        try {
          const categoryTrim = product.category ? String(product.category).trim() : '';
          const resolvedCategory = resolveEcommerceCategoryByName(categoryMap, categoryTrim);
          if (!resolvedCategory) {
            throw new Error(
              categoryTrim
                ? `Unknown or inactive category: "${categoryTrim}". Use an exact name from the template category list.`
                : 'Category is required (must match an active catalog name).'
            );
          }

          // Match existing product by vendor + title (SKU is system-assigned; not in template).
          const productTitle = product.name?.trim() || getBulkProductTitle(product);
          let existingProduct: { id: string; sku?: string } | null = null;
          if (productTitle) {
            const existing = await query(
              `SELECT id, sku FROM products
               WHERE vendor_id = $1 AND lower(trim(name)) = lower(trim($2))
               LIMIT 1`,
              [vendorId, productTitle]
            );
            if (existing.rows.length > 0) {
              existingProduct = existing.rows[0] as { id: string; sku?: string };
            }
          }

          const images = parseProductImageList(product.images ?? product.image_urls);

          // Parse tags
          let tags: string[] = [];
          if (product.tags) {
            if (typeof product.tags === 'string') {
              tags = product.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
            } else if (Array.isArray(product.tags)) {
              tags = product.tags;
            }
          }

          const stockValue =
            Number(product.stock_quantity ?? product.stock ?? product.stockQuantity) || 0;

          const productData: Record<string, unknown> = {
            vendor_id: vendorId,
            name: product.name?.trim(),
            description: product.description?.trim() || null,
            category_id: resolvedCategory.id,
            category: resolvedCategory.name,
            price: (() => {
              const norm = normalizeEcommerceProductPricing(product as Record<string, unknown>);
              return norm.ok ? norm.pricing.sellingPrice : Number(product.price);
            })(),
            compare_at_price: (() => {
              const norm = normalizeEcommerceProductPricing(product as Record<string, unknown>);
              return norm.ok ? norm.pricing.mrp : product.compare_at_price ? Number(product.compare_at_price) : null;
            })(),
            stock: stockValue,
            hsn_code: product.hsn_code?.trim() || null,
            gst_rate: product.gst_rate ? Number(product.gst_rate) : null,
            weight: product.weight ? Number(product.weight) : null,
            dimensions: product.dimensions?.trim() || null,
            images,
            tags: JSON.stringify(tags),
            metadata: JSON.stringify({
              material: product.material?.trim() || null,
              brand: product.brand?.trim() || null,
              barcode: product.barcode?.trim() || null,
              bulk_uploaded: true,
              upload_date: new Date().toISOString(),
            }),
            updated_at: new Date().toISOString(),
          };

          if (existingProduct) {
            // Update existing product — preserve system SKU; backfill if legacy row has none
            const updatePayload = { ...productData };
            if (!existingProduct.sku?.trim()) {
              updatePayload.sku = generateVendorProductSku(vendorId, String(rowNum));
            }
            await update('products', { id: existingProduct.id }, updatePayload);
            results.updated++;
          } else {
            // Create new product — not visible until admin approves
            await insert('products', {
              ...productData,
              sku: generateVendorProductSku(vendorId, String(rowNum)),
              is_active: false,
              status: 'pending',
              created_at: new Date().toISOString(),
            });
            results.created++;
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            error: error.message || 'Unknown error',
          });
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
