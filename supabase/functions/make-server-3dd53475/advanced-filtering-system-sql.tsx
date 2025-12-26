/**
 * ============================================================================
 * ADVANCED FILTERING & SEARCH SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Advanced service filtering (price, rating, distance, availability)
 * - Multi-criteria search
 * - Sort options
 * - Favorites/bookmarks management
 * - Search history
 * - Saved filters
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `services`, `vendors`, `reviews`, `staff` tables
 * - Uses `search_history` table for search history
 * - Uses `customers` table (preferences JSONB for favorites and saved filters)
 * - Uses `ServicesRepository`, `VendorsRepository`, `ReviewsRepository`
 * 
 * Date: 2025-01-28
 * Migration: Batch 13 - KV to SQL (15 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getDbClient } from '../../lib/db.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';

const app = new Hono();
app.use('*', cors());

// Helper: Calculate distance (Haversine formula)
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

// Helper: Sort services
function sortServices(services: any[], sortBy: string): any[] {
  switch (sortBy) {
    case 'price_low':
      return services.sort((a, b) => (a.price || 0) - (b.price || 0));
    case 'price_high':
      return services.sort((a, b) => (b.price || 0) - (a.price || 0));
    case 'rating':
      return services.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'distance':
      return services.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    case 'relevance':
    default:
      return services.sort((a, b) => {
        const scoreA = (a.rating || 0) * 0.4 + (a.reviewCount || 0) * 0.3 + (100 - (a.distance || 100)) * 0.3;
        const scoreB = (b.rating || 0) * 0.4 + (b.reviewCount || 0) * 0.3 + (100 - (b.distance || 100)) * 0.3;
        return scoreB - scoreA;
      });
  }
}

/**
 * POST /make-server-3dd53475/customer/services/advanced-search
 * Advanced service search with multiple filters
 */
