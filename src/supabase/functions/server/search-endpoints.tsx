// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { 
  getVendorsRepository,
  getServicesRepository,
  getDiscoveryRepository
} from '../../../supabase/lib/repositories/index';

export function searchEndpoints(app: Hono) {
  
  // ============================================
  // SEARCH & DISCOVERY ENDPOINTS
  // ============================================
  
  /**
   * Search vendors with filters
   * POST /make-server-3dd53475/search/vendors
   */
  app.post("/make-server-3dd53475/search/vendors", async (c) => {
    try {
      const {
        serviceType, // grooming, veterinary, training, etc.
        location, // { lat, lng }
        radius, // in km
        serviceStyle, // at_home, at_center, both
        minRating,
        maxPrice,
        availability, // date
        sortBy, // rating, price, distance, reviews
        limit
      } = await c.req.json();

      // ✅ SQL: Get all approved vendors using repository
      const vendorsRepo = getVendorsRepository();
      const allVendorsData = await vendorsRepo.findAll({});
      
      // Convert to format expected by filter logic
      const allVendors = allVendorsData.map((v: any) => ({
        id: v.id,
        status: v.status,
        isActive: v.is_active,
        services: [], // Services should be queried separately from vendor_services
        serviceStyle: v.service_style || 'at_center',
        rating: v.rating || 0,
        totalReviews: v.total_reviews || 0,
        completedBookings: v.completed_bookings || 0,
        location: v.latitude && v.longitude ? { lat: v.latitude, lng: v.longitude } : null,
        address: v.address,
        businessName: v.business_name,
        ownerName: v.owner_name,
        experience: v.experience_years || 0,
        photoUrl: v.photo_url || null,
        pricing: {} // Should be queried from vendor_services
      }));
      
      let filteredVendors = allVendors.filter((vendor: any) => {
        // Must be approved and active
        if (vendor.status !== 'approved' || !vendor.isActive) return false;
        
        // Service type filter
        if (serviceType && (!vendor.services || !vendor.services.includes(serviceType))) {
          return false;
        }
        
        // Service style filter
        if (serviceStyle && vendor.serviceStyle !== serviceStyle && vendor.serviceStyle !== 'both') {
          return false;
        }
        
        // Rating filter
        if (minRating && vendor.rating < minRating) {
          return false;
        }
        
        return true;
      });

      // Location-based filtering
      if (location && radius) {
        filteredVendors = filteredVendors.filter((vendor: any) => {
          if (!vendor.location || !vendor.location.lat || !vendor.location.lng) {
            return false;
          }
          
          const distance = calculateDistance(
            location.lat,
            location.lng,
            vendor.location.lat,
            vendor.location.lng
          );
          
          vendor.distance = distance;
          return distance <= radius;
        });
      }

      // Sort results
      switch (sortBy) {
        case 'rating':
          filteredVendors.sort((a: any, b: any) => b.rating - a.rating);
          break;
        case 'reviews':
          filteredVendors.sort((a: any, b: any) => (b.totalReviews || 0) - (a.totalReviews || 0));
          break;
        case 'distance':
          if (location) {
            filteredVendors.sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));
          }
          break;
        default:
          // Default: rating + reviews combined score
          filteredVendors.sort((a: any, b: any) => {
            const scoreA = (a.rating * 0.7) + ((a.totalReviews || 0) * 0.3);
            const scoreB = (b.rating * 0.7) + ((b.totalReviews || 0) * 0.3);
            return scoreB - scoreA;
          });
      }

      // Apply limit
      const maxResults = limit || 50;
      const results = filteredVendors.slice(0, maxResults);

      // Format results for customer view
      const vendorList = results.map((vendor: any) => ({
        id: vendor.id,
        businessName: vendor.businessName,
        ownerName: vendor.ownerName,
        services: vendor.services,
        serviceStyle: vendor.serviceStyle,
        rating: vendor.rating,
        totalReviews: vendor.totalReviews,
        completedBookings: vendor.completedBookings,
        experience: vendor.experience,
        location: vendor.location,
        address: vendor.address,
        distance: vendor.distance || null,
        photoUrl: vendor.photoUrl || null,
        pricing: vendor.pricing || {}
      }));

      console.log(`🔍 Search found ${vendorList.length} vendors`);
      return c.json({ 
        vendors: vendorList, 
        total: vendorList.length,
        filters: { serviceType, location, radius, serviceStyle, minRating }
      });
    } catch (error) {
      console.error('Error searching vendors:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get nearby vendors
   * POST /make-server-3dd53475/search/vendors/nearby
   */
  app.post("/make-server-3dd53475/search/vendors/nearby", async (c) => {
    try {
      const { location, radius, serviceType } = await c.req.json();

      if (!location || !location.lat || !location.lng) {
        return c.json({ error: 'Location is required' }, 400);
      }

      const searchRadius = radius || 10; // Default 10km

      // ✅ SQL: Get all approved vendors using repository
      const vendorsRepo = getVendorsRepository();
      const allVendorsData = await vendorsRepo.findAll({});
      
      const allVendors = allVendorsData.map((v: any) => ({
        id: v.id,
        status: v.status,
        isActive: v.is_active,
        services: [],
        location: v.latitude && v.longitude ? { lat: v.latitude, lng: v.longitude } : null,
        address: v.address,
        businessName: v.business_name,
        ownerName: v.owner_name,
        rating: v.rating || 0,
        totalReviews: v.total_reviews || 0,
        serviceStyle: v.service_style || 'at_center',
        photoUrl: v.photo_url || null
      }));
      
      const nearbyVendors = allVendors
        .filter((vendor: any) => {
          // Must be approved and active
          if (vendor.status !== 'approved' || !vendor.isActive) return false;
          
          // Service type filter
          if (serviceType && (!vendor.services || !vendor.services.includes(serviceType))) {
            return false;
          }
          
          // Must have location
          if (!vendor.location || !vendor.location.lat || !vendor.location.lng) {
            return false;
          }
          
          const distance = calculateDistance(
            location.lat,
            location.lng,
            vendor.location.lat,
            vendor.location.lng
          );
          
          vendor.distance = distance;
          return distance <= searchRadius;
        })
        .sort((a: any, b: any) => a.distance - b.distance);

      const vendorList = nearbyVendors.map((vendor: any) => ({
        id: vendor.id,
        businessName: vendor.businessName,
        ownerName: vendor.ownerName,
        services: vendor.services,
        serviceStyle: vendor.serviceStyle,
        rating: vendor.rating,
        totalReviews: vendor.totalReviews,
        location: vendor.location,
        address: vendor.address,
        distance: vendor.distance,
        photoUrl: vendor.photoUrl || null
      }));

      console.log(`📍 Found ${vendorList.length} nearby vendors within ${searchRadius}km`);
      return c.json({ vendors: vendorList, total: vendorList.length });
    } catch (error) {
      console.error('Error finding nearby vendors:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get top-rated vendors
   * GET /make-server-3dd53475/search/vendors/top-rated
   */
  app.get("/make-server-3dd53475/search/vendors/top-rated", async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '10');
      const serviceType = c.req.query('serviceType');

      // ✅ SQL: Get all approved vendors using repository
      const vendorsRepo = getVendorsRepository();
      const allVendorsData = await vendorsRepo.findAll({});
      
      const allVendors = allVendorsData.map((v: any) => ({
        id: v.id,
        status: v.status,
        isActive: v.is_active,
        services: [],
        rating: v.rating || 0,
        totalReviews: v.total_reviews || 0,
        completedBookings: v.completed_bookings || 0,
        businessName: v.business_name,
        ownerName: v.owner_name,
        photoUrl: v.photo_url || null
      }));
      
      let topVendors = allVendors.filter((vendor: any) => {
        if (vendor.status !== 'approved' || !vendor.isActive) return false;
        if (serviceType && (!vendor.services || !vendor.services.includes(serviceType))) {
          return false;
        }
        return vendor.totalReviews >= 5; // At least 5 reviews
      });

      // Sort by rating and number of reviews
      topVendors.sort((a: any, b: any) => {
        const scoreA = (a.rating * 0.7) + ((a.totalReviews || 0) * 0.001);
        const scoreB = (b.rating * 0.7) + ((b.totalReviews || 0) * 0.001);
        return scoreB - scoreA;
      });

      const results = topVendors.slice(0, limit).map((vendor: any) => ({
        id: vendor.id,
        businessName: vendor.businessName,
        ownerName: vendor.ownerName,
        services: vendor.services,
        rating: vendor.rating,
        totalReviews: vendor.totalReviews,
        completedBookings: vendor.completedBookings,
        photoUrl: vendor.photoUrl || null
      }));

      return c.json({ vendors: results, total: results.length });
    } catch (error) {
      console.error('Error getting top-rated vendors:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Search services in catalog
   * GET /make-server-3dd53475/search/services
   */
  app.get("/make-server-3dd53475/search/services", async (c) => {
    try {
      const query = c.req.query('q') || '';
      const category = c.req.query('category');

      // ✅ SQL: Get all services from services table
      const servicesRepo = getServicesRepository();
      const allServicesData = await servicesRepo.findAll();
      
      const allServices = allServicesData.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        price: s.price,
        duration: s.duration_minutes || 30,
        isActive: s.is_active
      }));
      
      let results = allServices.filter((service: any) => {
        if (!service || !service.name) return false;
        
        // Category filter
        if (category && service.category !== category) return false;
        
        // Text search
        if (query) {
          const searchText = query.toLowerCase();
          const nameMatch = service.name.toLowerCase().includes(searchText);
          const descMatch = (service.description || '').toLowerCase().includes(searchText);
          return nameMatch || descMatch;
        }
        
        return true;
      });

      return c.json({ services: results, total: results.length });
    } catch (error) {
      console.error('Error searching services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get featured vendors
   * GET /make-server-3dd53475/search/vendors/featured
   */
  app.get("/make-server-3dd53475/search/vendors/featured", async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '10');

      // ✅ SQL: Featured vendors should be stored in a featured_vendors table or vendor.featured flag
      // For now, return empty array - featured vendors should be stored in database
      const featuredIds: string[] = [];
      
      const vendors = [];
      const vendorsRepo = getVendorsRepository();
      for (const vendorId of featuredIds.slice(0, limit)) {
        const vendor = await vendorsRepo.findById(vendorId);
        if (vendor && vendor.status === 'approved' && vendor.is_active) {
          vendors.push({
            id: vendor.id,
            businessName: vendor.business_name,
            ownerName: vendor.owner_name,
            services: [], // Should be queried from vendor_services
            rating: vendor.rating || 0,
            totalReviews: vendor.total_reviews || 0,
            photoUrl: vendor.photo_url || null
          });
        }
      }

      return c.json({ vendors, total: vendors.length });
    } catch (error) {
      console.error('Error getting featured vendors:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get service categories
   * GET /make-server-3dd53475/search/categories
   */
  app.get("/make-server-3dd53475/search/categories", async (c) => {
    try {
      // ✅ SQL: Service categories should be stored in a service_categories table
      // For now, return default categories
      const categories = [
        {
          id: 'grooming',
          name: 'Pet Grooming',
          icon: '✂️',
          description: 'Bath, haircut, nail trimming, and more',
          vendorCount: 0
        },
        {
          id: 'veterinary',
          name: 'Veterinary Care',
          icon: '🏥',
          description: 'Health checkups, vaccinations, treatments',
          vendorCount: 0
        },
        {
          id: 'training',
          name: 'Pet Training',
          icon: '🎓',
          description: 'Obedience training, behavior correction',
          vendorCount: 0
        },
        {
          id: 'boarding',
          name: 'Pet Boarding',
          icon: '🏠',
          description: 'Daycare and overnight pet boarding',
          vendorCount: 0
        },
        {
          id: 'walking',
          name: 'Dog Walking',
          icon: '🚶',
          description: 'Daily walks and exercise',
          vendorCount: 0
        },
        {
          id: 'photography',
          name: 'Pet Photography',
          icon: '📸',
          description: 'Professional pet photoshoots',
          vendorCount: 0
        }
      ];

      // ✅ SQL: Count vendors for each category using repository
      const vendorsRepo = getVendorsRepository();
      const allVendorsData = await vendorsRepo.findAll({});
      const approvedVendors = allVendorsData.filter((v: any) => v.status === 'approved' && v.is_active);

      categories.forEach((category: any) => {
        category.vendorCount = approvedVendors.filter((v: any) => 
          v.services && v.services.includes(category.id)
        ).length;
      });

      return c.json({ categories });
    } catch (error) {
      console.error('Error getting categories:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Search endpoints registered');
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
