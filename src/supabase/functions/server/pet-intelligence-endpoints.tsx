import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

export function petIntelligenceEndpoints(app: Hono) {
  
  /**
   * GET /admin/pets/all
   * Get all pets with comprehensive information
   */
  app.get("/make-server-3dd53475/admin/pets/all", async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '100');
      const offset = parseInt(c.req.query('offset') || '0');
      
      const allPets = await kv.getByPrefix('pet:');
      const validPets = allPets.filter((p: any) => p.id && !p.id.includes(':pets'));
      
      // Enrich with customer and booking data
      const enrichedPets = await Promise.all(
        validPets.slice(offset, offset + limit).map(async (pet: any) => {
          const customer = await kv.get(`customer:${pet.customerId}`);
          const bookings = await getPetBookings(pet.id);
          
          return {
            ...pet,
            ownerName: customer?.fullName || 'Unknown',
            ownerPhone: customer?.phone || 'N/A',
            totalBookings: bookings.length,
            lastVisit: bookings.length > 0 ? 
              bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt : 
              null,
            healthStatus: calculateHealthStatus(pet, bookings)
          };
        })
      );
      
      return c.json({ 
        success: true, 
        pets: enrichedPets,
        total: validPets.length,
        offset,
        limit
      });
    } catch (error) {
      console.error('Get Pets Error:', error);
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
      
      const pet = await kv.get(`pet:${petId}`);
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }
      
      // Get comprehensive data
      const customer = await kv.get(`customer:${pet.customerId}`);
      const bookings = await getPetBookings(petId);
      const medicalHistory = await getPetMedicalHistory(petId);
      const recommendations = await generatePetRecommendations(pet, bookings);
      
      return c.json({
        success: true,
        pet: {
          ...pet,
          owner: customer,
          bookings,
          medicalHistory,
          recommendations,
          healthInsights: await generateHealthInsights(pet, medicalHistory)
        }
      });
    } catch (error) {
      console.error('Get Pet Detail Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/pets/analytics/breed-insights
   * Get breed-specific analytics and insights
   */
  app.get("/make-server-3dd53475/admin/pets/analytics/breed-insights", async (c) => {
    try {
      const allPets = await kv.getByPrefix('pet:');
      const validPets = allPets.filter((p: any) => p.id && !p.id.includes(':'));
      
      // Group by breed
      const breedData: Record<string, {
        count: number;
        avgAge: number;
        commonIssues: Record<string, number>;
        avgBookings: number;
        popularServices: Record<string, number>;
      }> = {};
      
      for (const pet of validPets) {
        const breed = pet.breed || 'Unknown';
        if (!breedData[breed]) {
          breedData[breed] = {
            count: 0,
            avgAge: 0,
            commonIssues: {},
            avgBookings: 0,
            popularServices: {}
          };
        }
        
        breedData[breed].count += 1;
        breedData[breed].avgAge += pet.age || 0;
        
        // Analyze medical history for common issues
        if (pet.medicalHistory && Array.isArray(pet.medicalHistory)) {
          pet.medicalHistory.forEach((record: any) => {
            const issue = record.diagnosis || record.condition;
            if (issue) {
              breedData[breed].commonIssues[issue] = (breedData[breed].commonIssues[issue] || 0) + 1;
            }
          });
        }
        
        // Analyze booking patterns
        const bookings = await getPetBookings(pet.id);
        breedData[breed].avgBookings += bookings.length;
        
        bookings.forEach((b: any) => {
          const service = b.serviceName || b.serviceType;
          if (service) {
            breedData[breed].popularServices[service] = (breedData[breed].popularServices[service] || 0) + 1;
          }
        });
      }
      
      // Calculate averages and format
      const breedInsights = Object.entries(breedData).map(([breed, data]) => ({
        breed,
        count: data.count,
        avgAge: data.count > 0 ? Math.round(data.avgAge / data.count) : 0,
        avgBookings: data.count > 0 ? Math.round(data.avgBookings / data.count) : 0,
        commonIssues: Object.entries(data.commonIssues)
          .map(([issue, count]) => ({ issue, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        popularServices: Object.entries(data.popularServices)
          .map(([service, count]) => ({ service, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      })).sort((a, b) => b.count - a.count);
      
      return c.json({ success: true, breedInsights });
    } catch (error) {
      console.error('Breed Insights Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/pets/analytics/health-trends
   * Get health trend analysis across all pets
   */
  app.get("/make-server-3dd53475/admin/pets/analytics/health-trends", async (c) => {
    try {
      const allPets = await kv.getByPrefix('pet:');
      const validPets = allPets.filter((p: any) => p.id && !p.id.includes(':'));
      
      // Analyze vaccination trends
      const vaccinationData = analyzeVaccinations(validPets);
      
      // Analyze common health issues
      const healthIssues = analyzeHealthIssues(validPets);
      
      // Analyze age distribution
      const ageDistribution = analyzeAgeDistribution(validPets);
      
      // Seasonal health patterns
      const seasonalPatterns = await analyzeSeasonalHealthPatterns();
      
      return c.json({
        success: true,
        healthTrends: {
          vaccinationCoverage: vaccinationData,
          commonHealthIssues: healthIssues,
          ageDistribution,
          seasonalPatterns,
          totalPets: validPets.length
        }
      });
    } catch (error) {
      console.error('Health Trends Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /admin/pets/suggestions/generate
   * Generate intelligent suggestions for pets based on breed, age, history
   */
  app.post("/make-server-3dd53475/admin/pets/suggestions/generate", async (c) => {
    try {
      const { petId } = await c.req.json();
      
      const pet = await kv.get(`pet:${petId}`);
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }
      
      const bookings = await getPetBookings(petId);
      const medicalHistory = await getPetMedicalHistory(petId);
      
      // Generate AI-powered suggestions
      const suggestions = await generatePetSuggestions(pet, bookings, medicalHistory);
      
      // Save suggestions
      await kv.set(`pet:${petId}:suggestions`, {
        petId,
        suggestions,
        generatedAt: new Date().toISOString()
      });
      
      return c.json({ success: true, suggestions });
    } catch (error) {
      console.error('Generate Suggestions Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/pets/analytics/species-distribution
   * Get species distribution and analytics
   */
  app.get("/make-server-3dd53475/admin/pets/analytics/species-distribution", async (c) => {
    try {
      const allPets = await kv.getByPrefix('pet:');
      const validPets = allPets.filter((p: any) => p.id && !p.id.includes(':'));
      
      const speciesData: Record<string, {
        count: number;
        breeds: Record<string, number>;
        avgAge: number;
        totalBookings: number;
      }> = {};
      
      for (const pet of validPets) {
        const species = pet.species || 'Unknown';
        if (!speciesData[species]) {
          speciesData[species] = {
            count: 0,
            breeds: {},
            avgAge: 0,
            totalBookings: 0
          };
        }
        
        speciesData[species].count += 1;
        speciesData[species].avgAge += pet.age || 0;
        
        const breed = pet.breed || 'Mixed';
        speciesData[species].breeds[breed] = (speciesData[species].breeds[breed] || 0) + 1;
        
        const bookings = await getPetBookings(pet.id);
        speciesData[species].totalBookings += bookings.length;
      }
      
      const distribution = Object.entries(speciesData).map(([species, data]) => ({
        species,
        count: data.count,
        percentage: Math.round((data.count / validPets.length) * 100),
        avgAge: data.count > 0 ? Math.round(data.avgAge / data.count) : 0,
        avgBookings: data.count > 0 ? Math.round(data.totalBookings / data.count) : 0,
        topBreeds: Object.entries(data.breeds)
          .map(([breed, count]) => ({ breed, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      })).sort((a, b) => b.count - a.count);
      
      return c.json({ success: true, distribution });
    } catch (error) {
      console.error('Species Distribution Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/pets/search
   * Advanced pet search with filters
   */
  app.get("/make-server-3dd53475/admin/pets/search", async (c) => {
    try {
      const query = c.req.query('q') || '';
      const species = c.req.query('species');
      const breed = c.req.query('breed');
      const ageMin = c.req.query('ageMin');
      const ageMax = c.req.query('ageMax');
      const healthStatus = c.req.query('healthStatus');
      
      let allPets = await kv.getByPrefix('pet:');
      let validPets = allPets.filter((p: any) => p.id && !p.id.includes(':'));
      
      // Apply filters
      if (query) {
        validPets = validPets.filter((p: any) => 
          p.name?.toLowerCase().includes(query.toLowerCase()) ||
          p.breed?.toLowerCase().includes(query.toLowerCase())
        );
      }
      
      if (species) {
        validPets = validPets.filter((p: any) => p.species === species);
      }
      
      if (breed) {
        validPets = validPets.filter((p: any) => p.breed === breed);
      }
      
      if (ageMin) {
        validPets = validPets.filter((p: any) => (p.age || 0) >= parseInt(ageMin));
      }
      
      if (ageMax) {
        validPets = validPets.filter((p: any) => (p.age || 0) <= parseInt(ageMax));
      }
      
      // Enrich results
      const enrichedResults = await Promise.all(
        validPets.map(async (pet: any) => {
          const customer = await kv.get(`customer:${pet.customerId}`);
          return {
            ...pet,
            ownerName: customer?.fullName || 'Unknown',
            ownerPhone: customer?.phone || 'N/A'
          };
        })
      );
      
      return c.json({ 
        success: true, 
        pets: enrichedResults,
        total: enrichedResults.length
      });
    } catch (error) {
      console.error('Pet Search Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/pets/analytics/care-recommendations
   * Get system-wide care recommendations based on data
   */
  app.get("/make-server-3dd53475/admin/pets/analytics/care-recommendations", async (c) => {
    try {
      const allPets = await kv.getByPrefix('pet:');
      const validPets = allPets.filter((p: any) => p.id && !p.id.includes(':'));
      
      const recommendations = {
        vaccinationDue: [],
        checkupOverdue: [],
        weightConcerns: [],
        ageSpecificCare: []
      };
      
      for (const pet of validPets) {
        // Check vaccination status
        if (needsVaccination(pet)) {
          recommendations.vaccinationDue.push({
            petId: pet.id,
            petName: pet.name,
            reason: 'Vaccination overdue'
          });
        }
        
        // Check last visit
        const bookings = await getPetBookings(pet.id);
        if (bookings.length > 0) {
          const lastVisit = new Date(bookings[0].createdAt);
          const monthsSinceVisit = (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24 * 30);
          
          if (monthsSinceVisit > 6) {
            recommendations.checkupOverdue.push({
              petId: pet.id,
              petName: pet.name,
              lastVisit: lastVisit.toISOString(),
              monthsSince: Math.round(monthsSinceVisit)
            });
          }
        }
        
        // Age-specific care
        if (pet.age && pet.ageUnit === 'years') {
          if (pet.age > 7) {
            recommendations.ageSpecificCare.push({
              petId: pet.id,
              petName: pet.name,
              age: pet.age,
              recommendation: 'Senior pet - requires specialized care'
            });
          }
        }
      }
      
      return c.json({ success: true, recommendations });
    } catch (error) {
      console.error('Care Recommendations Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  async function getPetBookings(petId: string): Promise<any[]> {
    const allBookings = await kv.getByPrefix('booking:');
    return allBookings
      .filter((b: any) => b.petId === petId && !b.id.includes(':'))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async function getPetMedicalHistory(petId: string): Promise<any[]> {
    const pet = await kv.get(`pet:${petId}`);
    return pet?.medicalHistory || [];
  }

  function calculateHealthStatus(pet: any, bookings: any[]): string {
    // Simple health status calculation
    if (bookings.length === 0) return 'Unknown';
    
    const recentBookings = bookings.filter(b => {
      const bookingDate = new Date(b.createdAt);
      const monthsAgo = (Date.now() - bookingDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsAgo <= 3;
    });
    
    if (recentBookings.length === 0) return 'Unknown';
    
    // Check for health issues in recent bookings
    const hasHealthIssues = recentBookings.some(b => 
      b.notes?.toLowerCase().includes('sick') || 
      b.notes?.toLowerCase().includes('injury')
    );
    
    return hasHealthIssues ? 'At Risk' : 'Healthy';
  }

  async function generateHealthInsights(pet: any, medicalHistory: any[]): Promise<any> {
    return {
      vaccinationStatus: getVaccinationStatus(pet),
      riskFactors: identifyRiskFactors(pet, medicalHistory),
      recommendations: generateHealthRecommendations(pet, medicalHistory)
    };
  }

  async function generatePetRecommendations(pet: any, bookings: any[], medicalHistory: any[]): Promise<any[]> {
    const recommendations = [];
    
    // Service recommendations based on breed
    const breedServices = getBreedRecommendedServices(pet.breed, pet.species);
    recommendations.push(...breedServices);
    
    // Age-based recommendations
    if (pet.age && pet.ageUnit === 'years') {
      if (pet.age < 1) {
        recommendations.push({
          type: 'service',
          title: 'Puppy/Kitten Training',
          description: 'Early socialization and training recommended',
          priority: 'high'
        });
      } else if (pet.age > 7) {
        recommendations.push({
          type: 'service',
          title: 'Senior Pet Care',
          description: 'Regular health checkups and senior-specific nutrition',
          priority: 'high'
        });
      }
    }
    
    // Vaccination recommendations
    if (needsVaccination(pet)) {
      recommendations.push({
        type: 'health',
        title: 'Vaccination Due',
        description: 'Pet is due for vaccinations',
        priority: 'urgent'
      });
    }
    
    // Seasonal recommendations
    const season = getCurrentSeason();
    if (season === 'summer') {
      recommendations.push({
        type: 'care',
        title: 'Summer Care',
        description: 'Grooming and cooling services recommended',
        priority: 'medium'
      });
    } else if (season === 'winter') {
      recommendations.push({
        type: 'care',
        title: 'Winter Care',
        description: 'Extra warmth and nutrition support',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  async function generatePetSuggestions(pet: any, bookings: any[], medicalHistory: any[]): Promise<any> {
    return {
      services: getBreedRecommendedServices(pet.breed, pet.species),
      products: getRecommendedProducts(pet),
      healthTips: getBreedHealthTips(pet.breed, pet.species),
      dietPlan: getDietRecommendations(pet),
      exercisePlan: getExerciseRecommendations(pet)
    };
  }

  function analyzeVaccinations(pets: any[]): any {
    const total = pets.length;
    const vaccinated = pets.filter(p => 
      p.vaccinations && Array.isArray(p.vaccinations) && p.vaccinations.length > 0
    ).length;
    
    return {
      total,
      vaccinated,
      notVaccinated: total - vaccinated,
      coverage: total > 0 ? Math.round((vaccinated / total) * 100) : 0
    };
  }

  function analyzeHealthIssues(pets: any[]): any[] {
    const issueCount: Record<string, number> = {};
    
    pets.forEach(pet => {
      if (pet.medicalHistory && Array.isArray(pet.medicalHistory)) {
        pet.medicalHistory.forEach((record: any) => {
          const issue = record.diagnosis || record.condition;
          if (issue) {
            issueCount[issue] = (issueCount[issue] || 0) + 1;
          }
        });
      }
      
      if (pet.allergies && Array.isArray(pet.allergies)) {
        pet.allergies.forEach((allergy: string) => {
          issueCount[`Allergy: ${allergy}`] = (issueCount[`Allergy: ${allergy}`] || 0) + 1;
        });
      }
    });
    
    return Object.entries(issueCount)
      .map(([issue, count]) => ({ issue, count, percentage: Math.round((count / pets.length) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  function analyzeAgeDistribution(pets: any[]): any[] {
    const ageGroups = {
      '0-1 years': 0,
      '1-3 years': 0,
      '3-7 years': 0,
      '7+ years': 0,
      'Unknown': 0
    };
    
    pets.forEach(pet => {
      if (!pet.age || !pet.ageUnit) {
        ageGroups['Unknown'] += 1;
        return;
      }
      
      const ageInYears = pet.ageUnit === 'months' ? pet.age / 12 : pet.age;
      
      if (ageInYears < 1) ageGroups['0-1 years'] += 1;
      else if (ageInYears < 3) ageGroups['1-3 years'] += 1;
      else if (ageInYears < 7) ageGroups['3-7 years'] += 1;
      else ageGroups['7+ years'] += 1;
    });
    
    return Object.entries(ageGroups).map(([range, count]) => ({
      range,
      count,
      percentage: pets.length > 0 ? Math.round((count / pets.length) * 100) : 0
    }));
  }

  async function analyzeSeasonalHealthPatterns(): Promise<any> {
    // Analyze health issues by season based on booking dates
    const bookings = await kv.getByPrefix('booking:');
    const validBookings = bookings.filter((b: any) => b.id && !b.id.includes(':'));
    
    const seasonalData: Record<string, number> = {
      spring: 0,
      summer: 0,
      fall: 0,
      winter: 0
    };
    
    validBookings.forEach((b: any) => {
      const date = new Date(b.createdAt);
      const month = date.getMonth();
      
      if (month >= 2 && month <= 4) seasonalData.spring += 1;
      else if (month >= 5 && month <= 7) seasonalData.summer += 1;
      else if (month >= 8 && month <= 10) seasonalData.fall += 1;
      else seasonalData.winter += 1;
    });
    
    return seasonalData;
  }

  function needsVaccination(pet: any): boolean {
    if (!pet.vaccinations || !Array.isArray(pet.vaccinations)) return true;
    if (pet.vaccinations.length === 0) return true;
    
    // Check last vaccination date
    const lastVaccination = pet.vaccinations[pet.vaccinations.length - 1];
    if (!lastVaccination.date) return true;
    
    const lastVacDate = new Date(lastVaccination.date);
    const monthsSince = (Date.now() - lastVacDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    return monthsSince > 12;
  }

  function getVaccinationStatus(pet: any): string {
    if (!pet.vaccinations || pet.vaccinations.length === 0) return 'Not Vaccinated';
    
    const lastVaccination = pet.vaccinations[pet.vaccinations.length - 1];
    const lastVacDate = new Date(lastVaccination.date);
    const monthsSince = (Date.now() - lastVacDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsSince < 12) return 'Up to Date';
    if (monthsSince < 18) return 'Due Soon';
    return 'Overdue';
  }

  function identifyRiskFactors(pet: any, medicalHistory: any[]): string[] {
    const riskFactors = [];
    
    if (pet.age && pet.ageUnit === 'years' && pet.age > 7) {
      riskFactors.push('Senior age');
    }
    
    if (pet.weight && pet.weightUnit === 'kg' && pet.species === 'dog') {
      if (pet.weight < 5) riskFactors.push('Underweight');
      if (pet.weight > 40) riskFactors.push('Overweight');
    }
    
    if (medicalHistory.length > 5) {
      riskFactors.push('Extensive medical history');
    }
    
    if (pet.allergies && pet.allergies.length > 0) {
      riskFactors.push('Multiple allergies');
    }
    
    return riskFactors;
  }

  function generateHealthRecommendations(pet: any, medicalHistory: any[]): string[] {
    const recommendations = [];
    
    if (needsVaccination(pet)) {
      recommendations.push('Schedule vaccination appointment');
    }
    
    if (pet.age && pet.ageUnit === 'years' && pet.age > 7) {
      recommendations.push('Regular senior health checkups recommended');
      recommendations.push('Consider senior-specific diet');
    }
    
    if (!pet.microchipId) {
      recommendations.push('Consider microchipping for identification');
    }
    
    return recommendations;
  }

  function getBreedRecommendedServices(breed: string, species: string): any[] {
    const services = [];
    
    if (species === 'dog') {
      services.push({
        type: 'service',
        title: 'Grooming',
        description: 'Regular grooming recommended',
        priority: 'medium'
      });
      services.push({
        type: 'service',
        title: 'Training',
        description: 'Basic obedience training',
        priority: 'medium'
      });
    }
    
    if (species === 'cat') {
      services.push({
        type: 'service',
        title: 'Grooming',
        description: 'Professional grooming services',
        priority: 'low'
      });
    }
    
    return services;
  }

  function getRecommendedProducts(pet: any): any[] {
    const products = [];
    
    if (pet.species === 'dog') {
      products.push({ category: 'Food', name: 'Premium dog food' });
      products.push({ category: 'Toys', name: 'Chew toys' });
    } else if (pet.species === 'cat') {
      products.push({ category: 'Food', name: 'Premium cat food' });
      products.push({ category: 'Accessories', name: 'Scratching post' });
    }
    
    return products;
  }

  function getBreedHealthTips(breed: string, species: string): string[] {
    const tips = [];
    
    if (species === 'dog') {
      tips.push('Regular exercise is essential for your dog\'s health');
      tips.push('Maintain a consistent feeding schedule');
      tips.push('Annual vet checkups are recommended');
    } else if (species === 'cat') {
      tips.push('Provide fresh water daily');
      tips.push('Regular play time helps prevent obesity');
      tips.push('Annual vet checkups are recommended');
    }
    
    return tips;
  }

  function getDietRecommendations(pet: any): any {
    return {
      mealFrequency: pet.age < 1 ? '3-4 times daily' : '2 times daily',
      portionSize: `Based on weight: ${pet.weight || 'N/A'} ${pet.weightUnit || 'kg'}`,
      foodType: 'Premium quality pet food',
      supplements: pet.age > 7 ? ['Joint support', 'Omega-3'] : []
    };
  }

  function getExerciseRecommendations(pet: any): any {
    let dailyExercise = '30-60 minutes';
    
    if (pet.species === 'dog') {
      if (pet.age < 1) dailyExercise = '20-30 minutes (short bursts)';
      else if (pet.age > 7) dailyExercise = '20-30 minutes (gentle)';
      else dailyExercise = '60-90 minutes';
    } else if (pet.species === 'cat') {
      dailyExercise = '15-30 minutes (interactive play)';
    }
    
    return {
      dailyExercise,
      activities: pet.species === 'dog' ? ['Walking', 'Playing fetch', 'Swimming'] : ['Interactive toys', 'Climbing', 'Laser pointer'],
      intensity: pet.age > 7 ? 'Low to moderate' : 'Moderate to high'
    };
  }

  function getCurrentSeason(): string {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }
}
