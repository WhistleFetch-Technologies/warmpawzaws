import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';
import { generateId } from './database-schema.tsx';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * NUTRITIONIST MEAL MANAGEMENT
 * Production-ready endpoints for custom meal products
 * 
 * Features:
 * - Meal product CRUD
 * - Ingredients & nutritional info
 * - Preparation & feeding guidelines
 * - Lead time & delivery windows
 * - Order management
 * - Logistics integration
 */

export function registerNutritionistMealManagement(app: Hono) {
  const BASE = '/make-server-3dd53475';

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const BUCKET_NAME = 'make-3dd53475-meal-products';
  
  async function ensureBucket() {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET_NAME);
    
    if (!exists) {
      await supabase.storage.createBucket(BUCKET_NAME, { public: false });
      console.log(`✅ Created bucket: ${BUCKET_NAME}`);
    }
  }

  ensureBucket().catch(console.error);

  // =============================================
  // GET ALL MEAL PRODUCTS FOR VENDOR
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/meal-products`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`[MEALS] Fetching products for vendor: ${vendorId}`);

      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const products = await kv.get(`vendor:${vendorId}:meal_products`) || [];

      // Refresh signed URLs for images
      const productsWithUrls = await Promise.all(products.map(async (product: any) => {
        const imageUrls = await Promise.all(
          (product.images || []).map(async (path: string) => {
            const { data } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(path, 3600);
            return data?.signedUrl || path;
          })
        );

        return { ...product, imageUrls };
      }));

      return c.json({
        success: true,
        products: productsWithUrls,
        totalProducts: products.length,
        vendor: {
          id: vendor.id,
          businessName: vendor.businessName
        }
      });

    } catch (error) {
      console.error('[MEALS] Error:', error);
      return c.json({ error: 'Failed to fetch meal products' }, 500);
    }
  });

  // =============================================
  // CREATE MEAL PRODUCT
  // =============================================
  app.post(`${BASE}/vendor/:vendorId/meal-products`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();

      console.log(`[MEALS] Creating product for vendor: ${vendorId}`);

      // Validation
      if (!body.name || !body.ingredients || !body.price) {
        return c.json({ 
          error: 'Meal name, ingredients, and price are required' 
        }, 400);
      }

      const products = await kv.get(`vendor:${vendorId}:meal_products`) || [];

      const productId = generateId('meal');
      const newProduct = {
        id: productId,
        vendorId,
        
        // Basic info
        name: body.name,
        description: body.description || '',
        category: body.category || 'fresh_meal', // 'fresh_meal', 'frozen_meal', 'treats'
        
        // Ingredients & Nutrition
        ingredients: body.ingredients, // array of strings
        nutritionalValue: body.nutritionalValue || {
          protein: '',
          fat: '',
          fiber: '',
          moisture: '',
          calories: ''
        },
        
        // Preparation
        preparationMethod: body.preparationMethod || '',
        preparationLeadTime: body.preparationLeadTime || 60, // minutes
        
        // Feeding Guidelines
        feedingGuidelines: body.feedingGuidelines || [],
        // Example: [{ weightRange: '5-10kg', portionSize: '150g', frequency: '2x daily' }]
        
        // Storage
        storageInstructions: body.storageInstructions || '',
        shelfLife: body.shelfLife || '', // e.g., "24 hours refrigerated"
        
        // Delivery
        deliveryTimeWindows: body.deliveryTimeWindows || [
          '9:00 AM - 12:00 PM',
          '12:00 PM - 3:00 PM',
          '3:00 PM - 6:00 PM',
          '6:00 PM - 9:00 PM'
        ],
        minOrderLeadTime: body.minOrderLeadTime || 120, // minutes before delivery
        
        // Pricing
        price: parseFloat(body.price),
        packSize: body.packSize || '', // e.g., "500g", "1kg"
        unit: body.unit || 'pack',
        
        // Media
        images: body.images || [],
        
        // Pet specifications
        suitableFor: body.suitableFor || [], // ['puppy', 'adult', 'senior']
        petTypes: body.petTypes || ['dog', 'cat'],
        dietType: body.dietType || '', // 'veg', 'non-veg', 'egg'
        
        // Allergen info
        allergens: body.allergens || [],
        warnings: body.warnings || '',
        
        // Availability
        isActive: body.isActive !== undefined ? body.isActive : true,
        maxDailyOrders: body.maxDailyOrders || 50,
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      products.push(newProduct);
      await kv.set(`vendor:${vendorId}:meal_products`, products);

      console.log(`✅ [MEALS] Created product: ${productId}`);

      return c.json({
        success: true,
        product: newProduct,
        message: 'Meal product created successfully'
      });

    } catch (error) {
      console.error('[MEALS] Error:', error);
      return c.json({ error: 'Failed to create meal product' }, 500);
    }
  });

  // =============================================
  // UPDATE MEAL PRODUCT
  // =============================================
  app.put(`${BASE}/vendor/:vendorId/meal-products/:productId`, async (c) => {
    try {
      const { vendorId, productId } = c.req.param();
      const body = await c.req.json();

      console.log(`[MEALS] Updating product: ${productId}`);

      const products = await kv.get(`vendor:${vendorId}:meal_products`) || [];
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

      await kv.set(`vendor:${vendorId}:meal_products`, products);

      console.log(`✅ [MEALS] Updated product: ${productId}`);

      return c.json({
        success: true,
        product: products[index],
        message: 'Product updated successfully'
      });

    } catch (error) {
      console.error('[MEALS] Error:', error);
      return c.json({ error: 'Failed to update product' }, 500);
    }
  });

  // =============================================
  // DELETE MEAL PRODUCT
  // =============================================
  app.delete(`${BASE}/vendor/:vendorId/meal-products/:productId`, async (c) => {
    try {
      const { vendorId, productId } = c.req.param();

      const products = await kv.get(`vendor:${vendorId}:meal_products`) || [];
      const product = products.find((p: any) => p.id === productId);

      if (!product) {
        return c.json({ error: 'Product not found' }, 404);
      }

      // Delete images
      for (const imagePath of product.images || []) {
        await supabase.storage.from(BUCKET_NAME).remove([imagePath]);
      }

      const filtered = products.filter((p: any) => p.id !== productId);
      await kv.set(`vendor:${vendorId}:meal_products`, filtered);

      return c.json({
        success: true,
        message: 'Product deleted successfully'
      });

    } catch (error) {
      console.error('[MEALS] Error:', error);
      return c.json({ error: 'Failed to delete product' }, 500);
    }
  });

  // =============================================
  // GET MEAL ORDERS FOR VENDOR
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/meal-orders`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status'); // pending, preparing, ready, out_for_delivery, delivered

      console.log(`[MEALS] Fetching orders for vendor: ${vendorId}`);

      const orders = await kv.get(`vendor:${vendorId}:meal_orders`) || [];

      let filtered = orders;
      if (status) {
        filtered = orders.filter((o: any) => o.status === status);
      }

      // Sort by order time (newest first)
      filtered.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return c.json({
        success: true,
        orders: filtered,
        totalOrders: filtered.length,
        pending: orders.filter((o: any) => o.status === 'pending').length,
        preparing: orders.filter((o: any) => o.status === 'preparing').length
      });

    } catch (error) {
      console.error('[MEALS] Error:', error);
      return c.json({ error: 'Failed to fetch orders' }, 500);
    }
  });

  // =============================================
  // UPDATE ORDER STATUS
  // =============================================
  app.put(`${BASE}/vendor/:vendorId/meal-orders/:orderId/status`, async (c) => {
    try {
      const { vendorId, orderId } = c.req.param();
      const { status, notes } = await c.req.json();

      console.log(`[MEALS] Updating order ${orderId} to status: ${status}`);

      const orders = await kv.get(`vendor:${vendorId}:meal_orders`) || [];
      const index = orders.findIndex((o: any) => o.id === orderId);

      if (index === -1) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const statusHistory = orders[index].statusHistory || [];
      statusHistory.push({
        status,
        timestamp: new Date().toISOString(),
        notes: notes || ''
      });

      orders[index] = {
        ...orders[index],
        status,
        statusHistory,
        updatedAt: new Date().toISOString()
      };

      // Special handling for status changes
      if (status === 'ready') {
        orders[index].readyAt = new Date().toISOString();
        // TODO: Notify logistics partner
      }

      if (status === 'out_for_delivery') {
        orders[index].dispatchedAt = new Date().toISOString();
        // TODO: Notify customer
      }

      await kv.set(`vendor:${vendorId}:meal_orders`, orders);

      // Update main booking if linked
      if (orders[index].bookingId) {
        const booking = await kv.get(`booking:${orders[index].bookingId}`);
        if (booking) {
          booking.mealOrderStatus = status;
          await kv.set(`booking:${orders[index].bookingId}`, booking);
        }
      }

      console.log(`✅ [MEALS] Updated order status: ${orderId}`);

      return c.json({
        success: true,
        order: orders[index],
        message: `Order marked as ${status}`
      });

    } catch (error) {
      console.error('[MEALS] Error:', error);
      return c.json({ error: 'Failed to update order status' }, 500);
    }
  });

  // =============================================
  // ASSIGN DELIVERY RIDER
  // =============================================
  app.post(`${BASE}/vendor/:vendorId/meal-orders/:orderId/assign-rider`, async (c) => {
    try {
      const { vendorId, orderId } = c.req.param();
      const { riderId, riderName, riderPhone } = await c.req.json();

      const orders = await kv.get(`vendor:${vendorId}:meal_orders`) || [];
      const index = orders.findIndex((o: any) => o.id === orderId);

      if (index === -1) {
        return c.json({ error: 'Order not found' }, 404);
      }

      orders[index].rider = {
        id: riderId,
        name: riderName,
        phone: riderPhone,
        assignedAt: new Date().toISOString()
      };

      orders[index].status = 'out_for_delivery';
      orders[index].dispatchedAt = new Date().toISOString();

      await kv.set(`vendor:${vendorId}:meal_orders`, orders);

      return c.json({
        success: true,
        order: orders[index],
        message: 'Rider assigned successfully'
      });

    } catch (error) {
      console.error('[MEALS] Error:', error);
      return c.json({ error: 'Failed to assign rider' }, 500);
    }
  });

  // =============================================
  // PUBLIC: GET MEAL PRODUCTS (Customer-facing)
  // =============================================
  app.get(`${BASE}/public/vendor/:vendorId/meal-products`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const products = await kv.get(`vendor:${vendorId}:meal_products`) || [];
      const activeProducts = products.filter((p: any) => p.isActive);

      // Refresh URLs
      const productsWithUrls = await Promise.all(activeProducts.map(async (product: any) => {
        const imageUrls = await Promise.all(
          (product.images || []).map(async (path: string) => {
            const { data } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(path, 3600);
            return data?.signedUrl || null;
          })
        );

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          ingredients: product.ingredients,
          nutritionalValue: product.nutritionalValue,
          feedingGuidelines: product.feedingGuidelines,
          storageInstructions: product.storageInstructions,
          shelfLife: product.shelfLife,
          price: product.price,
          packSize: product.packSize,
          imageUrls: imageUrls.filter(Boolean),
          suitableFor: product.suitableFor,
          petTypes: product.petTypes,
          dietType: product.dietType,
          preparationLeadTime: product.preparationLeadTime,
          deliveryTimeWindows: product.deliveryTimeWindows,
          minOrderLeadTime: product.minOrderLeadTime
        };
      }));

      return c.json({
        success: true,
        products: productsWithUrls
      });

    } catch (error) {
      console.error('[MEALS] Error:', error);
      return c.json({ error: 'Failed to fetch products' }, 500);
    }
  });

  // =============================================
  // CREATE MEAL ORDER (Customer)
  // =============================================
  app.post(`${BASE}/meal-orders`, async (c) => {
    try {
      const body = await c.req.json();

      const { vendorId, productId, customerId, quantity, deliveryAddress, deliveryTimeWindow, specialInstructions } = body;

      if (!vendorId || !productId || !customerId || !quantity) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Get product
      const products = await kv.get(`vendor:${vendorId}:meal_products`) || [];
      const product = products.find((p: any) => p.id === productId);

      if (!product) {
        return c.json({ error: 'Product not found' }, 404);
      }

      const orderId = generateId('mealorder');
      const newOrder = {
        id: orderId,
        vendorId,
        productId,
        productName: product.name,
        customerId,
        
        quantity,
        price: product.price,
        totalAmount: product.price * quantity,
        
        deliveryAddress,
        deliveryTimeWindow: deliveryTimeWindow || product.deliveryTimeWindows[0],
        specialInstructions: specialInstructions || '',
        
        preparationLeadTime: product.preparationLeadTime,
        estimatedReadyTime: new Date(Date.now() + product.preparationLeadTime * 60000).toISOString(),
        
        status: 'pending', // pending, preparing, ready, out_for_delivery, delivered, cancelled
        statusHistory: [{
          status: 'pending',
          timestamp: new Date().toISOString(),
          notes: 'Order placed'
        }],
        
        rider: null,
        
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add to vendor's orders
      const orders = await kv.get(`vendor:${vendorId}:meal_orders`) || [];
      orders.push(newOrder);
      await kv.set(`vendor:${vendorId}:meal_orders`, orders);

      // TODO: Send notification to vendor

      return c.json({
        success: true,
        order: newOrder,
        message: 'Order placed successfully'
      });

    } catch (error) {
      console.error('[MEALS] Error:', error);
      return c.json({ error: 'Failed to create order' }, 500);
    }
  });
}
