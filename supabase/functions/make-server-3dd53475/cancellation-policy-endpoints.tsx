/**
 * CANCELLATION POLICY ENDPOINTS
 * Handles cancellation policy CRUD operations
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { sendSuccess, sendError } from './response-utils.ts';

export function cancellationPolicyEndpoints(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';

  /**
   * GET /admin/finance/cancellation-policies
   * Get all cancellation policies
   */
  app.get(`${BASE_PATH}/admin/finance/cancellation-policies`, async (c) => {
    try {
      const policies = await kv.get('platform:cancellation_policies') || [];
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

      const policies = await kv.get('platform:cancellation_policies') || [];
      policies.push(policy);
      await kv.set('platform:cancellation_policies', policies);

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

      const policies = await kv.get('platform:cancellation_policies') || [];
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

      await kv.set('platform:cancellation_policies', policies);

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
      const policies = await kv.get('platform:cancellation_policies') || [];
      const filtered = policies.filter((p: any) => p.id !== policyId);
      await kv.set('platform:cancellation_policies', filtered);

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
      const policies = await kv.get('platform:cancellation_policies') || [];
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

