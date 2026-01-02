/**
 * 🔍 ELASTICSEARCH COMPLETE IMPLEMENTATION
 * Rule 5: Elastic Search Across Customer App
 * 
 * Features:
 * - Advanced search with fuzzy matching
 * - Autocomplete and suggestions
 * - Search indexing for staff, centers, services
 * - Search analytics and trending
 * - Faceted search and filters
 * - Search history tracking
 */

import { Hono } from 'hono';
import * as kv from './kv_store';

const app = new Hono();

// ==========================================
// SEARCH INDEX MANAGEMENT
// ==========================================

/**
 * POST /search/index/create - Create search indexes
 */
app.post('/search/index/create', async (c) => {
  try {
    const { type } = await c.req.json();
    
    if (!type || !['staff', 'center', 'service', 'all'].includes(type)) {
      return c.json({ success: false, error: 'Invalid type. Must be: staff, center, service, or all' }, 400);
    }
    
    const results = {
      staff: 0,
      centers: 0,
      services: 0
    };
    
    // Index staff
    if (type === 'staff' || type === 'all') {
      const allStaff = await kv.getByPrefix('staff_') || [];
      const vendors = await kv.getByPrefix('vendor_') || [];
      
      for (const staff of allStaff) {
        const vendor = vendors.find((v: any) => v.vendorId === staff.vendorId);
        
        const searchableText = [
          staff.name,
          staff.specialization,
          staff.qualifications?.join(' '),
          staff.services?.join(' '),
          vendor?.businessName,
          vendor?.address?.city,
          vendor?.address?.area
        ].filter(Boolean).join(' ').toLowerCase();
        
        const searchIndex = {
          id: staff.staffId,
          type: 'staff',
          data: {
            staffId: staff.staffId,
            name: staff.name,
            specialization: staff.specialization,
            services: staff.services || [],
            rating: staff.rating || 0,
            experience: staff.experience || 0,
            vendorId: staff.vendorId,
            vendorName: vendor?.businessName,
            location: {
              city: vendor?.address?.city,
              area: vendor?.address?.area,
              lat: vendor?.location?.lat,
              lng: vendor?.location?.lng
            }
          },
          searchableText,
          tags: [
            staff.specialization,
            ...(staff.services || []),
            vendor?.address?.city,
            vendor?.address?.area
          ].filter(Boolean).map(t => t.toLowerCase()),
          rating: staff.rating || 0,
          indexedAt: new Date().toISOString()
        };
        
        await kv.set(`search_index_staff_${staff.staffId}`, searchIndex);
        results.staff++;
      }
    }
    
    // Index centers
    if (type === 'center' || type === 'all') {
      const vendors = await kv.getByPrefix('vendor_') || [];
      const centerVendors = vendors.filter((v: any) => 
        v.serviceType === 'veterinary' || 
        v.serviceType === 'grooming' ||
        v.serviceType === 'boarding' ||
        v.serviceType === 'daycare'
      );
      
      for (const vendor of centerVendors) {
        const searchableText = [
          vendor.businessName,
          vendor.serviceType,
          vendor.description,
          vendor.services?.join(' '),
          vendor.address?.city,
          vendor.address?.area,
          vendor.address?.pincode
        ].filter(Boolean).join(' ').toLowerCase();
        
        const searchIndex = {
          id: vendor.vendorId,
          type: 'center',
          data: {
            vendorId: vendor.vendorId,
            businessName: vendor.businessName,
            serviceType: vendor.serviceType,
            services: vendor.services || [],
            rating: vendor.rating || 0,
            location: {
              city: vendor.address?.city,
              area: vendor.address?.area,
              pincode: vendor.address?.pincode,
              lat: vendor.location?.lat,
              lng: vendor.location?.lng
            },
            amenities: vendor.amenities || [],
            openingHours: vendor.openingHours
          },
          searchableText,
          tags: [
            vendor.serviceType,
            ...(vendor.services || []),
            vendor.address?.city,
            vendor.address?.area,
            ...(vendor.amenities || [])
          ].filter(Boolean).map(t => t.toLowerCase()),
          rating: vendor.rating || 0,
          location: vendor.location,
          indexedAt: new Date().toISOString()
        };
        
        await kv.set(`search_index_center_${vendor.vendorId}`, searchIndex);
        results.centers++;
      }
    }
    
    // Index services
    if (type === 'service' || type === 'all') {
      const services = await kv.getByPrefix('service_') || [];
      const vendors = await kv.getByPrefix('vendor_') || [];
      
      for (const service of services) {
        const vendor = vendors.find((v: any) => v.vendorId === service.vendorId);
        
        const searchableText = [
          service.name,
          service.description,
          service.category,
          service.subCategory,
          vendor?.businessName,
          vendor?.address?.city,
          vendor?.address?.area
        ].filter(Boolean).join(' ').toLowerCase();
        
        const searchIndex = {
          id: service.serviceId,
          type: 'service',
          data: {
            serviceId: service.serviceId,
            name: service.name,
            description: service.description,
            category: service.category,
            subCategory: service.subCategory,
            price: service.price,
            duration: service.duration,
            vendorId: service.vendorId,
            vendorName: vendor?.businessName,
            location: {
              city: vendor?.address?.city,
              area: vendor?.address?.area,
              lat: vendor?.location?.lat,
              lng: vendor?.location?.lng
            }
          },
          searchableText,
          tags: [
            service.category,
            service.subCategory,
            vendor?.address?.city,
            vendor?.address?.area
          ].filter(Boolean).map(t => t.toLowerCase()),
          price: service.price,
          indexedAt: new Date().toISOString()
        };
        
        await kv.set(`search_index_service_${service.serviceId}`, searchIndex);
        results.services++;
      }
    }
    
    return c.json({
      success: true,
      message: 'Search indexes created successfully',
      results
    });
  } catch (error) {
    console.error('Failed to create search indexes:', error);
    return c.json({ success: false, error: 'Failed to create search indexes' }, 500);
  }
});

