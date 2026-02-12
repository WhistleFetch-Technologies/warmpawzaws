/**
 * ============================================================================
 * INSURANCE ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles pet insurance:
 * - Browse insurance plans
 * - Purchase policies
 * - File claims
 * - Track claims
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

export function registerInsuranceEndpoints(app: Hono) {
  /**
   * GET /insurance/plans
   * Browse available insurance plans
   */
  app.get("/insurance/plans", async (c) => {
    try {
      const type = c.req.query('type');
      const minCoverage = parseFloat(c.req.query('minCoverage') || '0');
      const maxPremium = parseFloat(c.req.query('maxPremium') || '999999');

      let plansQuery = `
        SELECT * FROM insurance_plans
        WHERE is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (type) {
        plansQuery += ` AND type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      if (minCoverage > 0) {
        plansQuery += ` AND coverage_amount >= $${paramIndex}`;
        params.push(minCoverage);
        paramIndex++;
      }

      if (maxPremium < 999999) {
        plansQuery += ` AND monthly_premium <= $${paramIndex}`;
        params.push(maxPremium);
        paramIndex++;
      }

      plansQuery += ` ORDER BY monthly_premium ASC`;

      const plans = await query(plansQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        plans: plans.rows,
        total: plans.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching insurance plans:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /insurance/policies
   * Purchase insurance policy
   */
  app.post("/insurance/policies", async (c) => {
    try {
      const { customerId, petId, planId, paymentMethodId } = await c.req.json();

      if (!customerId || !petId || !planId) {
        return c.json({ error: 'customerId, petId, and planId are required' }, 400);
      }

      // Get plan
      const plans = await select('insurance_plans', { id: planId, is_active: true });
      if (plans.length === 0) {
        return c.json({ error: 'Insurance plan not found' }, 404);
      }

      const plan = plans[0];

      // Get pet details
      const pets = await select('pets', { id: petId });
      if (pets.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const pet = pets[0];

      // Calculate premium (simplified - can be enhanced)
      const petAge = pet.age_years || 0;
      let premium = parseFloat(plan.monthly_premium || '0');
      if (petAge > 8) premium *= 1.6;
      else if (petAge > 5) premium *= 1.3;

      // Calculate dates
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);

      // Create policy
      const policy = await insert('insurance_policies', {
        customer_id: customerId,
        pet_id: petId,
        plan_id: planId,
        policy_number: `POL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        status: 'pending_documents',
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        premium_amount: premium,
        coverage_amount: plan.coverage_amount,
        deductible: plan.deductible,
        payment_frequency: 'monthly',
        next_payment_date: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });

      return c.json({
        success: true,
        policy: policy[0],
        message: 'Insurance policy created. Please upload required documents.',
      });
    } catch (error: any) {
      console.error('Error creating insurance policy:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /insurance/policies/customer/:customerId
   * Get customer insurance policies
   */
  app.get("/insurance/policies/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      const policies = await query(
        `SELECT p.*, pl.name as plan_name, pl.provider, pl.type as plan_type
         FROM insurance_policies p
         INNER JOIN insurance_plans pl ON p.plan_id = pl.id
         WHERE p.customer_id = $1
         ORDER BY p.created_at DESC`,
        [customerId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        policies: policies.rows,
        total: policies.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching policies:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /insurance/claims
   * File an insurance claim
   */
  app.post("/insurance/claims", async (c) => {
    try {
      const {
        policyId,
        claimType,
        incidentDate,
        claimAmount,
        description,
        veterinarianName,
        clinicName,
        documents,
      } = await c.req.json();

      if (!policyId || !claimType || !incidentDate || !claimAmount) {
        return c.json({ error: 'policyId, claimType, incidentDate, and claimAmount are required' }, 400);
      }

      // Verify policy exists and is active
      const policies = await select('insurance_policies', { id: policyId, status: 'active' });
      if (policies.length === 0) {
        return c.json({ error: 'Active insurance policy not found' }, 404);
      }

      const policy = policies[0];

      // Create claim
      const claim = await insert('insurance_claims', {
        policy_id: policyId,
        policy_number: policy.policy_number,
        customer_id: policy.customer_id,
        pet_id: policy.pet_id,
        claim_type: claimType,
        incident_date: incidentDate,
        claim_amount: claimAmount,
        description: description || null,
        veterinarian_name: veterinarianName || null,
        clinic_name: clinicName || null,
        documents: documents || [],
        status: 'submitted',
      });

      return c.json({
        success: true,
        claim: claim[0],
        message: 'Claim submitted successfully',
      });
    } catch (error: any) {
      console.error('Error filing claim:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /insurance/claims/policy/:policyId
   * Get claims for a policy
   */
  app.get("/insurance/claims/policy/:policyId", async (c) => {
    try {
      const { policyId } = c.req.param();

      const claims = await query(
        `SELECT * FROM insurance_claims
         WHERE policy_id = $1
         ORDER BY created_at DESC`,
        [policyId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        claims: claims.rows,
        total: claims.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching claims:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /insurance/claims/vendor/:vendorId
   * Get all claims for a vendor (vendor can see claims for policies they've issued)
   */
  app.get("/insurance/claims/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get claims for policies where vendor is involved
      // Note: This assumes vendors can see claims related to their services
      const claims = await query(
        `SELECT 
           ic.*,
           ip.policy_number,
           ip.customer_id,
           c.full_name as customer_name,
           c.phone as customer_phone
         FROM insurance_claims ic
         INNER JOIN insurance_policies ip ON ic.policy_id = ip.id
         LEFT JOIN customers c ON ip.customer_id = c.id
         WHERE ic.vendor_id = $1 OR ip.vendor_id = $1
         ORDER BY ic.created_at DESC`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        claims: claims.rows,
        total: claims.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor insurance claims:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /insurance/policies/vendor/:vendorId
   * Get all policies for a vendor (if vendor is involved in policy creation)
   */
  app.get("/insurance/policies/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const policies = await query(
        `SELECT p.*, pl.name as plan_name, pl.provider, c.full_name as customer_name
         FROM insurance_policies p
         INNER JOIN insurance_plans pl ON p.plan_id = pl.id
         LEFT JOIN customers c ON p.customer_id = c.id
         WHERE p.vendor_id = $1
         ORDER BY p.created_at DESC`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        policies: policies.rows,
        total: policies.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor insurance policies:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // VENDOR INSURANCE MANAGEMENT ENDPOINTS
  // ============================================

  /**
   * GET /vendor/:vendorId/insurance/plans
   * Get insurance plans offered by a vendor (alias for policies)
   */
  app.get("/vendor/:vendorId/insurance/plans", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const plans = await query(
        `SELECT * FROM insurance_plans
         WHERE vendor_id = $1
         ORDER BY created_at DESC`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        plans: plans.rows,
        total: plans.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor plans:', error);
      return c.json({ success: true, plans: [], total: 0 });
    }
  });

  /**
   * POST /vendor/:vendorId/insurance/plans
   * Create a new insurance plan
   */
  app.post("/vendor/:vendorId/insurance/plans", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const planData = await c.req.json();

      const plan = await insert('insurance_plans', {
        vendor_id: vendorId,
        plan_name: planData.name || planData.plan_name,
        description: planData.description,
        coverage_type: planData.coverageType || planData.coverage_type || 'basic',
        coverage_amount: parseFloat(String(planData.coverage || planData.coverage_amount || '50000').replace(/[^0-9.]/g, '')),
        premium_monthly: planData.price || planData.premium_monthly,
        premium_yearly: planData.premium_yearly || (planData.price ? planData.price * 12 : 0),
        coverage_details: { features: planData.features || [] },
        waiting_period_days: parseInt(planData.waitingPeriod || planData.waiting_period_days || '30', 10),
        is_active: planData.isActive !== false,
      });

      return c.json({
        success: true,
        plan: plan[0],
        message: 'Plan created successfully',
      });
    } catch (error: any) {
      console.error('Error creating insurance plan:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/insurance/plans/:planId
   * Update an insurance plan
   */
  app.put("/vendor/:vendorId/insurance/plans/:planId", async (c) => {
    try {
      const { vendorId, planId } = c.req.param();
      const planData = await c.req.json();

      const updated = await update('insurance_plans', 
        { id: planId },
        {
          plan_name: planData.name || planData.plan_name,
          description: planData.description,
          coverage_type: planData.coverageType || planData.coverage_type,
          coverage_amount: planData.coverage ? parseFloat(String(planData.coverage).replace(/[^0-9.]/g, '')) : undefined,
          premium_monthly: planData.price || planData.premium_monthly,
          premium_yearly: planData.premium_yearly,
          coverage_details: planData.features ? { features: planData.features } : undefined,
          waiting_period_days: planData.waitingPeriod ? parseInt(planData.waitingPeriod, 10) : undefined,
          is_active: planData.isActive,
          updated_at: new Date().toISOString(),
        }
      );

      return c.json({
        success: true,
        plan: updated[0],
        message: 'Plan updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating insurance plan:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/insurance/plans/:planId
   * Delete an insurance plan
   */
  app.delete("/vendor/:vendorId/insurance/plans/:planId", async (c) => {
    try {
      const { vendorId, planId } = c.req.param();

      await query(
        `DELETE FROM insurance_plans WHERE id = $1 AND vendor_id = $2`,
        [planId, vendorId]
      );

      return c.json({
        success: true,
        message: 'Plan deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting insurance plan:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/insurance/stats
   * Get insurance statistics for a vendor
   */
  app.get("/vendor/:vendorId/insurance/stats", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get total plans
      const plansCount = await query(
        `SELECT COUNT(*) as count FROM insurance_plans WHERE vendor_id = $1 AND is_active = true`,
        [vendorId]
      ).catch(() => ({ rows: [{ count: 0 }] }));

      // Get active policies count
      const policiesCount = await query(
        `SELECT COUNT(*) as count FROM insurance_policies ip
         JOIN insurance_plans ipl ON ip.plan_id = ipl.id
         WHERE ipl.vendor_id = $1 AND ip.status = 'active'`,
        [vendorId]
      ).catch(() => ({ rows: [{ count: 0 }] }));

      // Get pending claims
      const claimsCount = await query(
        `SELECT COUNT(*) as count FROM insurance_claims ic
         JOIN insurance_policies ip ON ic.policy_id = ip.id
         JOIN insurance_plans ipl ON ip.plan_id = ipl.id
         WHERE ipl.vendor_id = $1 AND ic.status = 'pending'`,
        [vendorId]
      ).catch(() => ({ rows: [{ count: 0 }] }));

      // Get total revenue
      const revenue = await query(
        `SELECT COALESCE(SUM(ip.premium_amount), 0) as total FROM insurance_policies ip
         JOIN insurance_plans ipl ON ip.plan_id = ipl.id
         WHERE ipl.vendor_id = $1`,
        [vendorId]
      ).catch(() => ({ rows: [{ total: 0 }] }));

      return c.json({
        success: true,
        stats: {
          totalPlans: parseInt(plansCount.rows[0]?.count || 0),
          activePolicies: parseInt(policiesCount.rows[0]?.count || 0),
          pendingClaims: parseInt(claimsCount.rows[0]?.count || 0),
          totalRevenue: parseFloat(revenue.rows[0]?.total || 0),
        }
      });
    } catch (error: any) {
      console.error('Error fetching insurance stats:', error);
      return c.json({ 
        success: true, 
        stats: { totalPlans: 0, activePolicies: 0, pendingClaims: 0, totalRevenue: 0 } 
      });
    }
  });

  /**
   * POST /customer/insurance/purchase
   * Customer purchases an insurance policy
   */
  app.post("/customer/insurance/purchase", async (c) => {
    try {
      const body = await c.req.json();
      const { planId, petId, customerId, paymentId, paymentMethod } = body;

      if (!planId || !petId || !customerId) {
        return c.json({ success: false, error: 'planId, petId, and customerId are required' }, 400);
      }

      // Get plan details
      const plans = await query(
        `SELECT * FROM insurance_plans WHERE id = $1 AND is_active = true`,
        [planId]
      );

      if (plans.rows.length === 0) {
        return c.json({ success: false, error: 'Plan not found or inactive' }, 404);
      }

      const plan = plans.rows[0];

      // Generate policy number
      const policyNumber = `POL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Create policy
      const policy = await insert('insurance_policies', {
        policy_number: policyNumber,
        plan_id: planId,
        customer_id: customerId,
        pet_id: petId,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        premium_amount: plan.premium_yearly || plan.premium_monthly * 12,
        status: 'active',
        payment_id: paymentId,
        payment_method: paymentMethod || 'online',
      });

      return c.json({
        success: true,
        policy: policy[0],
        policyNumber,
        message: 'Policy purchased successfully',
      });
    } catch (error: any) {
      console.error('Error purchasing insurance:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/insurance/policies
   * Get policies managed by a vendor
   */
  app.get("/vendor/:vendorId/insurance/policies", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const policies = await query(
        `SELECT * FROM insurance_plans
         WHERE vendor_id = $1
         ORDER BY created_at DESC`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        policies: policies.rows,
        total: policies.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor policies:', error);
      return c.json({ success: true, policies: [], total: 0 });
    }
  });

  /**
   * POST /vendor/:vendorId/insurance/policies
   * Create a new insurance policy/plan
   */
  app.post("/vendor/:vendorId/insurance/policies", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const policyData = await c.req.json();

      const plan = await insert('insurance_plans', {
        vendor_id: vendorId,
        plan_name: policyData.name,
        description: policyData.description,
        coverage_type: policyData.coverage || 'basic',
        coverage_amount: parseFloat(policyData.coverage?.replace(/[^0-9.]/g, '') || '50000'),
        premium_monthly: policyData.price,
        premium_yearly: policyData.period === 'year' ? policyData.price : policyData.price * 12,
        coverage_details: { features: policyData.features || [] },
        waiting_period_days: parseInt(policyData.deductible || '30', 10),
        is_active: true,
      });

      return c.json({
        success: true,
        policy: plan[0],
        message: 'Policy created successfully',
      });
    } catch (error: any) {
      console.error('Error creating insurance policy:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/insurance/claims
   * Get claims for policies managed by a vendor
   */
  app.get("/vendor/:vendorId/insurance/claims", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const claims = await query(
        `SELECT ic.*, ip.policy_number, ipl.plan_name, p.name as pet_name
         FROM insurance_claims ic
         INNER JOIN insurance_policies ip ON ic.policy_id = ip.id
         INNER JOIN insurance_plans ipl ON ip.plan_id = ipl.id
         LEFT JOIN pets p ON ic.pet_id = p.id
         WHERE ipl.vendor_id = $1
         ORDER BY ic.created_at DESC`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        claims: claims.rows.map((c: any) => ({
          id: c.id,
          policyName: c.plan_name,
          petName: c.pet_name,
          status: c.status,
          amount: c.claim_amount,
          claimType: c.claim_type,
          createdAt: c.created_at,
        })),
        total: claims.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor claims:', error);
      return c.json({ success: true, claims: [], total: 0 });
    }
  });

  /**
   * GET /vendor/:vendorId/relocation/quotes
   * Get relocation quotes for a vendor
   */
  app.get("/vendor/:vendorId/relocation/quotes", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const quotes = await query(
        `SELECT b.*, c.name as customer_name, c.phone as customer_phone
         FROM bookings b
         LEFT JOIN customers c ON b.customer_id = c.id
         WHERE b.vendor_id = $1
         AND b.service_type IN ('pet_relocation', 'relocation')
         ORDER BY b.created_at DESC`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        quotes: quotes.rows.map((q: any) => ({
          id: q.id,
          customerName: q.customer_name,
          customerPhone: q.customer_phone,
          fromLocation: q.address,
          toLocation: q.destination_address,
          petCount: 1,
          distance: q.distance || 0,
          estimatedPrice: q.total_amount,
          status: q.status,
          createdAt: q.created_at,
        })),
        total: quotes.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching relocation quotes:', error);
      return c.json({ success: true, quotes: [], total: 0 });
    }
  });

  /**
   * PUT /vendor/:vendorId/relocation/quotes/:quoteId
   * Update a relocation quote status
   */
  app.put("/vendor/:vendorId/relocation/quotes/:quoteId", async (c) => {
    try {
      const { vendorId, quoteId } = c.req.param();
      const body = await c.req.json();

      const updateData: any = { updated_at: new Date() };
      if (body.status) updateData.status = body.status;
      if (body.finalPrice) updateData.total_amount = body.finalPrice;

      await update('bookings', { id: quoteId, vendor_id: vendorId }, updateData);

      return c.json({ success: true, message: 'Quote updated successfully' });
    } catch (error: any) {
      console.error('Error updating relocation quote:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

