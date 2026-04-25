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

import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

function toMaybeNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Prefer a positive premium; many legacy rows only populated monthly_premium (019) */
function pickDisplayedPremium(row: Record<string, unknown>): number {
  const candidates = [
    toMaybeNum(row.premium_monthly),
    toMaybeNum(row.monthly_premium),
    toMaybeNum(row.premium),
    toMaybeNum((row as { premiumMonthly?: unknown }).premiumMonthly),
    toMaybeNum((row as { monthlyPremium?: unknown }).monthlyPremium),
  ];
  for (const n of candidates) {
    if (n != null && n > 0) return n;
  }
  for (const n of candidates) {
    if (n != null) return n;
  }
  return 0;
}

function parseCoverageDetailsJson(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return typeof o === 'object' && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Normalize row for vendor GET so UI always gets premium, deductible, coverage_details */
function shapeVendorInsurancePlanRow(r: Record<string, unknown>): Record<string, unknown> {
  const cd = parseCoverageDetailsJson(r.coverage_details);
  const premium = pickDisplayedPremium(r);
  const deductible = toMaybeNum(r.deductible) ?? 0;
  const coverageAmount =
    toMaybeNum(r.coverage_amount) ??
    toMaybeNum((r as { coverageAmount?: unknown }).coverageAmount) ??
    0;

  return {
    ...r,
    coverage_details: cd,
    premium_monthly: premium,
    monthly_premium: premium,
    deductible,
    coverage_amount: coverageAmount,
  };
}

/** Merge vendor UI fields into coverage_details JSONB */
function buildInsuranceCoverageDetails(
  planData: Record<string, unknown>,
  previous: Record<string, unknown> | null
): Record<string, unknown> {
  const prev = previous && typeof previous === 'object' ? { ...previous } : {};
  const features = planData.features !== undefined
    ? (Array.isArray(planData.features) ? planData.features : [])
    : Array.isArray(prev.features)
      ? prev.features
      : [];
  const pet_types = planData.pet_types !== undefined
    ? (Array.isArray(planData.pet_types) ? planData.pet_types : [])
    : Array.isArray(prev.pet_types)
      ? prev.pet_types
      : [];
  const out: Record<string, unknown> = { ...prev, features, pet_types };
  if (planData.age_min !== undefined) out.age_min = planData.age_min;
  if (planData.age_max !== undefined) out.age_max = planData.age_max;
  return out;
}

/** Migration 019: plan_type CHECK (accident_only | time_limited | maximum_benefit | lifetime) */
function legacyInsurancePlanType(raw: unknown): string {
  const t = String(raw ?? 'lifetime')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const allowed = new Set(['accident_only', 'time_limited', 'maximum_benefit', 'lifetime']);
  if (allowed.has(t)) return t;
  if (t.includes('comprehen')) return 'lifetime';
  if (t.includes('accident')) return 'accident_only';
  if (t.includes('time') && t.includes('limit')) return 'time_limited';
  if (t.includes('maximum') || t.includes('max_benefit')) return 'maximum_benefit';
  return 'lifetime';
}

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
        plansQuery += ` AND (coverage_type = $${paramIndex} OR plan_type = $${paramIndex})`;
        params.push(type);
        paramIndex++;
      }

      if (minCoverage > 0) {
        plansQuery += ` AND coverage_amount >= $${paramIndex}`;
        params.push(minCoverage);
        paramIndex++;
      }

      if (maxPremium < 999999) {
        plansQuery += ` AND COALESCE(monthly_premium, premium_monthly) <= $${paramIndex}`;
        params.push(maxPremium);
        paramIndex++;
      }

      plansQuery += ` ORDER BY COALESCE(monthly_premium, premium_monthly) ASC NULLS LAST`;

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
      let premium = parseFloat(String(plan.premium_monthly ?? plan.monthly_premium ?? '0'));
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
        `SELECT p.*,
                COALESCE(pl.plan_name, pl.name) AS plan_name,
                pl.provider,
                COALESCE(pl.coverage_type, pl.plan_type) AS plan_type
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
         INNER JOIN insurance_plans ipl ON ip.plan_id = ipl.id
         LEFT JOIN customers c ON ip.customer_id = c.id
         WHERE ipl.vendor_id = $1
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

      // Policies are tied to plans; filter by issuing vendor via plan.vendor_id (not p.vendor_id).
      const policies = await query(
        `SELECT p.*,
                ipl.plan_name AS plan_name,
                c.full_name AS customer_name,
                pt.name AS pet_name
         FROM insurance_policies p
         INNER JOIN insurance_plans ipl ON p.plan_id = ipl.id
         LEFT JOIN customers c ON p.customer_id = c.id
         LEFT JOIN pets pt ON p.pet_id = pt.id
         WHERE ipl.vendor_id = $1
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

      const shaped = (plans.rows || []).map((row: Record<string, unknown>) =>
        shapeVendorInsurancePlanRow(row)
      );

      return c.json({
        success: true,
        plans: shaped,
        total: shaped.length,
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

      const legacyPlanId =
        planData.plan_id != null && String(planData.plan_id).trim() !== ''
          ? String(planData.plan_id).trim()
          : randomUUID();

      const monthly =
        Number(planData.price ?? planData.premium ?? planData.premium_monthly ?? 0) || 0;
      const yearly =
        Number(planData.premium_yearly ?? 0) || (monthly ? monthly * 12 : 0) || 0;
      const deductibleNum =
        parseFloat(String(planData.deductible ?? '0').replace(/[^0-9.]/g, '')) || 0;
      const coverageAmount = parseFloat(
        String(planData.coverage || planData.coverage_amount || '50000').replace(/[^0-9.]/g, '')
      );

      const coverage_details = buildInsuranceCoverageDetails(planData as Record<string, unknown>, null);

      const plan = await insert('insurance_plans', {
        // Legacy 019: plan_id TEXT NOT NULL (separate from UUID primary key id)
        plan_id: legacyPlanId,
        vendor_id: vendorId,
        plan_name: planData.name || planData.plan_name,
        description: planData.description,
        coverage_type: planData.coverageType || planData.coverage_type || 'basic',
        coverage_amount: coverageAmount,
        premium_monthly: monthly || Number(planData.premium_monthly) || 0,
        premium_yearly: yearly,
        coverage_details,
        waiting_period_days: parseInt(planData.waitingPeriod || planData.waiting_period_days || '30', 10),
        is_active: planData.isActive !== false,
        // Legacy 019 NOT NULL columns (no UI field for provider / 019 plan_type)
        provider: String(planData.provider || 'Vendor').trim() || 'Vendor',
        plan_type: legacyInsurancePlanType(
          planData.planType || planData.plan_type || planData.category || 'comprehensive'
        ),
        coverage: {},
        monthly_premium: monthly,
        annual_premium: yearly || monthly * 12,
        deductible: deductibleNum,
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

      const existing = await query(
        `SELECT coverage_details FROM insurance_plans WHERE id = $1::uuid AND vendor_id = $2::uuid`,
        [planId, vendorId]
      );
      if (!existing.rows?.length) {
        return c.json({ success: false, error: 'Plan not found' }, 404);
      }

      const prevDetails = existing.rows[0].coverage_details as Record<string, unknown> | null;
      const coverage_details = buildInsuranceCoverageDetails(planData as Record<string, unknown>, prevDetails);

      const premiumMonthly =
        planData.premium !== undefined || planData.price !== undefined || planData.premium_monthly !== undefined
          ? Number(planData.premium ?? planData.price ?? planData.premium_monthly ?? 0) || 0
          : undefined;
      const premiumYearly =
        planData.premium_yearly !== undefined
          ? Number(planData.premium_yearly)
          : premiumMonthly !== undefined
            ? premiumMonthly * 12
            : undefined;

      const coverageAmount =
        planData.coverage_amount !== undefined || planData.coverage !== undefined
          ? parseFloat(
              String(planData.coverage_amount ?? planData.coverage ?? '0').replace(/[^0-9.]/g, '')
            )
          : undefined;

      const deductibleNum =
        planData.deductible !== undefined && planData.deductible !== null
          ? parseFloat(String(planData.deductible).replace(/[^0-9.]/g, '')) || 0
          : undefined;

      const updated = await update('insurance_plans', { id: planId, vendor_id: vendorId }, {
        plan_name: planData.name || planData.plan_name,
        description: planData.description,
        coverage_type: planData.coverageType || planData.coverage_type,
        coverage_amount: coverageAmount,
        premium_monthly: premiumMonthly,
        premium_yearly: premiumYearly,
        monthly_premium: premiumMonthly,
        annual_premium: premiumYearly,
        deductible: deductibleNum,
        coverage_details,
        waiting_period_days:
          planData.waitingPeriod !== undefined
            ? parseInt(String(planData.waitingPeriod), 10)
            : planData.waiting_period_days !== undefined
              ? parseInt(String(planData.waiting_period_days), 10)
              : undefined,
        is_active: planData.isActive,
        plan_type:
          planData.plan_type !== undefined || planData.planType !== undefined
            ? legacyInsurancePlanType(planData.plan_type ?? planData.planType)
            : undefined,
        updated_at: new Date().toISOString(),
      });

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
         WHERE ipl.vendor_id = $1
           AND ic.status IN ('pending', 'submitted', 'under_review')`,
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
        `SELECT p.*,
                ipl.plan_name AS plan_name,
                c.full_name AS customer_name,
                pt.name AS pet_name
         FROM insurance_policies p
         INNER JOIN insurance_plans ipl ON p.plan_id = ipl.id
         LEFT JOIN customers c ON p.customer_id = c.id
         LEFT JOIN pets pt ON p.pet_id = pt.id
         WHERE ipl.vendor_id = $1
         ORDER BY p.created_at DESC`,
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

      const legacyPlanId =
        policyData.plan_id != null && String(policyData.plan_id).trim() !== ''
          ? String(policyData.plan_id).trim()
          : randomUUID();

      const monthly = Number(policyData.price ?? policyData.premium ?? policyData.premium_monthly ?? 0) || 0;
      const yearly =
        policyData.period === 'year'
          ? monthly
          : monthly * 12 || Number(policyData.premium_yearly ?? 0) || 0;
      const deductibleNum =
        parseFloat(String(policyData.deductible ?? '0').replace(/[^0-9.]/g, '')) || 0;

      const coverage_details = buildInsuranceCoverageDetails(policyData as Record<string, unknown>, null);

      const plan = await insert('insurance_plans', {
        plan_id: legacyPlanId,
        vendor_id: vendorId,
        plan_name: policyData.name,
        description: policyData.description,
        coverage_type: policyData.coverage || 'basic',
        coverage_amount: parseFloat(policyData.coverage?.replace(/[^0-9.]/g, '') || '50000'),
        premium_monthly: monthly,
        premium_yearly: yearly,
        coverage_details,
        waiting_period_days: parseInt(policyData.waitingPeriod || policyData.waiting_period_days || '30', 10),
        is_active: true,
        provider: String(policyData.provider || 'Vendor').trim() || 'Vendor',
        plan_type: legacyInsurancePlanType(
          policyData.planType || policyData.plan_type || policyData.category || 'comprehensive'
        ),
        coverage: {},
        monthly_premium: monthly,
        annual_premium: yearly || monthly * 12,
        deductible: deductibleNum,
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

