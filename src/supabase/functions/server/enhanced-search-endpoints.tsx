/**
 * Enhanced Search Endpoints with Elasticsearch
 * Falls back to KV store if Elasticsearch unavailable
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { getElasticsearchClient } from './elasticsearch-client.tsx';
import { calculateDistance } from './schedule-utils.tsx';

export function registerEnhancedSearchEndpoints(app: Hono) {
  const esClient = getElasticsearchClient();

  /**
   * Enhanced vendor search with Elasticsearch
   * GET /make-server-3dd53475/search/vendors/enhanced
   */
  app.get('/make-server-3dd53475/search/vendors/enhanced', async (c) => {
    try {
      const query = c.req.query('q') || '';
      const roleId = c.req.query('roleId');
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radius = c.req.query('radius') || '10km';
      const priceMin = parseFloat(c.req.query('priceMin') || '0');
      const priceMax = parseFloat(c.req.query('priceMax') || '999999');
      const sortBy = c.req.query('sortBy') || 'relevance';
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');

      // Check if Elasticsearch is available
      const esAvailable = await esClient.healthCheck();

      if (esAvailable) {
        // Use Elasticsearch
        const filters: any = {
          limit,
          offset,
          sortBy,
        };

        if (lat !== 0 && lng !== 0) {
          filters.location = { lat, lng, radius };
        }

        if (priceMin > 0 || priceMax < 999999) {
          filters.priceRange = { min: priceMin, max: priceMax };
        }

        if (roleId) {
          filters.category = roleId;
        }

        const result = await esClient.search('vendors', query, filters);
        
        return c.json({
          success: true,
          vendors: result.hits,
          total: result.total,
          source: 'elasticsearch',
        });
      } else {
        // Fallback to KV store
        console.log('⚠️ [SEARCH] Elasticsearch unavailable, using KV store fallback');
        const allVendors = await kv.getByPrefix('vendor:vendor_');
        
        let filtered = allVendors.filter((v: any) => {
          if (v.status !== 'approved' || !v.isActive) return false;
          if (roleId && v.roleId !== roleId) return false;
          
          if (query) {
            const searchLower = query.toLowerCase();
            const nameMatch = (v.businessName || v.name || '').toLowerCase().includes(searchLower);
            const descMatch = (v.description || '').toLowerCase().includes(searchLower);
            if (!nameMatch && !descMatch) return false;
          }
          
          const price = v.consultationFee || v.basePrice || 0;
          if (price < priceMin || price > priceMax) return false;
          
          return true;
        });

        // Calculate distances if location provided
        if (lat !== 0 && lng !== 0) {
          filtered = filtered.map((v: any) => ({
            ...v,
            distance: v.latitude && v.longitude
              ? calculateDistance(lat, lng, v.latitude, v.longitude)
              : null,
          })).filter((v: any) => !v.distance || v.distance <= parseFloat(radius));

          if (sortBy === 'distance') {
            filtered.sort((a: any, b: any) => (a.distance || 999) - (b.distance || 999));
          }
        }

        if (sortBy === 'rating') {
          filtered.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
        } else if (sortBy === 'price') {
          filtered.sort((a: any, b: any) => {
            const priceA = a.consultationFee || a.basePrice || 0;
            const priceB = b.consultationFee || b.basePrice || 0;
            return priceA - priceB;
          });
        }

        return c.json({
          success: true,
          vendors: filtered.slice(offset, offset + limit),
          total: filtered.length,
          source: 'kv_store',
        });
      }
    } catch (error) {
      console.error('❌ [SEARCH] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Enhanced staff search with Elasticsearch
   * GET /make-server-3dd53475/search/staff/enhanced
   */
  app.get('/make-server-3dd53475/search/staff/enhanced', async (c) => {
    try {
      const query = c.req.query('q') || '';
      const roleId = c.req.query('roleId');
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radius = c.req.query('radius') || '10km';
      const feeMin = parseFloat(c.req.query('feeMin') || '0');
      const feeMax = parseFloat(c.req.query('feeMax') || '999999');
      const sortBy = c.req.query('sortBy') || 'relevance';
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');

      const esAvailable = await esClient.healthCheck();

      if (esAvailable) {
        const filters: any = {
          limit,
          offset,
          sortBy,
        };

        if (lat !== 0 && lng !== 0) {
          filters.location = { lat, lng, radius };
        }

        if (feeMin > 0 || feeMax < 999999) {
          filters.priceRange = { min: feeMin, max: feeMax };
        }

        if (roleId) {
          filters.category = roleId;
        }

        const result = await esClient.search('staff', query, filters);
        
        return c.json({
          success: true,
          staff: result.hits,
          total: result.total,
          source: 'elasticsearch',
        });
      } else {
        // Fallback to KV store
        const allStaff = await kv.getByPrefix('staff:');
        
        let filtered = allStaff.filter((s: any) => {
          if (!s.isActive) return false;
          if (roleId && s.roleId !== roleId) return false;
          
          if (query) {
            const searchLower = query.toLowerCase();
            const nameMatch = (s.fullName || s.name || '').toLowerCase().includes(searchLower);
            const specMatch = (s.specialization || '').toLowerCase().includes(searchLower);
            if (!nameMatch && !specMatch) return false;
          }
          
          const fee = s.consultationFee || 0;
          if (fee < feeMin || fee > feeMax) return false;
          
          return true;
        });

        // Enrich with vendor location
        const enriched = await Promise.all(
          filtered.map(async (staff: any) => {
            if (staff.vendorId) {
              const vendor = await kv.get(`vendor:${staff.vendorId}`);
              if (vendor && vendor.latitude && vendor.longitude) {
                staff.location = { lat: vendor.latitude, lng: vendor.longitude };
                if (lat !== 0 && lng !== 0) {
                  staff.distance = calculateDistance(lat, lng, vendor.latitude, vendor.longitude);
                }
              }
            }
            return staff;
          })
        );

        if (lat !== 0 && lng !== 0) {
          const radiusKm = parseFloat(radius);
          filtered = enriched.filter((s: any) => !s.distance || s.distance <= radiusKm);

          if (sortBy === 'distance') {
            filtered.sort((a: any, b: any) => (a.distance || 999) - (b.distance || 999));
          }
        } else {
          filtered = enriched;
        }

        if (sortBy === 'rating') {
          filtered.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
        } else if (sortBy === 'price') {
          filtered.sort((a: any, b: any) => {
            const feeA = a.consultationFee || 0;
            const feeB = b.consultationFee || 0;
            return feeA - feeB;
          });
        }

        return c.json({
          success: true,
          staff: filtered.slice(offset, offset + limit),
          total: filtered.length,
          source: 'kv_store',
        });
      }
    } catch (error) {
      console.error('❌ [SEARCH] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Re-index all data
   * POST /make-server-3dd53475/search/reindex
   */
  app.post('/make-server-3dd53475/search/reindex', async (c) => {
    try {
      const { indexAllVendors, indexAllStaff } = await import('./search-indexing.tsx');
      
      await indexAllVendors();
      await indexAllStaff();
      
      return c.json({
        success: true,
        message: 'Re-indexing completed',
      });
    } catch (error) {
      console.error('❌ [SEARCH] Re-index error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

