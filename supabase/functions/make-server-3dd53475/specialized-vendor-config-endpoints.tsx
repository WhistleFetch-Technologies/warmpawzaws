/**
 * SPECIALIZED VENDOR CONFIGURATION ENDPOINTS
 * 
 * Handles special configuration requirements for different vendor types:
 * - Ambulance: Vehicle fleet, drivers
 * - Diagnostics: Test catalog, equipment
 * - Pharmacy: Medicine inventory
 * - Nutritionist: Meal plans
 * - Cafe: Tables, PAX capacity
 * - Breeder/Adoption: Puppy/Pet profiles
 * - Pet Resort/Boarding: Room configuration, pricing
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { sendSuccess, sendError } from './response-utils.ts';

const app = new Hono();

// ============================================
// AMBULANCE: VEHICLE FLEET MANAGEMENT
// ============================================

/**
 * GET /vendor/:vendorId/ambulance/vehicles
 * Get all vehicles for an ambulance service
 */
app.get('/make-server-3dd53475/vendor/:vendorId/ambulance/vehicles', async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const vehicles = await kv.get(`vendor:${vendorId}:ambulance:vehicles`) || [];
    
    return sendSuccess(c, { vehicles, total: vehicles.length });
  } catch (error) {
    console.error('Error fetching ambulance vehicles:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/:vendorId/ambulance/vehicles
 * Add a new vehicle
 */
app.post('/make-server-3dd53475/vendor/:vendorId/ambulance/vehicles', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const vehicleData = await c.req.json();
    
    const vehicleId = `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const vehicle = {
      id: vehicleId,
      ...vehicleData,
      vendorId,
      isAvailable: true,
      createdAt: new Date().toISOString()
    };
    
    const vehicles = await kv.get(`vendor:${vendorId}:ambulance:vehicles`) || [];
    vehicles.push(vehicle);
    
    await kv.set(`vendor:${vendorId}:ambulance:vehicles`, vehicles);
    await kv.set(`ambulance:vehicle:${vehicleId}`, vehicle);
    
    return sendSuccess(c, { vehicle }, 'Vehicle added successfully');
  } catch (error) {
    console.error('Error adding ambulance vehicle:', error);
    return sendError(c, error, 500);
  }
});

// ============================================
// DIAGNOSTICS: TEST CATALOG
// ============================================

/**
 * GET /vendor/:vendorId/diagnostics/tests
 * Get all diagnostic tests offered by this center
 */
app.get('/make-server-3dd53475/vendor/:vendorId/diagnostics/tests', async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const tests = await kv.get(`vendor:${vendorId}:diagnostics:tests`) || [];
    
    return sendSuccess(c, { tests, total: tests.length });
  } catch (error) {
    console.error('Error fetching diagnostic tests:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/:vendorId/diagnostics/tests
 * Add a new diagnostic test
 */
app.post('/make-server-3dd53475/vendor/:vendorId/diagnostics/tests', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const testData = await c.req.json();
    
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const test = {
      id: testId,
      ...testData,
      vendorId,
      isAvailable: true,
      createdAt: new Date().toISOString()
    };
    
    const tests = await kv.get(`vendor:${vendorId}:diagnostics:tests`) || [];
    tests.push(test);
    
    await kv.set(`vendor:${vendorId}:diagnostics:tests`, tests);
    
    return sendSuccess(c, { test }, 'Diagnostic test added successfully');
  } catch (error) {
    console.error('Error adding diagnostic test:', error);
    return sendError(c, error, 500);
  }
});

// ============================================
// PHARMACY: MEDICINE INVENTORY
// ============================================

/**
 * GET /vendor/:vendorId/pharmacy/medicines
 * Get pharmacy inventory
 */
app.get('/make-server-3dd53475/vendor/:vendorId/pharmacy/medicines', async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const medicines = await kv.get(`vendor:${vendorId}:pharmacy:inventory`) || [];
    
    return sendSuccess(c, { medicines, total: medicines.length });
  } catch (error) {
    console.error('Error fetching pharmacy inventory:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/:vendorId/pharmacy/medicines
 * Add medicine to inventory
 */
app.post('/make-server-3dd53475/vendor/:vendorId/pharmacy/medicines', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const medicineData = await c.req.json();
    
    const medicineId = `med_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const medicine = {
      id: medicineId,
      ...medicineData,
      vendorId,
      isAvailable: true,
      createdAt: new Date().toISOString()
    };
    
    const medicines = await kv.get(`vendor:${vendorId}:pharmacy:inventory`) || [];
    medicines.push(medicine);
    
    await kv.set(`vendor:${vendorId}:pharmacy:inventory`, medicines);
    
    return sendSuccess(c, { medicine }, 'Medicine added to inventory');
  } catch (error) {
    console.error('Error adding medicine:', error);
    return sendError(c, error, 500);
  }
});

