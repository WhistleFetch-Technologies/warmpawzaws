/**
 * ============================================================================
 * ECOMMERCE CATEGORIES REPOSITORY
 * ============================================================================
 * 
 * Repository for ecommerce category data access.
 * Replaces: ecommerce:categories KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 1, Task 1.5 - KV to SQL
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface EcommerceCategory {
  id: string;
  name: string;
  description?: string | null;
  parent_category_id?: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateEcommerceCategoryInput {
  name: string;
  description?: string | null;
  parent_category_id?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export interface UpdateEcommerceCategoryInput {
  name?: string;
  description?: string | null;
  parent_category_id?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export class EcommerceCategoriesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findAll(options?: { isActive?: boolean }): Promise<EcommerceCategory[]> {
    const conditions: any = {};
    if (options?.isActive !== undefined) {
      conditions.is_active = options.isActive;
    }
    return selectQuery<EcommerceCategory>("ecommerce_categories", conditions, {
      orderBy: "display_order",
      orderDirection: "asc",
    });
  }

  async findById(categoryId: string): Promise<EcommerceCategory | null> {
    const results = await selectQuery<EcommerceCategory>("ecommerce_categories", { id: categoryId }, { limit: 1 });
    return results[0] || null;
  }

  async findByName(name: string): Promise<EcommerceCategory | null> {
    const results = await selectQuery<EcommerceCategory>("ecommerce_categories", { name }, { limit: 1 });
    return results[0] || null;
  }

  async create(input: CreateEcommerceCategoryInput): Promise<EcommerceCategory> {
    const results = await insertQuery<EcommerceCategory>("ecommerce_categories", {
      name: input.name,
      description: input.description || null,
      parent_category_id: input.parent_category_id || null,
      display_order: input.display_order || 0,
      is_active: input.is_active !== false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create category");
    }
    
    return results[0];
  }

  async update(categoryId: string, input: UpdateEcommerceCategoryInput): Promise<EcommerceCategory> {
    const updateData: any = {};
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.parent_category_id !== undefined) updateData.parent_category_id = input.parent_category_id;
    if (input.display_order !== undefined) updateData.display_order = input.display_order;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    
    const results = await updateQuery<EcommerceCategory>("ecommerce_categories", { id: categoryId }, updateData);
    
    if (!results[0]) {
      throw new Error(`Category not found: ${categoryId}`);
    }
    
    return results[0];
  }

  async delete(categoryId: string): Promise<void> {
    await deleteQuery("ecommerce_categories", { id: categoryId });
  }

  // Seed default categories if none exist
  async seedDefaultCategories(): Promise<void> {
    const existing = await this.findAll();
    if (existing.length > 0) {
      return; // Categories already exist
    }

    const defaultCategories = [
      { name: 'Pet Food', description: 'Pet food and nutrition', display_order: 1 },
      { name: 'Treats & Chews', description: 'Pet treats and chews', display_order: 2 },
      { name: 'Toys', description: 'Pet toys and entertainment', display_order: 3 },
      { name: 'Accessories', description: 'Collars, leashes, and accessories', display_order: 4 },
      { name: 'Clothing & Apparel', description: 'Pet clothing and apparel', display_order: 5 },
      { name: 'Bedding & Furniture', description: 'Pet beds and furniture', display_order: 6 },
      { name: 'Grooming Supplies', description: 'Grooming tools and supplies', display_order: 7 },
      { name: 'Healthcare & Wellness', description: 'Healthcare and wellness products', display_order: 8 },
      { name: 'Bowls & Feeders', description: 'Food and water bowls', display_order: 9 },
      { name: 'Litter & Accessories', description: 'Litter and litter accessories', display_order: 10 },
    ];

    for (const cat of defaultCategories) {
      await this.create(cat);
    }
  }
}

let repositoryInstance: EcommerceCategoriesRepository | null = null;

export function getEcommerceCategoriesRepository(): EcommerceCategoriesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new EcommerceCategoriesRepository();
  }
  return repositoryInstance;
}