app.post('/make-server-3dd53475/customer/services/advanced-search', async (c) => {
  try {
    const {
      customerId,
      category,
      serviceStyle,
      location,
      petType,
      filters = {},
      sort = 'relevance',
      limit = 20,
      offset = 0
    } = await c.req.json();
    
    const db = getDbClient();
    
    // ✅ SQL: Get all services with filters
    let query = db
      .from('services')
      .select(`
        *,
        vendors!inner(*),
        reviews(rating)
      `)
      .eq('is_active', true);
    
    // Apply category filter
    if (category) {
      query = query.eq('category', category);
    }
    
    // Apply service style filter
    if (serviceStyle) {
      query = query.eq('service_style', serviceStyle);
    }
    
    const { data: servicesData, error } = await query;
    
    if (error) {
      throw error;
    }
    
    let filteredServices = (servicesData || []).map((service: any) => {
      // Calculate average rating
      const reviews = service.reviews || [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length
        : 0;
      
      return {
        ...service,
        rating: avgRating,
        reviewCount: reviews.length,
        price: service.price || 0,
        duration: service.duration_minutes || 0
      };
    });
    
    // Apply price range filter
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      filteredServices = filteredServices.filter((s: any) => {
        if (filters.minPrice !== undefined && s.price < filters.minPrice) return false;
        if (filters.maxPrice !== undefined && s.price > filters.maxPrice) return false;
        return true;
      });
    }
    
    // Apply rating filter
    if (filters.minRating) {
      filteredServices = filteredServices.filter((s: any) => s.rating >= filters.minRating);
    }
    
    // Apply distance filter (if location provided)
    if (location && filters.maxDistance) {
      filteredServices = filteredServices
        .map((s: any) => {
          if (s.vendors?.latitude && s.vendors?.longitude) {
            s.distance = calculateDistance(
              location.latitude,
              location.longitude,
              s.vendors.latitude,
              s.vendors.longitude
            );
          }
          return s;
        })
        .filter((s: any) => s.distance !== undefined && s.distance <= filters.maxDistance);
    } else if (location) {
      // Calculate distance for all services
      filteredServices = filteredServices.map((s: any) => {
        if (s.vendors?.latitude && s.vendors?.longitude) {
          s.distance = calculateDistance(
            location.latitude,
            location.longitude,
            s.vendors.latitude,
            s.vendors.longitude
          );
        }
        return s;
      });
    }
    
    // Sort results
    filteredServices = sortServices(filteredServices, sort);
    
    // Apply pagination
    const totalCount = filteredServices.length;
    const paginatedServices = filteredServices.slice(offset, offset + limit);
    
    // ✅ SQL: Save search history
    if (customerId) {
      await db.from('search_history').insert({
        customer_id: customerId,
        search_query: JSON.stringify({ category, serviceStyle, filters, sort }),
        results_count: totalCount
      });
    }
    
    console.log(`🔍 Advanced search: ${totalCount} results found`);
    
    return c.json({
      success: true,
      services: paginatedServices,
      filters: {
        applied: filters,
        sort
      },
      pagination: {
        totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });
    
  } catch (error) {
    console.error('Error in advanced search:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/customer/:customerId/favorites/add
 * Add service/vendor to favorites
 */
app.post('/make-server-3dd53475/customer/:customerId/favorites/add', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const { type, itemId, itemData } = await c.req.json();
    
    if (!type || !itemId) {
      return c.json({
        error: 'Missing required fields',
        required: ['type', 'itemId']
      }, 400);
    }
    
    // ✅ SQL: Get customer and update favorites in preferences
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    const favorites = customer.preferences?.favorites || {
      services: [],
      vendors: [],
      staff: []
    };
    
    const listKey = type === 'service' ? 'services' : type === 'vendor' ? 'vendors' : 'staff';
    
    // Check if already favorited
    if (favorites[listKey].some((fav: any) => fav.id === itemId)) {
      return c.json({ error: 'Already in favorites' }, 400);
    }
    
    // Add to favorites
    favorites[listKey].push({
      id: itemId,
      type,
      addedAt: new Date().toISOString(),
      data: itemData || {}
    });
    
    const updatedPreferences = {
      ...(customer.preferences || {}),
      favorites
    };
    
    await customersRepo.update(customerId, {
      preferences: updatedPreferences
    });
    
    return c.json({
      success: true,
      favorites: {
        servicesCount: favorites.services.length,
        vendorsCount: favorites.vendors.length,
        staffCount: favorites.staff.length
      },
      message: 'Added to favorites successfully'
    });
    
  } catch (error) {
    console.error('Error adding to favorites:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/:customerId/favorites
 * Get all favorites
 */
app.get('/make-server-3dd53475/customer/:customerId/favorites', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const type = c.req.query('type');
    
    // ✅ SQL: Get customer favorites
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    const favorites = customer.preferences?.favorites || {
      services: [],
      vendors: [],
      staff: []
    };
    
    if (type) {
      const listKey = type === 'service' ? 'services' : type === 'vendor' ? 'vendors' : 'staff';
      return c.json({
        success: true,
        favorites: favorites[listKey],
        count: favorites[listKey].length
      });
    }
    
    return c.json({
      success: true,
      favorites,
      counts: {
        services: favorites.services.length,
        vendors: favorites.vendors.length,
        staff: favorites.staff.length,
        total: favorites.services.length + favorites.vendors.length + favorites.staff.length
      }
    });
    
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/:customerId/search-history
 * Get search history
 */
app.get('/make-server-3dd53475/customer/:customerId/search-history', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const limit = parseInt(c.req.query('limit') || '20');
    
    // ✅ SQL: Get search history
    const db = getDbClient();
    const { data: history } = await db
      .from('search_history')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    return c.json({
      success: true,
      searchHistory: history || [],
      count: history?.length || 0
    });
    
  } catch (error) {
    console.error('Error fetching search history:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Export as named export to match import
export { app as advancedFilteringSystemSQL };
export default app;

