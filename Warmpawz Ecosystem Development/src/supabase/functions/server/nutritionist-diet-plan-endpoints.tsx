import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

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

export function nutritionistDietPlanEndpoints(app: Hono, kv: any) {
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

      // Get Nutritionist details
      const nutritionist = await kv.get(`staff:${nutritionistId}`) || await kv.get(`vendor:${nutritionistId}`);
      // Get Pet details
      const pet = await kv.get(`pet:${petId}`); // Assuming pet key format

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

      await kv.set(`diet_plan:${planId}`, dietPlan);

      // Link to Customer
      const customerPlans = await kv.get(`customer:${customerId}:diet_plans`) || [];
      customerPlans.unshift(planId);
      await kv.set(`customer:${customerId}:diet_plans`, customerPlans);

      // Link to Nutritionist
      const nutritionistPlans = await kv.get(`nutritionist:${nutritionistId}:diet_plans`) || [];
      nutritionistPlans.unshift(planId);
      await kv.set(`nutritionist:${nutritionistId}:diet_plans`, nutritionistPlans);

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
      const planIds = await kv.get(`customer:${customerId}:diet_plans`) || [];
      
      const plans = [];
      for (const id of planIds) {
        const plan = await kv.get(`diet_plan:${id}`);
        if (plan) plans.push(plan);
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
      const plan = await kv.get(`diet_plan:${planId}`);
      
      if (!plan) return sendError(c, 'Diet plan not found', 404);

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
      
      const plan = await kv.get(`diet_plan:${planId}`);
      if (!plan) return sendError(c, 'Diet plan not found', 404);

      const updatedPlan = {
        ...plan,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`diet_plan:${planId}`, updatedPlan);
      
      return sendSuccess(c, { plan: updatedPlan }, 'Diet plan updated');
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Nutritionist Diet Plan Endpoints registered');
}
