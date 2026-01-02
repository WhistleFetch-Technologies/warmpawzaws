/**
 * CANCELLATION POLICY ENDPOINTS
 * Handles cancellation policy CRUD operations
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { sendSuccess, sendError } from './response-utils';
import { getDbClient } from '../../../supabase/lib/db';

export function cancellationPolicyEndpoints(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';

  /**
   * GET /admin/finance/cancellation-policies
   * Get all cancellation policies
   */
  app.get(`${BASE_PATH}/admin/finance/cancellation-policies`, async (c) => {
    try {
      // ✅ SQL: Get cancellation policies from platform_settings table
      const db = getDbClient();
      const { data: settingsData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'cancellation_policies')
        .single();
      
      const policies = settingsData?.setting_value || [];
      // Sort by priority
      const sorted = policies.sort((a: any, b: any) => a.priority - b.priority);
      return sendSuccess(c, { policies: sorted });
    } catch (error) {
      console.error('Error fetching cancellation policies:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/finance/cancellation-policies
   * Create new cancellation policy
   */
  app.post(`${BASE_PATH}/admin/finance/cancellation-policies`, async (c) => {
    try {
      const policyData = await c.req.json();
      
      // Validate required fields
      if (!policyData.name) {
        return sendError(c, 'Policy name is required', 400);
      }
      if (!policyData.cancellationWindows || policyData.cancellationWindows.length === 0) {
        return sendError(c, 'At least one cancellation window is required', 400);
      }

      const policy = {
        id: `cancel_policy_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        ...policyData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // ✅ SQL: Get cancellation policies from platform_settings table
      const db = getDbClient();
      const { data: settingsData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'cancellation_policies')
        .single();
      
      const policies = settingsData?.setting_value || [];
      policies.push(policy);
      // ✅ SQL: Update cancellation policies in platform_settings table
      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'cancellation_policies',
          setting_value: policies,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      console.log('✅ Cancellation policy created:', policy.id);
      return sendSuccess(c, { policy });
    } catch (error) {
      console.error('Error creating cancellation policy:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/finance/cancellation-policies/:policyId
   * Update cancellation policy
   */
  app.put(`${BASE_PATH}/admin/finance/cancellation-policies/:policyId`, async (c) => {
    try {
      const { policyId } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Get cancellation policies from platform_settings table
      const db = getDbClient();
      const { data: settingsData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'cancellation_policies')
        .single();
      
      const policies = settingsData?.setting_value || [];
      const index = policies.findIndex((p: any) => p.id === policyId);

      if (index === -1) {
        return sendError(c, 'Cancellation policy not found', 404);
      }

      // Validate if updating windows
      if (updates.cancellationWindows && updates.cancellationWindows.length === 0) {
        return sendError(c, 'At least one cancellation window is required', 400);
      }

      policies[index] = {
        ...policies[index],
        ...updates,
        id: policyId, // Prevent ID change
        updatedAt: new Date().toISOString()
      };

      // ✅ SQL: Update cancellation policies in platform_settings table
      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'cancellation_policies',
          setting_value: policies,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      console.log('✅ Cancellation policy updated:', policyId);
      return sendSuccess(c, { policy: policies[index] });
    } catch (error) {
      console.error('Error updating cancellation policy:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/finance/cancellation-policies/:policyId
   * Delete cancellation policy
   */
  app.delete(`${BASE_PATH}/admin/finance/cancellation-policies/:policyId`, async (c) => {
    try {
      const { policyId } = c.req.param();
      // ✅ SQL: Get cancellation policies from platform_settings table
      const db = getDbClient();
      const { data: settingsData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'cancellation_policies')
        .single();
      
      const policies = settingsData?.setting_value || [];
      const filtered = policies.filter((p: any) => p.id !== policyId);
      await platformSettingsRepo.updateCancellationPolicies(filtered);

      console.log('✅ Cancellation policy deleted:', policyId);
      return sendSuccess(c, { success: true });
    } catch (error) {
      console.error('Error deleting cancellation policy:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/finance/cancellation-policies/:policyId
   * Get single cancellation policy
   */
  app.get(`${BASE_PATH}/admin/finance/cancellation-policies/:policyId`, async (c) => {
    try {
      const { policyId } = c.req.param();
      // ✅ SQL: Get cancellation policies from platform_settings table
      const db = getDbClient();
      const { data: settingsData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'cancellation_policies')
        .single();
      
      const policies = settingsData?.setting_value || [];
      const policy = policies.find((p: any) => p.id === policyId);

      if (!policy) {
        return sendError(c, 'Cancellation policy not found', 404);
      }

      return sendSuccess(c, { policy });
    } catch (error) {
      console.error('Error fetching cancellation policy:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Cancellation policy endpoints registered');
}

