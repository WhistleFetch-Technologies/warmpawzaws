/**
 * SQL-BASED DISCOVERY ENDPOINTS
 * NO KV STORE - All data from SQL
 */

import { Hono } from 'npm:hono';
import { getDiscoveryService } from '../../../supabase/lib/services/discovery-service.ts';
import { getDiscoveryRepository } from '../../../supabase/lib/repositories/discovery.ts';

export function registerDiscoverySQLEndpoints(app: Hono) {
  /**
   * GET /make-server-3dd53475/customer/discover-sql
   * SQL-based problem-driven discovery
   */
  app.get('/make-server-3dd53475/customer/discover-sql', async (c) => {
    try {
      const problemGridId = c.req.query('problemGridId');
      const roleId = c.req.query('roleId');
      const customerLat = c.req.query('lat') ? parseFloat(c.req.query('lat')!) : undefined;
      const customerLon = c.req.query('lon') ? parseFloat(c.req.query('lon')!) : undefined;
      const maxDistance = c.req.query('maxDistance') ? parseInt(c.req.query('maxDistance')!) : undefined;
      const feeMin = c.req.query('feeMin') ? parseInt(c.req.query('feeMin')!) : undefined;
      const feeMax = c.req.query('feeMax') ? parseInt(c.req.query('feeMax')!) : undefined;
      const sortBy = (c.req.query('sortBy') || 'rating') as 'rating' | 'distance' | 'fee_low' | 'fee_high' | 'experience';

      if (!roleId) {
        return c.json({
          success: false,
          error: 'Missing required parameter: roleId'
        }, 400);
      }

      const discoveryService = getDiscoveryService();
      const result = await discoveryService.discoverByProblemGrid({
        problemGridId,
        roleId,
        customerLat,
        customerLon,
        maxDistance,
        feeMin,
        feeMax,
        sortBy
      });

      return c.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('❌ [DISCOVERY-SQL] Error:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/customer/discover-staff-sql
   * SQL-based staff discovery by problem
   */
  app.get('/make-server-3dd53475/customer/discover-staff-sql', async (c) => {
    try {
      const problemGridId = c.req.query('problemGridId');
      const roleId = c.req.query('roleId');
      const customerLat = c.req.query('lat') ? parseFloat(c.req.query('lat')!) : undefined;
      const customerLon = c.req.query('lon') ? parseFloat(c.req.query('lon')!) : undefined;
      const maxDistance = c.req.query('maxDistance') ? parseInt(c.req.query('maxDistance')!) : undefined;

      if (!roleId) {
        return c.json({
          success: false,
          error: 'Missing required parameter: roleId'
        }, 400);
      }

      if (!problemGridId) {
        return c.json({
          success: false,
          error: 'Missing required parameter: problemGridId'
        }, 400);
      }

      const { findProblemById } = await import('./problem-grid-catalog.tsx');
      const problem = findProblemById(problemGridId);

      if (!problem) {
        return c.json({
          success: false,
          error: 'Problem grid not found'
        }, 404);
      }

      const requiredSubCategories = problem.mappedSubCategories || [];

      if (requiredSubCategories.length === 0) {
        return c.json({
          success: true,
          staff: [],
          total: 0,
          message: 'No subcategories mapped for this problem'
        });
      }

      const discoveryRepo = getDiscoveryRepository();
      const staff = await discoveryRepo.searchStaffBySubcategories(
        roleId,
        requiredSubCategories,
        customerLat,
        customerLon,
        maxDistance
      );

      // Sort by distance if location provided
      if (customerLat && customerLon) {
        staff.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      } else {
        staff.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      }

      return c.json({
        success: true,
        staff: staff.map(s => ({
          id: s.staffId,
          staffId: s.staffId,
          fullName: s.fullName,
          specialization: s.specialization,
          specializations: s.specializations,
          consultationFee: s.consultationFee,
          rating: s.rating,
          services: s.services,
          distance: s.distance,
          vendorId: s.vendorId
        })),
        total: staff.length,
        problemGrid: {
          id: problemGridId,
          displayName: problem.displayName || problem.name,
          mappedSubCategories: requiredSubCategories
        }
      });

    } catch (error) {
      console.error('❌ [DISCOVERY-STAFF-SQL] Error:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/sync-search-indexes
   * Manually sync search indexes
   */
  app.post('/make-server-3dd53475/admin/sync-search-indexes', async (c) => {
    try {
      const { entityType, entityId } = await c.req.json();

      if (!entityType || !entityId) {
        return c.json({
          success: false,
          error: 'Missing entityType or entityId'
        }, 400);
      }

      const discoveryService = getDiscoveryService();
      await discoveryService.syncSearchIndexes(entityType as 'vendor' | 'staff', entityId);

      return c.json({
        success: true,
        message: `Search index synced for ${entityType} ${entityId}`
      });

    } catch (error) {
      console.error('❌ [SYNC-INDEX] Error:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });
}

