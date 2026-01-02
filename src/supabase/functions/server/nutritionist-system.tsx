import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 🥗 NUTRITIONIST SYSTEM
 * 
 * Phase 7B: Critical Services Implementation
 * Business Rule 8 Compliance: Nutritionist + Food Delivery
 * 
 * Features:
 * - Nutritionist consultation booking
 * - Meal plan creation and management
 * - Customer meal plan access
 * - Consultation scheduling
 * - Video call integration
 * - Nutritional goal tracking
 */

interface NutritionistConsultation {
  consultationId: string;
  customerId: string;
  nutritionistId: string;
  petId: string;
  consultationType: 'initial' | 'follow_up' | 'emergency';
  scheduledAt: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  recommendations?: string;
  videoCallUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface MealPlan {
  planId: string;
  customerId: string;
  petId: string;
  nutritionistId: string;
  planName: string;
  description: string;
  startDate: string;
  endDate: string;
  meals: Array<{
    day: string;
    breakfast?: MealItem;
    lunch?: MealItem;
    dinner?: MealItem;
    snacks?: MealItem[];
  }>;
  nutritionalGoals: {
    calories?: number;
    protein?: number;
    fat?: number;
    carbs?: number;
  };
  specialInstructions?: string;
  status: 'active' | 'completed' | 'discontinued';
  createdAt: string;
  updatedAt: string;
}

interface MealItem {
  itemName: string;
  quantity: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  instructions?: string;
}

export function nutritionistSystemEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // NUTRITIONIST CONSULTATION ENDPOINTS
  // ========================================

  // Book nutritionist consultation
  app.post(`${BASE_PATH}/nutritionist/consultation/book`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        nutritionistId,
        petId,
        consultationType = 'initial',
        scheduledAt
      } = body;

      if (!customerId || !nutritionistId || !petId || !scheduledAt) {
        return sendError(c, 'customerId, nutritionistId, petId, and scheduledAt are required', 400);
      }

