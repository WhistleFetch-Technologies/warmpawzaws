/**
 * ============================================================================
 * NUTRITIONIST DIET PLAN ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Rule 8 & 16: Nutritionist Consultation & Meal Planning
 * 
 * Features:
 * - Create personalized diet charts for pets
 * - Weekly schedule (Mon-Sun)
 * - Assign to specific pet/customer
 * - PDF generation (mock)
 * - History of plans
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `platform_settings` JSONB for diet plan storage
 * - Uses `VendorsRepository` and `PetsRepository` for validation
 * 
 * Date: 2025-01-28
 * Migration: Batch 9 - 12 KV operations → 0
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { upsertQuery } from '../../lib/db.ts';

export function nutritionistDietPlanEndpointsSQL(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';
  const db = getDbClient();
  const vendorsRepo = getVendorsRepository();

  /**
   * POST /nutritionist/diet-plan/create
   * Create a new diet plan for a pet
   */
  app.post(`${BASE_PATH}/nutritionist/diet-plan/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        nutritionistId,
        customerId,
        petId,
        title,
        startDate,
        endDate,
        goals,
        weeklySchedule,
        generalGuidelines,
        avoidList
      } = body;

      if (!nutritionistId || !customerId || !petId || !weeklySchedule) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get Nutritionist details
      const nutritionist = await vendorsRepo.findById(nutritionistId);
      if (!nutritionist) {
        return sendError(c, 'Nutritionist not found', 404);
      }

      // ✅ SQL: Get Pet details
      const { data: pet, error: petError } = await db
        .from('pets')
        .select('*')
        .eq('id', petId)
        .eq('customer_id', customerId)
        .maybeSingle();

      if (petError) throw petError;
      if (!pet) {
        return sendError(c, 'Pet not found', 404);
      }

      const planId = `DIET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const now = new Date().toISOString();

      const dietPlan = {
        planId,
        nutritionistId,
        nutritionistName: nutritionist.business_name || nutritionist.owner_name || 'Expert Nutritionist',
        customerId,
        petId,
        petName: pet.name || 'Pet',
        title: title || `Diet Plan for ${pet.name || 'Pet'}`,
        startDate: startDate || now,
        endDate: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        goals: goals || [],
        weeklySchedule,
        generalGuidelines: generalGuidelines || [],
        avoidList: avoidList || [],
        status: 'active',
        pdfUrl: `https://warmpawz-docs.s3.amazonaws.com/diet-plans/${planId}.pdf`,
        createdAt: now,
        updatedAt: now
      };

      // ✅ SQL: Store diet plan in platform_settings
      await upsertQuery('platform_settings', {
        setting_key: `diet_plan:${planId}`,
        setting_value: dietPlan,
        setting_type: 'object',
        updated_at: now
      }, 'setting_key');

      // ✅ SQL: Link to Customer (store plan IDs list)
      const { data: customerPlansData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `customer:${customerId}:diet_plans`)
        .maybeSingle();

      const customerPlans = customerPlansData?.setting_value?.plans || [];
      customerPlans.unshift(planId);

      await upsertQuery('platform_settings', {
        setting_key: `customer:${customerId}:diet_plans`,
        setting_value: { plans: customerPlans },
        setting_type: 'object',
        updated_at: now
      }, 'setting_key');

      // ✅ SQL: Link to Nutritionist
      const { data: nutritionistPlansData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `nutritionist:${nutritionistId}:diet_plans`)
        .maybeSingle();

      const nutritionistPlans = nutritionistPlansData?.setting_value?.plans || [];
      nutritionistPlans.unshift(planId);

      await upsertQuery('platform_settings', {
        setting_key: `nutritionist:${nutritionistId}:diet_plans`,
        setting_value: { plans: nutritionistPlans },
        setting_type: 'object',
        updated_at: now
      }, 'setting_key');

      console.log(`🥗 Diet plan created: ${planId} for ${petId}`);

      return sendSuccess(c, { plan: dietPlan }, 'Diet plan created successfully');
    } catch (error) {
      console.error('❌ Error creating diet plan:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /nutritionist/customer/:customerId/diet-plans
   * Get diet plans for a customer
   */
  app.get(`${BASE_PATH}/nutritionist/customer/:customerId/diet-plans`, async (c) => {
    try {
      const { customerId } = c.req.param();

      // ✅ SQL: Get customer's diet plan IDs
      const { data: customerPlansData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `customer:${customerId}:diet_plans`)
        .maybeSingle();

      const planIds = customerPlansData?.setting_value?.plans || [];

      // ✅ SQL: Get all diet plans
      const plans = [];
      for (const planId of planIds) {
        const { data: planData } = await db
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', `diet_plan:${planId}`)
          .maybeSingle();

        if (planData?.setting_value) {
          plans.push(planData.setting_value);
        }
      }

      return sendSuccess(c, { plans, count: plans.length });
    } catch (error) {
      console.error('❌ Error fetching diet plans:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /nutritionist/diet-plan/:planId
   * Get specific diet plan details
   */
  app.get(`${BASE_PATH}/nutritionist/diet-plan/:planId`, async (c) => {
    try {
      const { planId } = c.req.param();

      // ✅ SQL: Get diet plan
      const { data: planData, error } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `diet_plan:${planId}`)
        .maybeSingle();

      if (error) throw error;
      if (!planData?.setting_value) {
        return sendError(c, 'Diet plan not found', 404);
      }

      return sendSuccess(c, { plan: planData.setting_value });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /nutritionist/diet-plan/:planId
   * Update diet plan
   */
  app.put(`${BASE_PATH}/nutritionist/diet-plan/:planId`, async (c) => {
    try {
      const { planId } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Get existing plan
      const { data: planData, error: fetchError } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `diet_plan:${planId}`)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!planData?.setting_value) {
        return sendError(c, 'Diet plan not found', 404);
      }

      const updatedPlan = {
        ...planData.setting_value,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // ✅ SQL: Update diet plan
      await upsertQuery('platform_settings', {
        setting_key: `diet_plan:${planId}`,
        setting_value: updatedPlan,
        setting_type: 'object',
        updated_at: new Date().toISOString()
      }, 'setting_key');

      return sendSuccess(c, { plan: updatedPlan }, 'Diet plan updated');
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Nutritionist Diet Plan Endpoints registered (SQL-only)');
}
