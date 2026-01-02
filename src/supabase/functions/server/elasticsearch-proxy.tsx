import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import Fuse from "fuse.js";

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

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { getDbClient } from '../../../supabase/lib/db';
import {
  getVendorServicesRepository,
  getVendorsRepository
} from '../../../supabase/lib/repositories/index';

export function elasticsearchProxyEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // SEARCH (Fuzzy & Weighted)
  // ========================================
  app.get(`${BASE_PATH}/search/elastic`, async (c) => {
    try {
      const query = c.req.query('q') || '';
      const type = c.req.query('type') || 'all';

      // ✅ SQL: 1. Fetch Data from SQL tables and build search index
      const db = getDbClient();
      const servicesRepo = getVendorServicesRepository();
      const vendorsRepo = getVendorsRepository();
      
      // Fetch all published services
      const { data: servicesData } = await db
        .from('vendor_services')
        .select('*')
        .eq('publish_status', 'published')
        .eq('is_enabled', true);
      
      // Fetch all active vendors
      const vendors = await vendorsRepo.findAll();
      const activeVendors = vendors.filter(v => v.is_active !== false && (v.application_status === 'approved' || v.status === 'approved'));
      
      // Build search index items
      const services = (servicesData || []).map((s: any) => ({
        id: s.id,
        type: 'service' as const,
        title: s.service_name || s.name,
        description: s.description || '',
        tags: [s.category_name || s.category, ...(s.tags || [])],
        popularity: s.popularity || 0,
        image: s.image || s.photo,
        price: s.price || s.custom_price || 0,
        rating: s.rating || 0
      }));
      
      const centers = activeVendors.map((v: any) => ({
        id: v.id,
        type: 'center' as const,
        title: v.business_name || v.full_name || v.businessName || v.fullName,
        description: v.bio || v.description || '',
        tags: v.services || [],
        popularity: v.rating || 0,
        image: v.profile_image || v.profile_photo || v.profilePhoto,
        rating: v.rating || 0
      }));

      const searchData: SearchIndexItem[] = [...services, ...centers];

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

      // ✅ SQL: 3. Log Query for Analytics
      // Fire and forget
      logSearchQuery(query);

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

          // ✅ SQL: Fetch popular searches from search_history table
          const db = getDbClient();
          const { data: history } = await db
            .from('search_history')
            .select('search_query')
            .ilike('search_query', `%${query}%`)
            .order('created_at', { ascending: false })
            .limit(5);
          
          const matches = history?.map(h => h.search_query) || [];
          
          return sendSuccess(c, { suggestions: matches });
      } catch (error) {
          return sendError(c, error, 500);
      }
  });

  // ========================================
  // RE-INDEX (Admin Trigger)
  // ========================================
  app.post(`${BASE_PATH}/search/index`, async (c) => {
      // ✅ SQL: In a real app, this would trigger a batch job
      // Here we just return success - index will rebuild on next search from SQL tables
      return sendSuccess(c, { message: 'Index flush triggered. Will rebuild on next query.' });
  });

  async function logSearchQuery(query: string) {
      try {
          const normalized = query.toLowerCase().trim();
          if (normalized.length < 3) return;

          // ✅ SQL: Log search query in search_history table
          const db = getDbClient();
          await db
            .from('search_history')
            .insert({
              search_query: normalized,
              results_count: 0,
              created_at: new Date().toISOString()
            });

          // ✅ SQL: Update search analytics in search_analytics table
          const today = new Date().toISOString().split('T')[0];
          const { data: existing } = await db
            .from('search_analytics')
            .select('*')
            .eq('query', normalized)
            .eq('date', today)
            .single();

          if (existing) {
            await db
              .from('search_analytics')
              .update({ search_count: (existing.search_count || 0) + 1 })
              .eq('id', existing.id);
          } else {
            await db
              .from('search_analytics')
              .insert({
                query: normalized,
                date: today,
                search_count: 1
              });
          }

      } catch (err) {
          console.error('Search logging failed', err);
      }
  }

  console.log('✅ Elasticsearch Proxy endpoints registered');
}