/**
 * POST /search/index/bulk - Bulk index items
 */
app.post('/search/index/bulk', async (c) => {
  try {
    const { items, type } = await c.req.json();
    
    if (!items || !Array.isArray(items)) {
      return c.json({ success: false, error: 'items array is required' }, 400);
    }
    
    if (!type || !['staff', 'center', 'service'].includes(type)) {
      return c.json({ success: false, error: 'Invalid type' }, 400);
    }
    
    let indexed = 0;
    for (const item of items) {
      const searchIndex = {
        id: item.id,
        type,
        data: item.data,
        searchableText: item.searchableText || '',
        tags: item.tags || [],
        rating: item.rating,
        location: item.location,
        price: item.price,
        indexedAt: new Date().toISOString()
      };
      
      await kv.set(`search_index_${type}_${item.id}`, searchIndex);
      indexed++;
    }
    
    return c.json({
      success: true,
      indexed
    });
  } catch (error) {
    console.error('Failed to bulk index:', error);
    return c.json({ success: false, error: 'Failed to bulk index' }, 500);
  }
});

// ==========================================
// ADVANCED SEARCH
// ==========================================

/**
 * Fuzzy string matching score (0-1)
 */
function fuzzyMatch(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // Contains match
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Levenshtein distance-based scoring
  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLen);
}

function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const dp: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }
  
  return dp[len1][len2];
}

/**
 * GET /search/elastic - Advanced search with fuzzy matching
 */
