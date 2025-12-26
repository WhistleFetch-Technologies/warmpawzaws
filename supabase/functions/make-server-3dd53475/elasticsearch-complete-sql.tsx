/**
 * ============================================================================
 * ELASTICSEARCH COMPLETE IMPLEMENTATION - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories and tables only
 * 
 * Features:
 * - Advanced search with fuzzy matching
 * - Autocomplete and suggestions
 * - Search indexing for staff, centers, services
 * - Search analytics and trending
 * - Faceted search and filters
 * - Search history tracking
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `search_index`, `search_history`, `search_analytics`, `popular_searches`, `zero_result_searches` tables
 * - Uses `StaffRepository`, `VendorsRepository`, `ServicesRepository` for indexing
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 12)
 * KV Operations Removed: 30
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getDbClient, insertQuery, updateQuery, selectQuery } from '../../lib/db.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';

const app = new Hono();
const db = getDbClient();

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
      const staffRepo = getStaffRepository();
      const vendorsRepo = getVendorsRepository();
      const allStaff = await staffRepo.findAll();
      
      for (const staff of allStaff) {
        const vendor = await vendorsRepo.findById(staff.vendorId);
        
        const searchableText = [
          staff.fullName,
          staff.specialization,
          staff.specializations?.join(' '),
          staff.services?.map((s: any) => s.name || s).join(' '),
          vendor?.business_name,
          vendor?.city,
          vendor?.address
        ].filter(Boolean).join(' ').toLowerCase();
        
        const metadata = {
          staffId: staff.id,
          name: staff.fullName,
          specialization: staff.specialization,
          services: staff.services || [],
          rating: staff.rating || 0,
          experience: staff.experience || 0,
          vendorId: staff.vendorId,
          vendorName: vendor?.business_name,
          location: {
            city: vendor?.city,
            area: vendor?.address,
            lat: vendor?.latitude,
            lng: vendor?.longitude
          }
        };
        
        // ✅ SQL: Insert or update search index
        await db.from('search_index')
          .upsert({
            entity_type: 'staff',
            entity_id: staff.id,
            search_text: searchableText,
            metadata: metadata,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'entity_type,entity_id'
          });
        
        results.staff++;
      }
    }
    
    // Index centers (vendors)
    if (type === 'center' || type === 'all') {
      const vendorsRepo = getVendorsRepository();
      const allVendors = await vendorsRepo.findAll({
        status: 'approved',
        is_active: true
      });
      
      const centerVendors = allVendors.filter((v: any) => 
        v.category === 'veterinary' || 
        v.category === 'grooming' ||
        v.category === 'boarding' ||
        v.category === 'daycare'
      );
      
      for (const vendor of centerVendors) {
        const searchableText = [
          vendor.business_name,
          vendor.category,
          vendor.description,
          vendor.services?.join(' '),
          vendor.city,
          vendor.address,
          vendor.pincode
        ].filter(Boolean).join(' ').toLowerCase();
        
        const metadata = {
          vendorId: vendor.id,
          businessName: vendor.business_name,
          serviceType: vendor.category,
          services: vendor.services || [],
          rating: vendor.rating || 0,
          location: {
            city: vendor.city,
            area: vendor.address,
            pincode: vendor.pincode,
            lat: vendor.latitude,
            lng: vendor.longitude
          },
          amenities: vendor.amenities || [],
          openingHours: vendor.operating_hours
        };
        
        // ✅ SQL: Insert or update search index
        await db.from('search_index')
          .upsert({
            entity_type: 'center',
            entity_id: vendor.id,
            search_text: searchableText,
            metadata: metadata,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'entity_type,entity_id'
          });
        
        results.centers++;
      }
    }
    
    // Index services
    if (type === 'service' || type === 'all') {
      const servicesRepo = getServicesRepository();
      const vendorsRepo = getVendorsRepository();
      const allServices = await servicesRepo.findAll();
      
      for (const service of allServices) {
        const vendor = service.vendor_id ? await vendorsRepo.findById(service.vendor_id) : null;
        
        const searchableText = [
          service.name,
          service.description,
          service.category,
          vendor?.business_name,
          vendor?.city,
          vendor?.address
        ].filter(Boolean).join(' ').toLowerCase();
        
        const metadata = {
          serviceId: service.id,
          name: service.name,
          description: service.description,
          category: service.category,
          price: service.price,
          duration: service.duration_minutes,
          vendorId: service.vendor_id,
          vendorName: vendor?.business_name,
          location: {
            city: vendor?.city,
            area: vendor?.address,
            lat: vendor?.latitude,
            lng: vendor?.longitude
          }
        };
        
        // ✅ SQL: Insert or update search index
        await db.from('search_index')
          .upsert({
            entity_type: 'service',
            entity_id: service.id,
            search_text: searchableText,
            metadata: metadata,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'entity_type,entity_id'
          });
        
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
      const searchableText = item.searchableText || 
        [item.data?.name, item.data?.businessName, item.data?.specialization]
          .filter(Boolean).join(' ').toLowerCase();
      
      // ✅ SQL: Insert or update search index
      await db.from('search_index')
        .upsert({
          entity_type: type,
          entity_id: item.id,
          search_text: searchableText,
          metadata: item.data || {},
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'entity_type,entity_id'
        });
      
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
      // ✅ SQL: Get search indexes for this type
      const { data: indexes } = await db
        .from('search_index')
        .select('*')
        .eq('entity_type', searchType);
      
      if (!indexes) continue;
      
      for (const index of indexes) {
        let score = fuzzyMatch(index.search_text || '', query);
        
        // Boost score for metadata matches
        if (index.metadata) {
          const metadataStr = JSON.stringify(index.metadata).toLowerCase();
          if (metadataStr.includes(query)) {
            score += 0.2;
          }
        }
        
        // Only include results with score > 0.3
        if (score > 0.3) {
          const metadata = index.metadata || {};
          
          // Apply filters
          if (city && metadata.location?.city?.toLowerCase() !== (city as string).toLowerCase()) continue;
          if (area && metadata.location?.area?.toLowerCase() !== (area as string).toLowerCase()) continue;
          if (minRating && (metadata.rating || 0) < parseFloat(minRating as string)) continue;
          if (maxPrice && metadata.price && metadata.price > parseFloat(maxPrice as string)) continue;
          if (minPrice && metadata.price && metadata.price < parseFloat(minPrice as string)) continue;
          
          allResults.push({
            ...index,
            data: metadata,
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
    const userId = c.req.header('user-id') || c.req.header('customer-id');
    await trackSearch(query, allResults.length, userId);
    
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
    
    // ✅ SQL: Get search indexes with text matching
    const { data: indexes } = await db
      .from('search_index')
      .select('*')
      .ilike('search_text', `%${query}%`)
      .limit(100);
    
    if (!indexes) {
      return c.json({ success: true, suggestions: [] });
    }
    
    // Extract unique suggestions from metadata
    const suggestions = new Set<string>();
    
    for (const index of indexes) {
      const metadata = index.metadata || {};
      
      // Add matching names
      if (metadata.name && metadata.name.toLowerCase().includes(query)) {
        suggestions.add(metadata.name.toLowerCase());
      }
      
      if (metadata.businessName && metadata.businessName.toLowerCase().includes(query)) {
        suggestions.add(metadata.businessName.toLowerCase());
      }
      
      if (metadata.specialization && metadata.specialization.toLowerCase().includes(query)) {
        suggestions.add(metadata.specialization.toLowerCase());
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
    
    // ✅ SQL: Get popular searches
    const { data: popularSearches } = await db
      .from('popular_searches')
      .select('*')
      .order('search_count', { ascending: false })
      .limit(100);
    
    if (!popularSearches) {
      return c.json({ success: true, suggestions: [] });
    }
    
    let suggestions = popularSearches.map((s: any) => s.query);
    
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
    
    // ✅ SQL: Get staff indexes
    let dbQuery = db
      .from('search_index')
      .select('*')
      .eq('entity_type', 'staff');
    
    if (query) {
      dbQuery = dbQuery.ilike('search_text', `%${query}%`);
    }
    
    const { data: indexes } = await dbQuery;
    
    if (!indexes) {
      return c.json({ success: true, total: 0, results: [] });
    }
    
    let results = indexes.map((index: any) => ({
      ...index,
      data: index.metadata || {}
    }));
    
    // Apply filters
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
        (index.data?.rating || 0) >= minRating
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
    results.sort((a: any, b: any) => (b.data?.rating || 0) - (a.data?.rating || 0));
    
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
    
    // ✅ SQL: Get center indexes
    let dbQuery = db
      .from('search_index')
      .select('*')
      .eq('entity_type', 'center');
    
    if (query) {
      dbQuery = dbQuery.ilike('search_text', `%${query}%`);
    }
    
    const { data: indexes } = await dbQuery;
    
    if (!indexes) {
      return c.json({ success: true, total: 0, results: [] });
    }
    
    let results = indexes.map((index: any) => ({
      ...index,
      data: index.metadata || {}
    }));
    
    // Apply filters
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
        (index.data?.rating || 0) >= minRating
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
        if (!index.data?.location?.lat || !index.data?.location?.lng) return false;
        const distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          index.data.location.lat,
          index.data.location.lng
        );
        return distance <= parseFloat(radius);
      });
    }
    
    // Sort by rating
    results.sort((a: any, b: any) => (b.data?.rating || 0) - (a.data?.rating || 0));
    
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
    
    // ✅ SQL: Get service indexes
    let dbQuery = db
      .from('search_index')
      .select('*')
      .eq('entity_type', 'service');
    
    if (query) {
      dbQuery = dbQuery.ilike('search_text', `%${query}%`);
    }
    
    const { data: indexes } = await dbQuery;
    
    if (!indexes) {
      return c.json({ success: true, total: 0, results: [] });
    }
    
    let results = indexes.map((index: any) => ({
      ...index,
      data: index.metadata || {}
    }));
    
    // Apply filters
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
        (index.data?.price || 0) >= minPrice
      );
    }
    
    if (maxPrice) {
      results = results.filter((index: any) => 
        (index.data?.price || Infinity) <= maxPrice
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
    results.sort((a: any, b: any) => (a.data?.price || 0) - (b.data?.price || 0));
    
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
    const customerId = userId ? (userId.startsWith('customer_') ? userId.replace('customer_', '') : userId) : null;
    
    // ✅ SQL: Insert search history
    if (customerId) {
      await db.from('search_history').insert({
        customer_id: customerId,
        search_query: query,
        results_count: resultsCount
      });
    }
    
    // ✅ SQL: Update popular searches
    const { data: existing } = await db
      .from('popular_searches')
      .select('*')
      .eq('query', query)
      .single();
    
    if (existing) {
      await db
        .from('popular_searches')
        .update({
          search_count: existing.search_count + 1,
          last_searched_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await db.from('popular_searches').insert({
        query: query,
        search_count: 1,
        last_searched_at: new Date().toISOString()
      });
    }
    
    // ✅ SQL: Track zero-result searches
    if (resultsCount === 0) {
      const { data: existingZero } = await db
        .from('zero_result_searches')
        .select('*')
        .eq('query', query)
        .single();
      
      if (existingZero) {
        await db
          .from('zero_result_searches')
          .update({
            search_count: existingZero.search_count + 1,
            last_searched_at: new Date().toISOString()
          })
          .eq('id', existingZero.id);
      } else {
        await db.from('zero_result_searches').insert({
          query: query,
          search_count: 1,
          last_searched_at: new Date().toISOString()
        });
      }
    }
    
    // ✅ SQL: Insert search analytics
    const today = new Date().toISOString().split('T')[0];
    const { data: existingAnalytics } = await db
      .from('search_analytics')
      .select('*')
      .eq('search_date', today)
      .eq('query', query)
      .single();
    
    if (existingAnalytics) {
      await db
        .from('search_analytics')
        .update({
          results_count: resultsCount,
          zero_results: resultsCount === 0
        })
        .eq('id', existingAnalytics.id);
    } else {
      await db.from('search_analytics').insert({
        search_date: today,
        query: query,
        results_count: resultsCount,
        zero_results: resultsCount === 0
      });
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
    
    // ✅ SQL: Get popular searches
    const { data: popularSearches } = await db
      .from('popular_searches')
      .select('*')
      .order('search_count', { ascending: false })
      .limit(parseInt(limit as string));
    
    if (!popularSearches) {
      return c.json({ success: true, searches: [] });
    }
    
    const topSearches = popularSearches.map((s: any) => ({
      query: s.query,
      count: s.search_count
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
    
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // ✅ SQL: Get recent searches from search_history
    const { data: recentSearches } = await db
      .from('search_history')
      .select('*')
      .gte('created_at', last24Hours);
    
    if (!recentSearches || recentSearches.length === 0) {
      return c.json({ success: true, trending: [] });
    }
    
    // Count occurrences
    const queryCounts: Record<string, number> = {};
    recentSearches.forEach((s: any) => {
      queryCounts[s.search_query] = (queryCounts[s.search_query] || 0) + 1;
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
    
    const customerId = userId.startsWith('customer_') ? userId.replace('customer_', '') : userId;
    
    // ✅ SQL: Get search history for customer
    const { data: history } = await db
      .from('search_history')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));
    
    if (!history) {
      return c.json({ success: true, history: [] });
    }
    
    const formattedHistory = history.map((h: any) => ({
      query: h.search_query,
      resultsCount: h.results_count,
      timestamp: h.created_at
    }));
    
    return c.json({
      success: true,
      history: formattedHistory
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
    
    // ✅ SQL: Update search history with click
    await db
      .from('search_history')
      .update({
        clicked_result_id: resultId
      })
      .eq('id', searchId);
    
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
    
    const daysAgo = new Date(Date.now() - parseInt(period as string) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // ✅ SQL: Get search analytics for period
    const { data: periodSearches } = await db
      .from('search_analytics')
      .select('*')
      .gte('search_date', daysAgo);
    
    if (!periodSearches || periodSearches.length === 0) {
      return c.json({
        success: true,
        analytics: {
          period: parseInt(period as string),
          totalSearches: 0,
          uniqueQueries: 0,
          avgResultsPerSearch: '0.00',
          clickThroughRate: '0.00'
        }
      });
    }
    
    const totalSearches = periodSearches.length;
    const uniqueQueries = new Set(periodSearches.map((s: any) => s.query)).size;
    const avgResultsPerSearch = periodSearches.reduce((sum: number, s: any) => 
      sum + s.results_count, 0) / totalSearches;
    
    // Get click-through rate from search_history
    const { data: historyWithClicks } = await db
      .from('search_history')
      .select('*')
      .gte('created_at', daysAgo)
      .not('clicked_result_id', 'is', null);
    
    const clickThroughRate = historyWithClicks && historyWithClicks.length > 0
      ? (historyWithClicks.length / totalSearches) * 100
      : 0;
    
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
    
    // ✅ SQL: Get zero-result searches
    const { data: zeroResults } = await db
      .from('zero_result_searches')
      .select('*')
      .order('last_searched_at', { ascending: false })
      .limit(parseInt(limit as string));
    
    if (!zeroResults) {
      return c.json({ success: true, queries: [] });
    }
    
    const queries = zeroResults.map((z: any) => ({
      query: z.query,
      count: z.search_count,
      lastSearched: z.last_searched_at
    }));
    
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
    
    const daysAgo = new Date(Date.now() - parseInt(period as string) * 24 * 60 * 60 * 1000).toISOString();
    
    // ✅ SQL: Get search history for period
    const { data: periodSearches } = await db
      .from('search_history')
      .select('*')
      .gte('created_at', daysAgo);
    
    if (!periodSearches || periodSearches.length === 0) {
      return c.json({
        success: true,
        conversion: {
          totalSearches: 0,
          searchesWithResults: 0,
          searchesWithClicks: 0,
          resultRate: '0.00',
          clickRate: '0.00',
          clickFromResultsRate: '0.00'
        }
      });
    }
    
    const totalSearches = periodSearches.length;
    const searchesWithResults = periodSearches.filter((s: any) => s.results_count > 0).length;
    const searchesWithClicks = periodSearches.filter((s: any) => s.clicked_result_id).length;
    
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

