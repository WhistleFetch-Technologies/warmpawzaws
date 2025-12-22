import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import Fuse from "npm:fuse.js";

/**
 * 🔍 ELASTICSEARCH PROXY / ENHANCED SEARCH SYSTEM
 * 
 * Phase 7C: Elastic Search Implementation - Rule 5
 * 
 * Since we cannot install actual Elasticsearch, we simulate its behavior using:
 * 1. Fuse.js for fuzzy searching in-memory (or loaded from KV).
 * 2. Inverted Index logic for tag-based filtering.
 * 3. Search history tracking for suggestions.
 */

interface SearchIndexItem {
  id: string;
  type: 'staff' | 'center' | 'service' | 'product';
  title: string;
  description: string;
  tags: string[];
  popularity: number;
  image?: string;
  price?: number;
  rating?: number;
}

export function elasticsearchProxyEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // SEARCH (Fuzzy & Weighted)
  // ========================================
  app.get(`${BASE_PATH}/search/elastic`, async (c) => {
    try {
      const query = c.req.query('q') || '';
      const type = c.req.query('type') || 'all';

      // 1. Fetch Data
      // In a real ES setup, we'd query the cluster. Here, we fetch cached indices from KV.
      // We assume an index exists at 'search_index_master'. If not, we build it on the fly (expensive but functional).
      let searchData: SearchIndexItem[] = await kv.get('search_index_master');
      
      if (!searchData) {
        // Fallback: Fetch from specific collections and build index
        // This is a simplified simulation
        const services = (await kv.getByPrefix('service_'))?.map((i: any) => ({
            id: i.value.id,
            type: 'service',
            title: i.value.name,
            description: i.value.description,
            tags: [i.value.category, ...(i.value.tags || [])],
            popularity: i.value.popularity || 0,
            image: i.value.image,
            price: i.value.price,
            rating: i.value.rating
        })) || [];
        
        const vendors = (await kv.getByPrefix('vendor_'))?.map((i: any) => ({
             id: i.value.id,
             type: 'center', // or staff
             title: i.value.businessName || i.value.fullName,
             description: i.value.bio || '',
             tags: i.value.services || [],
             popularity: i.value.rating || 0,
             image: i.value.profilePhoto,
             rating: i.value.rating
        })) || [];

        searchData = [...services, ...vendors];
        // Cache it for future
        await kv.set('search_index_master', searchData);
      }

      if (!query) {
          return sendSuccess(c, { results: [], total: 0 });
      }

      // 2. Perform Fuse.js Search
      const fuse = new Fuse(searchData, {
          keys: [
              { name: 'title', weight: 0.7 },
              { name: 'tags', weight: 0.5 },
              { name: 'description', weight: 0.2 }
          ],
          includeScore: true,
          threshold: 0.4, // Fuzzy threshold
          distance: 100
      });

      let results = fuse.search(query).map(r => r.item);

      // Filter by type if needed
      if (type !== 'all') {
          results = results.filter(r => r.type === type);
      }

      // 3. Log Query for Analytics
      // Fire and forget
      logSearchQuery(kv, query);

      return sendSuccess(c, {
          results: results.slice(0, 20), // Pagination simulation
          total: results.length,
          executionTime: 15 // ms mock
      });

    } catch (error) {
      console.error('Elastic Proxy Error:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // AUTOCOMPLETE
  // ========================================
  app.get(`${BASE_PATH}/search/autocomplete`, async (c) => {
      try {
          const query = c.req.query('q') || '';
          if (!query || query.length < 2) return sendSuccess(c, { suggestions: [] });

          // Fetch popular searches + index titles
          const history = await kv.get('search_history_trie') || [];
          const matches = history
            .filter((term: string) => term.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5);
          
          return sendSuccess(c, { suggestions: matches });
      } catch (error) {
          return sendError(c, error, 500);
      }
  });

  // ========================================
  // RE-INDEX (Admin Trigger)
  // ========================================
  app.post(`${BASE_PATH}/search/index`, async (c) => {
      // In a real app, this would trigger a batch job
      // Here we just clear the cache to force rebuild on next search
      await kv.del('search_index_master');
      return sendSuccess(c, { message: 'Index flush triggered. Will rebuild on next query.' });
  });

  async function logSearchQuery(kv: any, query: string) {
      try {
          const normalized = query.toLowerCase().trim();
          if (normalized.length < 3) return;

          // Update search history list for autocomplete
          let history = await kv.get('search_history_trie') || [];
          if (!history.includes(normalized)) {
              history.push(normalized);
              if (history.length > 500) history.shift(); // Keep size manageable
              await kv.set('search_history_trie', history);
          }

          // Update analytics count
          const today = new Date().toISOString().split('T')[0];
          const key = `search_stats_${today}_${normalized}`;
          const current = await kv.get(key) || 0;
          await kv.set(key, current + 1);

      } catch (err) {
          console.error('Search logging failed', err);
      }
  }

  console.log('✅ Elasticsearch Proxy endpoints registered');
}
