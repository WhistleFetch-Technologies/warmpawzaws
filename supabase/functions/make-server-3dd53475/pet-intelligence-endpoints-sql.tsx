/**
 * ============================================================================
 * PET INTELLIGENCE ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Comprehensive pet statistics
 * - Pet analytics and insights
 * - Breed-specific analytics
 * - Health analytics
 * - Personalized recommendations
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.getByPrefix()` with SQL queries
 * - Pets from `pets` table
 * - Customers from `customers` table
 * - Bookings from `bookings` table
 * - Orders from `orders` table
 * 
 * Date: 2025-01-27
 * Migration: Batch 7 Phase 3 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getPetsRepository } from '../../lib/repositories/pets.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getOrdersRepository } from '../../lib/repositories/orders.ts';

/**
 * PET INTELLIGENCE ENDPOINTS - SQL-ONLY
 */
export function petIntelligenceEndpoints(app: Hono) {
  const db = getDbClient();
  const petsRepo = getPetsRepository();
  const customersRepo = getCustomersRepository();
  const bookingsRepo = getBookingsRepository();
  const ordersRepo = getOrdersRepository();
  
  /**
   * GET /admin/pets/stats
   * Get comprehensive pet statistics
   */
  app.get("/make-server-3dd53475/admin/pets/stats", async (c) => {
    try {
      // ✅ SQL: Get all pets from pets table
      const { data: pets, error } = await db
        .from('pets')
        .select('*');

      if (error) {
        console.error('Error fetching pets:', error);
        return c.json({ error: 'Failed to fetch pets' }, 500);
      }

      const validPets = (pets || []).filter((p: any) => p.id);
      
      const dogCount = validPets.filter((p: any) => p.species?.toLowerCase() === 'dog').length;
      const catCount = validPets.filter((p: any) => p.species?.toLowerCase() === 'cat').length;
      const otherCount = validPets.length - dogCount - catCount;
      
      // Calculate average age (using age_years from database)
      const avgAge = validPets.length > 0 
        ? validPets.reduce((sum: number, p: any) => sum + (p.age_years || 0), 0) / validPets.length 
        : 0;
      
      // Top breeds
      const breedCount: Record<string, number> = {};
      validPets.forEach((p: any) => {
        const breed = p.breed || 'Unknown';
        breedCount[breed] = (breedCount[breed] || 0) + 1;
      });
      
      const topBreeds = Object.entries(breedCount)
        .map(([breed, count]) => ({ breed, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Health trends (from medical_history JSONB)
      const healthCount: Record<string, number> = {};
      validPets.forEach((p: any) => {
        const conditions = p.medical_history?.conditions || [];
        if (Array.isArray(conditions)) {
          conditions.forEach((condition: string) => {
            healthCount[condition] = (healthCount[condition] || 0) + 1;
          });
        }
      });
      
      const healthTrends = Object.entries(healthCount)
        .map(([condition, count]) => ({ condition, count }))
        .sort((a, b) => b.count - a.count);
      
      // Age distribution (using age_years)
      const ageGroups = {
        'Puppy/Kitten (0-1y)': 0,
        'Young (1-3y)': 0,
        'Adult (3-7y)': 0,
        'Senior (7-10y)': 0,
        'Geriatric (10+y)': 0
      };
      
      validPets.forEach((p: any) => {
        const age = p.age_years || 0;
        if (age <= 1) ageGroups['Puppy/Kitten (0-1y)']++;
        else if (age <= 3) ageGroups['Young (1-3y)']++;
        else if (age <= 7) ageGroups['Adult (3-7y)']++;
        else if (age <= 10) ageGroups['Senior (7-10y)']++;
        else ageGroups['Geriatric (10+y)']++;
      });
      
      const ageDistribution = Object.entries(ageGroups).map(([ageGroup, count]) => ({
        ageGroup,
        count
      }));
      
      const stats = {
        totalPets: validPets.length,
        dogCount,
        catCount,
        otherCount,
        avgAge: Math.round(avgAge * 10) / 10,
        topBreeds,
        healthTrends,
        ageDistribution
      };
      
      return c.json({ success: true, stats });
    } catch (error) {
      console.error('Pet Stats Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /admin/pets/all
   * Get all pets with owner information
   */
  app.get("/make-server-3dd53475/admin/pets/all", async (c) => {
    try {
      // ✅ SQL: Get all pets from pets table
      const { data: pets, error } = await db
        .from('pets')
        .select('*');

      if (error) {
        console.error('Error fetching pets:', error);
        return c.json({ error: 'Failed to fetch pets' }, 500);
      }

      const validPets = (pets || []).filter((p: any) => p.id);
      
      // ✅ SQL: Enrich with owner information
      const enrichedPets = await Promise.all(
        validPets.map(async (pet: any) => {
          let ownerName = 'Unknown';
          if (pet.customer_id) {
            try {
              const customer = await customersRepo.findById(pet.customer_id);
              if (customer) {
                ownerName = customer.full_name || customer.name || customer.phone || 'Unknown';
              }
            } catch (e) {
              console.error('Error fetching customer:', e);
            }
          }
          
          return {
            id: pet.id,
            name: pet.name,
            species: pet.species,
            breed: pet.breed,
            age: pet.age_years,
            gender: pet.gender,
            weight: pet.weight_kg,
            color: pet.color,
            photo_url: pet.profile_photo_url,
            medical_conditions: pet.medical_history?.conditions || [],
            allergies: pet.medical_history?.allergies || [],
            vaccinations: pet.medical_history?.vaccinations || [],
            owner: ownerName,
            ownerId: pet.customer_id
          };
        })
      );
      
      return c.json({ success: true, pets: enrichedPets });
    } catch (error) {
      console.error('Get All Pets Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /admin/pets/breed-insights
   * Get breed-specific insights and analytics
   */
  app.get("/make-server-3dd53475/admin/pets/breed-insights", async (c) => {
    try {
      // ✅ SQL: Get all pets
      const { data: pets, error: petsError } = await db
        .from('pets')
        .select('*');

      if (petsError) {
        console.error('Error fetching pets:', petsError);
        return c.json({ error: 'Failed to fetch pets' }, 500);
      }

      const validPets = (pets || []).filter((p: any) => p.id);
      
      // ✅ SQL: Get all bookings
      const { data: bookings, error: bookingsError } = await db
        .from('bookings')
        .select('*');

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        return c.json({ error: 'Failed to fetch bookings' }, 500);
      }

      const validBookings = (bookings || []).filter((b: any) => b.id);
      
      // Group pets by breed
      const breedGroups: Record<string, any[]> = {};
      validPets.forEach((pet: any) => {
        const breed = pet.breed || 'Unknown';
        if (!breedGroups[breed]) breedGroups[breed] = [];
        breedGroups[breed].push(pet);
      });
      
      // Calculate insights per breed
      const insights = await Promise.all(
        Object.entries(breedGroups).map(async ([breed, breedPets]) => {
          // Average age (using age_years)
          const avgAge = breedPets.reduce((sum, p) => sum + (p.age_years || 0), 0) / breedPets.length;
          
          // Common services (from bookings)
          const serviceCount: Record<string, number> = {};
          const petIds = breedPets.map(p => p.id);
          
          validBookings
            .filter(b => petIds.includes(b.pet_id))
            .forEach(b => {
              const service = b.service_name || b.service_type || 'Unknown';
              serviceCount[service] = (serviceCount[service] || 0) + 1;
            });
          
          const commonServices = Object.entries(serviceCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([service]) => service);
          
          // Health risk (based on medical_history)
          const healthConditions = breedPets.flatMap(p => p.medical_history?.conditions || []);
          const healthRisk = 
            healthConditions.length > breedPets.length * 1.5 ? 'High' :
            healthConditions.length > breedPets.length * 0.5 ? 'Medium' : 'Low';
          
          // Average spend (from bookings)
          const totalSpend = validBookings
            .filter(b => petIds.includes(b.pet_id))
            .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
          
          const avgSpend = breedPets.length > 0 ? Math.round(totalSpend / breedPets.length) : 0;
          
          return {
            breed,
            count: breedPets.length,
            avgAge: Math.round(avgAge * 10) / 10,
            commonServices,
            healthRisk,
            avgSpend
          };
        })
      );
      
      // Sort by count
      insights.sort((a, b) => b.count - a.count);
      
      return c.json({ success: true, insights });
    } catch (error) {
      console.error('Breed Insights Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /admin/pets/:petId
   * Get detailed pet information
   */
  app.get("/make-server-3dd53475/admin/pets/:petId", async (c) => {
    try {
      const { petId } = c.req.param();
      
      // ✅ SQL: Get pet from pets table
      const pet = await petsRepo.findById(petId);
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }
      
      // ✅ SQL: Get owner information
      let owner = null;
      if (pet.customer_id) {
        try {
          owner = await customersRepo.findById(pet.customer_id);
        } catch (e) {
          console.error('Error fetching owner:', e);
        }
      }
      
      // ✅ SQL: Get booking history
      const { data: petBookings, error: bookingsError } = await db
        .from('bookings')
        .select('*')
        .eq('pet_id', petId);

      const bookings = petBookings || [];
      
      // ✅ SQL: Get orders (for pet products)
      const { data: petOrders, error: ordersError } = await db
        .from('orders')
        .select('*')
        .eq('pet_id', petId);

      const orders = petOrders || [];
      
      return c.json({ 
        success: true, 
        pet: {
          id: pet.id,
          name: pet.name,
          species: pet.type || pet.species,
          breed: pet.breed,
          age: pet.age || pet.age_years,
          gender: pet.gender,
          weight: pet.weight || pet.weight_kg,
          color: pet.color,
          photo_url: pet.photo_url || pet.profile_photo_url,
          medical_conditions: pet.medical_conditions || pet.medical_history?.conditions || [],
          allergies: pet.allergies || pet.medical_history?.allergies || [],
          vaccinations: pet.vaccinations || pet.medical_history?.vaccinations || [],
          owner: owner ? {
            id: owner.id,
            name: owner.full_name || owner.name,
            phone: owner.phone,
            email: owner.email
          } : null,
          bookingHistory: bookings.length,
          totalSpend: bookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0) +
                     orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
        }
      });
    } catch (error) {
      console.error('Get Pet Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /admin/pets/search
   * Search pets by various criteria
   */
  app.get("/make-server-3dd53475/admin/pets/search", async (c) => {
    try {
      const query = c.req.query('q') || '';
      const species = c.req.query('species') || '';
      const breed = c.req.query('breed') || '';
      
      // ✅ SQL: Get all pets with filters
      let dbQuery = db.from('pets').select('*');
      
      if (species) {
        dbQuery = dbQuery.eq('species', species);
      }
      
      if (breed) {
        dbQuery = dbQuery.ilike('breed', `%${breed}%`);
      }
      
      const { data: pets, error } = await dbQuery;

      if (error) {
        console.error('Error searching pets:', error);
        return c.json({ error: 'Failed to search pets' }, 500);
      }

      let validPets = (pets || []).filter((p: any) => p.id);
      
      // Apply text search filter
      if (query) {
        validPets = validPets.filter((p: any) => 
          p.name?.toLowerCase().includes(query.toLowerCase()) ||
          p.breed?.toLowerCase().includes(query.toLowerCase())
        );
      }
      
      // Map to response format
      const petsResponse = validPets.map((p: any) => ({
        id: p.id,
        name: p.name,
        species: p.species,
        breed: p.breed,
        age: p.age_years,
        gender: p.gender,
        weight: p.weight_kg,
        color: p.color,
        photo_url: p.profile_photo_url
      }));
      
      return c.json({ success: true, pets: petsResponse });
    } catch (error) {
      console.error('Search Pets Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /admin/pets/health-analytics
   * Get health-related analytics
   */
  app.get("/make-server-3dd53475/admin/pets/health-analytics", async (c) => {
    try {
      // ✅ SQL: Get all pets
      const { data: pets, error } = await db
        .from('pets')
        .select('*');

      if (error) {
        console.error('Error fetching pets:', error);
        return c.json({ error: 'Failed to fetch pets' }, 500);
      }

      const validPets = (pets || []).filter((p: any) => p.id);
      
      // Vaccination coverage (from medical_history JSONB)
      const vaccinationCoverage = {
        rabies: 0,
        distemper: 0,
        parvovirus: 0,
        hepatitis: 0
      };
      
      validPets.forEach((pet: any) => {
        const vaccinations = pet.medical_history?.vaccinations || [];
        if (Array.isArray(vaccinations)) {
          vaccinations.forEach((vac: any) => {
            const vacType = (vac.type || vac.name || '').toLowerCase();
            if (vacType?.includes('rabies')) vaccinationCoverage.rabies++;
            if (vacType?.includes('distemper')) vaccinationCoverage.distemper++;
            if (vacType?.includes('parvo')) vaccinationCoverage.parvovirus++;
            if (vacType?.includes('hepatitis')) vaccinationCoverage.hepatitis++;
          });
        }
      });
      
      // Convert to percentages
      const totalPets = validPets.length || 1;
      Object.keys(vaccinationCoverage).forEach(key => {
        vaccinationCoverage[key as keyof typeof vaccinationCoverage] = 
          Math.round((vaccinationCoverage[key as keyof typeof vaccinationCoverage] / totalPets) * 100);
      });
      
      // Pets needing checkup (from medical_history or last_checkup)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const petsNeedingCheckup = validPets.filter((p: any) => {
        const lastCheckup = p.last_checkup ? new Date(p.last_checkup) : 
                           p.medical_history?.last_checkup ? new Date(p.medical_history.last_checkup) : 
                           new Date(0);
        return lastCheckup < sixMonthsAgo;
      }).length;
      
      // Overweight pets (using weight_kg)
      const overweightPets = validPets.filter((p: any) => {
        const species = p.species?.toLowerCase();
        const weight = p.weight_kg || 0;
        if (species === 'dog') {
          // Rough estimate: dogs over 40kg might be overweight
          return weight > 40;
        } else if (species === 'cat') {
          // Cats over 7kg might be overweight
          return weight > 7;
        }
        return false;
      }).length;
      
      return c.json({ 
        success: true, 
        analytics: {
          vaccinationCoverage,
          petsNeedingCheckup,
          overweightPets,
          totalPets: validPets.length
        }
      });
    } catch (error) {
      console.error('Health Analytics Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * POST /admin/pets/recommendations
   * Generate personalized pet care recommendations
   */
  app.post("/make-server-3dd53475/admin/pets/recommendations", async (c) => {
    try {
      const { petId } = await c.req.json();
      
      // ✅ SQL: Get pet from pets table
      const pet = await petsRepo.findById(petId);
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }
      
      const recommendations: any[] = [];
      
      // Age-based recommendations (using age_years)
      const age = pet.age || pet.age_years || 0;
      if (age < 1) {
        recommendations.push({
          type: 'training',
          priority: 'high',
          message: 'Puppy/Kitten training is crucial at this age',
          services: ['Pet Trainer', 'Pet Behaviorist']
        });
      } else if (age > 7) {
        recommendations.push({
          type: 'health',
          priority: 'high',
          message: 'Senior pets need regular checkups',
          services: ['Veterinarian', 'Pet Clinic']
        });
      }
      
      // Vaccination recommendations (from medical_history)
      const vaccinations = pet.vaccinations || pet.medical_history?.vaccinations || [];
      const lastVaccination = Array.isArray(vaccinations) && vaccinations.length > 0 
        ? vaccinations[vaccinations.length - 1] 
        : null;
      
      if (!lastVaccination || (lastVaccination.date && new Date(lastVaccination.date) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))) {
        recommendations.push({
          type: 'vaccination',
          priority: 'high',
          message: 'Annual vaccination due',
          services: ['Veterinarian', 'Pet Clinic']
        });
      }
      
      // Grooming recommendations (for long-haired breeds)
      const longHairBreeds = ['golden retriever', 'persian', 'poodle', 'shih tzu'];
      const breed = (pet.breed || '').toLowerCase();
      if (longHairBreeds.some(lb => breed.includes(lb))) {
        recommendations.push({
          type: 'grooming',
          priority: 'medium',
          message: 'Regular grooming recommended for long-haired breeds',
          services: ['Pet Groomer']
        });
      }
      
      // Exercise recommendations
      const highEnergyBreeds = ['labrador', 'golden retriever', 'german shepherd', 'border collie'];
      if (highEnergyBreeds.some(eb => breed.includes(eb))) {
        recommendations.push({
          type: 'exercise',
          priority: 'medium',
          message: 'High-energy breed needs regular exercise',
          services: ['Pet Walker']
        });
      }
      
      return c.json({ success: true, recommendations });
    } catch (error) {
      console.error('Recommendations Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  console.log('✅ Pet intelligence endpoints registered (SQL-only)');
}

