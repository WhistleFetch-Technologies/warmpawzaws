/**
 * VENDOR POLICIES ENDPOINTS
 * ✅ SQL-ONLY: NO KV STORE
 * Vendor policy management (cancellation, refund, rescheduling, etc.)
 */

import { Hono } from "npm:hono";
import { getVendorPoliciesRepository } from "../../lib/repositories/vendor-policies.ts";

export function registerVendorPoliciesEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';
  const policiesRepo = getVendorPoliciesRepository();

  // =============================================
  // GET VENDOR POLICIES
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/policies`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const policyType = c.req.query('type');

      console.log(`[POLICIES] Fetching policies for vendor: ${vendorId} (SQL)`);

      const policies = await policiesRepo.getVendorPolicies(vendorId, policyType || undefined);

      return c.json({
        success: true,
        policies,
        totalPolicies: policies.length
      });

    } catch (error) {
      console.error('[POLICIES] Error:', error);
      return c.json({ error: 'Failed to fetch policies' }, 500);
    }
  });

  // =============================================
  // GET DEFAULT POLICY
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/policies/:policyType/default`, async (c) => {
    try {
      const { vendorId, policyType } = c.req.param();

      const policy = await policiesRepo.getDefaultPolicy(vendorId, policyType);

      if (!policy) {
        return c.json({ error: 'Default policy not found' }, 404);
      }

      return c.json({
        success: true,
        policy
      });

    } catch (error) {
      console.error('[POLICIES] Error:', error);
      return c.json({ error: 'Failed to fetch policy' }, 500);
    }
  });

  // =============================================
  // CREATE POLICY
  // =============================================
  app.post(`${BASE}/vendor/:vendorId/policies`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();

      console.log(`[POLICIES] Creating policy for vendor: ${vendorId} (SQL)`);

      if (!body.policyType || !body.policyConfig) {
        return c.json({ 
          error: 'policyType and policyConfig are required' 
        }, 400);
      }

      const policy = await policiesRepo.createPolicy({
        vendorId,
        policyType: body.policyType,
        policyConfig: body.policyConfig,
        serviceType: body.serviceType,
        serviceStyle: body.serviceStyle,
        isActive: body.isActive !== undefined ? body.isActive : true,
        isDefault: body.isDefault || false,
        description: body.description
      });

      console.log(`✅ [POLICIES] Created policy: ${policy.id}`);

      return c.json({
        success: true,
        policy,
        message: 'Policy created successfully'
      });

    } catch (error) {
      console.error('[POLICIES] Error:', error);
      return c.json({ error: 'Failed to create policy' }, 500);
    }
  });

  // =============================================
  // UPDATE POLICY
  // =============================================
  app.put(`${BASE}/vendor/:vendorId/policies/:policyId`, async (c) => {
    try {
      const { vendorId, policyId } = c.req.param();
      const body = await c.req.json();

      console.log(`[POLICIES] Updating policy: ${policyId} (SQL)`);

      // Verify policy belongs to vendor
      const existingPolicy = await policiesRepo.getPolicyById(policyId);
      if (!existingPolicy || existingPolicy.vendorId !== vendorId) {
        return c.json({ error: 'Policy not found' }, 404);
      }

      const updatedPolicy = await policiesRepo.updatePolicy(policyId, body);

      if (!updatedPolicy) {
        return c.json({ error: 'Failed to update policy' }, 500);
      }

      return c.json({
        success: true,
        policy: updatedPolicy,
        message: 'Policy updated successfully'
      });

    } catch (error) {
      console.error('[POLICIES] Error:', error);
      return c.json({ error: 'Failed to update policy' }, 500);
    }
  });

  // =============================================
  // DELETE POLICY
  // =============================================
  app.delete(`${BASE}/vendor/:vendorId/policies/:policyId`, async (c) => {
    try {
      const { vendorId, policyId } = c.req.param();

      console.log(`[POLICIES] Deleting policy: ${policyId} (SQL)`);

      // Verify policy belongs to vendor
      const existingPolicy = await policiesRepo.getPolicyById(policyId);
      if (!existingPolicy || existingPolicy.vendorId !== vendorId) {
        return c.json({ error: 'Policy not found' }, 404);
      }

      const deleted = await policiesRepo.deletePolicy(policyId);

      if (!deleted) {
        return c.json({ error: 'Failed to delete policy' }, 500);
      }

      return c.json({
        success: true,
        message: 'Policy deleted successfully'
      });

    } catch (error) {
      console.error('[POLICIES] Error:', error);
      return c.json({ error: 'Failed to delete policy' }, 500);
    }
  });
}

