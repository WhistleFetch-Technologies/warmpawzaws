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

  // ============================================
  // GALLERY ENDPOINTS (BACKWARDS COMPATIBLE)
  // ============================================

  /**
   * GET /groomer-gallery/:vendorId
   * OLD PATH: Maps to /vendor/:vendorId/gallery
   */
  app.get(`${BASE_PATH}/groomer-gallery/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const galleryPhotoIds = await kv.get(`vendor:${vendorId}:gallery`) || [];
      
      const photos: any[] = [];
      for (const photoId of galleryPhotoIds) {
        const photo = await kv.get(`gallery:photo:${photoId}`);
        if (photo) {
          photos.push({
            id: photo.id,
            imageUrl: photo.afterPhoto || photo.beforePhoto || photo.imageUrl,
            caption: photo.description,
            category: photo.category || 'other',
            isFeatured: photo.isPublic || false,
            orderIndex: photos.length,
            uploadedAt: photo.uploadedAt,
            metadata: {
              petName: photo.petName,
              serviceType: photo.serviceName,
              date: photo.uploadedAt
            }
          });
        }
      }
      
      return sendSuccess(c, { images: photos, total: photos.length });
    } catch (error) {
      console.error('Error fetching gallery:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /groomer-gallery/:vendorId
   * OLD PATH: Upload gallery image
   */
  app.post(`${BASE_PATH}/groomer-gallery/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { image, caption, category, isFeatured } = await c.req.json();
      
      if (!image) {
        return sendError(c, 'Image is required', 400);
      }
      
      const photoId = `gallery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const galleryEntry = {
        id: photoId,
        vendorId,
        imageUrl: image, // Base64 or URL
        afterPhoto: image,
        description: caption || '',
        category: category || 'other',
        tags: [],
        isPublic: isFeatured || false,
        uploadedAt: new Date().toISOString(),
        likes: 0,
        views: 0
      };
      
      await kv.set(`gallery:photo:${photoId}`, galleryEntry);
      
      const vendorGallery = await kv.get(`vendor:${vendorId}:gallery`) || [];
      vendorGallery.unshift(photoId);
      await kv.set(`vendor:${vendorId}:gallery`, vendorGallery);
      
      if (isFeatured) {
        const portfolio = await kv.get(`vendor:${vendorId}:portfolio`) || [];
        if (!portfolio.includes(photoId)) {
          portfolio.unshift(photoId);
          await kv.set(`vendor:${vendorId}:portfolio`, portfolio);
        }
      }
      
      return sendSuccess(c, { image: galleryEntry }, 'Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading gallery image:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /groomer-gallery/:vendorId/:imageId
   * OLD PATH: Delete gallery image
   */
  app.delete(`${BASE_PATH}/groomer-gallery/:vendorId/:imageId`, async (c) => {
    try {
      const { vendorId, imageId } = c.req.param();
      
      const photo = await kv.get(`gallery:photo:${imageId}`);
      if (!photo || photo.vendorId !== vendorId) {
        return sendError(c, 'Photo not found or unauthorized', 404);
      }
      
      await kv.del(`gallery:photo:${imageId}`);
      
      const vendorGallery = await kv.get(`vendor:${vendorId}:gallery`) || [];
      const filtered = vendorGallery.filter((id: string) => id !== imageId);
      await kv.set(`vendor:${vendorId}:gallery`, filtered);
      
      const portfolio = await kv.get(`vendor:${vendorId}:portfolio`) || [];
      const filteredPortfolio = portfolio.filter((id: string) => id !== imageId);
      await kv.set(`vendor:${vendorId}:portfolio`, filteredPortfolio);
      
      return sendSuccess(c, {}, 'Image deleted successfully');
    } catch (error) {
      console.error('Error deleting gallery image:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // PORTFOLIO ENDPOINTS (BACKWARDS COMPATIBLE)
  // ============================================

  /**
   * GET /vendor/portfolio/:vendorId
   * Standardized endpoint - already exists in portfolio-endpoints.tsx
   * This is just for reference - the actual endpoint is registered separately
   */

  // ============================================
  // CUSTOMER-FACING ENDPOINTS FOR DIAGNOSTIC TESTS
  // ============================================

  /**
   * GET /customer/clinic/:vendorId/diagnostic-tests
   * Get all active diagnostic tests for a clinic (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/clinic/:vendorId/diagnostic-tests`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Get vendor's diagnostic tests
      const tests = await kv.get(`vendor:${vendorId}:diagnostic:tests`) || [];
      
      // Filter only active tests
      const activeTests = tests.filter((t: any) => t.isActive !== false);
      
      return sendSuccess(c, { tests: activeTests, total: activeTests.length });
    } catch (error) {
      console.error('Error fetching diagnostic tests for customer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/clinic/:vendorId/emergency-protocols
   * Get all active emergency protocols for a clinic (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/clinic/:vendorId/emergency-protocols`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Get vendor's emergency protocols
      const protocols = await kv.get(`vendor:${vendorId}:emergency:protocols`) || [];
      
      // Filter only active protocols
      const activeProtocols = protocols.filter((p: any) => p.isActive !== false);
      
      return sendSuccess(c, { protocols: activeProtocols, total: activeProtocols.length });
    } catch (error) {
      console.error('Error fetching emergency protocols for customer:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CUSTOMER-FACING ENDPOINTS FOR GALLERY & PORTFOLIO
  // ============================================

  /**
   * GET /customer/clinic/:vendorId/gallery
   * Get vendor's public gallery photos (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/clinic/:vendorId/gallery`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');
      
      // Get gallery photo IDs
      const galleryPhotoIds = await kv.get(`vendor:${vendorId}:gallery`) || [];
      
      // Fetch photo details (only public photos for customers)
      const photos: any[] = [];
      for (const photoId of galleryPhotoIds) {
        const photo = await kv.get(`gallery:photo:${photoId}`);
        if (photo && photo.isPublic !== false) {
          photos.push(photo);
        }
      }
      
      // Apply pagination
      const totalCount = photos.length;
      const paginatedPhotos = photos.slice(offset, offset + limit);
      
      return sendSuccess(c, {
        photos: paginatedPhotos,
        pagination: {
          totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      });
    } catch (error) {
      console.error('Error fetching gallery for customer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/clinic/:vendorId/portfolio
   * Get vendor's public portfolio items (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/clinic/:vendorId/portfolio`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');
      
      // Get portfolio photo IDs
      const portfolioPhotoIds = await kv.get(`vendor:${vendorId}:portfolio`) || [];
      
      // Fetch photo details (only public portfolio items)
      const photos: any[] = [];
      for (const photoId of portfolioPhotoIds) {
        const photo = await kv.get(`gallery:photo:${photoId}`);
        if (photo && photo.isPublic !== false) {
          photos.push(photo);
        }
      }
      
      // Also check portfolio items from portfolio-endpoints
      const portfolioItems = await kv.getByPrefix(`portfolio:${vendorId}:`);
      const publicPortfolioItems = portfolioItems.filter((item: any) => item.isPublic !== false);
      
      // Combine gallery photos and portfolio items
      const allItems = [
        ...photos.map(p => ({ type: 'photo', ...p })),
        ...publicPortfolioItems.map((item: any) => ({ type: 'portfolio', ...item }))
      ];
      
      // Apply pagination
      const totalCount = allItems.length;
      const paginatedItems = allItems.slice(offset, offset + limit);
      
      return sendSuccess(c, {
        items: paginatedItems,
        portfolioCount: totalCount,
        pagination: {
          totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      });
    } catch (error) {
      console.error('Error fetching portfolio for customer:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CUSTOMER-FACING ADOPTION ENDPOINTS
  // ============================================

  /**
   * GET /customer/adoption/:vendorId/pets
   * Get all available adoptable pets for a vendor (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/adoption/:vendorId/pets`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { status } = c.req.query(); // Optional: filter by status
      
      // Get all adoptable pets for this vendor
      const allPets = await kv.getByPrefix(`adoption:pet:${vendorId}:`) || [];
      
      // Filter by status (default: only 'available')
      let filteredPets = allPets;
      if (status) {
        filteredPets = allPets.filter((p: any) => p.status === status);
      } else {
        // Default: only show available pets to customers
        filteredPets = allPets.filter((p: any) => p.status === 'available');
      }
      
      // Sort by arrival date (newest first)
      const sortedPets = filteredPets.sort((a: any, b: any) => 
        new Date(b.arrivalDate || b.createdAt || 0).getTime() - 
        new Date(a.arrivalDate || a.createdAt || 0).getTime()
      );
      
      return sendSuccess(c, { pets: sortedPets, total: sortedPets.length });
    } catch (error) {
      console.error('Error fetching adoptable pets for customer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/adoption/:vendorId/pets/:petId
   * Get details of a specific adoptable pet (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/adoption/:vendorId/pets/:petId`, async (c) => {
    try {
      const { vendorId, petId } = c.req.param();
      
      const pet = await kv.get(`adoption:pet:${vendorId}:${petId}`);
      
      if (!pet) {
        return sendError(c, 'Pet not found', 404);
      }
      
      // Only return if pet is available or explicitly requested
      if (pet.status !== 'available' && c.req.query('includeAll') !== 'true') {
        return sendError(c, 'Pet is not available for adoption', 404);
      }
      
      return sendSuccess(c, { pet });
    } catch (error) {
      console.error('Error fetching pet details for customer:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CUSTOMER-FACING EVENT ENDPOINTS
  // ============================================

  /**
   * GET /customer/events/:vendorId
   * Get all published events for a vendor (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/events/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { upcoming, category } = c.req.query();
      
      // Get all events for this vendor
      const allEvents = await kv.getByPrefix(`event:${vendorId}:`) || [];
      
      // Filter only published events
      let filteredEvents = allEvents.filter((e: any) => e.status === 'published' || e.status === 'ongoing');
      
      // Filter by category if provided
      if (category) {
        filteredEvents = filteredEvents.filter((e: any) => e.category === category);
      }
      
      // Filter upcoming events if requested
      if (upcoming === 'true') {
        const now = new Date();
        filteredEvents = filteredEvents.filter((e: any) => {
          const eventDate = new Date(e.eventDate);
          return eventDate >= now && e.status !== 'completed' && e.status !== 'cancelled';
        });
      }
      
      // Sort by event date (upcoming first)
      filteredEvents.sort((a: any, b: any) => 
        new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
      );
      
      return sendSuccess(c, { events: filteredEvents, total: filteredEvents.length });
    } catch (error) {
      console.error('Error fetching events for customer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/events/:vendorId/:eventId
   * Get details of a specific event (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/events/:vendorId/:eventId`, async (c) => {
    try {
      const { vendorId, eventId } = c.req.param();
      
      const event = await kv.get(`event:${vendorId}:${eventId}`);
      
      if (!event) {
        return sendError(c, 'Event not found', 404);
      }
      
      // Only return published/ongoing events to customers
      if (event.status !== 'published' && event.status !== 'ongoing') {
        return sendError(c, 'Event is not available', 404);
      }
      
      return sendSuccess(c, { event });
    } catch (error) {
      console.error('Error fetching event details for customer:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CUSTOMER-FACING MEMORIAL SERVICES ENDPOINTS
  // ============================================

  /**
   * GET /customer/memorial/:vendorId/services
   * Get all available memorial services for a vendor (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/memorial/:vendorId/services`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Get all memorial services for this vendor
      const allServices = await kv.getByPrefix(`memorial:service:${vendorId}:`) || [];
      
      // Filter only active/available services
      const availableServices = allServices.filter((s: any) => 
        s.status === 'scheduled' || s.status === 'in_progress' || s.status === 'completed'
      );
      
      // Sort by creation date (newest first)
      availableServices.sort((a: any, b: any) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      
      return sendSuccess(c, { services: availableServices, total: availableServices.length });
    } catch (error) {
      console.error('Error fetching memorial services for customer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/memorial/:vendorId/products
   * Get all available memorial products for a vendor (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/memorial/:vendorId/products`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Get all memorial products for this vendor
      const allProducts = await kv.getByPrefix(`memorial:product:${vendorId}:`) || [];
      
      // Filter only in-stock products
      const availableProducts = allProducts.filter((p: any) => p.inStock !== false);
      
      // Sort by creation date (newest first)
      availableProducts.sort((a: any, b: any) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      
      return sendSuccess(c, { products: availableProducts, total: availableProducts.length });
    } catch (error) {
      console.error('Error fetching memorial products for customer:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CUSTOMER-FACING PROGRESS TRACKING ENDPOINTS
  // ============================================

  /**
   * GET /customer/progress/:customerId/trackers
   * Get all progress trackers for a customer's pets (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/progress/:customerId/trackers`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const { petId, status } = c.req.query();
      
      // Get all progress trackers
      const allTrackers = await kv.getByPrefix('progress:tracker:') || [];
      
      // Filter by customer
      let customerTrackers = allTrackers.filter((t: any) => 
        t.customerId === customerId || t.customerPhone === customerId
      );
      
      // Filter by petId if provided
      if (petId) {
        customerTrackers = customerTrackers.filter((t: any) => t.petId === petId);
      }
      
      // Filter by status if provided
      if (status) {
        customerTrackers = customerTrackers.filter((t: any) => t.status === status);
      }
      
      // Sort by start date (newest first)
      customerTrackers.sort((a: any, b: any) => 
        new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime()
      );
      
      return sendSuccess(c, { trackers: customerTrackers, total: customerTrackers.length });
    } catch (error) {
      console.error('Error fetching progress trackers for customer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/progress/:customerId/trackers/:trackerId
   * Get details of a specific progress tracker (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/progress/:customerId/trackers/:trackerId`, async (c) => {
    try {
      const { customerId, trackerId } = c.req.param();
      
      // Find tracker by ID
      const allTrackers = await kv.getByPrefix('progress:tracker:') || [];
      const tracker = allTrackers.find((t: any) => 
        t.id === trackerId && (t.customerId === customerId || t.customerPhone === customerId)
      );
      
      if (!tracker) {
        return sendError(c, 'Progress tracker not found', 404);
      }
      
      return sendSuccess(c, { tracker });
    } catch (error) {
      console.error('Error fetching progress tracker details for customer:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CUSTOMER-FACING MEAL PLANS ENDPOINTS
  // ============================================

  /**
   * GET /customer/meals/:vendorId/products
   * Get all available meal products for a vendor (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/meals/:vendorId/products`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { dietType, suitableFor, petType } = c.req.query();
      
      // Get all meal products for this vendor
      const allProducts = await kv.get(`vendor:${vendorId}:meal-products`) || [];
      
      // Filter products
      let filteredProducts = allProducts;
      
      // Filter by diet type if provided
      if (dietType) {
        filteredProducts = filteredProducts.filter((p: any) => p.dietType === dietType);
      }
      
      // Filter by suitable for if provided
      if (suitableFor) {
        filteredProducts = filteredProducts.filter((p: any) => 
          p.suitableFor && p.suitableFor.includes(suitableFor)
        );
      }
      
      // Filter by pet type if provided
      if (petType) {
        filteredProducts = filteredProducts.filter((p: any) => 
          p.petTypes && p.petTypes.includes(petType)
        );
      }
      
      // Sort by creation date (newest first)
      filteredProducts.sort((a: any, b: any) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      
      return sendSuccess(c, { products: filteredProducts, total: filteredProducts.length });
    } catch (error) {
      console.error('Error fetching meal products for customer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/meals/:vendorId/products/:productId
   * Get details of a specific meal product (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/meals/:vendorId/products/:productId`, async (c) => {
    try {
      const { vendorId, productId } = c.req.param();
      
      // Get all meal products for this vendor
      const allProducts = await kv.get(`vendor:${vendorId}:meal-products`) || [];
      const product = allProducts.find((p: any) => p.id === productId);
      
      if (!product) {
        return sendError(c, 'Meal product not found', 404);
      }
      
      return sendSuccess(c, { product });
    } catch (error) {
      console.error('Error fetching meal product details for customer:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CUSTOMER-FACING DONATION ENDPOINTS
  // ============================================

  /**
   * GET /customer/donations/:vendorId/campaigns
   * Get all active donation campaigns for a vendor (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/donations/:vendorId/campaigns`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Get all campaigns for this vendor
      const allCampaigns = await kv.getByPrefix(`donation:campaign:${vendorId}:`) || [];
      
      // Filter only active campaigns
      const activeCampaigns = allCampaigns.filter((campaign: any) => 
        campaign.status === 'active' || campaign.status === 'ongoing'
      );
      
      // Sort by creation date (newest first)
      activeCampaigns.sort((a: any, b: any) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      
      return sendSuccess(c, { campaigns: activeCampaigns, total: activeCampaigns.length });
    } catch (error) {
      console.error('Error fetching donation campaigns for customer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /customer/donations/:vendorId/contribute
   * Customer contributes to a donation campaign
   */
  app.post(`${BASE_PATH}/customer/donations/:vendorId/contribute`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { campaignId, customerId, customerName, customerPhone, amount, paymentMethod, transactionId, message } = await c.req.json();
      
      if (!campaignId || !amount || amount <= 0) {
        return sendError(c, 'Campaign ID and valid amount are required', 400);
      }
      
      // Get campaign
      const campaign = await kv.get(`donation:campaign:${vendorId}:${campaignId}`);
      if (!campaign) {
        return sendError(c, 'Campaign not found', 404);
      }
      
      if (campaign.status !== 'active' && campaign.status !== 'ongoing') {
        return sendError(c, 'Campaign is not accepting donations', 400);
      }
      
      // Create donation record
      const donationId = `donation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const donation = {
        id: donationId,
        vendorId,
        campaignId,
        customerId,
        customerName,
        customerPhone,
        amount,
        paymentMethod: paymentMethod || 'online',
        transactionId,
        message,
        status: transactionId ? 'completed' : 'pending',
        createdAt: new Date().toISOString()
      };
      
      await kv.set(`donation:record:${vendorId}:${donationId}`, donation);
      
      // Update campaign total
      const updatedCampaign = {
        ...campaign,
        totalRaised: (campaign.totalRaised || 0) + amount,
        donationCount: (campaign.donationCount || 0) + 1,
        updatedAt: new Date().toISOString()
      };
      await kv.set(`donation:campaign:${vendorId}:${campaignId}`, updatedCampaign);
      
      return sendSuccess(c, { donation }, 'Donation recorded successfully');
    } catch (error) {
      console.error('Error processing donation:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CUSTOMER-FACING COUNSELING ENDPOINTS
  // ============================================

  /**
   * GET /customer/counseling/:vendorId/sessions
   * Get available counseling sessions for a vendor (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/counseling/:vendorId/sessions`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { status } = c.req.query();
      
      // Get all counseling sessions for this vendor
      const allSessions = await kv.getByPrefix(`counseling:session:${vendorId}:`) || [];
      
      // Filter by status if provided
      let filteredSessions = allSessions;
      if (status) {
        filteredSessions = allSessions.filter((s: any) => s.status === status);
      } else {
        // Default: only show available sessions to customers
        filteredSessions = allSessions.filter((s: any) => 
          s.status === 'available' || s.status === 'scheduled'
        );
      }
      
      // Sort by date (upcoming first)
      filteredSessions.sort((a: any, b: any) => 
        new Date(a.scheduledDate || a.startDate || 0).getTime() - 
        new Date(b.scheduledDate || b.startDate || 0).getTime()
      );
      
      return sendSuccess(c, { sessions: filteredSessions, total: filteredSessions.length });
    } catch (error) {
      console.error('Error fetching counseling sessions for customer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /customer/counseling/:vendorId/book
   * Customer books a counseling session
   */
  app.post(`${BASE_PATH}/customer/counseling/:vendorId/book`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { sessionId, customerId, customerName, customerPhone, petId, petName, concerns, preferredDate, preferredTime } = await c.req.json();
      
      if (!customerId || !customerName || !customerPhone) {
        return sendError(c, 'Customer information is required', 400);
      }
      
      // If sessionId provided, book existing session
      if (sessionId) {
        const session = await kv.get(`counseling:session:${vendorId}:${sessionId}`);
        if (!session) {
          return sendError(c, 'Session not found', 404);
        }
        
        if (session.status !== 'available') {
          return sendError(c, 'Session is not available for booking', 400);
        }
        
        // Update session
        const updatedSession = {
          ...session,
          customerId,
          customerName,
          customerPhone,
          petId,
          petName,
          concerns,
          status: 'booked',
          bookedAt: new Date().toISOString()
        };
        await kv.set(`counseling:session:${vendorId}:${sessionId}`, updatedSession);
        
        return sendSuccess(c, { session: updatedSession }, 'Session booked successfully');
      } else {
        // Create new session request
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newSession = {
          id: newSessionId,
          vendorId,
          customerId,
          customerName,
          customerPhone,
          petId,
          petName,
          concerns,
          preferredDate,
          preferredTime,
          status: 'requested',
          createdAt: new Date().toISOString()
        };
        
        await kv.set(`counseling:session:${vendorId}:${newSessionId}`, newSession);
        
        return sendSuccess(c, { session: newSession }, 'Session request submitted successfully');
      }
    } catch (error) {
      console.error('Error booking counseling session:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CUSTOMER-FACING DIET CHARTS ENDPOINTS
  // ============================================

  /**
   * GET /customer/diet-charts/:customerId
   * Get all diet charts for a customer's pets (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/diet-charts/:customerId`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const { petId } = c.req.query();
      
      // Get all diet charts
      const allCharts = await kv.getByPrefix('diet:chart:') || [];
      
      // Filter by customer
      let customerCharts = allCharts.filter((chart: any) => 
        chart.customerId === customerId || chart.customerPhone === customerId
      );
      
      // Filter by petId if provided
      if (petId) {
        customerCharts = customerCharts.filter((chart: any) => chart.petId === petId);
      }
      
      // Sort by creation date (newest first)
      customerCharts.sort((a: any, b: any) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      
      return sendSuccess(c, { charts: customerCharts, total: customerCharts.length });
    } catch (error) {
      console.error('Error fetching diet charts for customer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/diet-charts/:customerId/:chartId
   * Get details of a specific diet chart (customer-facing)
   */
  app.get(`${BASE_PATH}/customer/diet-charts/:customerId/:chartId`, async (c) => {
    try {
      const { customerId, chartId } = c.req.param();
      
      // Find chart by ID
      const allCharts = await kv.getByPrefix('diet:chart:') || [];
      const chart = allCharts.find((c: any) => 
        c.id === chartId && (c.customerId === customerId || c.customerPhone === customerId)
      );
      
      if (!chart) {
        return sendError(c, 'Diet chart not found', 404);
      }
      
      return sendSuccess(c, { chart });
    } catch (error) {
      console.error('Error fetching diet chart details for customer:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Backwards-compatible endpoints registered (extended with customer-facing diagnostic/emergency/gallery/portfolio/adoption/events/memorial/progress/meals/donations/counseling/diet-charts)');
}