import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from "../../lib/db.ts";
import { getSearchHistoryRepository } from "../../lib/repositories/search-history.ts";

/**
 * 🔍 ENHANCED SEARCH ENGINE WITH RELEVANCE SCORING
 * 
 * Phase 7D: Elastic Search Enhancement - Rule 5 Implementation
 * 
 * Features:
 * - Multi-factor relevance scoring
 * - Location-based ranking
 * - Rating and experience weighting
 * - Fuzzy matching with Levenshtein distance
 * - Autocomplete with typo tolerance
 * - Faceted search
 */

interface SearchOptions {
  query: string;
  type?: 'staff' | 'center' | 'service' | 'all';
  lat?: number;
  lng?: number;
  maxDistance?: number; // in km
  minRating?: number;
  priceRange?: { min?: number; max?: number };
  city?: string;
  specialization?: string;
  limit?: number;
  offset?: number;
}

interface SearchResult {
  id: string;
  type: string;
  data: any;
  relevanceScore: number;
  distance?: number;
  matchedFields: string[];
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score (0-1) based on Levenshtein distance
 */
function similarityScore(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  return 1 - (distance / maxLength);
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate relevance score with multiple factors
 */
function calculateRelevanceScore(
  searchQuery: string,
  indexItem: any,
  options: SearchOptions
): { score: number; matchedFields: string[]; distance?: number } {
  const query = searchQuery.toLowerCase();
  const matchedFields: string[] = [];
  let score = 0;

  // 1. EXACT MATCH (100 points)
  const searchableText = indexItem.searchableText || '';
  if (searchableText.includes(query)) {
    score += 100;
    matchedFields.push('exact_match');
  }

  // 2. TITLE/NAME MATCH (80 points)
  const name = (indexItem.data?.name || indexItem.data?.businessName || '').toLowerCase();
  if (name.includes(query)) {
    score += 80;
    matchedFields.push('name');
  }

  // 3. FUZZY MATCH (0-60 points based on similarity)
  const similarity = similarityScore(query, searchableText);
  if (similarity > 0.5) {
    score += similarity * 60;
    matchedFields.push('fuzzy_match');
  }

  // 4. TAG MATCH (40 points per tag)
  const tags = indexItem.tags || [];
  for (const tag of tags) {
    if (tag.includes(query) || query.includes(tag)) {
      score += 40;
      matchedFields.push(`tag:${tag}`);
    }
  }

  // 5. WORD BOUNDARY MATCH (30 points)
  const words = searchableText.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(query) || query.startsWith(word)) {
      score += 30;
      matchedFields.push('word_start');
      break;
    }
  }

  // 6. RATING BOOST (0-50 points)
  const rating = indexItem.rating || indexItem.data?.rating || 0;
  score += rating * 10; // 5-star = 50 points
  
  // 7. EXPERIENCE BOOST (0-30 points for staff)
  if (indexItem.type === 'staff') {
    const experience = indexItem.experience || indexItem.data?.experience || 0;
    score += Math.min(experience * 2, 30); // Max 30 points for 15+ years
  }

  // 8. REVIEW COUNT BOOST (0-30 points)
  const totalReviews = indexItem.totalReviews || indexItem.data?.totalReviews || 0;
  score += Math.min(totalReviews / 10, 30); // Max 30 points for 300+ reviews

  // 9. LOCATION-BASED SCORING (0-100 points)
  let distance: number | undefined;
  if (options.lat && options.lng) {
    const itemLat = indexItem.data?.location?.lat;
    const itemLng = indexItem.data?.location?.lng;
    
    if (itemLat && itemLng) {
      distance = calculateDistance(options.lat, options.lng, itemLat, itemLng);
      
      // Distance scoring: closer = higher score
      if (distance <= 5) {
        score += 100; // Within 5km
      } else if (distance <= 10) {
        score += 80; // Within 10km
      } else if (distance <= 20) {
        score += 60; // Within 20km
      } else if (distance <= 50) {
        score += 40; // Within 50km
      } else if (distance <= 100) {
        score += 20; // Within 100km
      }
      
      matchedFields.push(`distance:${distance.toFixed(1)}km`);
    }
  }

  // 10. ACTIVE STATUS BOOST (20 points)
  if (indexItem.data?.isActive !== false) {
    score += 20;
  }

  // 11. PUBLISHED STATUS BOOST (for services, 20 points)
  if (indexItem.type === 'service' && indexItem.data?.isPublished !== false) {
    score += 20;
  }

  return { score, matchedFields, distance };
}

