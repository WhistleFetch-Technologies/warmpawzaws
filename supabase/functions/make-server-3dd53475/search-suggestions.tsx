import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getSearchHistoryRepository } from "../../lib/repositories/search-history.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getDbClient } from "../../lib/db.ts";

/**
 * 🔍 SEARCH SUGGESTIONS ENDPOINT
 * 
 * Phase 7D: Problem Grid Enhancement - Rule 4 Implementation
 * 
 * Features:
 * - Smart search suggestions based on user history
 * - Popular problems by location
 * - Trending searches
 * - Recent searches
 */

interface SearchSuggestion {
  type: 'problem' | 'service' | 'vendor' | 'category';
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  gradient?: string;
  category?: string;
  relevanceScore: number;
}

export function searchSuggestionsEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const searchHistoryRepo = getSearchHistoryRepository();
  const bookingsRepo = getBookingsRepository();
  const client = getDbClient();

  // ========================================
  // GET SEARCH SUGGESTIONS
  // ========================================
  app.get(`${BASE_PATH}/customer/search-suggestions`, async (c) => {
    try {
      const customerId = c.req.query('customerId');
      const roleId = c.req.query('roleId');
      const query = c.req.query('query') || '';
      const limit = parseInt(c.req.query('limit') || '10');

      console.log(`🔍 [SEARCH-SUGGESTIONS] Customer: ${customerId}, Role: ${roleId}, Query: "${query}"`);

      const suggestions: SearchSuggestion[] = [];

      // ✅ SQL: 1. Get recent searches (if customer provided)
      if (customerId) {
        const recentSearches = await searchHistoryRepo.findByCustomer(customerId, { limit: 3 });
        
        for (const search of recentSearches) {
          // Parse search query to extract type, id, title if stored in structured format
          const searchData = search.filters || {};
          suggestions.push({
            type: (searchData.type as any) || 'problem',
            id: searchData.id || search.query,
            title: searchData.title || search.query,
            subtitle: 'Recent search',
            icon: searchData.icon,
            color: searchData.color,
            gradient: searchData.gradient,
            category: searchData.category,
            relevanceScore: 100
          });
        }
      }

      // 2. Get problems from catalog
      const { getAllProblemGrids, getProblemGridByRole } = await import('./problem-grid-catalog.tsx');
      
      let problemsToSearch: any[] = [];
      
      if (roleId) {
        // Get problems for specific role
        problemsToSearch = getProblemGridByRole(roleId);
      } else {
        // Get all problems
        const allGrids = getAllProblemGrids();
        problemsToSearch = Object.values(allGrids).flat();
      }

      // 3. Filter problems by query (if provided)
      if (query && query.length > 0) {
        const queryLower = query.toLowerCase();
        
        for (const problem of problemsToSearch) {
          let relevanceScore = 0;
          
          // Check name match
          if (problem.name.toLowerCase().includes(queryLower)) {
            relevanceScore += 50;
          }
          
          // Check display name match
          if (problem.displayName && problem.displayName.toLowerCase().includes(queryLower)) {
            relevanceScore += 40;
          }
          
          // Check keyword match
          if (problem.keywords) {
            for (const keyword of problem.keywords) {
              if (keyword.toLowerCase().includes(queryLower) || queryLower.includes(keyword.toLowerCase())) {
                relevanceScore += 20;
              }
            }
          }
          
          // Check description match
          if (problem.description && problem.description.toLowerCase().includes(queryLower)) {
            relevanceScore += 10;
          }
          
          if (relevanceScore > 0) {
            suggestions.push({
              type: 'problem',
              id: problem.id,
              title: problem.displayName || problem.name,
              subtitle: problem.description,
              icon: problem.icon,
              color: problem.color,
              gradient: problem.gradient,
              relevanceScore
            });
          }
        }
      } else {
        // No query - show popular/trending problems
        for (const problem of problemsToSearch.slice(0, 8)) {
          suggestions.push({
            type: 'problem',
            id: problem.id,
            title: problem.displayName || problem.name,
            subtitle: problem.description,
            icon: problem.icon,
            color: problem.color,
            gradient: problem.gradient,
            relevanceScore: problem.order || 0
          });
        }
      }

      // 4. Sort by relevance score
      suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // 5. Limit results
      const limitedSuggestions = suggestions.slice(0, limit);

      console.log(`✅ Generated ${limitedSuggestions.length} search suggestions`);

      return sendSuccess(c, {
        suggestions: limitedSuggestions,
        total: limitedSuggestions.length,
        query: query || null
      });

    } catch (error) {
      console.error('❌ Error generating search suggestions:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // SAVE SEARCH HISTORY
  // ========================================
  app.post(`${BASE_PATH}/customer/search-history`, async (c) => {
    try {
      const {
        customerId,
        type,
        id,
        title,
        subtitle,
        icon,
        color,
        gradient,
        category
      } = await c.req.json();

      if (!customerId || !id || !title) {
        return sendError(c, 'Required fields missing', 400);
      }

      console.log(`💾 [SAVE-SEARCH] Customer: ${customerId}, Type: ${type}, ID: ${id}`);

      // ✅ SQL: Save search history to database
      await searchHistoryRepo.create({
        customer_id: customerId,
        query: title,
        search_type: type || 'problem',
        results_count: 0,
        filters: {
          id,
          title,
          subtitle,
          icon,
          color,
          gradient,
          category
        }
      });
      
      // Get updated count
      const allSearches = await searchHistoryRepo.findByCustomer(customerId);
      const updated = allSearches.length;

      console.log(`✅ Search history saved (${updated.length} total searches)`);

      return sendSuccess(c, {
        message: 'Search history saved',
        totalSearches: updated.length
      });

    } catch (error) {
      console.error('❌ Error saving search history:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET TRENDING PROBLEMS
  // ========================================
  app.get(`${BASE_PATH}/customer/trending-problems`, async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const limit = parseInt(c.req.query('limit') || '10');

      console.log(`📈 [TRENDING-PROBLEMS] Role: ${roleId || 'all'}`);

      // ✅ SQL: Get all bookings to calculate trending problems
      const allBookings = await bookingsRepo.findAll({ limit: 1000 }); // Get recent bookings
      
      // Count problem occurrences (simplified - in production, use time-windowed analytics)
      const problemCounts = new Map<string, number>();

      for (const booking of allBookings) {
        // Extract problemId from booking metadata or service category
        const problemId = (booking as any).problem_id || (booking as any).metadata?.problemId;
        if (problemId) {
          const count = problemCounts.get(problemId) || 0;
          problemCounts.set(problemId, count + 1);
        }
      }

      // Get problem details
      const { findProblemById } = await import('./problem-grid-catalog.tsx');
      
      const trendingProblems = [];

      for (const [problemId, count] of problemCounts.entries()) {
        const problem = findProblemById(problemId);
        if (problem) {
          trendingProblems.push({
            ...problem,
            bookingCount: count,
            trendScore: count
          });
        }
      }

      // Sort by trend score
      trendingProblems.sort((a, b) => b.trendScore - a.trendScore);

      // Limit results
      const limitedProblems = trendingProblems.slice(0, limit);

      console.log(`✅ Found ${limitedProblems.length} trending problems`);

      return sendSuccess(c, {
        problems: limitedProblems,
        total: limitedProblems.length
      });

    } catch (error) {
      console.error('❌ Error fetching trending problems:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // CLEAR SEARCH HISTORY
  // ========================================
  app.delete(`${BASE_PATH}/customer/:customerId/search-history`, async (c) => {
    try {
      const { customerId } = c.req.param();

      console.log(`🗑️ [CLEAR-SEARCH] Customer: ${customerId}`);

      // ✅ SQL: Clear search history for customer
      const client = getDbClient();
      await client.from('search_history').delete().eq('customer_id', customerId);

      console.log(`✅ Search history cleared`);

      return sendSuccess(c, {
        message: 'Search history cleared successfully'
      });

    } catch (error) {
      console.error('❌ Error clearing search history:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Search suggestions endpoints registered');
}
