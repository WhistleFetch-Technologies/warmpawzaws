/**
 * 🍽️ FOOD DELIVERY HYPERLOCAL SYSTEM - SQL-ONLY VERSION
 * 
 * Phase 7B: Critical Services Implementation
 * Business Rule 8 Compliance: Food Delivery with GPS Tracking
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Features:
 * - Hyperlocal food delivery
 * - Menu management
 * - Order processing
 * - GPS tracking
 * - Delivery partner integration
 * - Real-time order updates
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (26 KV operations → 0)
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from "../../lib/db.ts";
import { withTransaction } from "../../lib/utils/transaction-helper.ts";
import { calculateDistance } from "../../lib/utils/distance-calculation.ts";

interface FoodDeliveryOrder {
  orderId: string;
  customerId: string;
  vendorId: string;
  petId: string;
  items: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    price: number;
  }>;
  deliveryAddress: {
    address: string;
    lat: number;
    lng: number;
    landmark?: string;
  };
  orderTotal: number;
  deliveryFee: number;
  grandTotal: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  deliveryPartnerId?: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
  trackingData?: {
    currentLat: number;
    currentLng: number;
    lastUpdated: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface FoodMenuItem {
  itemId: string;
  vendorId: string;
  itemName: string;
  description: string;
  category: 'dog_food' | 'cat_food' | 'treats' | 'supplements';
  price: number;
  image?: string;
  nutritionalInfo: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  ingredients: string[];
  allergens?: string[];
  isAvailable: boolean;
  preparationTime: number;
  createdAt: string;
  updatedAt: string;
}

export function foodDeliveryHyperlocalEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const db = getDbClient();

  // ========================================
  // FOOD DELIVERY ORDER ENDPOINTS
  // ========================================

  // Create food delivery order
  app.post(`${BASE_PATH}/food-delivery/order/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        vendorId,
        petId,
        items,
        deliveryAddress,
        orderTotal,
        deliveryFee = 50
      } = body;

      if (!customerId || !vendorId || !petId || !items || !deliveryAddress) {
        return sendError(c, 'Required fields missing', 400);
      }

      return await withTransaction(async (txClient) => {
        const orderId = `food_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const orderNumber = `FO${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const now = new Date().toISOString();
      const estimatedTime = new Date(Date.now() + 35 * 60 * 1000);

      // ✅ SQL: Create order
        const { data: order, error: orderError } = await txClient
          .from('orders')
          .insert({
        customer_id: customerId,
        vendor_id: vendorId,
        order_number: orderNumber,
            order_status: 'pending',
        subtotal: orderTotal,
        shipping_amount: deliveryFee,
        total_amount: orderTotal + deliveryFee,
        shipping_address: deliveryAddress.address,
        shipping_city: deliveryAddress.city || '',
        shipping_state: deliveryAddress.state || '',
        shipping_pincode: deliveryAddress.pincode || '',
        shipping_phone: deliveryAddress.phone || '',
        payment_status: 'pending',
            created_at: now,
            updated_at: now
          })
          .select()
          .single();

        if (orderError) {
          console.error('Error creating order:', orderError);
          return sendError(c, 'Failed to create order', 500);
        }

        // ✅ SQL: Create order items
        const orderItems = items.map((item: any) => ({
          order_id: order.id,
          name: item.itemName,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity
        }));

        const { error: itemsError } = await txClient
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('Error creating order items:', itemsError);
          return sendError(c, 'Failed to create order items', 500);
        }

        // ✅ SQL: Create delivery record
        const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const { error: deliveryError } = await txClient
          .from('deliveries')
          .insert({
            delivery_id: deliveryId,
            order_id: orderNumber,
            order_type: 'product',
            customer_id: customerId,
            customer_name: deliveryAddress.name || 'Customer',
            customer_phone: deliveryAddress.phone || '',
            pickup_location: {
              lat: 0,
              lng: 0,
              address: 'Vendor Location'
            },
            drop_location: {
              lat: deliveryAddress.lat,
              lng: deliveryAddress.lng,
              address: deliveryAddress.address
            },
            status: 'pending',
            scheduled_date: new Date().toISOString().split('T')[0],
            scheduled_time: estimatedTime.toTimeString().slice(0, 5),
            delivery_fee: deliveryFee,
            created_at: now,
            updated_at: now
          });

        if (deliveryError) {
          console.error('Error creating delivery:', deliveryError);
          // Continue even if delivery creation fails
        }

        console.log(`✅ Food delivery order created: ${orderId}`);

        return sendSuccess(c, {
          order: {
            orderId: order.id,
            orderNumber: order.order_number,
            customerId: order.customer_id,
            vendorId: order.vendor_id,
            petId,
            items,
            deliveryAddress,
            orderTotal: order.subtotal,
            deliveryFee: order.shipping_amount,
            grandTotal: order.total_amount,
            status: order.order_status,
            paymentStatus: order.payment_status,
            estimatedDeliveryTime: estimatedTime.toISOString(),
            createdAt: order.created_at,
            updatedAt: order.updated_at
          }
        }, 'Order created successfully');
      });
    } catch (error) {
      console.error('Error creating food order:', error);
      return sendError(c, error, 500);
    }
  });

  // Get order details
  app.get(`${BASE_PATH}/food-delivery/order/:orderId`, async (c) => {
    try {
      const orderId = c.req.param('orderId');

      // ✅ SQL: Get order (try by ID or order_number)
      const { data: order, error: orderError } = await db
        .from('orders')
        .select('*')
        .or(`id.eq.${orderId},order_number.eq.${orderId}`)
        .single();

      if (orderError || !order) {
        return sendError(c, 'Order not found', 404);
      }

      // ✅ SQL: Get order items
      const { data: items } = await db
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      // ✅ SQL: Get delivery info
      const { data: delivery } = await db
        .from('deliveries')
        .select('*')
        .eq('order_id', order.order_number)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return sendSuccess(c, {
        order: {
          orderId: order.id,
          orderNumber: order.order_number,
          customerId: order.customer_id,
          vendorId: order.vendor_id,
          items: items?.map(item => ({
            itemId: item.product_id || item.id,
            itemName: item.name,
            quantity: item.quantity,
            price: item.unit_price
          })) || [],
          deliveryAddress: {
            address: order.shipping_address,
            lat: delivery?.drop_location?.lat || 0,
            lng: delivery?.drop_location?.lng || 0
          },
          orderTotal: order.subtotal,
          deliveryFee: order.shipping_amount,
          grandTotal: order.total_amount,
          status: order.order_status,
          paymentStatus: order.payment_status,
          deliveryPartnerId: delivery?.partner_id,
          estimatedDeliveryTime: delivery?.scheduled_time,
          actualDeliveryTime: delivery?.delivered_at,
          trackingData: delivery?.current_lat && delivery?.current_lng ? {
            currentLat: delivery.current_lat,
            currentLng: delivery.current_lng,
            lastUpdated: delivery.current_location_timestamp
          } : undefined,
          createdAt: order.created_at,
          updatedAt: order.updated_at
        }
      });
    } catch (error) {
      console.error('Error getting order:', error);
      return sendError(c, error, 500);
    }
  });

  // Update order status
  app.put(`${BASE_PATH}/food-delivery/order/:orderId/status`, async (c) => {
    try {
      const orderId = c.req.param('orderId');
      const { status, paymentStatus, deliveryPartnerId } = await c.req.json();

      return await withTransaction(async (txClient) => {
      // ✅ SQL: Get order
        const { data: order, error: orderError } = await txClient
          .from('orders')
          .select('*')
          .or(`id.eq.${orderId},order_number.eq.${orderId}`)
          .single();

        if (orderError || !order) {
        return sendError(c, 'Order not found', 404);
      }

        const updateData: any = {
          updated_at: new Date().toISOString()
        };

        if (status) {
          updateData.order_status = status;
      if (status === 'delivered') {
            updateData.delivered_at = new Date().toISOString();
          } else if (status === 'cancelled') {
            updateData.cancelled_at = new Date().toISOString();
          }
        }

        if (paymentStatus) {
          updateData.payment_status = paymentStatus;
      }

      // ✅ SQL: Update order
        const { data: updatedOrder, error: updateError } = await txClient
          .from('orders')
          .update(updateData)
          .eq('id', order.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating order:', updateError);
          return sendError(c, 'Failed to update order', 500);
        }

        // ✅ SQL: Update delivery if partner assigned
        if (deliveryPartnerId) {
          const { data: delivery } = await txClient
            .from('deliveries')
            .select('*')
            .eq('order_id', order.order_number)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (delivery) {
            await txClient
              .from('deliveries')
              .update({
                partner_id: deliveryPartnerId,
                status: status === 'out_for_delivery' ? 'out_for_delivery' : delivery.status,
                updated_at: new Date().toISOString()
              })
              .eq('id', delivery.id);
          }
      }

      console.log(`✅ Order ${orderId} status updated to: ${status}`);

        return sendSuccess(c, {
          order: {
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.order_number,
            status: updatedOrder.order_status,
            paymentStatus: updatedOrder.payment_status,
            updatedAt: updatedOrder.updated_at
          }
        }, 'Order status updated successfully');
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      return sendError(c, error, 500);
    }
  });

  // Track delivery with GPS
  app.get(`${BASE_PATH}/food-delivery/track/:orderId`, async (c) => {
    try {
      const orderId = c.req.param('orderId');

      // ✅ SQL: Get order
      const { data: order } = await db
        .from('orders')
        .select('*')
        .or(`id.eq.${orderId},order_number.eq.${orderId}`)
        .single();

      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      // ✅ SQL: Get delivery
      const { data: delivery } = await db
        .from('deliveries')
        .select('*')
        .eq('order_id', order.order_number)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // ✅ SQL: Get partner location if assigned
      let partnerLocation = null;
      if (delivery?.partner_id) {
        const { data: partner } = await db
          .from('delivery_partners')
          .select('current_location')
          .eq('partner_id', delivery.partner_id)
          .single();

        if (partner?.current_location) {
          partnerLocation = partner.current_location;
        }
      }

      return sendSuccess(c, {
        order: {
          orderId: order.id,
          status: order.order_status
        },
        tracking: {
          status: delivery?.status || order.order_status,
          estimatedDeliveryTime: delivery?.scheduled_time,
          currentLocation: partnerLocation || (delivery?.current_lat && delivery?.current_lng ? {
            lat: delivery.current_lat,
            lng: delivery.current_lng
          } : null),
          deliveryAddress: {
            address: order.shipping_address,
            lat: delivery?.drop_location?.lat || 0,
            lng: delivery?.drop_location?.lng || 0
          }
        }
      });
    } catch (error) {
      console.error('Error tracking delivery:', error);
      return sendError(c, error, 500);
    }
  });

  // Update delivery GPS location
  app.post(`${BASE_PATH}/food-delivery/track/:orderId/location`, async (c) => {
    try {
      const orderId = c.req.param('orderId');
      const { lat, lng } = await c.req.json();

      if (!lat || !lng) {
        return sendError(c, 'lat and lng are required', 400);
      }

      // ✅ SQL: Get order
      const { data: order } = await db
        .from('orders')
        .select('order_number')
        .or(`id.eq.${orderId},order_number.eq.${orderId}`)
        .single();

      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      // ✅ SQL: Update delivery location
      const { data: delivery } = await db
        .from('deliveries')
        .select('*')
        .eq('order_id', order.order_number)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (delivery) {
        await db
          .from('deliveries')
          .update({
            current_lat: lat,
            current_lng: lng,
            current_location_timestamp: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', delivery.id);
      }

      console.log(`✅ Order ${orderId} location updated: ${lat}, ${lng}`);

      return sendSuccess(c, {
        tracking: {
          currentLat: lat,
          currentLng: lng,
          lastUpdated: new Date().toISOString()
        }
      }, 'Location updated successfully');
    } catch (error) {
      console.error('Error updating location:', error);
      return sendError(c, error, 500);
    }
  });

  // Notify delivery partner
  app.post(`${BASE_PATH}/food-delivery/partner/notify`, async (c) => {
    try {
      const { orderId, partnerId } = await c.req.json();

      if (!orderId || !partnerId) {
        return sendError(c, 'orderId and partnerId are required', 400);
      }

      return await withTransaction(async (txClient) => {
      // ✅ SQL: Get order
        const { data: order, error: orderError } = await txClient
          .from('orders')
          .select('*')
          .or(`id.eq.${orderId},order_number.eq.${orderId}`)
          .single();

        if (orderError || !order) {
        return sendError(c, 'Order not found', 404);
      }

        // ✅ SQL: Verify partner
        const { data: partner, error: partnerError } = await txClient
          .from('delivery_partners')
        .select('*')
          .eq('partner_id', partnerId)
        .single();

        if (partnerError || !partner) {
        return sendError(c, 'Delivery partner not found', 404);
      }

        // ✅ SQL: Update order status
        await txClient
          .from('orders')
          .update({
            order_status: 'out_for_delivery',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        // ✅ SQL: Update delivery with partner
        const { data: delivery } = await txClient
          .from('deliveries')
          .select('*')
          .eq('order_id', order.order_number)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (delivery) {
          await txClient
            .from('deliveries')
            .update({
              partner_id: partnerId,
              partner_name: partner.name,
              partner_phone: partner.phone,
              status: 'out_for_delivery',
              updated_at: new Date().toISOString()
            })
            .eq('id', delivery.id);
        }

        console.log(`✅ Delivery partner ${partnerId} assigned to order ${orderId}`);

        return sendSuccess(c, {
          order: {
            orderId: order.id,
            status: 'out_for_delivery',
            deliveryPartnerId: partnerId
          }
        }, 'Delivery partner notified successfully');
      });
    } catch (error) {
      console.error('Error notifying delivery partner:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // FOOD MENU ENDPOINTS
  // ========================================

  // Get vendor food menu
  app.get(`${BASE_PATH}/food-delivery/menu/:vendorId`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      // ✅ SQL: Get products for vendor (food items)
      const { data: products, error } = await db
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting menu:', error);
        return sendError(c, 'Failed to get menu', 500);
      }

      const menu = products?.map(product => ({
        itemId: product.id,
        vendorId: product.vendor_id,
        itemName: product.name,
        description: product.description,
        category: product.category || 'dog_food',
        price: product.price,
        image: product.images?.[0] || null,
        nutritionalInfo: product.metadata?.nutritionalInfo || { calories: 0, protein: 0, fat: 0, carbs: 0 },
        ingredients: product.metadata?.ingredients || [],
        allergens: product.metadata?.allergens || [],
        isAvailable: product.is_active && (product.stock_quantity || 0) > 0,
        preparationTime: product.metadata?.preparationTime || 15,
        createdAt: product.created_at,
        updatedAt: product.updated_at
      })) || [];

      return sendSuccess(c, { menu });
    } catch (error) {
      console.error('Error getting menu:', error);
      return sendError(c, error, 500);
    }
  });

  // Create menu item
  app.post(`${BASE_PATH}/food-delivery/menu/item/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        itemName,
        description,
        category,
        price,
        nutritionalInfo,
        ingredients,
        allergens,
        preparationTime = 15,
        image
      } = body;

      if (!vendorId || !itemName || !category || !price) {
        return sendError(c, 'Required fields missing', 400);
      }

      // ✅ SQL: Create product (menu item)
      const { data: product, error } = await db
        .from('products')
        .insert({
        vendor_id: vendorId,
        name: itemName,
          description,
          category,
          price,
          stock_quantity: 100, // Default stock
        is_active: true,
          images: image ? [image] : [],
        metadata: {
          nutritionalInfo: nutritionalInfo || { calories: 0, protein: 0, fat: 0, carbs: 0 },
          ingredients: ingredients || [],
          allergens: allergens || [],
            preparationTime
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating menu item:', error);
        return sendError(c, 'Failed to create menu item', 500);
      }

      console.log(`✅ Menu item created: ${product.id}`);

      return sendSuccess(c, {
        menuItem: {
          itemId: product.id,
          vendorId: product.vendor_id,
          itemName: product.name,
          description: product.description,
          category: product.category,
          price: product.price,
          image: product.images?.[0],
          nutritionalInfo: product.metadata?.nutritionalInfo,
          ingredients: product.metadata?.ingredients,
          allergens: product.metadata?.allergens,
          isAvailable: product.is_active,
          preparationTime: product.metadata?.preparationTime,
          createdAt: product.created_at,
          updatedAt: product.updated_at
        }
      }, 'Menu item created successfully');
    } catch (error) {
      console.error('Error creating menu item:', error);
      return sendError(c, error, 500);
    }
  });

  // Update menu item
  app.put(`${BASE_PATH}/food-delivery/menu/item/:itemId`, async (c) => {
    try {
      const itemId = c.req.param('itemId');
      const updates = await c.req.json();

      // ✅ SQL: Get product
      const { data: product, error: getError } = await db
        .from('products')
        .select('*')
        .eq('id', itemId)
        .single();

      if (getError || !product) {
        return sendError(c, 'Menu item not found', 404);
      }

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.itemName) updateData.name = updates.itemName;
      if (updates.description) updateData.description = updates.description;
      if (updates.category) updateData.category = updates.category;
      if (updates.price !== undefined) updateData.price = updates.price;
      if (updates.image) updateData.images = [updates.image];
      if (updates.isAvailable !== undefined) updateData.is_active = updates.isAvailable;

      // Update metadata
      if (updates.nutritionalInfo || updates.ingredients || updates.allergens || updates.preparationTime) {
        updateData.metadata = {
          ...(product.metadata || {}),
          ...(updates.nutritionalInfo ? { nutritionalInfo: updates.nutritionalInfo } : {}),
          ...(updates.ingredients ? { ingredients: updates.ingredients } : {}),
          ...(updates.allergens ? { allergens: updates.allergens } : {}),
          ...(updates.preparationTime ? { preparationTime: updates.preparationTime } : {})
        };
      }

      // ✅ SQL: Update product
      const { data: updatedProduct, error: updateError } = await db
        .from('products')
        .update(updateData)
        .eq('id', itemId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating menu item:', updateError);
        return sendError(c, 'Failed to update menu item', 500);
      }

      console.log(`✅ Menu item ${itemId} updated`);

      return sendSuccess(c, {
        menuItem: {
          itemId: updatedProduct.id,
          vendorId: updatedProduct.vendor_id,
          itemName: updatedProduct.name,
          description: updatedProduct.description,
          category: updatedProduct.category,
          price: updatedProduct.price,
          image: updatedProduct.images?.[0],
          nutritionalInfo: updatedProduct.metadata?.nutritionalInfo,
          ingredients: updatedProduct.metadata?.ingredients,
          allergens: updatedProduct.metadata?.allergens,
          isAvailable: updatedProduct.is_active,
          preparationTime: updatedProduct.metadata?.preparationTime,
          createdAt: updatedProduct.created_at,
          updatedAt: updatedProduct.updated_at
        }
      }, 'Menu item updated successfully');
    } catch (error) {
      console.error('Error updating menu item:', error);
      return sendError(c, error, 500);
    }
  });

  // Delete menu item
  app.delete(`${BASE_PATH}/food-delivery/menu/item/:itemId`, async (c) => {
    try {
      const itemId = c.req.param('itemId');

      // ✅ SQL: Mark as inactive instead of deleting
      const { data: product, error } = await db
        .from('products')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .select()
        .single();

      if (error || !product) {
        return sendError(c, 'Menu item not found', 404);
      }

      console.log(`✅ Menu item ${itemId} marked unavailable`);

      return sendSuccess(c, {}, 'Menu item removed successfully');
    } catch (error) {
      console.error('Error deleting menu item:', error);
      return sendError(c, error, 500);
    }
  });

  // Get available vendors in area (hyperlocal)
  app.get(`${BASE_PATH}/food-delivery/available-vendors`, async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radius = parseFloat(c.req.query('radius') || '5'); // km

      if (!lat || !lng) {
        return sendError(c, 'lat and lng are required', 400);
      }

      // ✅ SQL: Get vendors with food products
      const { data: vendors, error } = await db
        .from('vendors')
        .select(`
          id,
          business_name,
          address,
          city,
          state,
          latitude,
          longitude,
          status
        `)
        .eq('status', 'approved')
        .eq('is_active', true);

      if (error) {
        console.error('Error getting vendors:', error);
        return sendError(c, 'Failed to get vendors', 500);
      }

      // Filter vendors within radius and check if they have food products
      const nearbyVendors = [];
      for (const vendor of vendors || []) {
        if (!vendor.latitude || !vendor.longitude) continue;

        const distance = calculateDistance(lat, lng, vendor.latitude, vendor.longitude);
        if (distance > radius) continue;

        // Check if vendor has food products
        const { data: products } = await db
          .from('products')
          .select('id')
          .eq('vendor_id', vendor.id)
          .eq('is_active', true)
          .limit(1);

        if (products && products.length > 0) {
          nearbyVendors.push({
            vendorId: vendor.id,
            businessName: vendor.business_name,
            address: vendor.address,
            city: vendor.city,
            state: vendor.state,
            location: {
              lat: vendor.latitude,
              lng: vendor.longitude
            },
            distance
          });
        }
      }

      // Sort by distance
      nearbyVendors.sort((a, b) => a.distance - b.distance);

      return sendSuccess(c, { vendors: nearbyVendors, count: nearbyVendors.length });
    } catch (error) {
      console.error('Error getting available vendors:', error);
      return sendError(c, error, 500);
    }
  });

  // Get customer's food orders
  app.get(`${BASE_PATH}/customer/:customerId/food-orders`, async (c) => {
    try {
      const customerId = c.req.param('customerId');

      // ✅ SQL: Get orders for customer
      const { data: orders, error } = await db
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting customer orders:', error);
        return sendError(c, 'Failed to get orders', 500);
      }

      // Get items for each order
      const ordersWithItems = await Promise.all(
        (orders || []).map(async (order) => {
          const { data: items } = await db
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);

          return {
            orderId: order.id,
            orderNumber: order.order_number,
            customerId: order.customer_id,
            vendorId: order.vendor_id,
            items: items?.map(item => ({
              itemId: item.product_id || item.id,
              itemName: item.name,
              quantity: item.quantity,
              price: item.unit_price
            })) || [],
            orderTotal: order.subtotal,
            deliveryFee: order.shipping_amount,
            grandTotal: order.total_amount,
            status: order.order_status,
            paymentStatus: order.payment_status,
            createdAt: order.created_at,
            updatedAt: order.updated_at
          };
        })
      );

      return sendSuccess(c, { orders: ordersWithItems });
    } catch (error) {
      console.error('Error getting customer orders:', error);
      return sendError(c, error, 500);
    }
  });

  // Get vendor's food orders
  app.get(`${BASE_PATH}/vendor/:vendorId/food-orders`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      // ✅ SQL: Get orders for vendor
      const { data: orders, error } = await db
        .from('orders')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting vendor orders:', error);
        return sendError(c, 'Failed to get orders', 500);
      }

      // Get items for each order
      const ordersWithItems = await Promise.all(
        (orders || []).map(async (order) => {
          const { data: items } = await db
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);

          return {
            orderId: order.id,
            orderNumber: order.order_number,
            customerId: order.customer_id,
            vendorId: order.vendor_id,
            items: items?.map(item => ({
              itemId: item.product_id || item.id,
              itemName: item.name,
              quantity: item.quantity,
              price: item.unit_price
            })) || [],
            orderTotal: order.subtotal,
            deliveryFee: order.shipping_amount,
            grandTotal: order.total_amount,
            status: order.order_status,
            paymentStatus: order.payment_status,
            createdAt: order.created_at,
            updatedAt: order.updated_at
          };
        })
      );

      return sendSuccess(c, { orders: ordersWithItems });
    } catch (error) {
      console.error('Error getting vendor orders:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Food Delivery Hyperlocal endpoints registered (SQL-only)');
}