      const consultationId = `consultation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const consultation: NutritionistConsultation = {
        consultationId,
        customerId,
        nutritionistId,
        petId,
        consultationType,
        scheduledAt,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`nutritionist_consultation_${consultationId}`, consultation);

      // Also store in customer's consultation list
      const customerConsultations = await kv.get(`customer_consultations_${customerId}`) || [];
      customerConsultations.push(consultationId);
      await kv.set(`customer_consultations_${customerId}`, customerConsultations);

      // Store in nutritionist's consultation list
      const nutritionistConsultations = await kv.get(`nutritionist_consultations_${nutritionistId}`) || [];
      nutritionistConsultations.push(consultationId);
      await kv.set(`nutritionist_consultations_${nutritionistId}`, nutritionistConsultations);

      console.log(`✅ Nutritionist consultation booked: ${consultationId}`);

      return sendSuccess(c, { consultation }, 'Consultation booked successfully');
    } catch (error) {
      console.error('Error booking consultation:', error);
      return sendError(c, error, 500);
    }
  });

  // Get consultation details
  app.get(`${BASE_PATH}/nutritionist/consultation/:consultationId`, async (c) => {
    try {
      const consultationId = c.req.param('consultationId');

      const consultation = await kv.get(`nutritionist_consultation_${consultationId}`);

      if (!consultation) {
        return sendError(c, 'Consultation not found', 404);
      }

      return sendSuccess(c, { consultation });
    } catch (error) {
      console.error('Error getting consultation:', error);
      return sendError(c, error, 500);
    }
  });

  // Update consultation status
  app.put(`${BASE_PATH}/nutritionist/consultation/:consultationId/status`, async (c) => {
    try {
      const consultationId = c.req.param('consultationId');
      const { status, notes, recommendations, videoCallUrl } = await c.req.json();

      const consultation = await kv.get(`nutritionist_consultation_${consultationId}`);

      if (!consultation) {
        return sendError(c, 'Consultation not found', 404);
      }

      // Update consultation
      const updated: NutritionistConsultation = {
        ...consultation,
        status: status || consultation.status,
        notes: notes || consultation.notes,
        recommendations: recommendations || consultation.recommendations,
        videoCallUrl: videoCallUrl || consultation.videoCallUrl,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`nutritionist_consultation_${consultationId}`, updated);

      console.log(`✅ Consultation ${consultationId} status updated to: ${status}`);

      return sendSuccess(c, { consultation: updated }, 'Consultation updated successfully');
    } catch (error) {
      console.error('Error updating consultation:', error);
      return sendError(c, error, 500);
    }
  });

  // Get customer consultations
  app.get(`${BASE_PATH}/customer/:customerId/consultations`, async (c) => {
    try {
      const customerId = c.req.param('customerId');

      const consultationIds = await kv.get(`customer_consultations_${customerId}`) || [];

      const consultations = await Promise.all(
        consultationIds.map((id: string) => kv.get(`nutritionist_consultation_${id}`))
      );

      return sendSuccess(c, { consultations: consultations.filter(Boolean) });
    } catch (error) {
      console.error('Error getting customer consultations:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // MEAL PLAN ENDPOINTS
  // ========================================

  // Create meal plan
  app.post(`${BASE_PATH}/nutritionist/meal-plan/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        petId,
        nutritionistId,
        planName,
        description,
        startDate,
        endDate,
        meals,
        nutritionalGoals,
        specialInstructions
      } = body;

      if (!customerId || !petId || !nutritionistId || !planName || !startDate || !endDate) {
        return sendError(c, 'Required fields missing', 400);
      }

      const planId = `mealplan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const mealPlan: MealPlan = {
        planId,
        customerId,
        petId,
        nutritionistId,
        planName,
        description,
        startDate,
        endDate,
        meals: meals || [],
        nutritionalGoals: nutritionalGoals || {},
        specialInstructions,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`meal_plan_${planId}`, mealPlan);

      // Store in customer's meal plan list
      const customerMealPlans = await kv.get(`customer_meal_plans_${customerId}`) || [];
      customerMealPlans.push(planId);
      await kv.set(`customer_meal_plans_${customerId}`, customerMealPlans);

      console.log(`✅ Meal plan created: ${planId}`);

      return sendSuccess(c, { mealPlan }, 'Meal plan created successfully');
    } catch (error) {
      console.error('Error creating meal plan:', error);
      return sendError(c, error, 500);
    }
  });

  // Get meal plan
  app.get(`${BASE_PATH}/nutritionist/meal-plan/:planId`, async (c) => {
    try {
      const planId = c.req.param('planId');

      const mealPlan = await kv.get(`meal_plan_${planId}`);

      if (!mealPlan) {
        return sendError(c, 'Meal plan not found', 404);
      }

      return sendSuccess(c, { mealPlan });
    } catch (error) {
      console.error('Error getting meal plan:', error);
      return sendError(c, error, 500);
    }
  });

  // Update meal plan
  app.put(`${BASE_PATH}/nutritionist/meal-plan/:planId`, async (c) => {
    try {
      const planId = c.req.param('planId');
      const updates = await c.req.json();

      const mealPlan = await kv.get(`meal_plan_${planId}`);

      if (!mealPlan) {
        return sendError(c, 'Meal plan not found', 404);
      }

      const updated: MealPlan = {
        ...mealPlan,
        ...updates,
        planId, // Prevent ID change
        updatedAt: new Date().toISOString()
      };

      await kv.set(`meal_plan_${planId}`, updated);

      console.log(`✅ Meal plan ${planId} updated`);

      return sendSuccess(c, { mealPlan: updated }, 'Meal plan updated successfully');
    } catch (error) {
      console.error('Error updating meal plan:', error);
      return sendError(c, error, 500);
    }
  });

  // Delete meal plan
  app.delete(`${BASE_PATH}/nutritionist/meal-plan/:planId`, async (c) => {
    try {
      const planId = c.req.param('planId');

      const mealPlan = await kv.get(`meal_plan_${planId}`);

      if (!mealPlan) {
        return sendError(c, 'Meal plan not found', 404);
      }

      // Mark as discontinued instead of deleting
      const updated: MealPlan = {
        ...mealPlan,
        status: 'discontinued',
        updatedAt: new Date().toISOString()
      };

      await kv.set(`meal_plan_${planId}`, updated);

      console.log(`✅ Meal plan ${planId} discontinued`);

      return sendSuccess(c, {}, 'Meal plan discontinued successfully');
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      return sendError(c, error, 500);
    }
  });

  // Get customer meal plans
  app.get(`${BASE_PATH}/customer/:customerId/meal-plans`, async (c) => {
    try {
      const customerId = c.req.param('customerId');

      const planIds = await kv.get(`customer_meal_plans_${customerId}`) || [];

      const mealPlans = await Promise.all(
        planIds.map((id: string) => kv.get(`meal_plan_${id}`))
      );

      // Filter out discontinued plans by default
      const activePlans = mealPlans.filter((plan: any) => plan && plan.status !== 'discontinued');

      return sendSuccess(c, { mealPlans: activePlans });
    } catch (error) {
      console.error('Error getting customer meal plans:', error);
      return sendError(c, error, 500);
    }
  });

  // Get nutritionist's meal plans
  app.get(`${BASE_PATH}/nutritionist/:nutritionistId/meal-plans`, async (c) => {
    try {
      const nutritionistId = c.req.param('nutritionistId');

      // Get all meal plans and filter by nutritionist
      const allPlans = await kv.getByPrefix('meal_plan_');
      
      const nutritionistPlans = allPlans
        .map((item: any) => item.value || item)
        .filter((plan: any) => plan.nutritionistId === nutritionistId);

      return sendSuccess(c, { mealPlans: nutritionistPlans });
    } catch (error) {
      console.error('Error getting nutritionist meal plans:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Nutritionist System endpoints registered');
}
