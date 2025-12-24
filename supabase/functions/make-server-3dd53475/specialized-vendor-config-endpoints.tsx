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
// ✅ MIGRATED: Removed KV import - using SQL repositories
import { sendSuccess, sendError } from './response-utils.ts';
import { getAmbulanceVehiclesRepository } from '../../lib/repositories/ambulance-vehicles.ts';
import { getDiagnosticTestsRepository } from '../../lib/repositories/diagnostic-tests.ts';
import { getProductsRepository } from '../../lib/repositories/products.ts';
import { getMealPlansRepository } from '../../lib/repositories/meal-plans.ts';
import { getCafeTablesRepository } from '../../lib/repositories/cafe-tables.ts';
import { getAdoptionRepository } from '../../lib/repositories/adoption.ts';
import { getBoardingRoomsRepository } from '../../lib/repositories/boarding-rooms.ts';
import { getPricingRulesRepository } from '../../lib/repositories/pricing-rules.ts';
import { getBoardingFacilitiesRepository } from '../../lib/repositories/boarding-facilities.ts';

export function specializedVendorConfigEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  
  // ✅ HELPER: Resolve vendor ID to UUID (used by all endpoints)
  const resolveVendorId = async (vendorId: string): Promise<string | null> => {
    const { resolveVendorIdToUuid } = await import('../../lib/utils/vendor-id-resolver.ts');
    return await resolveVendorIdToUuid(vendorId);
  };

// ============================================
// AMBULANCE: VEHICLE FLEET MANAGEMENT
// ============================================

