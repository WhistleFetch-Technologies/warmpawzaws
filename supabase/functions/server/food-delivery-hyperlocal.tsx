import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🍽️ FOOD DELIVERY HYPERLOCAL SYSTEM
 * 
 * Phase 7B: Critical Services Implementation
 * Business Rule 8 Compliance: Food Delivery with GPS Tracking
 * 
 * Features:
 * - Hyperlocal food delivery
 * - Menu management
 * - Order processing
 * - GPS tracking
 * - Delivery partner integration
 * - Real-time order updates
 */

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

interface DeliveryPartner {
  partnerId: string;
  partnerName: string;
  contactNumber: string;
  currentLocation?: {
    lat: number;
    lng: number;
    lastUpdated: string;
  };
  isAvailable: boolean;
  vehicleType: 'bike' | 'car' | 'van';
  rating: number;
  totalDeliveries: number;
}

export function foodDeliveryHyperlocalEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

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

      const orderId = `food_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Calculate estimated delivery time (30-45 minutes from now)
      const estimatedTime = new Date(Date.now() + 35 * 60 * 1000);

      const order: FoodDeliveryOrder = {
        orderId,
        customerId,
        vendorId,
        petId,
        items,
        deliveryAddress,
        orderTotal,
        deliveryFee,
        grandTotal: orderTotal + deliveryFee,
        status: 'pending',
        paymentStatus: 'pending',
        estimatedDeliveryTime: estimatedTime.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`food_order_${orderId}`, order);

      // Store in customer's orders
      const customerOrders = await kv.get(`customer_food_orders_${customerId}`) || [];
      customerOrders.push(orderId);
      await kv.set(`customer_food_orders_${customerId}`, customerOrders);

      // Store in vendor's orders
      const vendorOrders = await kv.get(`vendor_food_orders_${vendorId}`) || [];
      vendorOrders.push(orderId);
      await kv.set(`vendor_food_orders_${vendorId}`, vendorOrders);

      console.log(`✅ Food delivery order created: ${orderId}`);

      return sendSuccess(c, { order }, 'Order created successfully');
    } catch (error) {
      console.error('Error creating food order:', error);
      return sendError(c, error, 500);
    }
  });

  // Get order details
  app.get(`${BASE_PATH}/food-delivery/order/:orderId`, async (c) => {
    try {
      const orderId = c.req.param('orderId');

      const order = await kv.get(`food_order_${orderId}`);

      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      return sendSuccess(c, { order });
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

      const order = await kv.get(`food_order_${orderId}`);

      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      const updated: FoodDeliveryOrder = {
        ...order,
        status: status || order.status,
        paymentStatus: paymentStatus || order.paymentStatus,
        deliveryPartnerId: deliveryPartnerId || order.deliveryPartnerId,
        updatedAt: new Date().toISOString()
      };

      // If delivered, set actual delivery time
      if (status === 'delivered') {
        updated.actualDeliveryTime = new Date().toISOString();
      }

      await kv.set(`food_order_${orderId}`, updated);

      console.log(`✅ Order ${orderId} status updated to: ${status}`);

      return sendSuccess(c, { order: updated }, 'Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      return sendError(c, error, 500);
    }
  });

  // Track delivery with GPS
  app.get(`${BASE_PATH}/food-delivery/track/:orderId`, async (c) => {
    try {
      const orderId = c.req.param('orderId');

      const order = await kv.get(`food_order_${orderId}`);

      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      // Get delivery partner location if assigned
      let partnerLocation = null;
      if (order.deliveryPartnerId) {
        const partner = await kv.get(`delivery_partner_${order.deliveryPartnerId}`);
        if (partner && partner.currentLocation) {
          partnerLocation = partner.currentLocation;
        }
      }

      return sendSuccess(c, {
        order,
        tracking: {
          status: order.status,
          estimatedDeliveryTime: order.estimatedDeliveryTime,
          currentLocation: partnerLocation || order.trackingData,
          deliveryAddress: order.deliveryAddress
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

      const order = await kv.get(`food_order_${orderId}`);

      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      const updated: FoodDeliveryOrder = {
        ...order,
        trackingData: {
          currentLat: lat,
          currentLng: lng,
          lastUpdated: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      };

      await kv.set(`food_order_${orderId}`, updated);

      console.log(`✅ Order ${orderId} location updated: ${lat}, ${lng}`);

      return sendSuccess(c, { tracking: updated.trackingData }, 'Location updated successfully');
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

      const order = await kv.get(`food_order_${orderId}`);
      const partner = await kv.get(`delivery_partner_${partnerId}`);

      if (!order) {
        return sendError(c, 'Order not found', 404);
      }

      if (!partner) {
        return sendError(c, 'Delivery partner not found', 404);
      }

      // Assign partner to order
      const updated: FoodDeliveryOrder = {
        ...order,
        deliveryPartnerId: partnerId,
        status: 'out_for_delivery',
        updatedAt: new Date().toISOString()
      };

      await kv.set(`food_order_${orderId}`, updated);

      console.log(`✅ Delivery partner ${partnerId} assigned to order ${orderId}`);

      return sendSuccess(c, { order: updated }, 'Delivery partner notified successfully');
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

      const menuItems = await kv.getByPrefix(`food_menu_item_${vendorId}_`);

      const items = menuItems.map((item: any) => item.value || item);

      return sendSuccess(c, { menu: items });
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
        preparationTime = 15
      } = body;

      if (!vendorId || !itemName || !category || !price) {
        return sendError(c, 'Required fields missing', 400);
      }

      const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const menuItem: FoodMenuItem = {
        itemId,
        vendorId,
        itemName,
        description,
        category,
        price,
        nutritionalInfo: nutritionalInfo || { calories: 0, protein: 0, fat: 0, carbs: 0 },
        ingredients: ingredients || [],
        allergens,
        isAvailable: true,
        preparationTime,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`food_menu_item_${vendorId}_${itemId}`, menuItem);

      console.log(`✅ Menu item created: ${itemId}`);

      return sendSuccess(c, { menuItem }, 'Menu item created successfully');
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

      // Find the menu item
      const allItems = await kv.getByPrefix('food_menu_item_');
      const item = allItems.find((i: any) => {
        const val = i.value || i;
        return val.itemId === itemId;
      });

      if (!item) {
        return sendError(c, 'Menu item not found', 404);
      }

      const currentItem = item.value || item;

      const updated: FoodMenuItem = {
        ...currentItem,
        ...updates,
        itemId, // Prevent ID change
        updatedAt: new Date().toISOString()
      };

      await kv.set(`food_menu_item_${currentItem.vendorId}_${itemId}`, updated);

      console.log(`✅ Menu item ${itemId} updated`);

      return sendSuccess(c, { menuItem: updated }, 'Menu item updated successfully');
    } catch (error) {
      console.error('Error updating menu item:', error);
      return sendError(c, error, 500);
    }
  });

  // Delete menu item
  app.delete(`${BASE_PATH}/food-delivery/menu/item/:itemId`, async (c) => {
    try {
      const itemId = c.req.param('itemId');

      // Find and mark as unavailable instead of deleting
      const allItems = await kv.getByPrefix('food_menu_item_');
      const item = allItems.find((i: any) => {
        const val = i.value || i;
        return val.itemId === itemId;
      });

      if (!item) {
        return sendError(c, 'Menu item not found', 404);
      }

      const currentItem = item.value || item;

      const updated: FoodMenuItem = {
        ...currentItem,
        isAvailable: false,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`food_menu_item_${currentItem.vendorId}_${itemId}`, updated);

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

      // Get all vendors with food delivery service
      const allVendors = await kv.getByPrefix('vendor_');
      
      // Filter vendors within radius and offering food delivery
      const nearbyVendors = allVendors
        .map((item: any) => item.value || item)
        .filter((vendor: any) => {
          if (!vendor.location || !vendor.services?.includes('food_delivery')) {
            return false;
          }

          // Calculate distance using Haversine formula
          const R = 6371; // Earth radius in km
          const dLat = (vendor.location.lat - lat) * Math.PI / 180;
          const dLng = (vendor.location.lng - lng) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat * Math.PI / 180) * Math.cos(vendor.location.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;

          return distance <= radius;
        });

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

      const orderIds = await kv.get(`customer_food_orders_${customerId}`) || [];

      const orders = await Promise.all(
        orderIds.map((id: string) => kv.get(`food_order_${id}`))
      );

      return sendSuccess(c, { orders: orders.filter(Boolean) });
    } catch (error) {
      console.error('Error getting customer orders:', error);
      return sendError(c, error, 500);
    }
  });

  // Get vendor's food orders
  app.get(`${BASE_PATH}/vendor/:vendorId/food-orders`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      const orderIds = await kv.get(`vendor_food_orders_${vendorId}`) || [];

      const orders = await Promise.all(
        orderIds.map((id: string) => kv.get(`food_order_${id}`))
      );

      return sendSuccess(c, { orders: orders.filter(Boolean) });
    } catch (error) {
      console.error('Error getting vendor orders:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Food Delivery Hyperlocal endpoints registered');
}