app.get('/search/elastic', async (c) => {
  try {
    const { 
      q, 
      type, 
      limit = 20, 
      offset = 0,
      city,
      area,
      minRating,
      maxPrice,
      minPrice,
      tags
    } = c.req.query();
    
    if (!q) {
      return c.json({ success: false, error: 'Search query (q) is required' }, 400);
    }
    
    const query = (q as string).toLowerCase();
    const searchTypes = type ? [(type as string)] : ['staff', 'center', 'service'];
    
    let allResults: any[] = [];
    
    for (const searchType of searchTypes) {
      const indexes = await kv.getByPrefix(`search_index_${searchType}_`) || [];
      
      for (const index of indexes) {
        let score = fuzzyMatch(index.searchableText, query);
        
        // Boost score for tag matches
        if (index.tags) {
          const tagMatches = index.tags.filter((tag: string) => 
            fuzzyMatch(tag, query) > 0.6
          );
          score += tagMatches.length * 0.1;
        }
        
        // Only include results with score > 0.3
        if (score > 0.3) {
          // Apply filters
          if (city && index.data?.location?.city?.toLowerCase() !== (city as string).toLowerCase()) continue;
          if (area && index.data?.location?.area?.toLowerCase() !== (area as string).toLowerCase()) continue;
          if (minRating && (index.rating || 0) < parseFloat(minRating as string)) continue;
          if (maxPrice && index.price && index.price > parseFloat(maxPrice as string)) continue;
          if (minPrice && index.price && index.price < parseFloat(minPrice as string)) continue;
          
          if (tags) {
            const requiredTags = (tags as string).split(',').map(t => t.trim().toLowerCase());
            const hasAllTags = requiredTags.every(rt => 
              index.tags?.some((t: string) => t.includes(rt))
            );
            if (!hasAllTags) continue;
          }
          
          allResults.push({
            ...index,
            score
          });
        }
      }
    }
    
    // Sort by score descending
    allResults.sort((a, b) => b.score - a.score);
    
    // Paginate
    const paginatedResults = allResults.slice(
      parseInt(offset as string),
      parseInt(offset as string) + parseInt(limit as string)
    );
    
    // Track search
    await trackSearch(query, allResults.length, c.req.header('user-id'));
    
    return c.json({
      success: true,
      query,
      total: allResults.length,
      results: paginatedResults,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Failed to search:', error);
    return c.json({ success: false, error: 'Search failed' }, 500);
  }
});

/**
 * GET /search/autocomplete - Autocomplete suggestions
 */
app.get('/search/autocomplete', async (c) => {
  try {
    const { q, limit = 10 } = c.req.query();
    
    if (!q || (q as string).length < 2) {
      return c.json({ success: true, suggestions: [] });
    }
    
    const query = (q as string).toLowerCase();
    
    // Get all search indexes
    const allIndexes = await kv.getByPrefix('search_index_') || [];
    
    // Extract unique suggestions
    const suggestions = new Set<string>();
    
    for (const index of allIndexes) {
      // Add matching tags
      if (index.tags) {
        index.tags.forEach((tag: string) => {
          if (tag.startsWith(query) || tag.includes(query)) {
            suggestions.add(tag);
          }
        });
      }
      
      // Add matching names
      if (index.data?.name && index.data.name.toLowerCase().includes(query)) {
        suggestions.add(index.data.name.toLowerCase());
      }
      
      if (index.data?.businessName && index.data.businessName.toLowerCase().includes(query)) {
        suggestions.add(index.data.businessName.toLowerCase());
      }
      
      if (index.data?.specialization && index.data.specialization.toLowerCase().includes(query)) {
        suggestions.add(index.data.specialization.toLowerCase());
      }
    }
    
    // Convert to array and limit
    const suggestionArray = Array.from(suggestions)
      .sort()
      .slice(0, parseInt(limit as string));
    
    return c.json({
      success: true,
      query,
      suggestions: suggestionArray
    });
  } catch (error) {
    console.error('Failed to get autocomplete:', error);
    return c.json({ success: false, error: 'Autocomplete failed' }, 500);
  }
});

/**
 * GET /search/suggestions - Search suggestions based on popular searches
 */
app.get('/search/suggestions', async (c) => {
  try {
    const { q, limit = 5 } = c.req.query();
    
    // Get popular searches
    const popularSearches = await kv.get('search_popular') || { queries: [] };
    
    let suggestions = popularSearches.queries
      .sort((a: any, b: any) => b.count - a.count)
      .map((s: any) => s.query);
    
    // If query provided, filter suggestions
    if (q) {
      const query = (q as string).toLowerCase();
      suggestions = suggestions.filter((s: string) => 
        s.toLowerCase().includes(query)
      );
    }
    
    suggestions = suggestions.slice(0, parseInt(limit as string));
    
    return c.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Failed to get suggestions:', error);
    return c.json({ success: false, error: 'Failed to get suggestions' }, 500);
  }
});

/**
 * POST /search/staff - Search specifically for staff
 */
app.post('/search/staff', async (c) => {
  try {
    const { 
      query, 
      specialization, 
      services, 
      minRating, 
      city, 
      area,
      limit = 20,
      offset = 0
    } = await c.req.json();
    
    const staffIndexes = await kv.getByPrefix('search_index_staff_') || [];
    
    let results = staffIndexes;
    
    // Apply filters
    if (query) {
      const q = query.toLowerCase();
      results = results.filter((index: any) => 
        fuzzyMatch(index.searchableText, q) > 0.3
      );
    }
    
    if (specialization) {
      results = results.filter((index: any) => 
        index.data?.specialization?.toLowerCase() === specialization.toLowerCase()
      );
    }
    
    if (services && Array.isArray(services)) {
      results = results.filter((index: any) => 
        services.some(s => index.data?.services?.includes(s))
      );
    }
    
    if (minRating) {
      results = results.filter((index: any) => 
        (index.rating || 0) >= minRating
      );
    }
    
    if (city) {
      results = results.filter((index: any) => 
        index.data?.location?.city?.toLowerCase() === city.toLowerCase()
      );
    }
    
    if (area) {
      results = results.filter((index: any) => 
        index.data?.location?.area?.toLowerCase() === area.toLowerCase()
      );
    }
    
    // Sort by rating
    results.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
    
    // Paginate
    const paginatedResults = results.slice(offset, offset + limit);
    
    return c.json({
      success: true,
      total: results.length,
      results: paginatedResults,
      limit,
      offset
    });
  } catch (error) {
    console.error('Failed to search staff:', error);
    return c.json({ success: false, error: 'Staff search failed' }, 500);
  }
});

/**
 * POST /search/centers - Search specifically for centers
 */
app.post('/search/centers', async (c) => {
  try {
    const { 
      query, 
      serviceType, 
      amenities, 
      minRating, 
      city, 
      area,
      lat,
      lng,
      radius,
      limit = 20,
      offset = 0
    } = await c.req.json();
    
    const centerIndexes = await kv.getByPrefix('search_index_center_') || [];
    
    let results = centerIndexes;
    
    // Apply filters
    if (query) {
      const q = query.toLowerCase();
      results = results.filter((index: any) => 
        fuzzyMatch(index.searchableText, q) > 0.3
      );
    }
    
    if (serviceType) {
      results = results.filter((index: any) => 
        index.data?.serviceType === serviceType
      );
    }
    
    if (amenities && Array.isArray(amenities)) {
      results = results.filter((index: any) => 
        amenities.every(a => index.data?.amenities?.includes(a))
      );
    }
    
    if (minRating) {
      results = results.filter((index: any) => 
        (index.rating || 0) >= minRating
      );
    }
    
    if (city) {
      results = results.filter((index: any) => 
        index.data?.location?.city?.toLowerCase() === city.toLowerCase()
      );
    }
    
    if (area) {
      results = results.filter((index: any) => 
        index.data?.location?.area?.toLowerCase() === area.toLowerCase()
      );
    }
    
    // Location-based filtering
    if (lat && lng && radius) {
      results = results.filter((index: any) => {
        if (!index.location?.lat || !index.location?.lng) return false;
        const distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          index.location.lat,
          index.location.lng
        );
        return distance <= parseFloat(radius);
      });
    }
    
    // Sort by rating
    results.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
    
    // Paginate
    const paginatedResults = results.slice(offset, offset + limit);
    
    return c.json({
      success: true,
      total: results.length,
      results: paginatedResults,
      limit,
      offset
    });
  } catch (error) {
    console.error('Failed to search centers:', error);
    return c.json({ success: false, error: 'Centers search failed' }, 500);
  }
});

/**
 * POST /search/services - Search specifically for services
 */
app.post('/search/services', async (c) => {
  try {
    const { 
      query, 
      category, 
      subCategory, 
      minPrice, 
      maxPrice, 
      city, 
      area,
      limit = 20,
      offset = 0
    } = await c.req.json();
    
    const serviceIndexes = await kv.getByPrefix('search_index_service_') || [];
    
    let results = serviceIndexes;
    
    // Apply filters
    if (query) {
      const q = query.toLowerCase();
      results = results.filter((index: any) => 
        fuzzyMatch(index.searchableText, q) > 0.3
      );
    }
    
    if (category) {
      results = results.filter((index: any) => 
        index.data?.category?.toLowerCase() === category.toLowerCase()
      );
    }
    
    if (subCategory) {
      results = results.filter((index: any) => 
        index.data?.subCategory?.toLowerCase() === subCategory.toLowerCase()
      );
    }
    
    if (minPrice) {
      results = results.filter((index: any) => 
        (index.price || 0) >= minPrice
      );
    }
    
    if (maxPrice) {
      results = results.filter((index: any) => 
        (index.price || Infinity) <= maxPrice
      );
    }
    
    if (city) {
      results = results.filter((index: any) => 
        index.data?.location?.city?.toLowerCase() === city.toLowerCase()
      );
    }
    
    if (area) {
      results = results.filter((index: any) => 
        index.data?.location?.area?.toLowerCase() === area.toLowerCase()
      );
    }
    
    // Sort by price (low to high)
    results.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
    
    // Paginate
    const paginatedResults = results.slice(offset, offset + limit);
    
    return c.json({
      success: true,
      total: results.length,
      results: paginatedResults,
      limit,
      offset
    });
  } catch (error) {
    console.error('Failed to search services:', error);
    return c.json({ success: false, error: 'Services search failed' }, 500);
  }
});

// ==========================================
// SEARCH ANALYTICS
// ==========================================

async function trackSearch(query: string, resultsCount: number, userId?: string) {
  try {
    // Track individual search
    const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await kv.set(`search_query_${searchId}`, {
      id: searchId,
      userId,
      query,
      resultsCount,
      clicked: false,
      timestamp: new Date().toISOString()
    });
    
    // Update popular searches
    const popularSearches = await kv.get('search_popular') || { queries: [] };
    const existing = popularSearches.queries.find((s: any) => s.query === query);
    
    if (existing) {
      existing.count++;
      existing.lastSearched = new Date().toISOString();
    } else {
      popularSearches.queries.push({
        query,
        count: 1,
        lastSearched: new Date().toISOString()
      });
    }
    
    // Keep only top 100 popular searches
    popularSearches.queries.sort((a: any, b: any) => b.count - a.count);
    if (popularSearches.queries.length > 100) {
      popularSearches.queries = popularSearches.queries.slice(0, 100);
    }
    
    await kv.set('search_popular', popularSearches);
    
    // Track zero-result searches
    if (resultsCount === 0) {
      const zeroResults = await kv.get('search_zero_results') || { queries: [] };
      zeroResults.queries.unshift({
        query,
        timestamp: new Date().toISOString()
      });
      
      // Keep last 100
      if (zeroResults.queries.length > 100) {
        zeroResults.queries = zeroResults.queries.slice(0, 100);
      }
      
      await kv.set('search_zero_results', zeroResults);
    }
    
    // User search history
    if (userId) {
      const userHistory = await kv.get(`search_history_${userId}`) || { searches: [] };
      userHistory.searches.unshift({
        query,
        resultsCount,
        timestamp: new Date().toISOString()
      });
      
      // Keep last 50
      if (userHistory.searches.length > 50) {
        userHistory.searches = userHistory.searches.slice(0, 50);
      }
      
      await kv.set(`search_history_${userId}`, userHistory);
    }
  } catch (error) {
    console.error('Failed to track search:', error);
  }
}

/**
 * GET /search/popular - Get popular searches
 */
app.get('/search/popular', async (c) => {
  try {
    const { limit = 10 } = c.req.query();
    
    const popularSearches = await kv.get('search_popular') || { queries: [] };
    
    const topSearches = popularSearches.queries
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, parseInt(limit as string))
      .map((s: any) => ({
        query: s.query,
        count: s.count
      }));
    
    return c.json({
      success: true,
      searches: topSearches
    });
  } catch (error) {
    console.error('Failed to get popular searches:', error);
    return c.json({ success: false, error: 'Failed to get popular searches' }, 500);
  }
});

