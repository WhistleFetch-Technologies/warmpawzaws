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
import { buildBulkProductTemplateBuffer, parseBulkProductXlsxBuffer } from './bulk-product-xlsx';

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

      const errors: ValidationError[] = [];
      const validProducts: BulkProductRow[] = [];

      // Get existing SKUs for this vendor
      const existingProducts = await query(
        'SELECT sku FROM products WHERE vendor_id = $1 AND sku IS NOT NULL',
        [vendorId]
      );
      const existingSkus = new Set(existingProducts.rows.map((p: any) => p.sku?.toLowerCase()));

      // Get valid categories
      const categories = await select('ecommerce_categories', { is_active: true });
      const validCategories = new Set(
        categories.map((c: any) => String(c.name ?? '').trim().toLowerCase()).filter(Boolean)
      );

      products.forEach((product: any, index: number) => {
        const rowNum = index + 1;
        const rowErrors: ValidationError[] = [];
        const push = (field: string, message: string, value?: unknown) =>
          rowErrors.push({ row: rowNum, field, message, value });

        // ── Required ────────────────────────────────────────────────────
        // 1. Title*
        const title = typeof product.name === 'string' ? product.name.trim() : '';
        if (!title) push('name', 'Title is required', product.name);
        else if (title.length > 255) push('name', 'Title must be ≤ 255 characters', title.length);

        // 2. SP* (price)
        const priceNum = Number(product.price);
        if (product.price === undefined || product.price === null || product.price === '' || isNaN(priceNum)) {
          push('price', 'SP (selling price) is required', product.price);
        } else if (priceNum <= 0) {
          push('price', 'SP must be greater than 0', priceNum);
        }

        // 3. Quantity* (CSV field stock_quantity; alias stock)
        const qtyRaw = product.stock_quantity ?? product.stock;
        const stockNum = Number(qtyRaw);
        if (qtyRaw === undefined || qtyRaw === null || qtyRaw === '') {
          push('stock_quantity', 'Quantity is required', product.stock_quantity);
        } else if (isNaN(stockNum) || stockNum < 0) {
          push('stock_quantity', 'Quantity must be a number ≥ 0', qtyRaw);
        } else if (!Number.isInteger(stockNum)) {
          push('stock_quantity', 'Quantity must be a whole number', qtyRaw);
        }

        // 4. Category* — required AND must match an active catalog name
        const categoryStr = product.category ? String(product.category).trim() : '';
        if (!categoryStr) {
          push('category', 'Category is required (pick from the dropdown)', product.category);
        } else if (!validCategories.has(categoryStr.toLowerCase())) {
          push(
            'category',
            `Category must match an active catalog: ${[...validCategories].join(', ') || 'no active categories'}`,
            categoryStr
          );
        }

        // 5. HSN* — 4–8 digit numeric (Indian HSN/SAC range)
        const hsnStr = product.hsn_code ? String(product.hsn_code).trim() : '';
        if (!hsnStr) push('hsn_code', 'HSN is required for invoicing', product.hsn_code);
        else if (!/^\d{4,8}$/.test(hsnStr)) push('hsn_code', 'HSN must be 4–8 digits (numbers only)', hsnStr);

        // 6. Tax* / GST rate — required, must be one of the 5 GST slabs
        const gstNum = Number(product.gst_rate);
        if (product.gst_rate === undefined || product.gst_rate === null || product.gst_rate === '') {
          push('gst_rate', 'Tax (GST %) is required', product.gst_rate);
        } else if (isNaN(gstNum) || ![0, 5, 12, 18, 28].includes(gstNum)) {
          push('gst_rate', 'Tax must be 0, 5, 12, 18 or 28', product.gst_rate);
        }

        // 7. Image* — at least one URL
        const imageUrls = parseImageList(product.images ?? product.image_urls);
        if (imageUrls.length === 0) {
          push('images', 'At least one product image URL is required', product.images);
        } else if (!imageUrls.every(isLikelyUrl)) {
          push('images', 'Image must be an http(s) URL (1000×1000 px recommended)', product.images);
        }

        // ── Optional ────────────────────────────────────────────────────
        if (product.sku && existingSkus.has(String(product.sku).toLowerCase())) {
          push('sku', 'SKU already exists for this vendor', product.sku);
        }

        if (product.compare_at_price !== undefined && product.compare_at_price !== null && product.compare_at_price !== '') {
          const mrp = Number(product.compare_at_price);
          if (isNaN(mrp)) push('compare_at_price', 'MRP must be a number', product.compare_at_price);
          else if (!isNaN(priceNum) && mrp < priceNum)
            push('compare_at_price', 'MRP must be ≥ SP', product.compare_at_price);
        }

        if (product.weight !== undefined && product.weight !== null && product.weight !== '') {
          const w = Number(product.weight);
          if (isNaN(w) || w < 0) push('weight', 'Weight must be a number ≥ 0', product.weight);
        }

        // ── Build the cleaned product if no errors ──────────────────────
        if (rowErrors.length === 0) {
          validProducts.push({
            name: title,
            description: product.description?.trim() || null,
            category: categoryStr || null,
            sku: product.sku?.trim() || null,
            price: priceNum,
            compare_at_price:
              product.compare_at_price !== undefined && product.compare_at_price !== null && product.compare_at_price !== ''
                ? Number(product.compare_at_price)
                : null,
            stock_quantity: stockNum,
            hsn_code: hsnStr,
            gst_rate: gstNum,
            weight:
              product.weight !== undefined && product.weight !== null && product.weight !== ''
                ? Number(product.weight)
                : null,
            dimensions: product.dimensions?.trim() || null,
            material: product.material?.trim() || null,
            brand: product.brand?.trim() || null,
            tags: product.tags?.trim() || null,
            images: imageUrls.join(', '),
            is_active: false,
            status: 'pending',
          });
        }

        errors.push(...rowErrors);
      });

      return c.json({
        success: true,
        validation: {
          totalRows: products.length,
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

      // Process each product
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const rowNum = i + 1;

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

          // Check if SKU exists for update
          let existingProduct = null;
          if (product.sku) {
            const existing = await query(
              'SELECT id FROM products WHERE vendor_id = $1 AND sku = $2',
              [vendorId, product.sku]
            );
            if (existing.rows.length > 0) {
              existingProduct = existing.rows[0];
            }
          }

          // Parse images
          let images: string[] = [];
          if (product.images || product.image_urls) {
            const imageStr = product.images || product.image_urls;
            if (typeof imageStr === 'string') {
              images = imageStr.split(',').map((url: string) => url.trim()).filter(Boolean);
            } else if (Array.isArray(imageStr)) {
              images = imageStr;
            }
          }

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

          const productData = {
            vendor_id: vendorId,
            name: product.name?.trim(),
            description: product.description?.trim() || null,
            category_id: resolvedCategory.id,
            category: resolvedCategory.name,
            sku: product.sku?.trim() || null,
            price: Number(product.price),
            compare_at_price: product.compare_at_price ? Number(product.compare_at_price) : null,
            stock: stockValue,
            hsn_code: product.hsn_code?.trim() || null,
            gst_rate: product.gst_rate ? Number(product.gst_rate) : null,
            weight: product.weight ? Number(product.weight) : null,
            dimensions: product.dimensions?.trim() || null,
            images: JSON.stringify(images),
            tags: JSON.stringify(tags),
            metadata: JSON.stringify({
              material: product.material?.trim() || null,
              brand: product.brand?.trim() || null,
              bulk_uploaded: true,
              upload_date: new Date().toISOString(),
            }),
            updated_at: new Date().toISOString(),
          };

          if (existingProduct) {
            // Update existing product
            await update('products', { id: existingProduct.id }, productData);
            results.updated++;
          } else {
            // Create new product — not visible until admin approves
            await insert('products', {
              ...productData,
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
        'sku': 'sku',
        'productsku': 'sku',
        'barcodeean': 'sku',
        'vendorproductid': 'sku',
        'price': 'price',
        'sellingprice': 'price',
        'sp': 'price',
        'mrp': 'compare_at_price',
        'compareatprice': 'compare_at_price',
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

        products.push(product);
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
        'name', 'description', 'category', 'sku', 'price', 'compare_at_price',
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
          p.price,
          p.compare_at_price,
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

/** Split images cell (string | string[]) into a deduped, trimmed list. */
function parseImageList(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((u) => String(u ?? '').trim()).filter(Boolean);
  }
  return String(raw)
    .split(/[,\n]/)
    .map((u) => u.trim())
    .filter(Boolean);
}

/** Lightweight URL sniff — accept http(s):// and data:image/*;base64 (manual flow). */
function isLikelyUrl(s: string): boolean {
  return /^https?:\/\/\S+/i.test(s) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(s);
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
