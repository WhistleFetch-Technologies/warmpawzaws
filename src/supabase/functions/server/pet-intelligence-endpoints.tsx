// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import {
  getPetsRepository,
  getCustomersRepository,
  getBookingsRepository,
  getOrdersRepository
} from '../../../supabase/lib/repositories/index';

export function petIntelligenceEndpoints(app: Hono) {
  
  /**
   * GET /admin/pets/stats
   * Get comprehensive pet statistics
   */
  app.get("/make-server-3dd53475/admin/pets/stats", async (c) => {
    try {
      // ✅ SQL: Get all pets
      const petsRepo = getPetsRepository();
      const pets = await petsRepo.findAll();
      const validPets = pets.filter((p: any) => p.id && !p.id.includes(':'));
      
      const dogCount = validPets.filter((p: any) => p.species?.toLowerCase() === 'dog').length;
      const catCount = validPets.filter((p: any) => p.species?.toLowerCase() === 'cat').length;
      const otherCount = validPets.length - dogCount - catCount;
      
      // Calculate average age
      const avgAge = validPets.length > 0 
        ? validPets.reduce((sum: number, p: any) => sum + (p.age || 0), 0) / validPets.length 
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
      
      // Health trends
      const healthCount: Record<string, number> = {};
      validPets.forEach((p: any) => {
        (p.healthConditions || []).forEach((condition: string) => {
          healthCount[condition] = (healthCount[condition] || 0) + 1;
        });
      });
      
      const healthTrends = Object.entries(healthCount)
        .map(([condition, count]) => ({ condition, count }))
        .sort((a, b) => b.count - a.count);
      
      // Age distribution
      const ageGroups = {
        'Puppy/Kitten (0-1y)': 0,
        'Young (1-3y)': 0,
        'Adult (3-7y)': 0,
        'Senior (7-10y)': 0,
        'Geriatric (10+y)': 0
      };
      
      validPets.forEach((p: any) => {
        const age = p.age || 0;
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
      // ✅ SQL: Get all pets
      const petsRepo = getPetsRepository();
      const pets = await petsRepo.findAll();
      const validPets = pets.filter((p: any) => p.id && !p.id.includes(':'));
      
      // Enrich with owner information
      const enrichedPets = await Promise.all(
        validPets.map(async (pet: any) => {
          let ownerName = 'Unknown';
          if (pet.ownerId) {
            // ✅ SQL: Get customer
            const customersRepo = getCustomersRepository();
            const customer = await customersRepo.findById(pet.owner_id || pet.ownerId);
            if (customer) {
              ownerName = customer.fullName || customer.name || customer.phone;
            }
          }
          
          return {
            ...pet,
            owner: ownerName
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
      const petsRepo = getPetsRepository();
      const pets = await petsRepo.findAll();
      const validPets = pets.filter((p: any) => p.id && !p.id.includes(':'));
      
      // ✅ SQL: Get all bookings
      const bookingsRepo = getBookingsRepository();
      const bookings = await bookingsRepo.findAll();
      const validBookings = bookings.filter((b: any) => b.id && !b.id.includes(':'));
      
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
          // Average age
          const avgAge = breedPets.reduce((sum, p) => sum + (p.age || 0), 0) / breedPets.length;
          
          // Common services (from bookings)
          const serviceCount: Record<string, number> = {};
          const petIds = breedPets.map(p => p.id);
          
          validBookings
            .filter(b => petIds.includes(b.petId))
            .forEach(b => {
              const service = b.serviceName || b.serviceCategory || 'Unknown';
              serviceCount[service] = (serviceCount[service] || 0) + 1;
            });
          
          const commonServices = Object.entries(serviceCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([service]) => service);
          
          // Health risk (based on health conditions)
          const healthConditions = breedPets.flatMap(p => p.healthConditions || []);
          const healthRisk = 
            healthConditions.length > breedPets.length * 1.5 ? 'High' :
            healthConditions.length > breedPets.length * 0.5 ? 'Medium' : 'Low';
          
          // Average spend (from bookings)
          const totalSpend = validBookings
            .filter(b => petIds.includes(b.petId))
            .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
          
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
      
      // ✅ SQL: Get pet
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }
      
      // Get owner information
      let owner = null;
      if (pet.ownerId) {
        // ✅ SQL: Get owner
        const customersRepo = getCustomersRepository();
        owner = await customersRepo.findById(pet.owner_id || pet.ownerId);
      }
      
      // Get booking history
      // ✅ SQL: Get all bookings
      const bookingsRepo = getBookingsRepository();
      const bookings = await bookingsRepo.findAll();
      const petBookings = bookings.filter((b: any) => 
        b.id && !b.id.includes(':') && b.petId === petId
      );
      
      // Get orders (for pet products)
      // ✅ SQL: Get orders
      const ordersRepo = getOrdersRepository();
      const orders = await ordersRepo.findAll();
      const petOrders = orders.filter((o: any) => 
        o.id && !o.id.includes(':') && o.petId === petId
      );
      
      return c.json({ 
        success: true, 
        pet: {
          ...pet,
          owner: owner ? {
            id: owner.id,
            name: owner.fullName || owner.name,
            phone: owner.phone,
            email: owner.email
          } : null,
          bookingHistory: petBookings.length,
          totalSpend: petBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0) +
                     petOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
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
      
      // ✅ SQL: Get all pets
      const petsRepo = getPetsRepository();
      const pets = await petsRepo.findAll();
      let validPets = pets.filter((p: any) => p.id && !p.id.includes(':'));
      
      // Apply filters
      if (query) {
        validPets = validPets.filter((p: any) => 
          p.name?.toLowerCase().includes(query.toLowerCase()) ||
          p.breed?.toLowerCase().includes(query.toLowerCase())
        );
      }
      
      if (species) {
        validPets = validPets.filter((p: any) => 
          p.species?.toLowerCase() === species.toLowerCase()
        );
      }
      
      if (breed) {
        validPets = validPets.filter((p: any) => 
          p.breed?.toLowerCase() === breed.toLowerCase()
        );
      }
      
      return c.json({ success: true, pets: validPets });
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
      const petsRepo = getPetsRepository();
      const pets = await petsRepo.findAll();
      const validPets = pets.filter((p: any) => p.id && !p.id.includes(':'));
      
      // Vaccination coverage
      const vaccinationCoverage = {
        rabies: 0,
        distemper: 0,
        parvovirus: 0,
        hepatitis: 0
      };
      
      validPets.forEach((pet: any) => {
        (pet.vaccinations || []).forEach((vac: any) => {
          const vacType = vac.type?.toLowerCase();
          if (vacType?.includes('rabies')) vaccinationCoverage.rabies++;
          if (vacType?.includes('distemper')) vaccinationCoverage.distemper++;
          if (vacType?.includes('parvo')) vaccinationCoverage.parvovirus++;
          if (vacType?.includes('hepatitis')) vaccinationCoverage.hepatitis++;
        });
      });
      
      // Convert to percentages
      const totalPets = validPets.length || 1;
      Object.keys(vaccinationCoverage).forEach(key => {
        vaccinationCoverage[key as keyof typeof vaccinationCoverage] = 
          Math.round((vaccinationCoverage[key as keyof typeof vaccinationCoverage] / totalPets) * 100);
      });
      
      // Pets needing checkup
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const petsNeedingCheckup = validPets.filter((p: any) => {
        const lastCheckup = p.lastCheckup ? new Date(p.lastCheckup) : new Date(0);
        return lastCheckup < sixMonthsAgo;
      }).length;
      
      // Overweight pets (simple heuristic)
      const overweightPets = validPets.filter((p: any) => {
        const species = p.species?.toLowerCase();
        const weight = p.weight || 0;
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
      
      // ✅ SQL: Get pet
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }
      
      const recommendations: any[] = [];
      
      // Age-based recommendations
      if (pet.age < 1) {
        recommendations.push({
          type: 'training',
          priority: 'high',
          message: 'Puppy/Kitten training is crucial at this age',
          services: ['Pet Trainer', 'Pet Behaviorist']
        });
      } else if (pet.age > 7) {
        recommendations.push({
          type: 'health',
          priority: 'high',
          message: 'Senior pets need regular checkups',
          services: ['Veterinarian', 'Pet Clinic']
        });
      }
      
      // Vaccination recommendations
      const lastVaccination = pet.vaccinations?.[pet.vaccinations.length - 1];
      if (!lastVaccination || new Date(lastVaccination.date) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) {
        recommendations.push({
          type: 'vaccination',
          priority: 'high',
          message: 'Annual vaccination due',
          services: ['Veterinarian', 'Pet Clinic']
        });
      }
      
      // Grooming recommendations (for long-haired breeds)
      const longHairBreeds = ['golden retriever', 'persian', 'poodle', 'shih tzu'];
      if (longHairBreeds.some(breed => pet.breed?.toLowerCase().includes(breed))) {
        recommendations.push({
          type: 'grooming',
          priority: 'medium',
          message: 'Regular grooming recommended for long-haired breeds',
          services: ['Pet Groomer']
        });
      }
      
      // Exercise recommendations
      const highEnergyBreeds = ['labrador', 'golden retriever', 'german shepherd', 'border collie'];
      if (highEnergyBreeds.some(breed => pet.breed?.toLowerCase().includes(breed))) {
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
  
  console.log('✅ Pet intelligence endpoints registered');
}