/**
 * GET /search/trending - Get trending searches (last 24 hours)
 */
app.get('/search/trending', async (c) => {
  try {
    const { limit = 10 } = c.req.query();
    
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const allSearches = await kv.getByPrefix('search_query_') || [];
    
    const recentSearches = allSearches.filter((s: any) => 
      new Date(s.timestamp) >= last24Hours
    );
    
    // Count occurrences
    const queryCounts: Record<string, number> = {};
    recentSearches.forEach((s: any) => {
      queryCounts[s.query] = (queryCounts[s.query] || 0) + 1;
    });
    
    const trending = Object.entries(queryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, parseInt(limit as string))
      .map(([query, count]) => ({ query, count }));
    
    return c.json({
      success: true,
      trending
    });
  } catch (error) {
    console.error('Failed to get trending searches:', error);
    return c.json({ success: false, error: 'Failed to get trending searches' }, 500);
  }
});

/**
 * GET /search/history/:userId - Get user search history
 */
app.get('/search/history/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const { limit = 20 } = c.req.query();
    
    const userHistory = await kv.get(`search_history_${userId}`) || { searches: [] };
    
    const history = userHistory.searches.slice(0, parseInt(limit as string));
    
    return c.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Failed to get search history:', error);
    return c.json({ success: false, error: 'Failed to get search history' }, 500);
  }
});

