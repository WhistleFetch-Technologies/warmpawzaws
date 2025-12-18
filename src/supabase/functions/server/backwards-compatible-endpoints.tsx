import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🔄 BACKWARDS COMPATIBLE ENDPOINTS
 * 
 * This file maps OLD endpoint paths (used by existing UI components)
 * to NEW standardized backend logic.
 * 
 * Purpose: Ensure all existing UI components continue working without changes
 * while we maintain clean, standardized backend APIs.
 */

export function backwardsCompatibleEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  console.log('🔄 Registering backwards-compatible endpoints...');

  // ============================================
  // AMBULANCE ENDPOINTS (OLD PATHS)
  // ============================================

  /**
   * GET /vendor/:vendorId/ambulance-services
   * OLD PATH: Maps to /vendor/:vendorId/ambulance/vehicles
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/ambulance-services`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vehicles = await kv.get(`vendor:${vendorId}:ambulance:vehicles`) || [];
      return sendSuccess(c, { ambulances: vehicles, total: vehicles.length });
    } catch (error) {
      console.error('Error fetching ambulance services:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/ambulance-services
   * OLD PATH: Maps to /vendor/:vendorId/ambulance/vehicles
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/ambulance-services`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vehicleData = await c.req.json();
      
      const vehicleId = `amb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const vehicle = {
        id: vehicleId,
        ...vehicleData,
        vendorId,
        availability: vehicleData.availability || 'available',
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      
      const vehicles = await kv.get(`vendor:${vendorId}:ambulance:vehicles`) || [];
      vehicles.push(vehicle);
      
      await kv.set(`vendor:${vendorId}:ambulance:vehicles`, vehicles);
      await kv.set(`ambulance:vehicle:${vehicleId}`, vehicle);
      
      return sendSuccess(c, { ambulance: vehicle }, 'Ambulance added successfully');
    } catch (error) {
      console.error('Error adding ambulance:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/ambulance-services/:id
   * OLD PATH: Update ambulance
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/ambulance-services/:id`, async (c) => {
    try {
      const { vendorId, id } = c.req.param();
      const updates = await c.req.json();
      
      const vehicles = await kv.get(`vendor:${vendorId}:ambulance:vehicles`) || [];
      const index = vehicles.findIndex((v: any) => v.id === id);
      
      if (index === -1) {
        return sendError(c, 'Ambulance not found', 404);
      }
      
      vehicles[index] = { 
        ...vehicles[index], 
        ...updates, 
        lastUpdated: new Date().toISOString() 
      };
      
      await kv.set(`vendor:${vendorId}:ambulance:vehicles`, vehicles);
      await kv.set(`ambulance:vehicle:${id}`, vehicles[index]);
      
      return sendSuccess(c, { ambulance: vehicles[index] }, 'Ambulance updated successfully');
    } catch (error) {
      console.error('Error updating ambulance:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/ambulance-services/:id
   */
  app.delete(`${BASE_PATH}/vendor/:vendorId/ambulance-services/:id`, async (c) => {
    try {
      const { vendorId, id } = c.req.param();
      
      const vehicles = await kv.get(`vendor:${vendorId}:ambulance:vehicles`) || [];
      const updatedVehicles = vehicles.filter((v: any) => v.id !== id);
      
      await kv.set(`vendor:${vendorId}:ambulance:vehicles`, updatedVehicles);
      await kv.del(`ambulance:vehicle:${id}`);
      
      return sendSuccess(c, {}, 'Ambulance deleted successfully');
    } catch (error) {
      console.error('Error deleting ambulance:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // DIAGNOSTIC TESTS ENDPOINTS (OLD PATHS)
  // ============================================

  /**
   * GET /vendor/:vendorId/diagnostic-tests
   * OLD PATH: Maps to /vendor/:vendorId/diagnostics/tests
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/diagnostic-tests`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const tests = await kv.get(`vendor:${vendorId}:diagnostic:tests`) || [];
      return sendSuccess(c, { tests, total: tests.length });
    } catch (error) {
      console.error('Error fetching diagnostic tests:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/diagnostic-tests
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/diagnostic-tests`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const testData = await c.req.json();
      
      const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const test = {
        id: testId,
        ...testData,
        vendorId,
        isActive: testData.isActive !== false,
        createdAt: new Date().toISOString()
      };
      
      const tests = await kv.get(`vendor:${vendorId}:diagnostic:tests`) || [];
      tests.push(test);
      
      await kv.set(`vendor:${vendorId}:diagnostic:tests`, tests);
      await kv.set(`diagnostic:test:${testId}`, test);
      
      return sendSuccess(c, { test }, 'Diagnostic test added successfully');
    } catch (error) {
      console.error('Error adding diagnostic test:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/diagnostic-tests/:id
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/diagnostic-tests/:id`, async (c) => {
    try {
      const { vendorId, id } = c.req.param();
      const updates = await c.req.json();
      
      const tests = await kv.get(`vendor:${vendorId}:diagnostic:tests`) || [];
      const index = tests.findIndex((t: any) => t.id === id);
      
      if (index === -1) {
        return sendError(c, 'Test not found', 404);
      }
      
      tests[index] = { ...tests[index], ...updates, updatedAt: new Date().toISOString() };
      
      await kv.set(`vendor:${vendorId}:diagnostic:tests`, tests);
      await kv.set(`diagnostic:test:${id}`, tests[index]);
      
      return sendSuccess(c, { test: tests[index] }, 'Test updated successfully');
    } catch (error) {
      console.error('Error updating test:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/diagnostic-tests/:id
   */
  app.delete(`${BASE_PATH}/vendor/:vendorId/diagnostic-tests/:id`, async (c) => {
    try {
      const { vendorId, id } = c.req.param();
      
      const tests = await kv.get(`vendor:${vendorId}:diagnostic:tests`) || [];
      const updatedTests = tests.filter((t: any) => t.id !== id);
      
      await kv.set(`vendor:${vendorId}:diagnostic:tests`, updatedTests);
      await kv.del(`diagnostic:test:${id}`);
      
      return sendSuccess(c, {}, 'Test deleted successfully');
    } catch (error) {
      console.error('Error deleting test:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // EMERGENCY PROTOCOLS ENDPOINTS (OLD PATHS)
  // ============================================

  /**
   * GET /vendor/:vendorId/emergency-protocols
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/emergency-protocols`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const protocols = await kv.get(`vendor:${vendorId}:emergency:protocols`) || [];
      return sendSuccess(c, { protocols, total: protocols.length });
    } catch (error) {
      console.error('Error fetching emergency protocols:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/emergency-protocols
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/emergency-protocols`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const protocolData = await c.req.json();
      
      const protocolId = `protocol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const protocol = {
        id: protocolId,
        ...protocolData,
        vendorId,
        isActive: protocolData.isActive !== false,
        createdAt: new Date().toISOString()
      };
      
      const protocols = await kv.get(`vendor:${vendorId}:emergency:protocols`) || [];
      protocols.push(protocol);
      
      await kv.set(`vendor:${vendorId}:emergency:protocols`, protocols);
      await kv.set(`emergency:protocol:${protocolId}`, protocol);
      
      return sendSuccess(c, { protocol }, 'Emergency protocol added successfully');
    } catch (error) {
      console.error('Error adding emergency protocol:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/emergency-protocols/:id
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/emergency-protocols/:id`, async (c) => {
    try {
      const { vendorId, id } = c.req.param();
      const updates = await c.req.json();
      
      const protocols = await kv.get(`vendor:${vendorId}:emergency:protocols`) || [];
      const index = protocols.findIndex((p: any) => p.id === id);
      
      if (index === -1) {
        return sendError(c, 'Protocol not found', 404);
      }
      
      protocols[index] = { ...protocols[index], ...updates, updatedAt: new Date().toISOString() };
      
      await kv.set(`vendor:${vendorId}:emergency:protocols`, protocols);
      await kv.set(`emergency:protocol:${id}`, protocols[index]);
      
      return sendSuccess(c, { protocol: protocols[index] }, 'Protocol updated successfully');
    } catch (error) {
      console.error('Error updating protocol:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/emergency-protocols/:id
   */
  app.delete(`${BASE_PATH}/vendor/:vendorId/emergency-protocols/:id`, async (c) => {
    try {
      const { vendorId, id } = c.req.param();
      
      const protocols = await kv.get(`vendor:${vendorId}:emergency:protocols`) || [];
      const updatedProtocols = protocols.filter((p: any) => p.id !== id);
      
      await kv.set(`vendor:${vendorId}:emergency:protocols`, updatedProtocols);
      await kv.del(`emergency:protocol:${id}`);
      
      return sendSuccess(c, {}, 'Protocol deleted successfully');
    } catch (error) {
      console.error('Error deleting protocol:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // NUTRITIONIST ENDPOINTS (OLD PATHS)
  // ============================================

  /**
   * GET /nutritionist/:vendorId/meal-plans
   * OLD PATH: Maps to /vendor/:vendorId/nutritionist/meal-plans
   */
  app.get(`${BASE_PATH}/nutritionist/:vendorId/meal-plans`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const mealPlans = await kv.get(`vendor:${vendorId}:nutritionist:meal-plans`) || [];
      return sendSuccess(c, { mealPlans, total: mealPlans.length });
    } catch (error) {
      console.error('Error fetching meal plans:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /nutritionist/meal-plan/create
   * OLD PATH: Create meal plan
   */
  app.post(`${BASE_PATH}/nutritionist/meal-plan/create`, async (c) => {
    try {
      const data = await c.req.json();
      const { nutritionistId, customerId, petId, planName, description, startDate, endDate, meals = [], nutritionalGoals = {} } = data;
      
      if (!nutritionistId) {
        return sendError(c, 'Nutritionist ID is required', 400);
      }
      
      const planId = `meal_plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const mealPlan = {
        id: planId,
        nutritionistId,
        customerId,
        petId,
        planName,
        description,
        startDate,
        endDate,
        meals,
        nutritionalGoals,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      
      const mealPlans = await kv.get(`vendor:${nutritionistId}:nutritionist:meal-plans`) || [];
      mealPlans.push(mealPlan);
      
      await kv.set(`vendor:${nutritionistId}:nutritionist:meal-plans`, mealPlans);
      await kv.set(`meal-plan:${planId}`, mealPlan);
      
      return sendSuccess(c, { mealPlan }, 'Meal plan created successfully');
    } catch (error) {
      console.error('Error creating meal plan:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // MEAL PRODUCTS ENDPOINTS (Nutritionist)
  // ============================================

  /**
   * GET /vendor/:vendorId/meal-products
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/meal-products`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const products = await kv.get(`vendor:${vendorId}:meal-products`) || [];
      return sendSuccess(c, { products, total: products.length });
    } catch (error) {
      console.error('Error fetching meal products:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/meal-products
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/meal-products`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const productData = await c.req.json();
      
      const productId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const product = {
        id: productId,
        ...productData,
        vendorId,
        createdAt: new Date().toISOString()
      };
      
      const products = await kv.get(`vendor:${vendorId}:meal-products`) || [];
      products.push(product);
      
      await kv.set(`vendor:${vendorId}:meal-products`, products);
      
      return sendSuccess(c, { product }, 'Product added successfully');
    } catch (error) {
      console.error('Error adding product:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/meal-products/:id
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/meal-products/:id`, async (c) => {
    try {
      const { vendorId, id } = c.req.param();
      const updates = await c.req.json();
      
      const products = await kv.get(`vendor:${vendorId}:meal-products`) || [];
      const index = products.findIndex((p: any) => p.id === id);
      
      if (index === -1) {
        return sendError(c, 'Product not found', 404);
      }
      
      products[index] = { ...products[index], ...updates, updatedAt: new Date().toISOString() };
      
      await kv.set(`vendor:${vendorId}:meal-products`, products);
      
      return sendSuccess(c, { product: products[index] }, 'Product updated successfully');
    } catch (error) {
      console.error('Error updating product:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/meal-products/:id
   */
  app.delete(`${BASE_PATH}/vendor/:vendorId/meal-products/:id`, async (c) => {
    try {
      const { vendorId, id } = c.req.param();
      
      const products = await kv.get(`vendor:${vendorId}:meal-products`) || [];
      const updatedProducts = products.filter((p: any) => p.id !== id);
      
      await kv.set(`vendor:${vendorId}:meal-products`, updatedProducts);
      
      return sendSuccess(c, {}, 'Product deleted successfully');
    } catch (error) {
      console.error('Error deleting product:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // MEAL ORDERS ENDPOINTS
  // ============================================

  /**
   * GET /vendor/:vendorId/meal-orders
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/meal-orders`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const orders = await kv.get(`vendor:${vendorId}:meal-orders`) || [];
      return sendSuccess(c, { orders, total: orders.length });
    } catch (error) {
      console.error('Error fetching meal orders:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/meal-orders/:orderId/status
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/meal-orders/:orderId/status`, async (c) => {
    try {
      const { vendorId, orderId } = c.req.param();
      const { status } = await c.req.json();
      
      const orders = await kv.get(`vendor:${vendorId}:meal-orders`) || [];
      const index = orders.findIndex((o: any) => o.id === orderId);
      
      if (index === -1) {
        return sendError(c, 'Order not found', 404);
      }
      
      orders[index].status = status;
      orders[index].updatedAt = new Date().toISOString();
      
      await kv.set(`vendor:${vendorId}:meal-orders`, orders);
      
      return sendSuccess(c, { order: orders[index] }, 'Order status updated');
    } catch (error) {
      console.error('Error updating order status:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CAFE MENU ENDPOINTS (OLD PATHS)
  // ============================================

  /**
   * GET /vendor/cafe/:vendorId/menu
   */
  app.get(`${BASE_PATH}/vendor/cafe/:vendorId/menu`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const menuItems = await kv.get(`vendor:${vendorId}:cafe:menu`) || [];
      return sendSuccess(c, { menuItems, total: menuItems.length });
    } catch (error) {
      console.error('Error fetching cafe menu:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/cafe/:vendorId/menu
   */
  app.post(`${BASE_PATH}/vendor/cafe/:vendorId/menu`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const itemData = await c.req.json();
      
      const itemId = `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const menuItem = {
        id: itemId,
        ...itemData,
        vendorId,
        createdAt: new Date().toISOString()
      };
      
      const menuItems = await kv.get(`vendor:${vendorId}:cafe:menu`) || [];
      menuItems.push(menuItem);
      
      await kv.set(`vendor:${vendorId}:cafe:menu`, menuItems);
      
      return sendSuccess(c, { menuItem }, 'Menu item added successfully');
    } catch (error) {
      console.error('Error adding menu item:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/cafe/:vendorId/menu/:itemId
   */
  app.put(`${BASE_PATH}/vendor/cafe/:vendorId/menu/:itemId`, async (c) => {
    try {
      const { vendorId, itemId } = c.req.param();
      const updates = await c.req.json();
      
      const menuItems = await kv.get(`vendor:${vendorId}:cafe:menu`) || [];
      const index = menuItems.findIndex((i: any) => i.id === itemId);
      
      if (index === -1) {
        return sendError(c, 'Menu item not found', 404);
      }
      
      menuItems[index] = { ...menuItems[index], ...updates, updatedAt: new Date().toISOString() };
      
      await kv.set(`vendor:${vendorId}:cafe:menu`, menuItems);
      
      return sendSuccess(c, { menuItem: menuItems[index] }, 'Menu item updated successfully');
    } catch (error) {
      console.error('Error updating menu item:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /vendor/cafe/:vendorId/menu/:itemId
   */
  app.delete(`${BASE_PATH}/vendor/cafe/:vendorId/menu/:itemId`, async (c) => {
    try {
      const { vendorId, itemId } = c.req.param();
      
      const menuItems = await kv.get(`vendor:${vendorId}:cafe:menu`) || [];
      const updatedItems = menuItems.filter((i: any) => i.id !== itemId);
      
      await kv.set(`vendor:${vendorId}:cafe:menu`, updatedItems);
      
      return sendSuccess(c, {}, 'Menu item deleted successfully');
    } catch (error) {
      console.error('Error deleting menu item:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // BOARDING ROOM ENDPOINTS (OLD PATHS)
  // ============================================

  /**
   * GET /vendor/:vendorId/boarding/rooms
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/boarding/rooms`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const rooms = await kv.get(`vendor:${vendorId}:boarding:rooms`) || [];
      return sendSuccess(c, { rooms, total: rooms.length });
    } catch (error) {
      console.error('Error fetching boarding rooms:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/boarding/rooms
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/boarding/rooms`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const roomData = await c.req.json();
      
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const room = {
        id: roomId,
        ...roomData,
        vendorId,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      
      const rooms = await kv.get(`vendor:${vendorId}:boarding:rooms`) || [];
      rooms.push(room);
      
      await kv.set(`vendor:${vendorId}:boarding:rooms`, rooms);
      await kv.set(`boarding:room:${roomId}`, room);
      
      return sendSuccess(c, { room }, 'Room created successfully');
    } catch (error) {
      console.error('Error creating boarding room:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/boarding/rooms/:roomId
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/boarding/rooms/:roomId`, async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();
      const updates = await c.req.json();
      
      const rooms = await kv.get(`vendor:${vendorId}:boarding:rooms`) || [];
      const index = rooms.findIndex((r: any) => r.id === roomId);
      
      if (index === -1) {
        return sendError(c, 'Room not found', 404);
      }
      
      rooms[index] = { ...rooms[index], ...updates, updatedAt: new Date().toISOString() };
      
      await kv.set(`vendor:${vendorId}:boarding:rooms`, rooms);
      await kv.set(`boarding:room:${roomId}`, rooms[index]);
      
      return sendSuccess(c, { room: rooms[index] }, 'Room updated successfully');
    } catch (error) {
      console.error('Error updating boarding room:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/boarding/rooms/:roomId
   */
  app.delete(`${BASE_PATH}/vendor/:vendorId/boarding/rooms/:roomId`, async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();
      
      const rooms = await kv.get(`vendor:${vendorId}:boarding:rooms`) || [];
      const updatedRooms = rooms.filter((r: any) => r.id !== roomId);
      
      await kv.set(`vendor:${vendorId}:boarding:rooms`, updatedRooms);
      await kv.del(`boarding:room:${roomId}`);
      
      return sendSuccess(c, {}, 'Room deleted successfully');
    } catch (error) {
      console.error('Error deleting boarding room:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/boarding/rooms/:roomId/media
   * POST /vendor/:vendorId/boarding/rooms/temp/media
   * Handle room media uploads
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/boarding/rooms/:roomId/media`, async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();
      
      // For now, return a mock URL - in production would handle actual upload
      const mediaUrl = `https://example.com/media/${roomId}_${Date.now()}.jpg`;
      
      return sendSuccess(c, { url: mediaUrl }, 'Media uploaded successfully');
    } catch (error) {
      console.error('Error uploading media:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // PET LISTING ENDPOINTS (Breeder/Adoption)
  // ============================================

  /**
   * GET /vendor/:vendorId/pet-listings
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/pet-listings`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const listings = await kv.get(`vendor:${vendorId}:pet-listings`) || [];
      return sendSuccess(c, { listings, total: listings.length });
    } catch (error) {
      console.error('Error fetching pet listings:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/pet-listings
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/pet-listings`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const listingData = await c.req.json();
      
      const listingId = `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const listing = {
        id: listingId,
        ...listingData,
        vendorId,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      
      const listings = await kv.get(`vendor:${vendorId}:pet-listings`) || [];
      listings.push(listing);
      
      await kv.set(`vendor:${vendorId}:pet-listings`, listings);
      await kv.set(`pet-listing:${listingId}`, listing);
      
      return sendSuccess(c, { listing }, 'Listing created successfully');
    } catch (error) {
      console.error('Error creating pet listing:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/pet-listings/:listingId
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/pet-listings/:listingId`, async (c) => {
    try {
      const { vendorId, listingId } = c.req.param();
      const updates = await c.req.json();
      
      const listings = await kv.get(`vendor:${vendorId}:pet-listings`) || [];
      const index = listings.findIndex((l: any) => l.id === listingId);
      
      if (index === -1) {
        return sendError(c, 'Listing not found', 404);
      }
      
      listings[index] = { ...listings[index], ...updates, updatedAt: new Date().toISOString() };
      
      await kv.set(`vendor:${vendorId}:pet-listings`, listings);
      await kv.set(`pet-listing:${listingId}`, listings[index]);
      
      return sendSuccess(c, { listing: listings[index] }, 'Listing updated successfully');
    } catch (error) {
      console.error('Error updating pet listing:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/pet-listings/:listingId
   */
  app.delete(`${BASE_PATH}/vendor/:vendorId/pet-listings/:listingId`, async (c) => {
    try {
      const { vendorId, listingId } = c.req.param();
      
      const listings = await kv.get(`vendor:${vendorId}:pet-listings`) || [];
      const updatedListings = listings.filter((l: any) => l.id !== listingId);
      
      await kv.set(`vendor:${vendorId}:pet-listings`, updatedListings);
      await kv.del(`pet-listing:${listingId}`);
      
      return sendSuccess(c, {}, 'Listing deleted successfully');
    } catch (error) {
      console.error('Error deleting pet listing:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/pet-listings/media/upload
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/pet-listings/media/upload`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Mock media upload - in production would handle actual file upload
      const mediaUrl = `https://example.com/listings/${vendorId}_${Date.now()}.jpg`;
      
      return sendSuccess(c, { url: mediaUrl }, 'Media uploaded successfully');
    } catch (error) {
      console.error('Error uploading media:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // MISC VENDOR ENDPOINTS
  // ============================================

  /**
   * GET /vendor/:vendorId/prescriptions
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/prescriptions`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const prescriptions = await kv.get(`vendor:${vendorId}:prescriptions`) || [];
      return sendSuccess(c, { prescriptions, total: prescriptions.length });
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/center-availability
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/center-availability`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const availability = await kv.get(`vendor:${vendorId}:center-availability`) || {
        isOpen: true,
        operatingHours: {},
        holidays: []
      };
      return sendSuccess(c, { availability });
    } catch (error) {
      console.error('Error fetching center availability:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/center-availability
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/center-availability`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const availabilityData = await c.req.json();
      
      await kv.set(`vendor:${vendorId}:center-availability`, {
        ...availabilityData,
        updatedAt: new Date().toISOString()
      });
      
      return sendSuccess(c, {}, 'Availability updated successfully');
    } catch (error) {
      console.error('Error updating center availability:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/food-orders
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/food-orders`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const orders = await kv.get(`vendor:${vendorId}:food-orders`) || [];
      return sendSuccess(c, { orders, total: orders.length });
    } catch (error) {
      console.error('Error fetching food orders:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/holiday-bookings
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/holiday-bookings`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const bookings = await kv.get(`vendor:${vendorId}:holiday-bookings`) || [];
      return sendSuccess(c, { bookings, total: bookings.length });
    } catch (error) {
      console.error('Error fetching holiday bookings:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/holiday-packages
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/holiday-packages`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const packages = await kv.get(`vendor:${vendorId}:holiday-packages`) || [];
      return sendSuccess(c, { packages, total: packages.length });
    } catch (error) {
      console.error('Error fetching holiday packages:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/scheduling-policy
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/scheduling-policy`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const policy = await kv.get(`vendor:${vendorId}:scheduling-policy`) || {
        advanceBookingDays: 30,
        minNoticeHours: 24,
        bufferMinutes: 0
      };
      return sendSuccess(c, { policy });
    } catch (error) {
      console.error('Error fetching scheduling policy:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/scheduling-policy
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/scheduling-policy`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const policyData = await c.req.json();
      
      await kv.set(`vendor:${vendorId}:scheduling-policy`, {
        ...policyData,
        updatedAt: new Date().toISOString()
      });
      
      return sendSuccess(c, {}, 'Scheduling policy updated successfully');
    } catch (error) {
      console.error('Error updating scheduling policy:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Backwards-compatible endpoints registered (extended)');
}