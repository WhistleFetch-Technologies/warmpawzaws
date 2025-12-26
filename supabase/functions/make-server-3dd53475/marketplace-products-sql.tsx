/**
 * MARKETPLACE PRODUCT MANAGEMENT - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Production-ready e-commerce product catalog
 * 
 * Features:
 * - Product CRUD with variants
 * - Categories (Toys, Accessories, Food, Furniture)
 * - Stock management
 * - S3 photo storage
 * - Shiprocket integration ready
 * - Multi-vendor support
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (16 KV operations → 0)
 * Endpoints: 8
 */

import { Hono } from "npm:hono";
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { generateId } from './database-schema.tsx';
import { createClient } from 'npm:@supabase/supabase-js@2';

export function registerMarketplaceProducts(app: Hono) {
  const BASE = '/make-server-3dd53475';
  const db = getDbClient();

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

  // =============================================
  // GET ALL PRODUCTS FOR VENDOR
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/marketplace-products`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`[MARKETPLACE] Fetching products for vendor: ${vendorId}`);

      // ✅ SQL: Get products for vendor
      const { data: products, error } = await db
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Refresh signed URLs
      const productsWithUrls = await Promise.all((products || []).map(async (product: any) => {
        const imageUrls = await Promise.all(
          ((product.images || []) as string[]).map(async (path: string) => {
            const { data } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(path, 3600);
            return data?.signedUrl || path;
          })
        );

        return {
          ...product,
          id: product.id,
          vendorId: product.vendor_id,
          name: product.name,
          description: product.description,
          category: product.category,
          subCategory: product.subcategory,
          brand: product.brand,
          price: parseFloat(product.price || 0),
          compareAtPrice: product.compare_at_price ? parseFloat(product.compare_at_price) : null,
          stock: product.stock || 0,
          sku: product.sku || '',
          images: product.images || [],
          imageUrls,
          tags: product.tags || [],
          isActive: product.is_active !== false,
          isFeatured: product.is_featured || false,
          views: product.views || 0,
          sales: product.sales || 0,
          revenue: product.revenue || 0,
          createdAt: product.created_at,
          updatedAt: product.updated_at
        };
      }));

      return c.json({
        success: true,
        products: productsWithUrls,
        totalProducts: productsWithUrls.length,
        lowStock: productsWithUrls.filter((p: any) => p.stock < 10).length
      });

    } catch (error) {
      console.error('[MARKETPLACE] Error:', error);
      return c.json({ error: 'Failed to fetch products' }, 500);
    }
  });

  // =============================================
  // CREATE PRODUCT
  // =============================================
  app.post(`${BASE}/vendor/:vendorId/marketplace-products`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();

      console.log(`[MARKETPLACE] Creating product for vendor: ${vendorId}`);

      if (!body.name || !body.category || !body.price) {
        return c.json({ 
          error: 'Product name, category, and price are required' 
        }, 400);
      }

      const productId = generateId('product');

      // ✅ SQL: Create product
      const { data: newProduct, error: insertError } = await db
        .from('products')
        .insert({
          id: productId,
          vendor_id: vendorId,
          name: body.name,
          description: body.description || '',
          category: body.category,
          subcategory: body.subCategory || '',
          brand: body.brand || '',
          price: parseFloat(body.price),
          compare_at_price: body.compareAtPrice ? parseFloat(body.compareAtPrice) : null,
          stock: body.hasVariants ? 0 : parseInt(body.stock || 0),
          sku: body.sku || '',
          images: body.images || [],
          tags: body.tags || [],
          weight: body.weight || null,
          dimensions: body.dimensions || null,
          is_active: body.isActive !== undefined ? body.isActive : true,
          is_featured: body.isFeatured || false,
          // Store variants in metadata JSONB if needed
          metadata: {
            hasVariants: body.hasVariants || false,
            variants: body.variants || [],
            petTypes: body.petTypes || ['dog', 'cat'],
            ageGroup: body.ageGroup || [],
            searchKeywords: body.searchKeywords || '',
            shippingRequired: body.shippingRequired !== undefined ? body.shippingRequired : true,
            freeShipping: body.freeShipping || false,
            shippingClass: body.shippingClass || 'standard',
            trackInventory: body.trackInventory !== undefined ? body.trackInventory : true,
            lowStockThreshold: body.lowStockThreshold || 10,
            discountPercent: body.discountPercent || 0,
            views: 0,
            sales: 0,
            revenue: 0
          }
        })
        .select()
        .single();

      if (insertError) {
        console.error('[MARKETPLACE] Insert error:', insertError);
        return c.json({ error: 'Failed to create product' }, 500);
      }

      console.log(`✅ [MARKETPLACE] Created product: ${productId}`);

      return c.json({
        success: true,
        product: {
          id: newProduct.id,
          vendorId: newProduct.vendor_id,
          name: newProduct.name,
          description: newProduct.description,
          category: newProduct.category,
          price: parseFloat(newProduct.price || 0),
          stock: newProduct.stock || 0,
          images: newProduct.images || [],
          tags: newProduct.tags || [],
          createdAt: newProduct.created_at,
          updatedAt: newProduct.updated_at
        },
        message: 'Product created successfully'
      });

    } catch (error) {
      console.error('[MARKETPLACE] Error:', error);
      return c.json({ error: 'Failed to create product' }, 500);
    }
  });

  // =============================================
  // UPDATE PRODUCT
  // =============================================
  app.put(`${BASE}/vendor/:vendorId/marketplace-products/:productId`, async (c) => {
    try {
      const { vendorId, productId } = c.req.param();
      const body = await c.req.json();

      // ✅ SQL: Get product
      const { data: existingProduct, error: fetchError } = await db
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('vendor_id', vendorId)
        .single();

      if (fetchError || !existingProduct) {
        return c.json({ error: 'Product not found' }, 404);
      }

      // ✅ SQL: Update product
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.category !== undefined) updateData.category = body.category;
      if (body.subCategory !== undefined) updateData.subcategory = body.subCategory;
      if (body.brand !== undefined) updateData.brand = body.brand;
      if (body.price !== undefined) updateData.price = parseFloat(body.price);
      if (body.compareAtPrice !== undefined) updateData.compare_at_price = body.compareAtPrice ? parseFloat(body.compareAtPrice) : null;
      if (body.stock !== undefined) updateData.stock = parseInt(body.stock);
      if (body.sku !== undefined) updateData.sku = body.sku;
      if (body.images !== undefined) updateData.images = body.images;
      if (body.tags !== undefined) updateData.tags = body.tags;
      if (body.isActive !== undefined) updateData.is_active = body.isActive;
      if (body.isFeatured !== undefined) updateData.is_featured = body.isFeatured;

      // Update metadata if provided
      if (body.variants !== undefined || body.petTypes !== undefined) {
        const metadata = (existingProduct.metadata as any) || {};
        if (body.variants !== undefined) metadata.variants = body.variants;
        if (body.petTypes !== undefined) metadata.petTypes = body.petTypes;
        updateData.metadata = metadata;
      }

      const { data: updatedProduct, error: updateError } = await db
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return c.json({
        success: true,
        product: updatedProduct,
        message: 'Product updated successfully'
      });

    } catch (error) {
      console.error('[MARKETPLACE] Error:', error);
      return c.json({ error: 'Failed to update product' }, 500);
    }
  });

  // =============================================
  // UPDATE STOCK
  // =============================================
  app.patch(`${BASE}/vendor/:vendorId/marketplace-products/:productId/stock`, async (c) => {
    try {
      const { vendorId, productId } = c.req.param();
      const { stock, variantId } = await c.req.json();

      // ✅ SQL: Get product
      const { data: product, error: fetchError } = await db
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('vendor_id', vendorId)
        .single();

      if (fetchError || !product) {
        return c.json({ error: 'Product not found' }, 404);
      }

      if (variantId) {
        // Update variant stock in metadata
        const metadata = (product.metadata as any) || {};
        const variants = metadata.variants || [];
        const variantIndex = variants.findIndex((v: any) => v.id === variantId);
        
        if (variantIndex !== -1) {
          variants[variantIndex].stock = parseInt(stock);
          metadata.variants = variants;
          
          await db
            .from('products')
            .update({
              metadata,
              updated_at: new Date().toISOString()
            })
            .eq('id', productId);
        }
      } else {
        // Update main product stock
        await db
          .from('products')
          .update({
            stock: parseInt(stock),
            updated_at: new Date().toISOString()
          })
          .eq('id', productId);
      }

      // Get updated product
      const { data: updatedProduct } = await db
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      return c.json({
        success: true,
        product: updatedProduct,
        message: 'Stock updated successfully'
      });

    } catch (error) {
      console.error('[MARKETPLACE] Error:', error);
      return c.json({ error: 'Failed to update stock' }, 500);
    }
  });

  // =============================================
  // DELETE PRODUCT
  // =============================================
  app.delete(`${BASE}/vendor/:vendorId/marketplace-products/:productId`, async (c) => {
    try {
      const { vendorId, productId } = c.req.param();

      // ✅ SQL: Get product
      const { data: product, error: fetchError } = await db
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('vendor_id', vendorId)
        .single();

      if (fetchError || !product) {
        return c.json({ error: 'Product not found' }, 404);
      }

      // Delete images
      for (const imagePath of (product.images || []) as string[]) {
        await supabase.storage.from(BUCKET_NAME).remove([imagePath]);
      }

      // ✅ SQL: Delete product
      const { error: deleteError } = await db
        .from('products')
        .delete()
        .eq('id', productId);

      if (deleteError) {
        throw deleteError;
      }

      return c.json({
        success: true,
        message: 'Product deleted successfully'
      });

    } catch (error) {
      console.error('[MARKETPLACE] Error:', error);
      return c.json({ error: 'Failed to delete product' }, 500);
    }
  });

  // =============================================
  // UPLOAD PRODUCT IMAGE
  // =============================================
  app.post(`${BASE}/vendor/:vendorId/marketplace-products/media/upload`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const productId = formData.get('productId') as string;

      if (!file) {
        return c.json({ error: 'No file provided' }, 400);
      }

      if (!file.type.startsWith('image/')) {
        return c.json({ error: 'Only images are allowed' }, 400);
      }

      if (file.size > 10485760) { // 10MB
        return c.json({ error: 'File size must be less than 10MB' }, 400);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${vendorId}/${productId || 'temp'}/${Date.now()}.${fileExt}`;

      const fileBuffer = await file.arrayBuffer();
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: false
        });

      if (error) {
        console.error('[MARKETPLACE] Upload error:', error);
        return c.json({ error: 'Failed to upload file' }, 500);
      }

      // ✅ SQL: Update product if productId provided
      if (productId) {
        const { data: product } = await db
          .from('products')
          .select('images')
          .eq('id', productId)
          .single();

        if (product) {
          const images = (product.images || []) as string[];
          images.push(fileName);

          await db
            .from('products')
            .update({
              images,
              updated_at: new Date().toISOString()
            })
            .eq('id', productId);
        }
      }

      const { data: urlData } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(fileName, 3600);

      return c.json({
        success: true,
        filePath: fileName,
        url: urlData?.signedUrl,
        message: 'Image uploaded successfully'
      });

    } catch (error) {
      console.error('[MARKETPLACE] Error:', error);
      return c.json({ error: 'Failed to upload image' }, 500);
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

      console.log(`[MARKETPLACE] Public browse - category: ${category}`);

      // ✅ SQL: Get all active products with vendor info
      let query = db
        .from('products')
        .select(`
          *,
          vendors!inner(id, business_name, address, rating)
        `)
        .eq('is_active', true);

      if (category) {
        query = query.eq('category', category);
      }

      if (minPrice) {
        query = query.gte('price', parseFloat(minPrice));
      }

      if (maxPrice) {
        query = query.lte('price', parseFloat(maxPrice));
      }

      const { data: products, error } = await query;

      if (error) {
        throw error;
      }

      // Apply additional filters in code
      let filtered = (products || []).map((p: any) => ({
        ...p,
        vendorName: p.vendors?.business_name,
        vendorLocation: p.vendors?.address,
        vendorRating: p.vendors?.rating || 0
      }));

      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter((p: any) => 
          p.name?.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower) ||
          (p.tags || []).some((tag: string) => tag.toLowerCase().includes(searchLower))
        );
      }

      if (petType) {
        filtered = filtered.filter((p: any) => {
          const metadata = p.metadata as any;
          const petTypes = metadata?.petTypes || [];
          return petTypes.includes(petType);
        });
      }

      // Refresh URLs
      const productsWithUrls = await Promise.all(filtered.map(async (product: any) => {
        const imageUrls = await Promise.all(
          ((product.images || []) as string[]).slice(0, 3).map(async (path: string) => {
            const { data } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(path, 3600);
            return data?.signedUrl || null;
          })
        );

        return {
          ...product,
          imageUrls: imageUrls.filter(Boolean)
        };
      }));

      return c.json({
        success: true,
        products: productsWithUrls,
        total: productsWithUrls.length,
        filters: {
          categories: [...new Set((products || []).map((p: any) => p.category))],
          priceRange: {
            min: Math.min(...(products || []).map((p: any) => parseFloat(p.price || 0))),
            max: Math.max(...(products || []).map((p: any) => parseFloat(p.price || 0)))
          }
        }
      });

    } catch (error) {
      console.error('[MARKETPLACE] Error:', error);
      return c.json({ error: 'Failed to fetch products' }, 500);
    }
  });

  // =============================================
  // INCREMENT PRODUCT VIEW
  // =============================================
  app.post(`${BASE}/public/marketplace-products/:productId/view`, async (c) => {
    try {
      const { productId } = c.req.param();

      // ✅ SQL: Get product
      const { data: product, error: fetchError } = await db
        .from('products')
        .select('metadata, views')
        .eq('id', productId)
        .single();

      if (fetchError || !product) {
        return c.json({ error: 'Product not found' }, 404);
      }

      // Increment views in metadata
      const metadata = (product.metadata as any) || {};
      const currentViews = metadata.views || product.views || 0;
      metadata.views = currentViews + 1;

      // ✅ SQL: Update product views
      await db
        .from('products')
        .update({
          metadata,
          views: currentViews + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      return c.json({
        success: true,
        views: currentViews + 1
      });

    } catch (error) {
      console.error('[MARKETPLACE] Error:', error);
      return c.json({ error: 'Failed to increment view' }, 500);
    }
  });

  console.log('✅ Marketplace products endpoints registered (SQL-only)');
}