/**
 * POST /search/track - Track search result click
 */
app.post('/search/track', async (c) => {
  try {
    const { searchId, resultId, resultType } = await c.req.json();
    
    if (!searchId) {
      return c.json({ success: false, error: 'searchId is required' }, 400);
    }
    
    const search = await kv.get(`search_query_${searchId}`);
    if (search) {
      search.clicked = true;
      search.clickedResultId = resultId;
      search.clickedResultType = resultType;
      search.clickedAt = new Date().toISOString();
      await kv.set(`search_query_${searchId}`, search);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to track search click:', error);
    return c.json({ success: false, error: 'Failed to track click' }, 500);
  }
});

/**
 * GET /search/analytics/queries - Get search analytics
 */
app.get('/search/analytics/queries', async (c) => {
  try {
    const { period = '7' } = c.req.query();
    
    const daysAgo = new Date(Date.now() - parseInt(period as string) * 24 * 60 * 60 * 1000);
    const allSearches = await kv.getByPrefix('search_query_') || [];
    
    const periodSearches = allSearches.filter((s: any) => 
      new Date(s.timestamp) >= daysAgo
    );
    
    const totalSearches = periodSearches.length;
    const uniqueQueries = new Set(periodSearches.map((s: any) => s.query)).size;
    const avgResultsPerSearch = periodSearches.reduce((sum: number, s: any) => 
      sum + s.resultsCount, 0) / totalSearches;
    const clickThroughRate = (periodSearches.filter((s: any) => s.clicked).length / totalSearches) * 100;
    
    return c.json({
      success: true,
      analytics: {
        period: parseInt(period as string),
        totalSearches,
        uniqueQueries,
        avgResultsPerSearch: avgResultsPerSearch.toFixed(2),
        clickThroughRate: clickThroughRate.toFixed(2)
      }
    });
  } catch (error) {
    console.error('Failed to get search analytics:', error);
    return c.json({ success: false, error: 'Failed to get analytics' }, 500);
  }
});

/**
 * GET /search/analytics/zero-results - Get zero-result searches
 */
app.get('/search/analytics/zero-results', async (c) => {
  try {
    const { limit = 20 } = c.req.query();
    
    const zeroResults = await kv.get('search_zero_results') || { queries: [] };
    
    const queries = zeroResults.queries.slice(0, parseInt(limit as string));
    
    return c.json({
      success: true,
      queries
    });
  } catch (error) {
    console.error('Failed to get zero-result searches:', error);
    return c.json({ success: false, error: 'Failed to get zero-result searches' }, 500);
  }
});

/**
 * GET /search/analytics/conversion - Get search conversion metrics
 */
app.get('/search/analytics/conversion', async (c) => {
  try {
    const { period = '7' } = c.req.query();
    
    const daysAgo = new Date(Date.now() - parseInt(period as string) * 24 * 60 * 60 * 1000);
    const allSearches = await kv.getByPrefix('search_query_') || [];
    
    const periodSearches = allSearches.filter((s: any) => 
      new Date(s.timestamp) >= daysAgo
    );
    
    const totalSearches = periodSearches.length;
    const searchesWithResults = periodSearches.filter((s: any) => s.resultsCount > 0).length;
    const searchesWithClicks = periodSearches.filter((s: any) => s.clicked).length;
    
    const conversionFunnel = {
      totalSearches,
      searchesWithResults,
      searchesWithClicks,
      resultRate: ((searchesWithResults / totalSearches) * 100).toFixed(2),
      clickRate: ((searchesWithClicks / totalSearches) * 100).toFixed(2),
      clickFromResultsRate: searchesWithResults > 0 
        ? ((searchesWithClicks / searchesWithResults) * 100).toFixed(2)
        : '0.00'
    };
    
    return c.json({
      success: true,
      conversion: conversionFunnel
    });
  } catch (error) {
    console.error('Failed to get conversion metrics:', error);
    return c.json({ success: false, error: 'Failed to get conversion metrics' }, 500);
  }
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default app;
