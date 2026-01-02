/**
 * ADVANCED FILTERING & SEARCH SYSTEM
 * 
 * Features:
 * - Advanced service filtering (price, rating, distance, availability)
 * - Multi-criteria search
 * - Sort options (relevance, price, rating, distance)
 * - Favorites/bookmarks management
 * - Search history
 * - Saved filters
 * - Filter presets
 * 
 * Status: ✅ P2 IMPLEMENTATION (5%)
 */

import { Hono } from 'hono';
import { cors } from "hono/cors";
import * as kv from './kv_store';

const app = new Hono();
app.use('*', cors());

// ==========================================================================
// ADVANCED SERVICE FILTERING
// ==========================================================================

/**
 * POST /customer/services/advanced-search
 * Advanced service search with multiple filters
 */
app.post('/customer/services/advanced-search', async (c) => {
  try {
    const {
      customerId,
      category, // 'veterinary', 'grooming', etc.
      serviceStyle, // 'at_home', 'at_center', 'tele'
      location,
      petType, // 'Dog', 'Cat', etc.
      filters = {},
      sort = 'relevance', // 'relevance', 'price_low', 'price_high', 'rating', 'distance'
      limit = 20,
      offset = 0
    } = await c.req.json();
    
    // Get all services
    const allServices = await kv.getByPrefix('service:') || [];
    
    let filteredServices = allServices;
    
    // Apply category filter
    if (category) {
      filteredServices = filteredServices.filter((s: any) => 
        s.category === category || s.serviceType === category
      );
    }
    
    // Apply service style filter
    if (serviceStyle) {
      filteredServices = filteredServices.filter((s: any) => 
        s.serviceStyle === serviceStyle
      );
    }
    
    // Apply pet type filter
    if (petType) {
      filteredServices = filteredServices.filter((s: any) => 
        !s.petTypes || s.petTypes.length === 0 || s.petTypes.includes(petType)
      );
    }
    
    // Apply price range filter
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      filteredServices = filteredServices.filter((s: any) => {
        const price = s.price || 0;
        if (filters.minPrice !== undefined && price < filters.minPrice) return false;
        if (filters.maxPrice !== undefined && price > filters.maxPrice) return false;
        return true;
      });
    }
    
    // Apply rating filter
    if (filters.minRating) {
      filteredServices = filteredServices.filter((s: any) => {
        const rating = s.rating || 0;
        return rating >= filters.minRating;
      });
    }
    
    // Apply availability filter
    if (filters.availableNow) {
      filteredServices = filteredServices.filter((s: any) => {
        return s.isAvailable !== false;
      });
    }
    
    // Apply distance filter (if location provided)
    if (location && filters.maxDistance) {
      filteredServices = filteredServices.filter((s: any) => {
        if (!s.location) return false;
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          s.location.latitude,
          s.location.longitude
        );
        return distance <= filters.maxDistance;
      });
    }
    
    // Apply duration filter
    if (filters.minDuration || filters.maxDuration) {
      filteredServices = filteredServices.filter((s: any) => {
        const duration = s.duration || 0;
        if (filters.minDuration && duration < filters.minDuration) return false;
        if (filters.maxDuration && duration > filters.maxDuration) return false;
        return true;
      });
    }
    
    // Apply experience filter (for staff)
    if (filters.minExperience) {
      filteredServices = filteredServices.filter((s: any) => {
        const experience = s.yearsOfExperience || 0;
        return experience >= filters.minExperience;
      });
    }
    
    // Apply specialization filter
    if (filters.specializations && filters.specializations.length > 0) {
      filteredServices = filteredServices.filter((s: any) => {
        if (!s.specializations) return false;
        return filters.specializations.some((spec: string) => 
          s.specializations.includes(spec)
        );
      });
    }
    
    // Apply certification filter
    if (filters.certifiedOnly) {
      filteredServices = filteredServices.filter((s: any) => 
        s.certifications && s.certifications.length > 0
      );
    }
    
    // Apply verified filter
    if (filters.verifiedOnly) {
      filteredServices = filteredServices.filter((s: any) => 
        s.isVerified === true
      );
    }
    
    // Calculate distance for all services if location provided
    if (location) {
      filteredServices = filteredServices.map((s: any) => {
        if (s.location) {
          s.distance = calculateDistance(
            location.latitude,
            location.longitude,
            s.location.latitude,
            s.location.longitude
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
    
    // Save search history
    if (customerId) {
      const searchHistory = await kv.get(`customer:${customerId}:search-history`) || [];
      searchHistory.unshift({
        query: { category, serviceStyle, filters, sort },
        resultsCount: totalCount,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 50 searches
      if (searchHistory.length > 50) {
        searchHistory.splice(50);
      }
      
      await kv.set(`customer:${customerId}:search-history`, searchHistory);
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

// Helper: Calculate distance between two coordinates (Haversine formula)
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
    case 'experience':
      return services.sort((a, b) => (b.yearsOfExperience || 0) - (a.yearsOfExperience || 0));
    case 'relevance':
    default:
      // Relevance: combination of rating, reviews, and distance
      return services.sort((a, b) => {
        const scoreA = (a.rating || 0) * 0.4 + (a.reviewCount || 0) * 0.3 + (100 - (a.distance || 100)) * 0.3;
        const scoreB = (b.rating || 0) * 0.4 + (b.reviewCount || 0) * 0.3 + (100 - (b.distance || 100)) * 0.3;
        return scoreB - scoreA;
      });
  }
}

// ==========================================================================
// FAVORITES / BOOKMARKS
// ==========================================================================

/**
 * POST /customer/:customerId/favorites/add
 * Add service/vendor to favorites
 */
app.post('/customer/:customerId/favorites/add', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const { type, itemId, itemData } = await c.req.json();
    
    if (!type || !itemId) {
      return c.json({
        error: 'Missing required fields',
        required: ['type', 'itemId']
      }, 400);
    }
    
    const validTypes = ['service', 'vendor', 'staff'];
    if (!validTypes.includes(type)) {
      return c.json({
        error: 'Invalid type',
        validTypes
      }, 400);
    }
    
    // Get favorites
    const favorites = await kv.get(`customer:${customerId}:favorites`) || {
      services: [],
      vendors: [],
      staff: []
    };
    
    // Add to appropriate list
    const listKey = type === 'service' ? 'services' : type === 'vendor' ? 'vendors' : 'staff';
    
    // Check if already favorited
    if (favorites[listKey].some((fav: any) => fav.id === itemId)) {
      return c.json({
        error: 'Already in favorites'
      }, 400);
    }
    
    // Add to favorites
    favorites[listKey].push({
      id: itemId,
      type,
      addedAt: new Date().toISOString(),
      data: itemData || {}
    });
    
    await kv.set(`customer:${customerId}:favorites`, favorites);
    
    console.log(`⭐ Added to favorites: ${type} ${itemId}`);
    
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
 * DELETE /customer/:customerId/favorites/remove
 * Remove from favorites
 */
app.delete('/customer/:customerId/favorites/remove', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const { type, itemId } = await c.req.json();
    
    const favorites = await kv.get(`customer:${customerId}:favorites`) || {
      services: [],
      vendors: [],
      staff: []
    };
    
    const listKey = type === 'service' ? 'services' : type === 'vendor' ? 'vendors' : 'staff';
    
    // Remove from list
    favorites[listKey] = favorites[listKey].filter((fav: any) => fav.id !== itemId);
    
    await kv.set(`customer:${customerId}:favorites`, favorites);
    
    console.log(`🗑️ Removed from favorites: ${type} ${itemId}`);
    
    return c.json({
      success: true,
      message: 'Removed from favorites successfully'
    });
    
  } catch (error) {
    console.error('Error removing from favorites:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /customer/:customerId/favorites
 * Get all favorites
 */
app.get('/customer/:customerId/favorites', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const type = c.req.query('type'); // Optional filter
    
    const favorites = await kv.get(`customer:${customerId}:favorites`) || {
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

// ==========================================================================
// SAVED FILTERS & PRESETS
// ==========================================================================

/**
 * POST /customer/:customerId/saved-filters
 * Save filter preset
 */
app.post('/customer/:customerId/saved-filters', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const { name, filters, category } = await c.req.json();
    
    if (!name || !filters) {
      return c.json({
        error: 'Missing required fields',
        required: ['name', 'filters']
      }, 400);
    }
    
    const savedFilters = await kv.get(`customer:${customerId}:saved-filters`) || [];
    
    const filterId = `filter_${Date.now()}`;
    
    savedFilters.push({
      id: filterId,
      name,
      filters,
      category: category || 'general',
      createdAt: new Date().toISOString()
    });
    
    await kv.set(`customer:${customerId}:saved-filters`, savedFilters);
    
    console.log(`💾 Filter preset saved: ${name}`);
    
    return c.json({
      success: true,
      filterId,
      message: 'Filter preset saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving filter preset:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /customer/:customerId/saved-filters
 * Get saved filter presets
 */
app.get('/customer/:customerId/saved-filters', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    
    const savedFilters = await kv.get(`customer:${customerId}:saved-filters`) || [];
    
    return c.json({
      success: true,
      savedFilters,
      count: savedFilters.length
    });
    
  } catch (error) {
    console.error('Error fetching saved filters:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * DELETE /customer/:customerId/saved-filters/:filterId
 * Delete saved filter preset
 */
app.delete('/customer/:customerId/saved-filters/:filterId', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const filterId = c.req.param('filterId');
    
    let savedFilters = await kv.get(`customer:${customerId}:saved-filters`) || [];
    
    savedFilters = savedFilters.filter((f: any) => f.id !== filterId);
    
    await kv.set(`customer:${customerId}:saved-filters`, savedFilters);
    
    return c.json({
      success: true,
      message: 'Filter preset deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting saved filter:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// SEARCH HISTORY
// ==========================================================================

/**
 * GET /customer/:customerId/search-history
 * Get search history
 */
app.get('/customer/:customerId/search-history', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const limit = parseInt(c.req.query('limit') || '20');
    
    const searchHistory = await kv.get(`customer:${customerId}:search-history`) || [];
    
    return c.json({
      success: true,
      searchHistory: searchHistory.slice(0, limit),
      count: searchHistory.length
    });
    
  } catch (error) {
    console.error('Error fetching search history:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * DELETE /customer/:customerId/search-history
 * Clear search history
 */
app.delete('/customer/:customerId/search-history', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    
    await kv.set(`customer:${customerId}:search-history`, []);
    
    return c.json({
      success: true,
      message: 'Search history cleared successfully'
    });
    
  } catch (error) {
    console.error('Error clearing search history:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
