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

interface BulkProductRow {
  name: string;
  description?: string;
  category?: string;
  sku?: string;
  price: number;
  compare_at_price?: number;
  stock_quantity: number;
  hsn_code?: string;
  gst_rate?: number;
  weight?: number;
  dimensions?: string;
  material?: string;
  brand?: string;
  tags?: string;
  images?: string;
  is_active?: boolean;
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
    const vendorId = c.req.param('vendorId');
    
    // CSV template header
    const headers = [
      'name*',
      'description',
      'category',
      'sku',
      'price*',
      'compare_at_price',
      'stock_quantity*',
      'hsn_code',
      'gst_rate',
      'weight_kg',
      'dimensions',
      'material',
      'brand',
      'tags',
      'image_urls',
      'is_active'
    ];

    const sampleRows = [
      [
        'Premium Dog Food',
        'High-quality grain-free dog food with real chicken',
        'Pet Food',
        'SKU-001',
        '599',
        '699',
        '100',
        '2309',
        '18',
        '2.5',
        '30x20x10',
        'Chicken, Rice',
        'WarmPawz',
        'dog,food,premium',
        'https://example.com/image1.jpg',
        'true'
      ],
      [
        'Cat Scratching Post',
        'Durable sisal rope scratching post for cats',
        'Pet Accessories',
        'SKU-002',
        '1299',
        '1499',
        '50',
        '9403',
        '18',
        '3.0',
        '40x40x60',
        'Sisal, Wood',
        'WarmPawz',
        'cat,scratching,furniture',
        'https://example.com/image2.jpg',
        'true'
      ]
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return c.text(csvContent, 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="product_upload_template.csv"'
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
      const validCategories = new Set(categories.map((c: any) => c.name?.toLowerCase()));

      products.forEach((product: any, index: number) => {
        const rowNum = index + 1;
        const rowErrors: ValidationError[] = [];

        // Required field validations
        if (!product.name || typeof product.name !== 'string' || product.name.trim().length === 0) {
          rowErrors.push({ row: rowNum, field: 'name', message: 'Name is required', value: product.name });
        } else if (product.name.length > 255) {
          rowErrors.push({ row: rowNum, field: 'name', message: 'Name must be less than 255 characters', value: product.name.length });
        }

        if (product.price === undefined || product.price === null || isNaN(Number(product.price))) {
          rowErrors.push({ row: rowNum, field: 'price', message: 'Valid price is required', value: product.price });
        } else if (Number(product.price) < 0) {
          rowErrors.push({ row: rowNum, field: 'price', message: 'Price cannot be negative', value: product.price });
        }

        if (product.stock_quantity === undefined || isNaN(Number(product.stock_quantity))) {
          rowErrors.push({ row: rowNum, field: 'stock_quantity', message: 'Stock quantity is required', value: product.stock_quantity });
        } else if (Number(product.stock_quantity) < 0) {
          rowErrors.push({ row: rowNum, field: 'stock_quantity', message: 'Stock cannot be negative', value: product.stock_quantity });
        }

        // Optional field validations
        if (product.sku) {
          if (existingSkus.has(product.sku.toLowerCase())) {
            rowErrors.push({ row: rowNum, field: 'sku', message: 'SKU already exists', value: product.sku });
          }
        }

        if (product.compare_at_price !== undefined && product.compare_at_price !== null) {
          if (isNaN(Number(product.compare_at_price))) {
            rowErrors.push({ row: rowNum, field: 'compare_at_price', message: 'Invalid compare at price', value: product.compare_at_price });
          } else if (Number(product.compare_at_price) < Number(product.price)) {
            rowErrors.push({ row: rowNum, field: 'compare_at_price', message: 'Compare at price should be greater than price', value: product.compare_at_price });
          }
        }

        if (product.gst_rate !== undefined && product.gst_rate !== null) {
          const rate = Number(product.gst_rate);
          if (isNaN(rate) || ![0, 5, 12, 18, 28].includes(rate)) {
            rowErrors.push({ row: rowNum, field: 'gst_rate', message: 'GST rate must be 0, 5, 12, 18, or 28', value: product.gst_rate });
          }
        }

        if (product.weight !== undefined && product.weight !== null) {
          if (isNaN(Number(product.weight)) || Number(product.weight) < 0) {
            rowErrors.push({ row: rowNum, field: 'weight', message: 'Invalid weight', value: product.weight });
          }
        }

        if (rowErrors.length === 0) {
          validProducts.push({
            name: product.name.trim(),
            description: product.description?.trim() || null,
            category: product.category?.trim() || null,
            sku: product.sku?.trim() || null,
            price: Number(product.price),
            compare_at_price: product.compare_at_price ? Number(product.compare_at_price) : null,
            stock_quantity: Number(product.stock_quantity),
            hsn_code: product.hsn_code?.trim() || null,
            gst_rate: product.gst_rate ? Number(product.gst_rate) : null,
            weight: product.weight ? Number(product.weight) : null,
            dimensions: product.dimensions?.trim() || null,
            material: product.material?.trim() || null,
            brand: product.brand?.trim() || null,
            tags: product.tags?.trim() || null,
            images: product.images || product.image_urls || null,
            is_active: product.is_active !== false,
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

      // Process each product
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const rowNum = i + 1;

        try {
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

          const productData = {
            vendor_id: vendorId,
            name: product.name?.trim(),
            description: product.description?.trim() || null,
            category: product.category?.trim() || null,
            sku: product.sku?.trim() || null,
            price: Number(product.price),
            compare_at_price: product.compare_at_price ? Number(product.compare_at_price) : null,
            stock_quantity: Number(product.stock_quantity) || 0,
            stock: Number(product.stock_quantity) || 0,
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
            is_active: product.is_active !== false,
            updated_at: new Date().toISOString(),
          };

          if (existingProduct) {
            // Update existing product
            await update('products', { id: existingProduct.id }, productData);
            results.updated++;
          } else {
            // Create new product
            await insert('products', {
              ...productData,
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
      const vendorId = c.req.param('vendorId');
      const body = await c.req.json();
      const { csvContent, format = 'csv' } = body;

      if (!csvContent) {
        return c.json({ success: false, error: 'No file content provided' }, 400);
      }

      // Parse CSV content
      const lines = csvContent.split('\n').filter((line: string) => line.trim());
      if (lines.length < 2) {
        return c.json({ success: false, error: 'File must contain header row and at least one data row' }, 400);
      }

      // Parse header
      const headerLine = lines[0];
      const headers = parseCSVLine(headerLine).map((h: string) => 
        h.toLowerCase().replace(/[*\s]/g, '').replace(/_/g, '')
      );

      // Map headers to standard field names
      const fieldMap: Record<string, string> = {
        'name': 'name',
        'productname': 'name',
        'title': 'name',
        'description': 'description',
        'desc': 'description',
        'category': 'category',
        'categoryname': 'category',
        'sku': 'sku',
        'productsku': 'sku',
        'price': 'price',
        'sellingprice': 'price',
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
        'brand': 'brand',
        'brandname': 'brand',
        'tags': 'tags',
        'keywords': 'tags',
        'images': 'images',
        'imageurls': 'images',
        'image': 'images',
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
          let value = values[index]?.trim() || '';
          
          // Convert boolean strings
          if (header === 'is_active') {
            value = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
          }
          // Convert numbers
          else if (['price', 'compare_at_price', 'stock_quantity', 'gst_rate', 'weight'].includes(header)) {
            value = value ? parseFloat(value) : null;
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

function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
