// ✅ S3 MIGRATION: Supabase Storage replaced with AWS S3
import { Hono } from "hono";
import * as kv from './kv_store';
import { generateId } from './database-schema';
import { getS3Helper, uploadToS3 } from '../../../supabase/lib/storage/s3-helper';

/**
 * MARKETPLACE PRODUCT MANAGEMENT
 * Production-ready e-commerce product catalog
 * 
 * Features:
 * - Product CRUD with variants
 * - Categories (Toys, Accessories, Food, Furniture)
 * - Stock management
 * - S3 photo storage
 * - Shiprocket integration ready
 * - Multi-vendor support
 */

export function registerMarketplaceProducts(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // S3 bucket is configured via PlatformSettingsRepository

  const CATEGORIES = ['Toys', 'Accessories', 'Food', 'Furniture', 'Grooming', 'Healthcare'];

  // =============================================
  // GET ALL PRODUCTS FOR VENDOR
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/marketplace-products`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`[MARKETPLACE] Fetching products for vendor: ${vendorId}`);

      const products = await kv.get(`vendor:${vendorId}:marketplace_products`) || [];

      // ✅ S3: Refresh signed URLs
      const s3 = getS3Helper();
      const productsWithUrls = await Promise.all(products.map(async (product: any) => {
        const imageUrls = await Promise.all(
          (product.images || []).map(async (path: string) => {
            try {
              const signedUrl = await s3.getSignedUrl(path, 3600);
              return signedUrl;
            } catch (err) {
              console.warn('Warning: Could not get signed URL for', path);
              return path;
            }
          })
        );

        return { ...product, imageUrls };
      }));

      return c.json({
        success: true,
        products: productsWithUrls,
        totalProducts: products.length,
        lowStock: products.filter((p: any) => p.stock < 10).length
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

      const products = await kv.get(`vendor:${vendorId}:marketplace_products`) || [];

      const productId = generateId('product');
      const newProduct = {
        id: productId,
        vendorId,
        
        // Basic Info
        name: body.name,
        description: body.description || '',
        category: body.category,
        subCategory: body.subCategory || '',
        brand: body.brand || '',
        
        // Pricing
        price: parseFloat(body.price),
        compareAtPrice: body.compareAtPrice ? parseFloat(body.compareAtPrice) : null,
        discountPercent: body.discountPercent || 0,
        
        // Variants (e.g., Size, Color)
        hasVariants: body.hasVariants || false,
        variants: body.variants || [],
        /* Example variants:
        [
          { 
            id: 'var_1', 
            name: 'Small - Red', 
            sku: 'TOY-SM-RED',
            price: 299,
            stock: 50,
            attributes: { size: 'Small', color: 'Red' }
          }
        ]
        */
        
        // Stock Management
        stock: body.hasVariants ? 0 : parseInt(body.stock || 0),
        sku: body.sku || '',
        trackInventory: body.trackInventory !== undefined ? body.trackInventory : true,
        lowStockThreshold: body.lowStockThreshold || 10,
        
        // Media
        images: body.images || [],
        
        // Product Details
        weight: body.weight || '', // for shipping
        dimensions: body.dimensions || '', // L x W x H
        
        // Pet Specifications
        petTypes: body.petTypes || ['dog', 'cat'],
        ageGroup: body.ageGroup || [], // ['puppy', 'adult', 'senior']
        
        // SEO & Tags
        tags: body.tags || [],
        searchKeywords: body.searchKeywords || '',
        
        // Shipping
        shippingRequired: body.shippingRequired !== undefined ? body.shippingRequired : true,
        freeShipping: body.freeShipping || false,
        shippingClass: body.shippingClass || 'standard', // standard, express
        
        // Status
        isActive: body.isActive !== undefined ? body.isActive : true,
        isFeatured: body.isFeatured || false,
        
        // Analytics
        views: 0,
        sales: 0,
        revenue: 0,
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      products.push(newProduct);
      await kv.set(`vendor:${vendorId}:marketplace_products`, products);

      console.log(`✅ [MARKETPLACE] Created product: ${productId}`);

      return c.json({
        success: true,
        product: newProduct,
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

      const products = await kv.get(`vendor:${vendorId}:marketplace_products`) || [];
      const index = products.findIndex((p: any) => p.id === productId);

      if (index === -1) {
        return c.json({ error: 'Product not found' }, 404);
      }

      products[index] = {
        ...products[index],
        ...body,
        id: productId,
        vendorId,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`vendor:${vendorId}:marketplace_products`, products);

      return c.json({
        success: true,
        product: products[index],
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

      const products = await kv.get(`vendor:${vendorId}:marketplace_products`) || [];
      const index = products.findIndex((p: any) => p.id === productId);

      if (index === -1) {
        return c.json({ error: 'Product not found' }, 404);
      }

      if (variantId) {
        // Update variant stock
        const variantIndex = products[index].variants.findIndex((v: any) => v.id === variantId);
        if (variantIndex !== -1) {
          products[index].variants[variantIndex].stock = parseInt(stock);
        }
      } else {
        // Update main product stock
        products[index].stock = parseInt(stock);
      }

      products[index].updatedAt = new Date().toISOString();
      await kv.set(`vendor:${vendorId}:marketplace_products`, products);

      return c.json({
        success: true,
        product: products[index],
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

      const products = await kv.get(`vendor:${vendorId}:marketplace_products`) || [];
      const product = products.find((p: any) => p.id === productId);

      if (!product) {
        return c.json({ error: 'Product not found' }, 404);
      }

      // ✅ S3: Delete images
      const s3 = getS3Helper();
      for (const imagePath of product.images || []) {
        try {
          await s3.deleteFile(imagePath);
        } catch (err) {
          console.warn('Warning: Could not delete image', imagePath);
        }
      }

      const filtered = products.filter((p: any) => p.id !== productId);
      await kv.set(`vendor:${vendorId}:marketplace_products`, filtered);

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

      const fileExt = file.name.split('.').pop() || 'jpg';
      const s3Key = `marketplace/${vendorId}/${productId || 'temp'}/${Date.now()}.${fileExt}`;

      // ✅ S3: Upload to S3
      const s3 = getS3Helper();
      const uploadResult = await uploadToS3(
        file,
        `marketplace/${vendorId}/${productId || 'temp'}`,
        `${Date.now()}.${fileExt}`,
        {
          contentType: file.type,
          acl: 'private',
        }
      );

      // Update product if productId provided
      if (productId) {
        const products = await kv.get(`vendor:${vendorId}:marketplace_products`) || [];
        const index = products.findIndex((p: any) => p.id === productId);

        if (index !== -1) {
          products[index].images = [...(products[index].images || []), s3Key];
          products[index].updatedAt = new Date().toISOString();
          await kv.set(`vendor:${vendorId}:marketplace_products`, products);
        }
      }

      return c.json({
        success: true,
        filePath: s3Key,
        key: s3Key,
        url: uploadResult.signedUrl || uploadResult.url,
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

      // Get all vendors
      const allVendors = await kv.getByPrefix('vendor:');
      let allProducts: any[] = [];

      for (const vendor of allVendors) {
        const products = await kv.get(`vendor:${vendor.id}:marketplace_products`) || [];
        const activeProducts = products.filter((p: any) => p.isActive);
        
        allProducts = [
          ...allProducts,
          ...activeProducts.map((p: any) => ({
            ...p,
            vendorName: vendor.businessName,
            vendorLocation: vendor.address,
            vendorRating: vendor.rating || 0
          }))
        ];
      }

      // Apply filters
      let filtered = allProducts;

      if (category) {
        filtered = filtered.filter(p => p.category === category);
      }

      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower) ||
          p.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower))
        );
      }

      if (minPrice) {
        filtered = filtered.filter(p => p.price >= parseFloat(minPrice));
      }

      if (maxPrice) {
        filtered = filtered.filter(p => p.price <= parseFloat(maxPrice));
      }

      if (petType) {
        filtered = filtered.filter(p => p.petTypes.includes(petType));
      }

      // ✅ S3: Refresh URLs
      const s3 = getS3Helper();
      const productsWithUrls = await Promise.all(filtered.map(async (product: any) => {
        const imageUrls = await Promise.all(
          (product.images || []).slice(0, 3).map(async (path: string) => {
            try {
              const signedUrl = await s3.getSignedUrl(path, 3600);
              return signedUrl;
            } catch (err) {
              return null;
            }
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
          categories: [...new Set(allProducts.map(p => p.category))],
          priceRange: {
            min: Math.min(...allProducts.map(p => p.price)),
            max: Math.max(...allProducts.map(p => p.price))
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

      // Find product across all vendors
      const allVendors = await kv.getByPrefix('vendor:');
      
      for (const vendor of allVendors) {
        const products = await kv.get(`vendor:${vendor.id}:marketplace_products`) || [];
        const index = products.findIndex((p: any) => p.id === productId);

        if (index !== -1) {
          products[index].views = (products[index].views || 0) + 1;
          await kv.set(`vendor:${vendor.id}:marketplace_products`, products);
          
          return c.json({
            success: true,
            views: products[index].views
          });
        }
      }

      return c.json({ error: 'Product not found' }, 404);

    } catch (error) {
      console.error('[MARKETPLACE] Error:', error);
      return c.json({ error: 'Failed to increment view' }, 500);
    }
  });
}