// ============================================
// NUTRITIONIST: MEAL PLANS
// ============================================

/**
 * GET /vendor/:vendorId/nutritionist/meal-plans
 * Get all meal plans
 */
app.get('/make-server-3dd53475/vendor/:vendorId/nutritionist/meal-plans', async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const mealPlans = await kv.get(`vendor:${vendorId}:nutritionist:meal_plans`) || [];
    
    return sendSuccess(c, { mealPlans, total: mealPlans.length });
  } catch (error) {
    console.error('Error fetching meal plans:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/:vendorId/nutritionist/meal-plans
 * Create a new meal plan
 */
app.post('/make-server-3dd53475/vendor/:vendorId/nutritionist/meal-plans', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const mealPlanData = await c.req.json();
    
    const mealPlanId = `meal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const mealPlan = {
      id: mealPlanId,
      ...mealPlanData,
      vendorId,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    const mealPlans = await kv.get(`vendor:${vendorId}:nutritionist:meal_plans`) || [];
    mealPlans.push(mealPlan);
    
    await kv.set(`vendor:${vendorId}:nutritionist:meal_plans`, mealPlans);
    
    return sendSuccess(c, { mealPlan }, 'Meal plan created successfully');
  } catch (error) {
    console.error('Error creating meal plan:', error);
    return sendError(c, error, 500);
  }
});

// ============================================
// CAFE: TABLE & PAX CONFIGURATION
// ============================================

/**
 * GET /vendor/:vendorId/cafe/tables
 * Get cafe table configuration
 */
app.get('/make-server-3dd53475/vendor/:vendorId/cafe/tables', async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const tableConfig = await kv.get(`vendor:${vendorId}:cafe:tables`) || {
      tables: [],
      totalSeats: 0
    };
    
    return sendSuccess(c, tableConfig);
  } catch (error) {
    console.error('Error fetching cafe tables:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/:vendorId/cafe/tables
 * Update cafe table configuration
 */
app.post('/make-server-3dd53475/vendor/:vendorId/cafe/tables', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const tableData = await c.req.json();
    
    // Calculate total seats
    const totalSeats = tableData.tables?.reduce((sum: number, table: any) => sum + (table.capacity || 0), 0) || 0;
    
    const tableConfig = {
      ...tableData,
      totalSeats,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`vendor:${vendorId}:cafe:tables`, tableConfig);
    
    return sendSuccess(c, { tableConfig }, 'Table configuration updated');
  } catch (error) {
    console.error('Error updating cafe tables:', error);
    return sendError(c, error, 500);
  }
});

// ============================================
// BREEDER/ADOPTION: PET PROFILES
// ============================================

/**
 * GET /vendor/:vendorId/breeder/puppies
 * Get all available puppies/pets for adoption/breeding
 */
app.get('/make-server-3dd53475/vendor/:vendorId/breeder/puppies', async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const puppies = await kv.get(`vendor:${vendorId}:breeder:puppies`) || [];
    
    return sendSuccess(c, { puppies, total: puppies.length });
  } catch (error) {
    console.error('Error fetching puppies:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/:vendorId/breeder/puppies
 * Add a new puppy/pet profile
 */
app.post('/make-server-3dd53475/vendor/:vendorId/breeder/puppies', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const puppyData = await c.req.json();
    
    const puppyId = `puppy_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const puppy = {
      id: puppyId,
      ...puppyData,
      vendorId,
      status: 'available',
      createdAt: new Date().toISOString()
    };
    
    const puppies = await kv.get(`vendor:${vendorId}:breeder:puppies`) || [];
    puppies.push(puppy);
    
    await kv.set(`vendor:${vendorId}:breeder:puppies`, puppies);
    
    return sendSuccess(c, { puppy }, 'Puppy profile created successfully');
  } catch (error) {
    console.error('Error creating puppy profile:', error);
    return sendError(c, error, 500);
  }
});

