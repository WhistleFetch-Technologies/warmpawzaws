/**
 * SEARCH ENDPOINTS - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Search & Discovery Endpoints:
 * - Vendor search with filters
 * - Nearby vendors
 * - Top-rated vendors
 * - Service catalog search
 * - Featured vendors
 * - Service categories
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (8 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { calculateDistance } from '../../lib/utils/distance-calculation.ts';

export function searchEndpointsSQL(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';
  const db = getDbClient();
  const vendorsRepo = getVendorsRepository();
  const servicesRepo = getServicesRepository();

  // ============================================
  // SEARCH & DISCOVERY ENDPOINTS
  // ============================================

  /**
   * Search vendors with filters
   * POST /make-server-3dd53475/search/vendors
   */
  app.post(`${BASE_PATH}/search/vendors`, async (c) => {
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

      // ✅ SQL: Get all approved and active vendors
      const allVendors = await vendorsRepo.findByStatus('approved', { 
        limit: 10000 
      });

      // Filter vendors
      let filteredVendors = allVendors.filter((vendor: any) => {
        // Must be approved and active
        if (vendor.status !== 'approved' || !vendor.is_active) return false;
        
        // Service type filter - check if vendor has services in this category
        if (serviceType) {
          // We'll need to check vendor services separately
          // For now, we'll filter by role_id or category
          if (vendor.category && vendor.category !== serviceType) {
            return false;
          }
        }
        
        // Rating filter
        if (minRating && (vendor.rating || 0) < minRating) {
          return false;
        }
        
        return true;
      });

      // Location-based filtering
      if (location && radius) {
        filteredVendors = filteredVendors.filter((vendor: any) => {
          if (!vendor.latitude || !vendor.longitude) {
            return false;
          }
          
          const distance = calculateDistance(
            location.lat,
            location.lng,
            vendor.latitude,
            vendor.longitude
          );
          
          vendor.distance = distance;
          return distance <= radius;
        });
      }

      // Sort results
      switch (sortBy) {
        case 'rating':
          filteredVendors.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
          break;
        case 'reviews':
          filteredVendors.sort((a: any, b: any) => (b.total_reviews || 0) - (a.total_reviews || 0));
          break;
        case 'distance':
          if (location) {
            filteredVendors.sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));
          }
          break;
        default:
          // Default: rating + reviews combined score
          filteredVendors.sort((a: any, b: any) => {
            const scoreA = ((a.rating || 0) * 0.7) + ((a.total_reviews || 0) * 0.3);
            const scoreB = ((b.rating || 0) * 0.7) + ((b.total_reviews || 0) * 0.3);
            return scoreB - scoreA;
          });
      }

      // Apply limit
      const maxResults = limit || 50;
      const results = filteredVendors.slice(0, maxResults);

      // Format results for customer view
      const vendorList = results.map((vendor: any) => ({
        id: vendor.id,
        businessName: vendor.business_name,
        ownerName: vendor.owner_name,
        services: vendor.category ? [vendor.category] : [],
        serviceStyle: 'both', // Default, can be enhanced
        rating: vendor.rating || 0,
        totalReviews: vendor.total_reviews || 0,
        completedBookings: 0, // Can be computed from bookings table
        experience: vendor.experience_years || 0,
        location: {
          lat: vendor.latitude,
          lng: vendor.longitude
        },
        address: vendor.address,
        distance: vendor.distance || null,
        photoUrl: null, // Can be added from vendor profile
        pricing: {} // Can be computed from services
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
  app.post(`${BASE_PATH}/search/vendors/nearby`, async (c) => {
    try {
      const { location, radius, serviceType } = await c.req.json();

      if (!location || !location.lat || !location.lng) {
        return c.json({ error: 'Location is required' }, 400);
      }

      const searchRadius = radius || 10; // Default 10km

      // ✅ SQL: Get all approved and active vendors
      const allVendors = await vendorsRepo.findByStatus('approved', { 
        limit: 10000 
      });
      
      const nearbyVendors = allVendors
        .filter((vendor: any) => {
          // Must be approved and active
          if (vendor.status !== 'approved' || !vendor.is_active) return false;
          
          // Service type filter
          if (serviceType && vendor.category && vendor.category !== serviceType) {
            return false;
          }
          
          // Must have location
          if (!vendor.latitude || !vendor.longitude) {
            return false;
          }
          
          const distance = calculateDistance(
            location.lat,
            location.lng,
            vendor.latitude,
            vendor.longitude
          );
          
          vendor.distance = distance;
          return distance <= searchRadius;
        })
        .sort((a: any, b: any) => a.distance - b.distance);

      const vendorList = nearbyVendors.map((vendor: any) => ({
        id: vendor.id,
        businessName: vendor.business_name,
        ownerName: vendor.owner_name,
        services: vendor.category ? [vendor.category] : [],
        serviceStyle: 'both',
        rating: vendor.rating || 0,
        totalReviews: vendor.total_reviews || 0,
        location: {
          lat: vendor.latitude,
          lng: vendor.longitude
        },
        address: vendor.address,
        distance: vendor.distance,
        photoUrl: null
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
  app.get(`${BASE_PATH}/search/vendors/top-rated`, async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '10');
      const serviceType = c.req.query('serviceType');

      // ✅ SQL: Get all approved and active vendors
      const allVendors = await vendorsRepo.findByStatus('approved', { 
        limit: 10000 
      });
      
      let topVendors = allVendors.filter((vendor: any) => {
        if (vendor.status !== 'approved' || !vendor.is_active) return false;
        if (serviceType && vendor.category && vendor.category !== serviceType) {
          return false;
        }
        return (vendor.total_reviews || 0) >= 5; // At least 5 reviews
      });

      // Sort by rating and number of reviews
      topVendors.sort((a: any, b: any) => {
        const scoreA = ((a.rating || 0) * 0.7) + ((a.total_reviews || 0) * 0.001);
        const scoreB = ((b.rating || 0) * 0.7) + ((b.total_reviews || 0) * 0.001);
        return scoreB - scoreA;
      });

      const results = topVendors.slice(0, limit).map((vendor: any) => ({
        id: vendor.id,
        businessName: vendor.business_name,
        ownerName: vendor.owner_name,
        services: vendor.category ? [vendor.category] : [],
        rating: vendor.rating || 0,
        totalReviews: vendor.total_reviews || 0,
        completedBookings: 0,
        photoUrl: null
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
  app.get(`${BASE_PATH}/search/services`, async (c) => {
    try {
      const query = c.req.query('q') || '';
      const category = c.req.query('category');

      // ✅ SQL: Get all services from service_catalog table
      let servicesQuery = db
        .from('service_catalog')
        .select('*')
        .eq('status', 'active')
        .eq('publish_status', 'published');

      if (category) {
        servicesQuery = servicesQuery.eq('category_name', category);
      }

      const { data: allServices, error } = await servicesQuery;

      if (error) {
        throw error;
      }

      let results = (allServices || []).filter((service: any) => {
        if (!service || !service.service_name) return false;
        
        // Text search
        if (query) {
          const searchText = query.toLowerCase();
          const nameMatch = service.service_name.toLowerCase().includes(searchText);
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
  app.get(`${BASE_PATH}/search/vendors/featured`, async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '10');

      // ✅ SQL: Get featured vendor IDs from featured_vendors table
      const { data: featuredVendors, error } = await db
        .from('featured_vendors')
        .select('vendor_id, display_order')
        .order('display_order', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      const vendors = [];
      for (const featured of featuredVendors || []) {
        const vendor = await vendorsRepo.findById(featured.vendor_id);
        if (vendor && vendor.status === 'approved' && vendor.is_active) {
          vendors.push({
            id: vendor.id,
            businessName: vendor.business_name,
            ownerName: vendor.owner_name,
            services: vendor.category ? [vendor.category] : [],
            rating: vendor.rating || 0,
            totalReviews: vendor.total_reviews || 0,
            photoUrl: null
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
  app.get(`${BASE_PATH}/search/categories`, async (c) => {
    try {
      // ✅ SQL: Get categories from service_categories table
      const { data: categoriesData, error } = await db
        .from('service_categories')
        .select('id, name, description, display_order')
        .order('display_order', { ascending: true });

      // Format categories from DB
      let categories = (categoriesData || []).map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        icon: '📋', // Default icon
        description: cat.description || '',
        vendorCount: 0
      }));

      // If no categories in DB, return default categories
      if (categories.length === 0) {
        categories = [
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
      }

      // ✅ SQL: Count vendors for each category
      const allVendors = await vendorsRepo.findByStatus('approved', { 
        limit: 10000 
      });
      const approvedVendors = allVendors.filter((v: any) => v.is_active);

      categories.forEach((category: any) => {
        category.vendorCount = approvedVendors.filter((v: any) => 
          v.category && v.category === category.id
        ).length;
      });

      return c.json({ categories });
    } catch (error) {
      console.error('Error getting categories:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Search endpoints registered (SQL-only)');
}
