/**
 * ============================================================================
 * ECOMMERCE POLICIES ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * Complete Ecommerce Policies Management
 * 
 * Features:
 * - Return policy management
 * - Shipping policy management
 * - Warranty policy management
 * - Refund policy management
 * - Policy enforcement on checkout
 * - Policy acceptance tracking
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 3, Task 3.2 - Complete Ecommerce Policies
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getEcommercePoliciesRepository } from "../../lib/repositories/ecommerce-policies.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getProductsRepository } from "../../lib/repositories/products.ts";
import { getOrdersRepository } from "../../lib/repositories/orders.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";

export function ecommercePoliciesEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const policiesRepo = getEcommercePoliciesRepository();
  const vendorsRepo = getVendorsRepository();
  const productsRepo = getProductsRepository();
  const ordersRepo = getOrdersRepository();
  const customersRepo = getCustomersRepository();

  // Helper: Resolve vendor ID
  async function resolveVendorId(identifier: string): Promise<string | null> {
    return await vendorsRepo.resolveVendorId(identifier);
  }

  // ============================================
  // POLICY MANAGEMENT
  // ============================================

  /**
   * GET /vendor/:vendorId/policies
   * List all policies for a vendor
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/policies`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const policyType = c.req.query('policy_type');

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      const policies = await policiesRepo.findByVendor(resolvedVendorId, {
        policyType: policyType || undefined,
        isActive: true,
      });

      return sendSuccess(c, { policies });
    } catch (error) {
      console.error('❌ [POLICIES] Error fetching policies:', error);
      return sendError(c, `Failed to fetch policies: ${String(error)}`, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/policies
   * Create a new policy
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/policies`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const policyData = await c.req.json();

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // Validate required fields
      if (!policyData.policy_type || !policyData.policy_name || !policyData.policy_data) {
        return sendError(c, 'Missing required fields: policy_type, policy_name, policy_data', 400);
      }

      // Validate policy type
      const validTypes = ['return', 'shipping', 'warranty', 'refund', 'cancellation', 'exchange'];
      if (!validTypes.includes(policyData.policy_type)) {
        return sendError(c, `Invalid policy_type. Must be one of: ${validTypes.join(', ')}`, 400);
      }

      // If setting as default, unset other defaults of same type
      if (policyData.is_default) {
        const existingDefault = await policiesRepo.findDefaultForVendor(resolvedVendorId, policyData.policy_type);
        if (existingDefault) {
          await policiesRepo.update(existingDefault.id, { is_default: false });
        }
      }

      const policy = await policiesRepo.create({
        vendor_id: resolvedVendorId,
        policy_type: policyData.policy_type,
        policy_name: policyData.policy_name,
        policy_description: policyData.policy_description || null,
        policy_data: policyData.policy_data,
        return_window_days: policyData.return_window_days || null,
        return_conditions: policyData.return_conditions || null,
        return_shipping_cost: policyData.return_shipping_cost || null,
        refund_processing_days: policyData.refund_processing_days || null,
        shipping_zones: policyData.shipping_zones || null,
        shipping_rates: policyData.shipping_rates || null,
        delivery_timeframes: policyData.delivery_timeframes || null,
        free_shipping_threshold: policyData.free_shipping_threshold || null,
        warranty_period_days: policyData.warranty_period_days || null,
        warranty_terms: policyData.warranty_terms || null,
        warranty_claim_process: policyData.warranty_claim_process || null,
        refund_method: policyData.refund_method || null,
        refund_processing_time_days: policyData.refund_processing_time_days || null,
        is_active: policyData.is_active !== false,
        is_default: policyData.is_default || false,
      });

      console.log(`✅ [POLICIES] Created policy ${policy.id} for vendor ${paramVendorId}`);

      return sendSuccess(c, { policy }, 'Policy created successfully');
    } catch (error) {
      console.error('❌ [POLICIES] Error creating policy:', error);
      return sendError(c, `Failed to create policy: ${String(error)}`, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/policies/:policyId
   * Update a policy
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/policies/:policyId`, async (c) => {
    try {
      const { vendorId: paramVendorId, policyId } = c.req.param();
      const updates = await c.req.json();

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // Verify policy belongs to vendor
      const policy = await policiesRepo.findById(policyId);
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }
      if (policy.vendor_id !== resolvedVendorId) {
        return sendError(c, 'Policy does not belong to this vendor', 403);
      }

      // If setting as default, unset other defaults
      if (updates.is_default) {
        const existingDefault = await policiesRepo.findDefaultForVendor(resolvedVendorId, policy.policy_type);
        if (existingDefault && existingDefault.id !== policyId) {
          await policiesRepo.update(existingDefault.id, { is_default: false });
        }
      }

      const updated = await policiesRepo.update(policyId, updates);

      return sendSuccess(c, { policy: updated }, 'Policy updated successfully');
    } catch (error) {
      console.error('❌ [POLICIES] Error updating policy:', error);
      return sendError(c, `Failed to update policy: ${String(error)}`, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/policies/:policyId
   * Delete a policy
   */
  app.delete(`${BASE_PATH}/vendor/:vendorId/policies/:policyId`, async (c) => {
    try {
      const { vendorId: paramVendorId, policyId } = c.req.param();

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // Verify policy belongs to vendor
      const policy = await policiesRepo.findById(policyId);
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }
      if (policy.vendor_id !== resolvedVendorId) {
        return sendError(c, 'Policy does not belong to this vendor', 403);
      }

      await policiesRepo.delete(policyId);

      return sendSuccess(c, {}, 'Policy deleted successfully');
    } catch (error) {
      console.error('❌ [POLICIES] Error deleting policy:', error);
      return sendError(c, `Failed to delete policy: ${String(error)}`, 500);
    }
  });

  // ============================================
  // PRODUCT POLICY MAPPING
  // ============================================

  /**
   * GET /policies/product/:productId
   * Get policies for a specific product
   */
  app.get(`${BASE_PATH}/policies/product/:productId`, async (c) => {
    try {
      const { productId } = c.req.param();
      const policyType = c.req.query('policy_type');

      const product = await productsRepo.findById(productId);
      if (!product) {
        return sendError(c, 'Product not found', 404);
      }

      // Get product-specific policies
      let policies = await policiesRepo.findByProduct(productId, policyType || undefined);

      // If no product-specific policies, get vendor default
      if (policies.length === 0 && product.vendor_id) {
        const vendorPolicies = await policiesRepo.findByVendor(product.vendor_id, {
          policyType: policyType || undefined,
          isActive: true,
        });
        policies = vendorPolicies.filter(p => p.is_default);
      }

      return sendSuccess(c, { policies });
    } catch (error) {
      console.error('❌ [POLICIES] Error fetching product policies:', error);
      return sendError(c, `Failed to fetch product policies: ${String(error)}`, 500);
    }
  });

  /**
   * POST /policies/product/:productId/link
   * Link a policy to a product
   */
  app.post(`${BASE_PATH}/policies/product/:productId/link`, async (c) => {
    try {
      const { productId } = c.req.param();
      const { policy_id, policy_type } = await c.req.json();

      if (!policy_id || !policy_type) {
        return sendError(c, 'Missing required fields: policy_id, policy_type', 400);
      }

      const product = await productsRepo.findById(productId);
      if (!product) {
        return sendError(c, 'Product not found', 404);
      }

      const policy = await policiesRepo.findById(policy_id);
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      await policiesRepo.linkProductToPolicy(productId, policy_id, policy_type);

      return sendSuccess(c, {}, 'Policy linked to product successfully');
    } catch (error) {
      console.error('❌ [POLICIES] Error linking policy to product:', error);
      return sendError(c, `Failed to link policy: ${String(error)}`, 500);
    }
  });

  /**
   * POST /policies/product/:productId/unlink
   * Unlink a policy from a product
   */
  app.post(`${BASE_PATH}/policies/product/:productId/unlink`, async (c) => {
    try {
      const { productId } = c.req.param();
      const { policy_id, policy_type } = await c.req.json();

      if (!policy_id || !policy_type) {
        return sendError(c, 'Missing required fields: policy_id, policy_type', 400);
      }

      await policiesRepo.unlinkProductFromPolicy(productId, policy_id, policy_type);

      return sendSuccess(c, {}, 'Policy unlinked from product successfully');
    } catch (error) {
      console.error('❌ [POLICIES] Error unlinking policy from product:', error);
      return sendError(c, `Failed to unlink policy: ${String(error)}`, 500);
    }
  });

  // ============================================
  // POLICY ACCEPTANCE
  // ============================================

  /**
   * POST /policies/accept
   * Record policy acceptance by customer
   */
  app.post(`${BASE_PATH}/policies/accept`, async (c) => {
    try {
      const { customer_id, policy_id, policy_type, order_id } = await c.req.json();

      if (!customer_id || !policy_id || !policy_type) {
        return sendError(c, 'Missing required fields: customer_id, policy_id, policy_type', 400);
      }

      const customer = await customersRepo.findById(customer_id);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      const policy = await policiesRepo.findById(policy_id);
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      // Get request headers for tracking
      const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '';
      const userAgent = c.req.header('user-agent') || '';

      await policiesRepo.recordAcceptance(
        customer_id,
        policy_id,
        policy_type,
        order_id || undefined,
        ipAddress,
        userAgent
      );

      return sendSuccess(c, {}, 'Policy acceptance recorded');
    } catch (error) {
      console.error('❌ [POLICIES] Error recording policy acceptance:', error);
      return sendError(c, `Failed to record acceptance: ${String(error)}`, 500);
    }
  });

  /**
   * GET /policies/check-acceptance
   * Check if customer has accepted a policy
   */
  app.get(`${BASE_PATH}/policies/check-acceptance`, async (c) => {
    try {
      const customerId = c.req.query('customer_id');
      const policyId = c.req.query('policy_id');
      const orderId = c.req.query('order_id');

      if (!customerId || !policyId) {
        return sendError(c, 'Missing required query params: customer_id, policy_id', 400);
      }

      const hasAccepted = await policiesRepo.hasAccepted(
        customerId,
        policyId,
        orderId || undefined
      );

      return sendSuccess(c, { has_accepted: hasAccepted });
    } catch (error) {
      console.error('❌ [POLICIES] Error checking policy acceptance:', error);
      return sendError(c, `Failed to check acceptance: ${String(error)}`, 500);
    }
  });

  // ============================================
  // POLICY ENFORCEMENT (Checkout)
  // ============================================

  /**
   * POST /policies/validate-checkout
   * Validate policies for checkout
   */
  app.post(`${BASE_PATH}/policies/validate-checkout`, async (c) => {
    try {
      const { customer_id, product_ids, order_id } = await c.req.json();

      if (!customer_id || !product_ids || !Array.isArray(product_ids)) {
        return sendError(c, 'Missing required fields: customer_id, product_ids (array)', 400);
      }

      const requiredPolicies: any[] = [];
      const missingAcceptances: any[] = [];

      // Get policies for each product
      for (const productId of product_ids) {
        const product = await productsRepo.findById(productId);
        if (!product) continue;

        // Get return and shipping policies (required for checkout)
        const policies = await policiesRepo.findByProduct(productId);
        const returnPolicy = policies.find(p => p.policy_type === 'return' && p.is_active);
        const shippingPolicy = policies.find(p => p.policy_type === 'shipping' && p.is_active);

        if (returnPolicy) {
          requiredPolicies.push({
            product_id: productId,
            policy_id: returnPolicy.id,
            policy_type: 'return',
            policy_name: returnPolicy.policy_name,
          });

          const hasAccepted = await policiesRepo.hasAccepted(customer_id, returnPolicy.id, order_id);
          if (!hasAccepted) {
            missingAcceptances.push({
              product_id: productId,
              policy_id: returnPolicy.id,
              policy_type: 'return',
              policy_name: returnPolicy.policy_name,
            });
          }
        }

        if (shippingPolicy) {
          requiredPolicies.push({
            product_id: productId,
            policy_id: shippingPolicy.id,
            policy_type: 'shipping',
            policy_name: shippingPolicy.policy_name,
          });

          const hasAccepted = await policiesRepo.hasAccepted(customer_id, shippingPolicy.id, order_id);
          if (!hasAccepted) {
            missingAcceptances.push({
              product_id: productId,
              policy_id: shippingPolicy.id,
              policy_type: 'shipping',
              policy_name: shippingPolicy.policy_name,
            });
          }
        }
      }

      return sendSuccess(c, {
        valid: missingAcceptances.length === 0,
        required_policies: requiredPolicies,
        missing_acceptances: missingAcceptances,
      });
    } catch (error) {
      console.error('❌ [POLICIES] Error validating checkout policies:', error);
      return sendError(c, `Failed to validate policies: ${String(error)}`, 500);
    }
  });

  console.log('✅ [POLICIES-SQL] Ecommerce policies endpoints registered (SQL-only)');
}