export function enhancedSearchEngineEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const client = getDbClient();
  const searchHistoryRepo = getSearchHistoryRepository();

  // ========================================
  // ENHANCED SEARCH
  // ========================================
  app.get(`${BASE_PATH}/search/enhanced`, async (c) => {
    try {
      const query = c.req.query('q') || c.req.query('query') || '';
      const type = c.req.query('type') || 'all';
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const maxDistance = parseInt(c.req.query('maxDistance') || '100');
      const minRating = parseFloat(c.req.query('minRating') || '0');
      const city = c.req.query('city');
      const specialization = c.req.query('specialization');
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');

      if (!query || query.trim().length === 0) {
        return sendError(c, 'Search query is required', 400);
      }

      console.log(`🔍 [ENHANCED-SEARCH] Query: "${query}", Type: ${type}`);

      const options: SearchOptions = {
        query,
        type: type as any,
        lat: lat || undefined,
        lng: lng || undefined,
        maxDistance,
        minRating,
        city,
        specialization,
        limit,
        offset
      };

      // ✅ SQL: Get all search indexes from database
      const allIndexes: any[] = [];
      
      const indexTypes: string[] = [];
      if (type === 'all' || type === 'staff') indexTypes.push('staff');
      if (type === 'all' || type === 'center') indexTypes.push('center');
      if (type === 'all' || type === 'service') indexTypes.push('service');
      
      if (indexTypes.length > 0) {
        const { data: indexes, error } = await client
          .from('search_index')
          .select('*')
          .in('entity_type', indexTypes)
          .eq('is_active', true);
        
        if (error) {
          console.error('❌ Error fetching search indexes:', error);
        } else {
          // Transform SQL rows to index format
          const transformedIndexes = (indexes || []).map((idx: any) => ({
            id: idx.entity_id,
            type: idx.entity_type,
            data: idx.entity_data || {},
            searchableText: idx.searchable_text || '',
            tags: idx.tags || [],
            rating: idx.rating || 0,
            totalReviews: idx.total_reviews || 0,
            experience: idx.experience || 0,
            price: idx.price || 0
          }));
          allIndexes.push(...transformedIndexes);
        }
      }

      console.log(`   Found ${allIndexes.length} items in search index`);

      // Calculate relevance scores
      const results: SearchResult[] = [];

      for (const indexItem of allIndexes) {
        // Apply filters
        if (minRating > 0) {
          const rating = indexItem.rating || indexItem.data?.rating || 0;
          if (rating < minRating) continue;
        }

        if (city) {
          const itemCity = (indexItem.data?.location?.city || '').toLowerCase();
          if (!itemCity.includes(city.toLowerCase())) continue;
        }

        if (specialization && indexItem.type === 'staff') {
          const itemSpec = (indexItem.data?.specialization || '').toLowerCase();
          if (!itemSpec.includes(specialization.toLowerCase())) continue;
        }

        // Only include active items
        if (indexItem.data?.isActive === false) continue;

        // Calculate relevance
        const { score, matchedFields, distance } = calculateRelevanceScore(query, indexItem, options);

        // Filter by distance if provided
        if (options.lat && options.lng && distance !== undefined) {
          if (distance > maxDistance) continue;
        }

        // Only include results with minimum relevance
        if (score < 10) continue;

        results.push({
          id: indexItem.id,
          type: indexItem.type,
          data: indexItem.data,
          relevanceScore: score,
          distance,
          matchedFields
        });
      }

      // Sort by relevance score
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Paginate
      const paginatedResults = results.slice(offset, offset + limit);

      console.log(`✅ Found ${results.length} results, returning ${paginatedResults.length}`);

      // ✅ SQL: Track search analytics in search_history table
      const customerId = c.req.query('customerId');
      if (customerId) {
        try {
          await searchHistoryRepo.create({
            customer_id: customerId,
            query: query,
            search_type: type,
            results_count: results.length,
            filters: { city, specialization, minRating }
          });
        } catch (err) {
          console.error('Error logging search:', err);
        }
      }

      return sendSuccess(c, {
        results: paginatedResults,
        total: results.length,
        limit,
        offset,
        query,
        type
      });

    } catch (error) {
      console.error('❌ Error in enhanced search:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // AUTOCOMPLETE WITH FUZZY MATCHING
  // ========================================
  app.get(`${BASE_PATH}/search/autocomplete-enhanced`, async (c) => {
    try {
      const query = c.req.query('q') || '';
      const limit = parseInt(c.req.query('limit') || '10');

      if (!query || query.length < 2) {
        return sendSuccess(c, { suggestions: [] });
      }

      console.log(`💡 [AUTOCOMPLETE] Query: "${query}"`);

      // ✅ SQL: Get all search indexes from database
      const { data: indexes, error } = await client
        .from('search_index')
        .select('*')
        .in('entity_type', ['staff', 'center', 'service'])
        .eq('is_active', true);
      
      if (error) {
        console.error('❌ Error fetching search indexes:', error);
        return sendSuccess(c, { suggestions: [] });
      }
      
      // Transform SQL rows to index format
      const allIndexes = (indexes || []).map((idx: any) => ({
        id: idx.entity_id,
        type: idx.entity_type,
        data: idx.entity_data || {},
        tags: idx.tags || [],
        searchableText: idx.searchable_text || ''
      }));

      const suggestionSet = new Set<string>();
      const scoredSuggestions: Array<{ text: string; score: number }> = [];

      for (const indexItem of allIndexes) {
        // Name suggestions
        const name = indexItem.data?.name || indexItem.data?.businessName || '';
        if (name && name.toLowerCase().includes(query.toLowerCase())) {
          const similarity = similarityScore(query, name);
          scoredSuggestions.push({ text: name, score: similarity * 100 });
        }

        // Tag suggestions
        const tags = indexItem.tags || [];
        for (const tag of tags) {
          if (tag.includes(query.toLowerCase())) {
            if (!suggestionSet.has(tag)) {
              scoredSuggestions.push({ text: tag, score: 50 });
              suggestionSet.add(tag);
            }
          }
        }

        // Specialization suggestions
        if (indexItem.data?.specialization) {
          const spec = indexItem.data.specialization;
          if (spec.toLowerCase().includes(query.toLowerCase())) {
            if (!suggestionSet.has(spec)) {
              scoredSuggestions.push({ text: spec, score: 70 });
              suggestionSet.add(spec);
            }
          }
        }
      }

      // Sort by score and get top suggestions
      scoredSuggestions.sort((a, b) => b.score - a.score);
      const suggestions = scoredSuggestions
        .slice(0, limit)
        .map(s => s.text);

      console.log(`✅ Generated ${suggestions.length} autocomplete suggestions`);

      return sendSuccess(c, { suggestions });

    } catch (error) {
      console.error('❌ Error in autocomplete:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // FACETED SEARCH (Get available filters)
  // ========================================
  app.get(`${BASE_PATH}/search/facets`, async (c) => {
    try {
      const query = c.req.query('q') || '';
      const type = c.req.query('type') || 'all';

      console.log(`📊 [FACETS] Query: "${query}", Type: ${type}`);

      // ✅ SQL: Get relevant indexes from database
      const indexTypes: string[] = [];
      if (type === 'all' || type === 'staff') indexTypes.push('staff');
      if (type === 'all' || type === 'center') indexTypes.push('center');
      if (type === 'all' || type === 'service') indexTypes.push('service');
      
      const { data: indexes, error } = await client
        .from('search_index')
        .select('*')
        .in('entity_type', indexTypes.length > 0 ? indexTypes : ['staff', 'center', 'service'])
        .eq('is_active', true);
      
      if (error) {
        console.error('❌ Error fetching search indexes:', error);
        return sendError(c, 'Failed to fetch search facets', 500);
      }
      
      // Transform SQL rows to index format
      const allIndexes = (indexes || []).map((idx: any) => ({
        id: idx.entity_id,
        type: idx.entity_type,
        data: idx.entity_data || {},
        rating: idx.rating || 0,
        price: idx.price || 0
      }));

      // Extract facets
      const cities = new Set<string>();
      const specializations = new Set<string>();
      const serviceTypes = new Set<string>();
      const priceRanges = { min: Infinity, max: -Infinity };
      const ratings = new Set<number>();

      for (const item of allIndexes) {
        // Cities
        if (item.data?.location?.city) {
          cities.add(item.data.location.city);
        }

        // Specializations (staff)
        if (item.type === 'staff' && item.data?.specialization) {
          specializations.add(item.data.specialization);
        }

        // Service types (centers)
        if (item.type === 'center' && item.data?.serviceType) {
          serviceTypes.add(item.data.serviceType);
        }

        // Price range
        if (item.data?.price || item.price) {
          const price = item.data?.price || item.price;
          priceRanges.min = Math.min(priceRanges.min, price);
          priceRanges.max = Math.max(priceRanges.max, price);
        }

        // Ratings
        const rating = Math.floor(item.rating || item.data?.rating || 0);
        if (rating > 0) {
          ratings.add(rating);
        }
      }

      const facets = {
        cities: Array.from(cities).sort(),
        specializations: Array.from(specializations).sort(),
        serviceTypes: Array.from(serviceTypes).sort(),
        priceRange: priceRanges.min !== Infinity ? priceRanges : null,
        ratings: Array.from(ratings).sort((a, b) => b - a)
      };

      console.log(`✅ Generated facets:`, {
        cities: facets.cities.length,
        specializations: facets.specializations.length,
        serviceTypes: facets.serviceTypes.length
      });

      return sendSuccess(c, { facets });

    } catch (error) {
      console.error('❌ Error getting facets:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Enhanced search engine endpoints registered');
}
