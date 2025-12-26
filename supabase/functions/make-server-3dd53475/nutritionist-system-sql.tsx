/**
 * 🥗 NUTRITIONIST SYSTEM - SQL-ONLY VERSION
 * 
 * Phase 7B: Critical Services Implementation
 * Business Rule 8 Compliance: Nutritionist + Food Delivery
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Features:
 * - Nutritionist consultation booking
 * - Meal plan creation and management
 * - Customer meal plan access
 * - Consultation scheduling
 * - Video call integration
 * - Nutritional goal tracking
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (21 KV operations → 0)
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from '../../lib/db.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getMealPlansRepository } from '../../lib/repositories/meal-plans.ts';

export function nutritionistSystemEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const db = getDbClient();
  const bookingsRepo = getBookingsRepository();
  const mealPlansRepo = getMealPlansRepository();

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

      const scheduledDate = new Date(scheduledAt);
      const bookingDate = scheduledDate.toISOString().split('T')[0];
      const bookingTime = scheduledDate.toTimeString().slice(0, 5);

      // ✅ SQL: Create booking (consultation)
      const booking = await bookingsRepo.create({
        customer_id: customerId,
        vendor_id: nutritionistId,
        service_id: 'nutritionist_consultation',
        booking_date: bookingDate,
        booking_time: bookingTime,
        service_type: 'nutritionist_consultation',
        address: nutritionistId, // Vendor location
        base_price: 0,
        total_amount: 0,
        payment_status: 'pending',
        metadata: {
          consultationType,
          petId,
          scheduledAt
        }
      });

      console.log(`✅ Nutritionist consultation booked: ${booking.id}`);

      return sendSuccess(c, {
        consultation: {
          consultationId: booking.id,
          customerId: booking.customer_id,
          nutritionistId: booking.vendor_id,
          petId: booking.metadata?.petId,
          consultationType: booking.metadata?.consultationType,
          scheduledAt: booking.metadata?.scheduledAt,
          status: 'scheduled',
          createdAt: booking.created_at,
          updatedAt: booking.updated_at
        }
      }, 'Consultation booked successfully');
    } catch (error) {
      console.error('Error booking consultation:', error);
      return sendError(c, error, 500);
    }
  });

  // Get consultation details
  app.get(`${BASE_PATH}/nutritionist/consultation/:consultationId`, async (c) => {
    try {
      const consultationId = c.req.param('consultationId');

      // ✅ SQL: Get booking (consultation)
      const booking = await bookingsRepo.findById(consultationId);

      if (!booking || booking.service_type !== 'nutritionist_consultation') {
        return sendError(c, 'Consultation not found', 404);
      }

      return sendSuccess(c, {
        consultation: {
          consultationId: booking.id,
          customerId: booking.customer_id,
          nutritionistId: booking.vendor_id,
          petId: booking.metadata?.petId,
          consultationType: booking.metadata?.consultationType,
          scheduledAt: booking.metadata?.scheduledAt,
          status: booking.status,
          notes: booking.metadata?.notes,
          recommendations: booking.metadata?.recommendations,
          videoCallUrl: booking.metadata?.videoCallUrl,
          createdAt: booking.created_at,
          updatedAt: booking.updated_at
        }
      });
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

      // ✅ SQL: Get booking
      const booking = await bookingsRepo.findById(consultationId);
      if (!booking || booking.service_type !== 'nutritionist_consultation') {
        return sendError(c, 'Consultation not found', 404);
      }

      // ✅ SQL: Update booking
      const metadata = booking.metadata || {};
      if (notes) metadata.notes = notes;
      if (recommendations) metadata.recommendations = recommendations;
      if (videoCallUrl) metadata.videoCallUrl = videoCallUrl;

      await bookingsRepo.update(consultationId, {
        status: status || booking.status,
        metadata
      });

      console.log(`✅ Consultation ${consultationId} status updated to: ${status}`);

      return sendSuccess(c, {
        consultation: {
          consultationId: booking.id,
          status: status || booking.status,
          notes: metadata.notes,
          recommendations: metadata.recommendations,
          videoCallUrl: metadata.videoCallUrl
        }
      }, 'Consultation updated successfully');
    } catch (error) {
      console.error('Error updating consultation:', error);
      return sendError(c, error, 500);
    }
  });

  // Get customer consultations
  app.get(`${BASE_PATH}/customer/:customerId/consultations`, async (c) => {
    try {
      const customerId = c.req.param('customerId');

      // ✅ SQL: Get bookings (consultations) for customer
      const bookings = await bookingsRepo.findByCustomer(customerId);
      const consultations = bookings
        .filter(b => b.service_type === 'nutritionist_consultation')
        .map(booking => ({
          consultationId: booking.id,
          customerId: booking.customer_id,
          nutritionistId: booking.vendor_id,
          petId: booking.metadata?.petId,
          consultationType: booking.metadata?.consultationType,
          scheduledAt: booking.metadata?.scheduledAt,
          status: booking.status,
          notes: booking.metadata?.notes,
          recommendations: booking.metadata?.recommendations,
          videoCallUrl: booking.metadata?.videoCallUrl,
          createdAt: booking.created_at,
          updatedAt: booking.updated_at
        }));

      return sendSuccess(c, { consultations });
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

      // ✅ SQL: Create meal plan
      const mealPlan = await mealPlansRepo.create({
        vendor_id: nutritionistId,
        plan_name: planName,
        description: description || '',
        meals: meals || [],
        nutritional_goals: nutritionalGoals || {},
        is_active: true,
        metadata: {
          customerId,
          petId,
          startDate,
          endDate,
          specialInstructions,
          status: 'active'
        }
      });

      console.log(`✅ Meal plan created: ${mealPlan.id}`);

      return sendSuccess(c, {
        mealPlan: {
          planId: mealPlan.id,
          customerId,
          petId,
          nutritionistId: mealPlan.vendor_id,
          planName: mealPlan.plan_name,
          description: mealPlan.description,
          startDate,
          endDate,
          meals: mealPlan.meals,
          nutritionalGoals: mealPlan.nutritional_goals,
          specialInstructions: mealPlan.metadata?.specialInstructions,
          status: mealPlan.metadata?.status || 'active',
          createdAt: mealPlan.created_at,
          updatedAt: mealPlan.updated_at
        }
      }, 'Meal plan created successfully');
    } catch (error) {
      console.error('Error creating meal plan:', error);
      return sendError(c, error, 500);
    }
  });

  // Get meal plan
  app.get(`${BASE_PATH}/nutritionist/meal-plan/:planId`, async (c) => {
    try {
      const planId = c.req.param('planId');

      // ✅ SQL: Get meal plan
      const mealPlan = await mealPlansRepo.findById(planId);

      if (!mealPlan) {
        return sendError(c, 'Meal plan not found', 404);
      }

      return sendSuccess(c, {
        mealPlan: {
          planId: mealPlan.id,
          customerId: mealPlan.metadata?.customerId,
          petId: mealPlan.metadata?.petId,
          nutritionistId: mealPlan.vendor_id,
          planName: mealPlan.plan_name,
          description: mealPlan.description,
          startDate: mealPlan.metadata?.startDate,
          endDate: mealPlan.metadata?.endDate,
          meals: mealPlan.meals,
          nutritionalGoals: mealPlan.nutritional_goals,
          specialInstructions: mealPlan.metadata?.specialInstructions,
          status: mealPlan.metadata?.status || 'active',
          createdAt: mealPlan.created_at,
          updatedAt: mealPlan.updated_at
        }
      });
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

      // ✅ SQL: Get meal plan
      const mealPlan = await mealPlansRepo.findById(planId);
      if (!mealPlan) {
        return sendError(c, 'Meal plan not found', 404);
      }

      // ✅ SQL: Update meal plan
      const updateData: any = {};
      if (updates.planName) updateData.plan_name = updates.planName;
      if (updates.description) updateData.description = updates.description;
      if (updates.meals) updateData.meals = updates.meals;
      if (updates.nutritionalGoals) updateData.nutritional_goals = updates.nutritionalGoals;
      
      const metadata = mealPlan.metadata || {};
      if (updates.startDate) metadata.startDate = updates.startDate;
      if (updates.endDate) metadata.endDate = updates.endDate;
      if (updates.specialInstructions) metadata.specialInstructions = updates.specialInstructions;
      if (updates.status) metadata.status = updates.status;
      updateData.metadata = metadata;

      await mealPlansRepo.update(planId, updateData);

      console.log(`✅ Meal plan ${planId} updated`);

      return sendSuccess(c, {
        mealPlan: {
          planId,
          ...updates,
          updatedAt: new Date().toISOString()
        }
      }, 'Meal plan updated successfully');
    } catch (error) {
      console.error('Error updating meal plan:', error);
      return sendError(c, error, 500);
    }
  });

  // Delete meal plan
  app.delete(`${BASE_PATH}/nutritionist/meal-plan/:planId`, async (c) => {
    try {
      const planId = c.req.param('planId');

      // ✅ SQL: Mark as discontinued
      const mealPlan = await mealPlansRepo.findById(planId);
      if (!mealPlan) {
        return sendError(c, 'Meal plan not found', 404);
      }

      const metadata = mealPlan.metadata || {};
      metadata.status = 'discontinued';

      await mealPlansRepo.update(planId, {
        is_active: false,
        metadata
      });

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

      // ✅ SQL: Get all meal plans and filter by customer
      const { data: mealPlans } = await db
        .from('meal_plans')
        .select('*')
        .eq('is_active', true);

      const customerPlans = mealPlans
        ?.filter((plan: any) => plan.metadata?.customerId === customerId && plan.metadata?.status !== 'discontinued')
        .map((plan: any) => ({
          planId: plan.id,
          customerId: plan.metadata?.customerId,
          petId: plan.metadata?.petId,
          nutritionistId: plan.vendor_id,
          planName: plan.plan_name,
          description: plan.description,
          startDate: plan.metadata?.startDate,
          endDate: plan.metadata?.endDate,
          meals: plan.meals,
          nutritionalGoals: plan.nutritional_goals,
          specialInstructions: plan.metadata?.specialInstructions,
          status: plan.metadata?.status || 'active',
          createdAt: plan.created_at,
          updatedAt: plan.updated_at
        })) || [];

      return sendSuccess(c, { mealPlans: customerPlans });
    } catch (error) {
      console.error('Error getting customer meal plans:', error);
      return sendError(c, error, 500);
    }
  });

  // Get nutritionist's meal plans
  app.get(`${BASE_PATH}/nutritionist/:nutritionistId/meal-plans`, async (c) => {
    try {
      const nutritionistId = c.req.param('nutritionistId');

      // ✅ SQL: Get meal plans by vendor (nutritionist)
      const mealPlans = await mealPlansRepo.findByVendor(nutritionistId);

      return sendSuccess(c, {
        mealPlans: mealPlans.map(plan => ({
          planId: plan.id,
          customerId: plan.metadata?.customerId,
          petId: plan.metadata?.petId,
          nutritionistId: plan.vendor_id,
          planName: plan.plan_name,
          description: plan.description,
          startDate: plan.metadata?.startDate,
          endDate: plan.metadata?.endDate,
          meals: plan.meals,
          nutritionalGoals: plan.nutritional_goals,
          specialInstructions: plan.metadata?.specialInstructions,
          status: plan.metadata?.status || 'active',
          createdAt: plan.created_at,
          updatedAt: plan.updated_at
        }))
      });
    } catch (error) {
      console.error('Error getting nutritionist meal plans:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Nutritionist System endpoints registered (SQL-only)');
}

