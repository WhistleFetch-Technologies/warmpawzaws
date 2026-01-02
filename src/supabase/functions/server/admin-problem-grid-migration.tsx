/**
 * ADMIN ENDPOINT: Populate Problem Grid Mappings
 * ✅ SQL-ONLY: Populates problem_grid_mappings table from catalog
 */

import { Hono } from 'hono';
import { populateProblemGridMappings } from '../../../supabase/lib/services/problem-grid-migration';

export function registerProblemGridMigrationEndpoints(app: Hono) {
  /**
   * POST /make-server-3dd53475/admin/populate-problem-grid-mappings
   * Populates problem_grid_mappings table from problem grid catalog
   */
  app.post('/make-server-3dd53475/admin/populate-problem-grid-mappings', async (c) => {
    try {
      console.log('🔄 Starting problem grid mappings population...');
      
      const result = await populateProblemGridMappings();
      
      return c.json({
        success: true,
        inserted: result.inserted,
        errors: result.errors,
        message: `Problem grid mappings populated: ${result.inserted} inserted, ${result.errors} errors`
      });
      
    } catch (error) {
      console.error('❌ Error populating problem grid mappings:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });
}