/**
 * GET /vendor/:vendorId/ambulance/vehicles
 * Get all vehicles for an ambulance service
 */
  app.get(`${BASE_PATH}/vendor/:vendorId/ambulance/vehicles`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Get vehicles from repository
    const vehiclesRepo = getAmbulanceVehiclesRepository();
    const vehicles = await vehiclesRepo.findByVendor(resolvedVendorId);
    
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
  app.post(`${BASE_PATH}/vendor/:vendorId/ambulance/vehicles`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    const vehicleData = await c.req.json();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Create vehicle using repository
    const vehiclesRepo = getAmbulanceVehiclesRepository();
    const vehicle = await vehiclesRepo.create({
      vendor_id: resolvedVendorId,
      vehicle_number: vehicleData.vehicleNumber || vehicleData.vehicle_number || `VEH-${Date.now()}`,
      vehicle_type: vehicleData.vehicleType || vehicleData.vehicle_type,
      capacity: vehicleData.capacity,
      equipment: vehicleData.equipment || [],
      current_location: vehicleData.currentLocation || vehicleData.current_location,
    });
    
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
  app.get(`${BASE_PATH}/vendor/:vendorId/diagnostics/tests`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Get tests from repository
    const testsRepo = getDiagnosticTestsRepository();
    const tests = await testsRepo.findByVendor(resolvedVendorId);
    
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
  app.post(`${BASE_PATH}/vendor/:vendorId/diagnostics/tests`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    const testData = await c.req.json();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Create test using repository
    const testsRepo = getDiagnosticTestsRepository();
    const test = await testsRepo.create({
      vendor_id: resolvedVendorId,
      test_name: testData.testName || testData.test_name || testData.name,
      test_code: testData.testCode || testData.test_code,
      category: testData.category,
      description: testData.description,
      price: testData.price,
      duration_minutes: testData.durationMinutes || testData.duration_minutes,
      sample_type: testData.sampleType || testData.sample_type,
      preparation_instructions: testData.preparationInstructions || testData.preparation_instructions,
    });
    
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
  app.get(`${BASE_PATH}/vendor/:vendorId/pharmacy/medicines`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Get pharmacy products from ProductsRepository (filtered by category)
    const productsRepo = getProductsRepository();
    const medicines = await productsRepo.findByVendor(resolvedVendorId);
    // Filter to pharmacy/medicine products if needed
    const pharmacyMedicines = medicines.filter((p: any) => 
      p.category === 'medicine' || p.category === 'pharmacy' || p.category?.toLowerCase().includes('medicine')
    );
    
    return sendSuccess(c, { medicines: pharmacyMedicines, total: pharmacyMedicines.length });
  } catch (error) {
    console.error('Error fetching pharmacy inventory:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/:vendorId/pharmacy/medicines
 * Add medicine to inventory
 */
  app.post(`${BASE_PATH}/vendor/:vendorId/pharmacy/medicines`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    const medicineData = await c.req.json();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Create medicine product using ProductsRepository
    const productsRepo = getProductsRepository();
    const medicine = await productsRepo.create({
      vendor_id: resolvedVendorId,
      name: medicineData.name,
      description: medicineData.description,
      category: 'medicine',
      subcategory: medicineData.subcategory,
      price: medicineData.price,
      stock: medicineData.stock || 0,
      images: medicineData.images || [],
      hsn_code: medicineData.hsnCode || medicineData.hsn_code,
      gst_rate: medicineData.gstRate || medicineData.gst_rate,
    });
    
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
  app.get(`${BASE_PATH}/vendor/:vendorId/nutritionist/meal-plans`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Get meal plans from repository
    const mealPlansRepo = getMealPlansRepository();
    const mealPlans = await mealPlansRepo.findByVendor(resolvedVendorId);
    
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
  app.post(`${BASE_PATH}/vendor/:vendorId/nutritionist/meal-plans`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    const mealPlanData = await c.req.json();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Create meal plan using repository
    const mealPlansRepo = getMealPlansRepository();
    const mealPlan = await mealPlansRepo.create({
      vendor_id: resolvedVendorId,
      plan_name: mealPlanData.planName || mealPlanData.plan_name || mealPlanData.name,
      description: mealPlanData.description,
      meals: mealPlanData.meals || [],
      nutritional_goals: mealPlanData.nutritionalGoals || mealPlanData.nutritional_goals || {},
    });
    
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
  app.get(`${BASE_PATH}/vendor/:vendorId/cafe/tables`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Get cafe tables from repository
    const cafeTablesRepo = getCafeTablesRepository();
    const tables = await cafeTablesRepo.findByVendor(resolvedVendorId);
    const totalSeats = tables.reduce((sum, table) => sum + table.capacity, 0);
    
    return sendSuccess(c, { tables, totalSeats });
  } catch (error) {
    console.error('Error fetching cafe tables:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/:vendorId/cafe/tables
 * Update cafe table configuration
 */
  app.post(`${BASE_PATH}/vendor/:vendorId/cafe/tables`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    const tableData = await c.req.json();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Update/create cafe tables using repository
    const cafeTablesRepo = getCafeTablesRepository();
    const tables = tableData.tables || [];
    const results = [];
    
    for (const table of tables) {
      if (table.id) {
        // Update existing table
        const updated = await cafeTablesRepo.update(table.id, {
          capacity: table.capacity,
          section: table.section,
          location: table.location,
          isOutdoor: table.isOutdoor,
          amenities: table.amenities,
          status: table.status,
        });
        if (updated) results.push(updated);
      } else {
        // Create new table
        const created = await cafeTablesRepo.create({
          vendorId,
          tableNumber: table.tableNumber || table.table_number || `T-${Date.now()}`,
          capacity: table.capacity,
          section: table.section,
          location: table.location,
          isOutdoor: table.isOutdoor,
          amenities: table.amenities || [],
        });
        results.push(created);
      }
    }
    
    const totalSeats = results.reduce((sum, table) => sum + table.capacity, 0);
    
    return sendSuccess(c, { tables: results, totalSeats }, 'Table configuration updated');
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
  app.get(`${BASE_PATH}/vendor/:vendorId/breeder/puppies`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Get adoption listings (puppies/pets) from AdoptionRepository
    const adoptionRepo = getAdoptionRepository();
    const puppies = await adoptionRepo.getAllListings({ vendorId: resolvedVendorId });
    
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
  app.post(`${BASE_PATH}/vendor/:vendorId/breeder/puppies`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    const puppyData = await c.req.json();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Create adoption listing using AdoptionRepository
    const adoptionRepo = getAdoptionRepository();
    const puppy = await adoptionRepo.createListing({
      vendorId: resolvedVendorId,
      petName: puppyData.petName || puppyData.name,
      petType: puppyData.petType || puppyData.type || 'dog',
      breed: puppyData.breed,
      age: puppyData.age,
      ageUnit: puppyData.ageUnit || puppyData.age_unit,
      gender: puppyData.gender,
      size: puppyData.size,
      color: puppyData.color,
      description: puppyData.description,
      medicalHistory: puppyData.medicalHistory || puppyData.medical_history,
      vaccinationStatus: puppyData.vaccinationStatus || puppyData.vaccination_status,
      spayedNeutered: puppyData.spayedNeutered || puppyData.spayed_neutered,
      microchipped: puppyData.microchipped,
      specialNeeds: puppyData.specialNeeds || puppyData.special_needs,
      photos: puppyData.photos || [],
      videos: puppyData.videos || [],
      adoptionFee: puppyData.adoptionFee || puppyData.adoption_fee || 0,
      locationCity: puppyData.locationCity || puppyData.location_city,
      locationState: puppyData.locationState || puppyData.location_state,
      contactEmail: puppyData.contactEmail || puppyData.contact_email,
      contactPhone: puppyData.contactPhone || puppyData.contact_phone,
      requirements: puppyData.requirements || {},
    });
    
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
  app.get(`${BASE_PATH}/vendor/:vendorId/resort/rooms`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Get boarding rooms from repository
    const boardingRoomsRepo = getBoardingRoomsRepository();
    const rooms = await boardingRoomsRepo.findByVendor(resolvedVendorId);
    
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
  app.post(`${BASE_PATH}/vendor/:vendorId/resort/rooms`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    const roomData = await c.req.json();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Create or update boarding room using repository
    const boardingRoomsRepo = getBoardingRoomsRepository();
    let room;
    
    if (roomData.id) {
      // Update existing room
      room = await boardingRoomsRepo.update(roomData.id, {
        name: roomData.name,
        description: roomData.description,
        dayPrice: roomData.dayPrice || roomData.day_price,
        nightPrice: roomData.nightPrice || roomData.night_price,
        capacity: roomData.capacity,
        petTypes: roomData.petTypes || roomData.pet_types,
        amenities: roomData.amenities,
        included: roomData.included,
        notIncluded: roomData.notIncluded || roomData.not_included,
        photos: roomData.photos,
        videos: roomData.videos,
        size: roomData.size,
        features: roomData.features,
        rules: roomData.rules,
        isActive: roomData.isActive !== false,
        totalUnits: roomData.totalUnits || roomData.total_units,
      });
    } else {
      // Create new room
      room = await boardingRoomsRepo.create({
        vendorId: resolvedVendorId,
        name: roomData.name,
        description: roomData.description,
        dayPrice: roomData.dayPrice || roomData.day_price,
        nightPrice: roomData.nightPrice || roomData.night_price,
        capacity: roomData.capacity,
        petTypes: roomData.petTypes || roomData.pet_types,
        amenities: roomData.amenities,
        included: roomData.included,
        notIncluded: roomData.notIncluded || roomData.not_included,
        photos: roomData.photos,
        videos: roomData.videos,
        size: roomData.size,
        features: roomData.features,
        rules: roomData.rules,
        totalUnits: roomData.totalUnits || roomData.total_units,
      });
    }
    
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
  app.get(`${BASE_PATH}/vendor/:vendorId/resort/pricing`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Get pricing rules from repository
    const pricingRulesRepo = getPricingRulesRepository();
    const pricingRules = await pricingRulesRepo.findByVendor(resolvedVendorId);
    
    // Format pricing rules into the expected structure
    const pricing = {
      daycare: {},
      boarding: {},
      rules: pricingRules
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
  app.post(`${BASE_PATH}/vendor/:vendorId/resort/pricing`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    const pricingData = await c.req.json();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Create or update pricing rules using repository
    const pricingRulesRepo = getPricingRulesRepository();
    
    // Handle pricing rules if provided
    if (pricingData.rules && Array.isArray(pricingData.rules)) {
      for (const rule of pricingData.rules) {
        if (rule.id) {
          await pricingRulesRepo.update(rule.id, {
            base_night_price: rule.base_night_price || rule.baseNightPrice,
            size_based_pricing: rule.size_based_pricing || rule.sizeBasedPricing,
            seasonal_pricing: rule.seasonal_pricing || rule.seasonalPricing,
            special_offers: rule.special_offers || rule.specialOffers,
          });
        } else {
          await pricingRulesRepo.create({
            vendor_id: resolvedVendorId,
            room_id: rule.room_id || rule.roomId,
            room_name: rule.room_name || rule.roomName,
            base_night_price: rule.base_night_price || rule.baseNightPrice,
            size_based_pricing: rule.size_based_pricing || rule.sizeBasedPricing,
            seasonal_pricing: rule.seasonal_pricing || rule.seasonalPricing,
            special_offers: rule.special_offers || rule.specialOffers,
          });
        }
      }
    }
    
    const pricing = {
      ...pricingData,
      updatedAt: new Date().toISOString()
    };
    
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
  app.get(`${BASE_PATH}/vendor/:vendorId/boarding/facilities`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Get boarding facilities from repository
    const facilitiesRepo = getBoardingFacilitiesRepository();
    let facilities = await facilitiesRepo.findByVendor(resolvedVendorId);
    
    if (!facilities) {
      facilities = {
        id: '',
        vendor_id: resolvedVendorId,
        has_daycare: false,
        has_boarding: false,
        amenities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    
    return sendSuccess(c, { 
      facilities: {
        hasDaycare: facilities.has_daycare,
        hasBoarding: facilities.has_boarding,
        amenities: facilities.amenities
      }
    });
  } catch (error) {
    console.error('Error fetching boarding facilities:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/:vendorId/boarding/facilities
 * Update boarding facility configuration
 */
  app.post(`${BASE_PATH}/vendor/:vendorId/boarding/facilities`, async (c) => {
  try {
    const { vendorId } = c.req.param();
    const facilityData = await c.req.json();
    
    // ✅ FIX: Resolve vendor ID to UUID
    const resolvedVendorId = await resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return sendError(c, `Vendor not found: ${vendorId}`, 404);
    }
    
    // ✅ SQL: Update boarding facilities using repository
    const facilitiesRepo = getBoardingFacilitiesRepository();
    const facilities = await facilitiesRepo.update(resolvedVendorId, {
      has_daycare: facilityData.hasDaycare !== undefined ? facilityData.hasDaycare : facilityData.has_daycare,
      has_boarding: facilityData.hasBoarding !== undefined ? facilityData.hasBoarding : facilityData.has_boarding,
      amenities: facilityData.amenities || [],
    });
    
    return sendSuccess(c, { 
      facilities: {
        hasDaycare: facilities.has_daycare,
        hasBoarding: facilities.has_boarding,
        amenities: facilities.amenities
      }
    }, 'Facilities updated successfully');
  } catch (error) {
    console.error('Error updating boarding facilities:', error);
    return sendError(c, error, 500);
  }
});

  console.log('✅ Specialized Vendor Config Endpoints (SQL) registered');
}
