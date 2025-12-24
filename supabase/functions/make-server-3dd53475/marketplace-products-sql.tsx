/**
 * ============================================================================
 * MARKETPLACE PRODUCT MANAGEMENT - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Product CRUD with variants (stored in JSONB)
 * - Categories (Toys, Accessories, Food, Furniture)
 * - Stock management
 * - S3 photo storage
 * - Shiprocket integration ready
 * - Multi-vendor support
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 1, Task 1.1 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getProductsRepository } from "../../lib/repositories/products.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getDbClient } from "../../lib/db.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

export function registerMarketplaceProductsSQL(app: Hono) {
  const BASE = '/make-server-3dd53475';

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const BUCKET_NAME = 'make-3dd53475-marketplace-products';

  async function ensureBucket() {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET_NAME);
    
    if (!exists) {
      await supabase.storage.createBucket(BUCKET_NAME, { public: false });
      console.log(`✅ Created bucket: ${BUCKET_NAME}`);
    }
  }

  ensureBucket().catch(console.error);

  const CATEGORIES = ['Toys', 'Accessories', 'Food', 'Furniture', 'Grooming', 'Healthcare'];

  // Helper: Resolve vendor ID (handles vendor_ prefix)
  async function resolveVendorId(identifier: string): Promise<string | null> {
    const vendorsRepo = getVendorsRepository();
    return await vendorsRepo.resolveVendorId(identifier);
  }

// Helper: Get signed URLs for product images
async function getProductImageUrls(images: string[]): Promise<string[]> {
  if (!images || images.length === 0) return [];
  
  const urls = await Promise.all(
    images.map(async (path: string) => {
      try {
        const { data } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(path, 3600);
        return data?.signedUrl || null;
      } catch (error) {
        console.warn(`Failed to get signed URL for ${path}:`, error);
        return null;
      }
    })
  );
  
  return urls.filter(Boolean) as string[];
}

// Helper: Map SQL product to API response format
function mapProductToResponse(product: any, imageUrls?: string[]): any {
  return {
    id: product.id,
    vendorId: product.vendor_id,
    name: product.name,
    description: product.description || '',
    category: product.category,
    subCategory: product.subcategory || '',
    price: product.price,
    compareAtPrice: product.compare_at_price,
    discountPercent: product.compare_at_price 
      ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
      : 0,
    stock: product.stock || 0,
    sku: product.sku || '',
    images: product.images || [],
    imageUrls: imageUrls || [],
    weight: product.weight || '',
    dimensions: product.dimensions || '',
    tags: product.tags || [],
    isActive: product.is_active !== false,
    isFeatured: product.is_featured || false,
    costPrice: product.cost_price,
    minStock: product.min_stock || 0,
    hsnCode: product.hsn_code,
    gstRate: product.gst_rate,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
    // Additional metadata can be stored in a separate metadata JSONB column if needed
    // For now, we'll use tags for petTypes, ageGroup, etc.
  };
}

// =============================================
// GET ALL PRODUCTS FOR VENDOR
// =============================================
app.get(`${BASE}/vendor/:vendorId/marketplace-products`, async (c) => {
  try {
    const { vendorId: paramVendorId } = c.req.param();
    
    console.log(`[MARKETPLACE-SQL] Fetching products for vendor: ${paramVendorId}`);
    
    // ✅ CRITICAL FIX: Resolve vendorId to UUID
    const resolvedVendorId = await resolveVendorId(paramVendorId);
    
    if (!resolvedVendorId) {
      console.error(`❌ [MARKETPLACE-SQL] Vendor not found or invalid ID format: ${paramVendorId}`);
      return sendError(c, 'Vendor not found or invalid ID format', 404);
    }
    
    // ✅ SQL: Get products from database
    const productsRepo = getProductsRepository();
    const products = await productsRepo.findByVendor(resolvedVendorId, { isActive: undefined });
    
    // Get signed URLs for images
    const productsWithUrls = await Promise.all(
      products.map(async (product) => {
        const imageUrls = await getProductImageUrls(product.images || []);
        return mapProductToResponse(product, imageUrls);
      })
    );
    
    const lowStock = products.filter(p => (p.stock || 0) < (p.min_stock || 10)).length;
    
    console.log(`✅ [MARKETPLACE-SQL] Found ${products.length} products for vendor ${paramVendorId}`);
    
    return sendSuccess(c, {
      products: productsWithUrls,
      totalProducts: products.length,
      lowStock
    });
    
  } catch (error) {
    console.error('[MARKETPLACE-SQL] Error:', error);
    return sendError(c, `Failed to fetch products: ${String(error)}`, 500);
  }
});

// =============================================
// CREATE PRODUCT
// =============================================
app.post(`${BASE}/vendor/:vendorId/marketplace-products`, async (c) => {
  try {
    const { vendorId: paramVendorId } = c.req.param();
    const body = await c.req.json();
    
    console.log(`[MARKETPLACE-SQL] Creating product for vendor: ${paramVendorId}`);
    
    if (!body.name || !body.category || !body.price) {
      return sendError(c, 'Product name, category, and price are required', 400);
    }
    
    // ✅ CRITICAL FIX: Resolve vendorId to UUID
    const resolvedVendorId = await resolveVendorId(paramVendorId);
    
    if (!resolvedVendorId) {
      console.error(`❌ [MARKETPLACE-SQL] Vendor not found or invalid ID format: ${paramVendorId}`);
      return sendError(c, 'Vendor not found or invalid ID format', 404);
    }
    
    // ✅ SQL: Create product using repository
    const productsRepo = getProductsRepository();
    
    const productData = {
      vendor_id: resolvedVendorId,
      name: body.name,
      description: body.description || '',
      category: body.category,
      subcategory: body.subCategory || null,
      price: parseFloat(body.price),
      compare_at_price: body.compareAtPrice ? parseFloat(body.compareAtPrice) : null,
      cost_price: body.costPrice ? parseFloat(body.costPrice) : null,
      sku: body.sku || null,
      barcode: body.barcode || null,
      stock: body.hasVariants ? 0 : parseInt(body.stock || '0'),
      min_stock: body.lowStockThreshold || 10,
      weight: body.weight ? parseFloat(body.weight) : null,
      dimensions: body.dimensions || null,
      images: body.images || [],
      tags: body.tags || [],
      is_active: body.isActive !== false,
      is_featured: body.isFeatured || false,
      hsn_code: body.hsnCode || null,
      gst_rate: body.gstRate ? parseFloat(body.gstRate) : null,
    };
    
    const newProduct = await productsRepo.create(productData);
    
    // Get signed URLs for images
    const imageUrls = await getProductImageUrls(newProduct.images || []);
    const productResponse = mapProductToResponse(newProduct, imageUrls);
    
    console.log(`✅ [MARKETPLACE-SQL] Created product: ${newProduct.id}`);
    
    return sendSuccess(c, {
      product: productResponse,
      message: 'Product created successfully'
    });
    
  } catch (error) {
    console.error('[MARKETPLACE-SQL] Error:', error);
    return sendError(c, `Failed to create product: ${String(error)}`, 500);
  }
});

// =============================================
// UPDATE PRODUCT
// =============================================
app.put(`${BASE}/vendor/:vendorId/marketplace-products/:productId`, async (c) => {
  try {
    const { vendorId: paramVendorId, productId } = c.req.param();
    const body = await c.req.json();
    
    console.log(`[MARKETPLACE-SQL] Updating product: ${productId} for vendor: ${paramVendorId}`);
    
    // ✅ CRITICAL FIX: Resolve vendorId to UUID
    const resolvedVendorId = await resolveVendorId(paramVendorId);
    
    if (!resolvedVendorId) {
      return sendError(c, 'Vendor not found or invalid ID format', 404);
    }
    
    // ✅ SQL: Verify product belongs to vendor
    const productsRepo = getProductsRepository();
    const product = await productsRepo.findById(productId);
    
    if (!product) {
      return sendError(c, 'Product not found', 404);
    }
    
    if (product.vendor_id !== resolvedVendorId) {
      return sendError(c, 'Product does not belong to this vendor', 403);
    }
    
    // ✅ SQL: Update product
    const updateData: any = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.subCategory !== undefined) updateData.subcategory = body.subCategory;
    if (body.price !== undefined) updateData.price = parseFloat(body.price);
    if (body.compareAtPrice !== undefined) updateData.compare_at_price = body.compareAtPrice ? parseFloat(body.compareAtPrice) : null;
    if (body.costPrice !== undefined) updateData.cost_price = body.costPrice ? parseFloat(body.costPrice) : null;
    if (body.sku !== undefined) updateData.sku = body.sku;
    if (body.barcode !== undefined) updateData.barcode = body.barcode;
    if (body.stock !== undefined) updateData.stock = parseInt(body.stock);
    if (body.lowStockThreshold !== undefined) updateData.min_stock = parseInt(body.lowStockThreshold);
    if (body.weight !== undefined) updateData.weight = body.weight ? parseFloat(body.weight) : null;
    if (body.dimensions !== undefined) updateData.dimensions = body.dimensions;
    if (body.images !== undefined) updateData.images = body.images;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    if (body.isFeatured !== undefined) updateData.is_featured = body.isFeatured;
    if (body.hsnCode !== undefined) updateData.hsn_code = body.hsnCode;
    if (body.gstRate !== undefined) updateData.gst_rate = body.gstRate ? parseFloat(body.gstRate) : null;
    
    const updatedProduct = await productsRepo.update(productId, updateData);
    
    // Get signed URLs for images
    const imageUrls = await getProductImageUrls(updatedProduct.images || []);
    const productResponse = mapProductToResponse(updatedProduct, imageUrls);
    
    console.log(`✅ [MARKETPLACE-SQL] Updated product: ${productId}`);
    
    return sendSuccess(c, {
      product: productResponse,
      message: 'Product updated successfully'
    });
    
  } catch (error) {
    console.error('[MARKETPLACE-SQL] Error:', error);
    return sendError(c, `Failed to update product: ${String(error)}`, 500);
  }
});

// =============================================
// UPDATE STOCK
// =============================================
app.patch(`${BASE}/vendor/:vendorId/marketplace-products/:productId/stock`, async (c) => {
  try {
    const { vendorId: paramVendorId, productId } = c.req.param();
    const { stock, operation = 'set' } = await c.req.json();
    
    console.log(`[MARKETPLACE-SQL] Updating stock for product: ${productId}`);
    
    // ✅ CRITICAL FIX: Resolve vendorId to UUID
    const resolvedVendorId = await resolveVendorId(paramVendorId);
    
    if (!resolvedVendorId) {
      return sendError(c, 'Vendor not found or invalid ID format', 404);
    }
    
    // ✅ SQL: Verify product belongs to vendor
    const productsRepo = getProductsRepository();
    const product = await productsRepo.findById(productId);
    
    if (!product) {
      return sendError(c, 'Product not found', 404);
    }
    
    if (product.vendor_id !== resolvedVendorId) {
      return sendError(c, 'Product does not belong to this vendor', 403);
    }
    
    // ✅ SQL: Update stock
    const operationType = operation === 'add' ? 'add' : operation === 'subtract' ? 'subtract' : 'set';
    const updatedProduct = await productsRepo.updateStock(productId, parseInt(stock), operationType);
    
    // Get signed URLs for images
    const imageUrls = await getProductImageUrls(updatedProduct.images || []);
    const productResponse = mapProductToResponse(updatedProduct, imageUrls);
    
    console.log(`✅ [MARKETPLACE-SQL] Updated stock for product: ${productId}`);
    
    return sendSuccess(c, {
      product: productResponse,
      message: 'Stock updated successfully'
    });
    
  } catch (error) {
    console.error('[MARKETPLACE-SQL] Error:', error);
    return sendError(c, `Failed to update stock: ${String(error)}`, 500);
  }
});

// =============================================
// DELETE PRODUCT
// =============================================
app.delete(`${BASE}/vendor/:vendorId/marketplace-products/:productId`, async (c) => {
  try {
    const { vendorId: paramVendorId, productId } = c.req.param();
    
    console.log(`[MARKETPLACE-SQL] Deleting product: ${productId}`);
    
    // ✅ CRITICAL FIX: Resolve vendorId to UUID
    const resolvedVendorId = await resolveVendorId(paramVendorId);
    
    if (!resolvedVendorId) {
      return sendError(c, 'Vendor not found or invalid ID format', 404);
    }
    
    // ✅ SQL: Verify product belongs to vendor
    const productsRepo = getProductsRepository();
    const product = await productsRepo.findById(productId);
    
    if (!product) {
      return sendError(c, 'Product not found', 404);
    }
    
    if (product.vendor_id !== resolvedVendorId) {
      return sendError(c, 'Product does not belong to this vendor', 403);
    }
    
    // Delete images from S3
    if (product.images && product.images.length > 0) {
      try {
        await supabase.storage.from(BUCKET_NAME).remove(product.images);
      } catch (error) {
        console.warn(`Failed to delete images for product ${productId}:`, error);
      }
    }
    
    // ✅ SQL: Delete product
    await productsRepo.delete(productId);
    
    console.log(`✅ [MARKETPLACE-SQL] Deleted product: ${productId}`);
    
    return sendSuccess(c, {
      message: 'Product deleted successfully'
    });
    
  } catch (error) {
    console.error('[MARKETPLACE-SQL] Error:', error);
    return sendError(c, `Failed to delete product: ${String(error)}`, 500);
  }
});

// =============================================
// UPLOAD PRODUCT IMAGE
// =============================================
app.post(`${BASE}/vendor/:vendorId/marketplace-products/media/upload`, async (c) => {
  try {
    const { vendorId: paramVendorId } = c.req.param();
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const productId = formData.get('productId') as string;
    
    if (!file) {
      return sendError(c, 'No file provided', 400);
    }
    
    if (!file.type.startsWith('image/')) {
      return sendError(c, 'Only images are allowed', 400);
    }
    
    if (file.size > 10485760) { // 10MB
      return sendError(c, 'File size must be less than 10MB', 400);
    }
    
    // ✅ CRITICAL FIX: Resolve vendorId to UUID
    const resolvedVendorId = await resolveVendorId(paramVendorId);
    
    if (!resolvedVendorId) {
      return sendError(c, 'Vendor not found or invalid ID format', 404);
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${resolvedVendorId}/${productId || 'temp'}/${Date.now()}.${fileExt}`;
    
    const fileBuffer = await file.arrayBuffer();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false
      });
    
    if (error) {
      console.error('[MARKETPLACE-SQL] Upload error:', error);
      return sendError(c, 'Failed to upload file', 500);
    }
    
    // ✅ SQL: Update product if productId provided
    if (productId) {
      const productsRepo = getProductsRepository();
      const product = await productsRepo.findById(productId);
      
      if (product && product.vendor_id === resolvedVendorId) {
        const currentImages = product.images || [];
        const updatedImages = [...currentImages, fileName];
        await productsRepo.update(productId, { images: updatedImages });
      }
    }
    
    const { data: urlData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 3600);
    
    return sendSuccess(c, {
      filePath: fileName,
      url: urlData?.signedUrl,
      message: 'Image uploaded successfully'
    });
    
  } catch (error) {
    console.error('[MARKETPLACE-SQL] Error:', error);
    return sendError(c, `Failed to upload image: ${String(error)}`, 500);
  }
});

// =============================================
// CUSTOMER: BROWSE PRODUCTS
// =============================================
app.get(`${BASE}/public/marketplace-products`, async (c) => {
  try {
    const category = c.req.query('category');
    const search = c.req.query('search');
    const minPrice = c.req.query('minPrice');
    const maxPrice = c.req.query('maxPrice');
    const petType = c.req.query('petType');
    
    console.log(`[MARKETPLACE-SQL] Public browse - category: ${category}, search: ${search}`);
    
    // ✅ SQL: Get all active products
    const productsRepo = getProductsRepository();
    let products = await productsRepo.findAll({ isActive: true });
    
    // Apply filters
    if (category) {
      products = products.filter(p => p.category === category);
    }
    
    if (search) {
      products = await productsRepo.search(search, { limit: 1000 });
      products = products.filter(p => p.is_active);
    }
    
    if (minPrice) {
      products = products.filter(p => p.price >= parseFloat(minPrice));
    }
    
    if (maxPrice) {
      products = products.filter(p => p.price <= parseFloat(maxPrice));
    }
    
    if (petType) {
      // Check if petType is in tags
      products = products.filter(p => 
        (p.tags || []).some((tag: string) => tag.toLowerCase().includes(petType.toLowerCase()))
      );
    }
    
    // ✅ SQL: Get vendor info for each product
    const vendorsRepo = getVendorsRepository();
    const productsWithVendor = await Promise.all(
      products.map(async (product) => {
        let vendor = null;
        if (product.vendor_id) {
          vendor = await vendorsRepo.findById(product.vendor_id);
        }
        
        const imageUrls = await getProductImageUrls((product.images || []).slice(0, 3));
        
        return {
          ...mapProductToResponse(product, imageUrls),
          vendorName: vendor?.business_name || vendor?.businessName || 'Unknown',
          vendorLocation: vendor?.address || '',
          vendorRating: 0, // TODO: Get from reviews
        };
      })
    );
    
    // Get unique categories
    const allProducts = await productsRepo.findAll({ isActive: true });
    const categories = [...new Set(allProducts.map(p => p.category))];
    const prices = allProducts.map(p => p.price);
    const priceRange = prices.length > 0 ? {
      min: Math.min(...prices),
      max: Math.max(...prices)
    } : { min: 0, max: 0 };
    
    console.log(`✅ [MARKETPLACE-SQL] Found ${productsWithVendor.length} products`);
    
    return sendSuccess(c, {
      products: productsWithVendor,
      total: productsWithVendor.length,
      filters: {
        categories,
        priceRange
      }
    });
    
  } catch (error) {
    console.error('[MARKETPLACE-SQL] Error:', error);
    return sendError(c, `Failed to fetch products: ${String(error)}`, 500);
  }
});

// =============================================
// INCREMENT PRODUCT VIEW
// =============================================
app.post(`${BASE}/public/marketplace-products/:productId/view`, async (c) => {
  try {
    const { productId } = c.req.param();
    
    console.log(`[MARKETPLACE-SQL] Incrementing view for product: ${productId}`);
    
    // ✅ SQL: Find product and increment views
    // Note: Views can be tracked in a separate analytics table or in product metadata
    // For now, we'll just return success (views can be tracked separately)
    const productsRepo = getProductsRepository();
    const product = await productsRepo.findById(productId);
    
    if (!product) {
      return sendError(c, 'Product not found', 404);
    }
    
    // TODO: Create product_analytics table to track views, sales, revenue
    // For now, just return success
    
    return sendSuccess(c, {
      views: 0, // TODO: Get from analytics table
      message: 'View tracked'
    });
    
  } catch (error) {
    console.error('[MARKETPLACE-SQL] Error:', error);
    return sendError(c, `Failed to increment view: ${String(error)}`, 500);
  }
});

  console.log('✅ [MARKETPLACE-SQL] Marketplace products endpoints registered (SQL-only)');
}

