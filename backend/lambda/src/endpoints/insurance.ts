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
 * Migrated from: supabase/functions/server/insurance-endpoints.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';

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
}

