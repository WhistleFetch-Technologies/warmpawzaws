// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import {
  getStaffRepository,
  getVendorsRepository,
  getPetsRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

/**
 * 🥗 NUTRITIONIST DIET PLAN ENDPOINTS
 * 
 * Rule 8 & 16: Nutritionist Consultation & Meal Planning
 * 
 * Features:
 * - Create personalized diet charts for pets
 * - Weekly schedule (Mon-Sun)
 * - Assign to specific pet/customer
 * - PDF generation (mock)
 * - History of plans
 */

interface DietMeal {
  time: string; // "8:00 AM"
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: string[];
  portion: string;
  notes?: string;
}

interface DailyDiet {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  meals: DietMeal[];
  waterIntake: string;
  supplements?: string[];
}

interface DietPlan {
  planId: string;
  nutritionistId: string;
  nutritionistName: string;
  customerId: string;
  petId: string;
  petName: string;
  title: string;
  startDate: string;
  endDate: string;
  goals: string[]; // "Weight Loss", "Allergy Management"
  weeklySchedule: DailyDiet[];
  generalGuidelines: string[];
  avoidList: string[];
  status: 'active' | 'archived';
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export function nutritionistDietPlanEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

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
      const staffRepo = getStaffRepository();
      const vendorsRepo = getVendorsRepository();
      let nutritionist = await staffRepo.findById(nutritionistId);
      if (!nutritionist) {
        nutritionist = await vendorsRepo.findById(nutritionistId);
      }
      
      // ✅ SQL: Get Pet details
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);

      const planId = `DIET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const dietPlan: DietPlan = {
        planId,
        nutritionistId,
        nutritionistName: nutritionist?.name || nutritionist?.businessName || 'Expert Nutritionist',
        customerId,
        petId,
        petName: pet?.name || 'Pet',
        title: title || `Diet Plan for ${pet?.name || 'Pet'}`,
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        goals: goals || [],
        weeklySchedule,
        generalGuidelines: generalGuidelines || [],
        avoidList: avoidList || [],
        status: 'active',
        // Mock PDF URL
        pdfUrl: `https://warmpawz-docs.s3.amazonaws.com/diet-plans/${planId}.pdf`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // ✅ SQL: Store diet plan
      const db = getDbClient();
      await db.from('diet_plans').insert({
        id: planId,
        nutritionist_id: nutritionistId,
        nutritionist_name: nutritionist?.name || nutritionist?.business_name || nutritionist?.businessName || 'Expert Nutritionist',
        customer_id: customerId,
        pet_id: petId,
        pet_name: pet?.name || 'Pet',
        title: title || `Diet Plan for ${pet?.name || 'Pet'}`,
        start_date: startDate || new Date().toISOString(),
        end_date: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        goals: goals || [],
        weekly_schedule: weeklySchedule,
        general_guidelines: generalGuidelines || [],
        avoid_list: avoidList || [],
        status: 'active',
        pdf_url: `https://warmpawz-docs.s3.amazonaws.com/diet-plans/${planId}.pdf`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

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
      // ✅ SQL: Get diet plans for customer
      const db = getDbClient();
      const { data: plans } = await db
        .from('diet_plans')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      // Map to expected format
      const mappedPlans = (plans || []).map((p: any) => ({
        planId: p.id,
        nutritionistId: p.nutritionist_id,
        nutritionistName: p.nutritionist_name,
        customerId: p.customer_id,
        petId: p.pet_id,
        petName: p.pet_name,
        title: p.title,
        startDate: p.start_date,
        endDate: p.end_date,
        goals: p.goals,
        weeklySchedule: p.weekly_schedule,
        generalGuidelines: p.general_guidelines,
        avoidList: p.avoid_list,
        status: p.status,
        pdfUrl: p.pdf_url,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));
      
      return sendSuccess(c, { plans: mappedPlans, count: mappedPlans.length });
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
      // ✅ SQL: Get diet plan (already replaced above in previous endpoint, this was duplicate)
      const db = getDbClient();
      const { data: planData } = await db
        .from('diet_plans')
        .select('*')
        .eq('id', planId)
        .single();
      
      if (!planData) return sendError(c, 'Diet plan not found', 404);
      
      // Map to expected format
      const plan = {
        planId: planData.id,
        nutritionistId: planData.nutritionist_id,
        nutritionistName: planData.nutritionist_name,
        customerId: planData.customer_id,
        petId: planData.pet_id,
        petName: planData.pet_name,
        title: planData.title,
        startDate: planData.start_date,
        endDate: planData.end_date,
        goals: planData.goals,
        weeklySchedule: planData.weekly_schedule,
        generalGuidelines: planData.general_guidelines,
        avoidList: planData.avoid_list,
        status: planData.status,
        pdfUrl: planData.pdf_url,
        createdAt: planData.created_at,
        updatedAt: planData.updated_at
      };

      return sendSuccess(c, { plan });
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
      
      // ✅ SQL: Update diet plan
      const db = getDbClient();
      const { data: existingPlan } = await db
        .from('diet_plans')
        .select('*')
        .eq('id', planId)
        .single();
      
      if (!existingPlan) return sendError(c, 'Diet plan not found', 404);

      await db.from('diet_plans')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId);
      
      const { data: updatedPlanData } = await db
        .from('diet_plans')
        .select('*')
        .eq('id', planId)
        .single();
      
      // Map to expected format
      const updatedPlan = {
        planId: updatedPlanData.id,
        nutritionistId: updatedPlanData.nutritionist_id,
        nutritionistName: updatedPlanData.nutritionist_name,
        customerId: updatedPlanData.customer_id,
        petId: updatedPlanData.pet_id,
        petName: updatedPlanData.pet_name,
        title: updatedPlanData.title,
        startDate: updatedPlanData.start_date,
        endDate: updatedPlanData.end_date,
        goals: updatedPlanData.goals,
        weeklySchedule: updatedPlanData.weekly_schedule,
        generalGuidelines: updatedPlanData.general_guidelines,
        avoidList: updatedPlanData.avoid_list,
        status: updatedPlanData.status,
        pdfUrl: updatedPlanData.pdf_url,
        createdAt: updatedPlanData.created_at,
        updatedAt: updatedPlanData.updated_at
      };
      
      return sendSuccess(c, { plan: updatedPlan }, 'Diet plan updated');
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Nutritionist Diet Plan Endpoints registered');
}
