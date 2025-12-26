/**
 * ✅ NUTRITIONIST MEAL MANAGEMENT - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * KV Operations: 19 → 0
 * 
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

import { Hono } from "npm:hono";
import { generateId } from './database-schema.tsx';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getDbClient, withTransaction } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';

export function registerNutritionistMealManagementSQL(app: Hono) {
  const BASE = '/make-server-3dd53475';

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const client = getDbClient();

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

      // ✅ SQL: Get vendor
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Get meal products (products with metadata type = meal_product)
      // Note: Requires migration 034_add_metadata_columns.sql to add metadata column
      const { data: productsData, error: productsError } = await client
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('metadata->>type', 'meal_product');

      if (productsError) throw productsError;
      const products = (productsData || []).map((p: any) => {
        const metadata = (p.metadata as any) || {};
        return {
          id: p.id,
          vendorId: p.vendor_id,
          name: p.name,
          description: p.description,
          category: metadata.category || 'fresh_meal',
          ingredients: metadata.ingredients || [],
          nutritionalValue: metadata.nutritionalValue || {},
          preparationMethod: metadata.preparationMethod || '',
          preparationLeadTime: metadata.preparationLeadTime || 60,
          feedingGuidelines: metadata.feedingGuidelines || [],
          storageInstructions: metadata.storageInstructions || '',
          shelfLife: metadata.shelfLife || '',
          deliveryTimeWindows: metadata.deliveryTimeWindows || [],
          minOrderLeadTime: metadata.minOrderLeadTime || 120,
          price: Number(p.price),
          packSize: metadata.packSize || '',
          unit: metadata.unit || 'pack',
          images: metadata.images || [],
          suitableFor: metadata.suitableFor || [],
          petTypes: metadata.petTypes || ['dog', 'cat'],
          dietType: metadata.dietType || '',
          allergens: metadata.allergens || [],
          warnings: metadata.warnings || '',
          isActive: p.is_active,
          maxDailyOrders: metadata.maxDailyOrders || 50,
          createdAt: p.created_at,
          updatedAt: p.updated_at
        };
      });

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
        totalProducts: productsWithUrls.length,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name
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

      // ✅ SQL: Create product with meal metadata
      // Note: Requires migration 034_add_metadata_columns.sql to add metadata column
      const productId = generateId('meal');
      
      const { data: product, error: productError } = await client
        .from('products')
        .insert({
          id: productId,
          vendor_id: vendorId,
          name: body.name,
          description: body.description || '',
          price: Number(body.price),
          stock_quantity: body.maxDailyOrders || 50,
          is_active: body.isActive !== false,
          metadata: {
          type: 'meal_product',
          category: body.category || 'fresh_meal',
          ingredients: body.ingredients,
          nutritionalValue: body.nutritionalValue || {},
          preparationMethod: body.preparationMethod || '',
          preparationLeadTime: body.preparationLeadTime || 60,
          feedingGuidelines: body.feedingGuidelines || [],
          storageInstructions: body.storageInstructions || '',
          shelfLife: body.shelfLife || '',
          deliveryTimeWindows: body.deliveryTimeWindows || [],
          minOrderLeadTime: body.minOrderLeadTime || 120,
          packSize: body.packSize || '',
          unit: body.unit || 'pack',
          images: body.images || [],
          suitableFor: body.suitableFor || [],
          petTypes: body.petTypes || ['dog', 'cat'],
          dietType: body.dietType || '',
          allergens: body.allergens || [],
          warnings: body.warnings || '',
          maxDailyOrders: body.maxDailyOrders || 50
          }
        })
        .select()
        .single();

      if (productError) throw productError;

      console.log(`✅ [MEALS] Created product: ${productId}`);

      return c.json({
        success: true,
        product: {
          id: product.id,
          ...product.metadata,
          vendorId: product.vendor_id,
          name: product.name,
          description: product.description,
          price: Number(product.price),
          isActive: product.is_active,
          createdAt: product.created_at,
          updatedAt: product.updated_at
        },
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

      // ✅ SQL: Get product
      const { data: existing, error: existingError } = await client
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('vendor_id', vendorId)
        .single();

      if (existingError || !existing) {
        return c.json({ error: 'Product not found' }, 404);
      }

      // ✅ SQL: Update product
      const { data: updated, error: updateError } = await client
        .from('products')
        .update({
          name: body.name !== undefined ? body.name : existing.name,
          description: body.description !== undefined ? body.description : existing.description,
          price: body.price !== undefined ? Number(body.price) : existing.price,
          is_active: body.isActive !== undefined ? body.isActive : existing.is_active,
          metadata: {
            ...(existing.metadata || {}),
          ...(body.category !== undefined && { category: body.category }),
          ...(body.ingredients !== undefined && { ingredients: body.ingredients }),
          ...(body.nutritionalValue !== undefined && { nutritionalValue: body.nutritionalValue }),
          ...(body.preparationMethod !== undefined && { preparationMethod: body.preparationMethod }),
          ...(body.preparationLeadTime !== undefined && { preparationLeadTime: body.preparationLeadTime }),
          ...(body.feedingGuidelines !== undefined && { feedingGuidelines: body.feedingGuidelines }),
          ...(body.storageInstructions !== undefined && { storageInstructions: body.storageInstructions }),
          ...(body.shelfLife !== undefined && { shelfLife: body.shelfLife }),
          ...(body.deliveryTimeWindows !== undefined && { deliveryTimeWindows: body.deliveryTimeWindows }),
          ...(body.minOrderLeadTime !== undefined && { minOrderLeadTime: body.minOrderLeadTime }),
          ...(body.packSize !== undefined && { packSize: body.packSize }),
          ...(body.unit !== undefined && { unit: body.unit }),
          ...(body.images !== undefined && { images: body.images }),
          ...(body.suitableFor !== undefined && { suitableFor: body.suitableFor }),
          ...(body.petTypes !== undefined && { petTypes: body.petTypes }),
          ...(body.dietType !== undefined && { dietType: body.dietType }),
          ...(body.allergens !== undefined && { allergens: body.allergens }),
          ...(body.warnings !== undefined && { warnings: body.warnings }),
          ...(body.maxDailyOrders !== undefined && { maxDailyOrders: body.maxDailyOrders })
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log(`✅ [MEALS] Updated product: ${productId}`);

      return c.json({
        success: true,
        product: {
          id: updated.id,
          ...updated.metadata,
          vendorId: updated.vendor_id,
          name: updated.name,
          description: updated.description,
          price: Number(updated.price),
          isActive: updated.is_active,
          updatedAt: updated.updated_at
        },
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

      // ✅ SQL: Get product
      const { data: product, error: productError } = await client
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('vendor_id', vendorId)
        .single();

      if (productError || !product) {
        return c.json({ error: 'Product not found' }, 404);
      }

      // Delete images
      const images = ((product.metadata as any)?.images || []);
      for (const imagePath of images) {
        await supabase.storage.from(BUCKET_NAME).remove([imagePath]);
      }

      // ✅ SQL: Delete product
      const { error: deleteError } = await client
        .from('products')
        .delete()
        .eq('id', productId);

      if (deleteError) throw deleteError;

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
      const status = c.req.query('status');

      console.log(`[MEALS] Fetching orders for vendor: ${vendorId}`);

      // ✅ SQL: Get orders for vendor (filter by metadata type = meal_order)
      // Note: Requires migration 034_add_metadata_columns.sql to add metadata column
      const { data: ordersData, error: ordersError } = await client
        .from('orders')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('metadata->>type', 'meal_order');

      if (ordersError) throw ordersError;
      let orders = (ordersData || []).map((o: any) => {
        const metadata = (o.metadata as any) || {};
        return {
          id: o.id,
          vendorId: o.vendor_id,
          productId: metadata.productId,
          productName: metadata.productName,
          customerId: o.customer_id,
          quantity: metadata.quantity || 1,
          price: metadata.price,
          totalAmount: Number(o.total_amount),
          deliveryAddress: metadata.deliveryAddress,
          deliveryTimeWindow: metadata.deliveryTimeWindow,
          specialInstructions: metadata.specialInstructions || '',
          preparationLeadTime: metadata.preparationLeadTime,
          estimatedReadyTime: metadata.estimatedReadyTime,
          status: o.order_status,
          statusHistory: metadata.statusHistory || [],
          rider: metadata.rider || null,
          createdAt: o.created_at,
          updatedAt: o.updated_at
        };
      });

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

      // ✅ SQL: Get order
      const { data: order, error: orderError } = await client
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('vendor_id', vendorId)
        .single();

      if (orderError || !order) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const statusHistory = ((order.metadata as any)?.statusHistory || []).concat([{
        status,
        timestamp: new Date().toISOString(),
        notes: notes || ''
      }]);

      const metadata = {
        ...((order.metadata as any) || {}),
        statusHistory,
        ...(status === 'ready' && { readyAt: new Date().toISOString() }),
        ...(status === 'out_for_delivery' && { dispatchedAt: new Date().toISOString() })
      };

      // ✅ SQL: Update order
      await withTransaction(async () => {
        const { error: updateError } = await client
          .from('orders')
          .update({
            order_status: status,
            metadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (updateError) throw updateError;

        // Update main booking if linked
        if ((order.metadata as any)?.bookingId) {
          const bookingsRepo = getBookingsRepository();
          const booking = await bookingsRepo.findById((order.metadata as any).bookingId);
          if (booking) {
            await bookingsRepo.update((order.metadata as any).bookingId, {
              metadata: {
                ...(booking.metadata || {}),
                mealOrderStatus: status
              }
            });
          }
        }
      });

      console.log(`✅ [MEALS] Updated order status: ${orderId}`);

      return c.json({
        success: true,
        order: {
          ...order,
          status,
          statusHistory,
          metadata
        },
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

      // ✅ SQL: Get order
      const { data: order, error: orderError } = await client
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('vendor_id', vendorId)
        .single();

      if (orderError || !order) {
        return c.json({ error: 'Order not found' }, 404);
      }

      // ✅ SQL: Update order with rider info
      const { data: updated, error: updateError } = await client
        .from('orders')
        .update({
          order_status: 'out_for_delivery',
          metadata: {
            ...((order.metadata as any) || {}),
          rider: {
            id: riderId,
            name: riderName,
            phone: riderPhone,
            assignedAt: new Date().toISOString()
          },
          dispatchedAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError) throw updateError;

      return c.json({
        success: true,
        order: updated,
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

      // ✅ SQL: Get active meal products
      // Note: Requires migration 034_add_metadata_columns.sql to add metadata column
      const { data: productsData, error: productsError } = await client
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .eq('metadata->>type', 'meal_product');

      if (productsError) throw productsError;
      const products = productsData || [];

      // Refresh URLs
      const productsWithUrls = await Promise.all(products.map(async (product: any) => {
        const metadata = (product.metadata as any) || {};
        const imageUrls = await Promise.all(
          (metadata.images || []).map(async (path: string) => {
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
          category: metadata.category,
          ingredients: metadata.ingredients,
          nutritionalValue: metadata.nutritionalValue,
          feedingGuidelines: metadata.feedingGuidelines,
          storageInstructions: metadata.storageInstructions,
          shelfLife: metadata.shelfLife,
          price: Number(product.price),
          packSize: metadata.packSize,
          imageUrls: imageUrls.filter(Boolean),
          suitableFor: metadata.suitableFor,
          petTypes: metadata.petTypes,
          dietType: metadata.dietType,
          preparationLeadTime: metadata.preparationLeadTime,
          deliveryTimeWindows: metadata.deliveryTimeWindows,
          minOrderLeadTime: metadata.minOrderLeadTime
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

      // ✅ SQL: Get product
      const { data: product, error: productError } = await client
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('vendor_id', vendorId)
        .single();

      if (productError || !product) {
        return c.json({ error: 'Product not found' }, 404);
      }

      const orderId = generateId('mealorder');
      const totalAmount = Number(product.price) * quantity;
      const metadata = (product.metadata as any) || {};

      // ✅ SQL: Create order
      // Note: Requires migration 034_add_metadata_columns.sql to add metadata column
      const { data: newOrder, error: orderError } = await client
        .from('orders')
        .insert({
          id: orderId,
          customer_id: customerId,
          vendor_id: vendorId,
          order_number: `MEAL-${Date.now()}`,
          order_status: 'pending',
          subtotal: totalAmount,
          tax_amount: 0,
          shipping_amount: 0,
          discount_amount: 0,
          total_amount: totalAmount,
          shipping_address: deliveryAddress || '',
          shipping_city: '',
          shipping_state: '',
          shipping_pincode: '',
          shipping_phone: '',
          payment_status: 'pending',
          metadata: {
          type: 'meal_order',
          productId,
          productName: product.name,
          quantity,
          price: Number(product.price),
          deliveryAddress,
          deliveryTimeWindow: deliveryTimeWindow || (metadata.deliveryTimeWindows?.[0]),
          specialInstructions: specialInstructions || '',
          preparationLeadTime: metadata.preparationLeadTime,
          estimatedReadyTime: new Date(Date.now() + (metadata.preparationLeadTime || 60) * 60000).toISOString(),
          statusHistory: [{
            status: 'pending',
            timestamp: new Date().toISOString(),
            notes: 'Order placed'
          }],
          rider: null
          }
        })
        .select()
        .single();

      if (orderError) throw orderError;

      return c.json({
        success: true,
        order: {
          id: newOrder.id,
          ...((newOrder.metadata as any) || {}),
          vendorId: newOrder.vendor_id,
          customerId: newOrder.customer_id,
          createdAt: newOrder.created_at,
          updatedAt: newOrder.updated_at
        },
        message: 'Order placed successfully'
      });

    } catch (error) {
      console.error('[MEALS] Error:', error);
      return c.json({ error: 'Failed to create order' }, 500);
    }
  });

  console.log('✅ Nutritionist Meal Management (SQL-only) registered');
}

