import { Hono } from "npm:hono";

export function searchEndpoints(app: Hono, kv: any) {
  
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

      // Get all approved vendors
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      
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

      // Get all approved vendors
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      
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

      // Get all approved vendors
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      
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

      // Get all services from catalog
      const allServices = await kv.getByPrefix('service:catalog:');
      
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

      // Get featured vendor IDs (manually curated by admin)
      const featuredIds = await kv.get('featured:vendors') || [];
      
      const vendors = [];
      for (const vendorId of featuredIds.slice(0, limit)) {
        const vendor = await kv.get(`vendor:${vendorId}`);
        if (vendor && vendor.status === 'approved' && vendor.isActive) {
          vendors.push({
            id: vendor.id,
            businessName: vendor.businessName,
            ownerName: vendor.ownerName,
            services: vendor.services,
            rating: vendor.rating,
            totalReviews: vendor.totalReviews,
            photoUrl: vendor.photoUrl || null
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
      const categories = await kv.get('service:categories') || [
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

      // Count vendors for each category
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      const approvedVendors = allVendors.filter((v: any) => v.status === 'approved' && v.isActive);

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