// ============================================
// PET RESORT/BOARDING: ROOM CONFIGURATION
// ============================================

/**
 * GET /vendor/:vendorId/resort/rooms
 * Get room configuration and pricing
 */
app.get('/make-server-3dd53475/vendor/:vendorId/resort/rooms', async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const rooms = await kv.get(`vendor:${vendorId}:resort:rooms`) || [];
    
    return sendSuccess(c, { rooms, total: rooms.length });
  } catch (error) {
    console.error('Error fetching resort rooms:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/:vendorId/resort/rooms
 * Add/update room configuration
 */
app.post('/make-server-3dd53475/vendor/:vendorId/resort/rooms', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const roomData = await c.req.json();
    
    const roomId = roomData.id || `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const room = {
      id: roomId,
      ...roomData,
      vendorId,
      isAvailable: true,
      createdAt: roomData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const rooms = await kv.get(`vendor:${vendorId}:resort:rooms`) || [];
    const existingIndex = rooms.findIndex((r: any) => r.id === roomId);
    
    if (existingIndex >= 0) {
      rooms[existingIndex] = room;
    } else {
      rooms.push(room);
    }
    
    await kv.set(`vendor:${vendorId}:resort:rooms`, rooms);
    
    return sendSuccess(c, { room }, 'Room configuration updated');
  } catch (error) {
    console.error('Error updating resort room:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /vendor/:vendorId/resort/pricing
 * Get day/night pricing for boarding/daycare
 */
app.get('/make-server-3dd53475/vendor/:vendorId/resort/pricing', async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const pricing = await kv.get(`vendor:${vendorId}:resort:pricing`) || {
      daycare: {},
      boarding: {}
    };
    
    return sendSuccess(c, { pricing });
  } catch (error) {
    console.error('Error fetching resort pricing:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/:vendorId/resort/pricing
 * Update day/night pricing
 */
app.post('/make-server-3dd53475/vendor/:vendorId/resort/pricing', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const pricingData = await c.req.json();
    
    const pricing = {
      ...pricingData,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`vendor:${vendorId}:resort:pricing`, pricing);
    
    return sendSuccess(c, { pricing }, 'Pricing updated successfully');
  } catch (error) {
    console.error('Error updating resort pricing:', error);
    return sendError(c, error, 500);
  }
});

// ============================================
// BOARDING: DAY CARE FACILITIES
// ============================================

/**
 * GET /vendor/:vendorId/boarding/facilities
 * Get boarding facility configuration
 */
app.get('/make-server-3dd53475/vendor/:vendorId/boarding/facilities', async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const facilities = await kv.get(`vendor:${vendorId}:boarding:facilities`) || {
      hasDaycare: false,
      hasBoarding: false,
      amenities: []
    };
    
    return sendSuccess(c, { facilities });
  } catch (error) {
    console.error('Error fetching boarding facilities:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/:vendorId/boarding/facilities
 * Update boarding facility configuration
 */
app.post('/make-server-3dd53475/vendor/:vendorId/boarding/facilities', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const facilityData = await c.req.json();
    
    const facilities = {
      ...facilityData,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`vendor:${vendorId}:boarding:facilities`, facilities);
    
    return sendSuccess(c, { facilities }, 'Facilities updated successfully');
  } catch (error) {
    console.error('Error updating boarding facilities:', error);
    return sendError(c, error, 500);
  }
});

export default app;
