/**
 * ============================================================================
 * MEAL PLANS REPOSITORY
 * ============================================================================
 * 
 * Repository for nutritionist meal plans management.
 * Replaces: vendor:{id}:nutritionist:meal_plans KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface MealPlan {
  id: string;
  vendor_id: string;
  plan_name: string;
  description?: string;
  meals: any[];
  nutritional_goals: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMealPlanInput {
  vendor_id: string;
  plan_name: string;
  description?: string;
  meals?: any[];
  nutritional_goals?: any;
  is_active?: boolean;
}

export class MealPlansRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findByVendor(vendorId: string): Promise<MealPlan[]> {
    return selectQuery<MealPlan>("meal_plans", 
      { vendor_id: vendorId }, 
      { orderBy: "created_at", orderDirection: "desc" }
    );
  }

  async findById(planId: string): Promise<MealPlan | null> {
    const results = await selectQuery<MealPlan>("meal_plans", 
      { id: planId }, 
      { limit: 1 }
    );
    return results[0] || null;
  }

  async create(input: CreateMealPlanInput): Promise<MealPlan> {
    const results = await insertQuery<MealPlan>("meal_plans", {
      ...input,
      meals: input.meals || [],
      nutritional_goals: input.nutritional_goals || {},
      is_active: input.is_active !== false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create meal plan");
    }
    
    return results[0];
  }

  async update(planId: string, updates: Partial<CreateMealPlanInput>): Promise<MealPlan> {
    const results = await updateQuery<MealPlan>(
      "meal_plans",
      { id: planId },
      {
        ...updates,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Meal plan not found: ${planId}`);
    }
    
    return results[0];
  }
}

let repositoryInstance: MealPlansRepository | null = null;

export function getMealPlansRepository(client?: SupabaseClient): MealPlansRepository {
  if (!repositoryInstance) {
    repositoryInstance = new MealPlansRepository(client);
  }
  return repositoryInstance;
}

