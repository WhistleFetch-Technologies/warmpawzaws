/**
 * ============================================================================
 * SCHEDULING POLICIES MANAGEMENT ENDPOINTS
 * ============================================================================
 * 
 * Admin endpoints for managing scheduling policies:
 * - GET /admin/scheduling-policies - Get all policies
 * - GET /admin/scheduling-policies/:policyType - Get policy by type
 * - POST /admin/scheduling-policies - Create/update policy
 * - PUT /admin/scheduling-policies/:id - Update policy
 * - DELETE /admin/scheduling-policies/:id - Deactivate policy
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';

export function registerSchedulingPolicyEndpoints(app: Hono) {
  /**
   * GET /admin/scheduling-policies
   * Get all scheduling policies
   */
  app.get("/admin/scheduling-policies", async (c) => {
    try {
      const includeInactive = c.req.query('includeInactive') === 'true';
      
      const policies = includeInactive
        ? await select('scheduling_policies', {})
        : await select('scheduling_policies', { is_active: true });

      return c.json({
        success: true,
        policies,
        total: policies.length,
      });
    } catch (error: any) {
      console.error('Error fetching scheduling policies:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/scheduling-policies/:policyType
   * Get policy by type
   */
  app.get("/admin/scheduling-policies/:policyType", async (c) => {
    try {
      const { policyType } = c.req.param();
      
      const policies = await select('scheduling_policies', { 
        policy_type: policyType,
        is_active: true 
      });

      if (policies.length === 0) {
        return c.json({ error: 'Policy not found' }, 404);
      }

      return c.json({
        success: true,
        policy: policies[0],
      });
    } catch (error: any) {
      console.error('Error fetching scheduling policy:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/scheduling-policies
   * Create or update scheduling policy
   */
  app.post("/admin/scheduling-policies", async (c) => {
    try {
      const body = await c.req.json();
      const {
        policy_name,
        policy_type,
        policy_config,
        is_active = true,
      } = body;

      // Validation
      if (!policy_name || !policy_type || !policy_config) {
        return c.json({
          error: 'policy_name, policy_type, and policy_config are required'
        }, 400);
      }

      // Check if policy with same name exists
      const existing = await select('scheduling_policies', { policy_name });
      
      if (existing.length > 0) {
        // Update existing policy
        const updated = await update(
          'scheduling_policies',
          { policy_name },
          {
            policy_type,
            policy_config,
            is_active,
            updated_at: new Date().toISOString(),
          }
        );

        return c.json({
          success: true,
          message: 'Policy updated successfully',
          policy: updated[0],
        });
      } else {
        // Create new policy
        const created = await insert('scheduling_policies', {
          policy_name,
          policy_type,
          policy_config,
          is_active,
        });

        return c.json({
          success: true,
          message: 'Policy created successfully',
          policy: created[0],
        });
      }
    } catch (error: any) {
      console.error('Error saving scheduling policy:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/scheduling-policies/:id
   * Update scheduling policy
   */
  app.put("/admin/scheduling-policies/:id", async (c) => {
    try {
      const { id } = c.req.param();
      const body = await c.req.json();

      const policies = await select('scheduling_policies', { id });
      if (policies.length === 0) {
        return c.json({ error: 'Policy not found' }, 404);
      }

      const updated = await update(
        'scheduling_policies',
        { id },
        {
          ...body,
          updated_at: new Date().toISOString(),
        }
      );

      return c.json({
        success: true,
        message: 'Policy updated successfully',
        policy: updated[0],
      });
    } catch (error: any) {
      console.error('Error updating scheduling policy:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /admin/scheduling-policies/:id
   * Deactivate scheduling policy (soft delete)
   */
  app.delete("/admin/scheduling-policies/:id", async (c) => {
    try {
      const { id } = c.req.param();

      const policies = await select('scheduling_policies', { id });
      if (policies.length === 0) {
        return c.json({ error: 'Policy not found' }, 404);
      }

      await update(
        'scheduling_policies',
        { id },
        {
          is_active: false,
          updated_at: new Date().toISOString(),
        }
      );

      return c.json({
        success: true,
        message: 'Policy deactivated successfully',
      });
    } catch (error: any) {
      console.error('Error deactivating scheduling policy:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
