/**
 * ============================================================================
 * PROMOTIONS REPOSITORY
 * ============================================================================
 * 
 * Repository for promotion data access.
 * Replaces: marketing:promotions KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Promotion {
  id: string;
  name: string;
  description?: string | null;
  promotion_type: string;
  discount_type?: string | null;
  discount_value?: number | null;
  min_order_amount?: number | null;
  max_discount_amount?: number | null;
  start_date: string;
  end_date: string;
  priority?: number | null;
  applicable_services?: string[] | null;
  applicable_roles?: string[] | null;
  usage_limit?: number | null;
  usage_count?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePromotionInput {
  name: string;
  description?: string;
  promotion_type: string;
  discount_type?: string;
  discount_value?: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  start_date: string;
  end_date: string;
  priority?: number;
  applicable_services?: string[];
  applicable_roles?: string[];
  usage_limit?: number;
  usage_count?: number;
  is_active?: boolean;
}

export class PromotionsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findAll(options?: { is_active?: boolean; limit?: number; offset?: number }): Promise<Promotion[]> {
    const filters: any = {};
    if (options?.is_active !== undefined) {
      filters.is_active = options.is_active;
    }
    
    return selectQuery<Promotion>("promotions", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async findById(promotionId: string): Promise<Promotion | null> {
    const results = await selectQuery<Promotion>("promotions", { id: promotionId }, { limit: 1 });
    return results[0] || null;
  }

  async findActive(filters?: { roleId?: string; serviceStyle?: string }): Promise<Promotion[]> {
    const now = new Date().toISOString().split('T')[0];
    
    let query = this.client
      .from("promotions")
      .select("*")
      .eq("is_active", true)
      .lte("start_date", now)
      .gte("end_date", now);
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Filter by roleId and serviceStyle if provided
    let promotions = (data || []) as Promotion[];
    
    if (filters?.roleId && filters.roleId !== 'all') {
      promotions = promotions.filter(p => {
        const roles = p.applicable_roles || [];
        return roles.length === 0 || roles.includes(filters.roleId!);
      });
    }
    
    if (filters?.serviceStyle && filters.serviceStyle !== 'all') {
      promotions = promotions.filter(p => {
        const services = p.applicable_services || [];
        return services.length === 0 || services.includes(filters.serviceStyle!);
      });
    }
    
    // Sort by priority (higher first)
    promotions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    return promotions;
  }

  async create(input: CreatePromotionInput): Promise<Promotion> {
    const results = await insertQuery<Promotion>("promotions", {
      name: input.name,
      description: input.description || null,
      promotion_type: input.promotion_type,
      discount_type: input.discount_type || null,
      discount_value: input.discount_value || null,
      min_order_amount: input.min_order_amount || null,
      max_discount_amount: input.max_discount_amount || null,
      start_date: input.start_date,
      end_date: input.end_date,
      priority: input.priority || 0,
      applicable_services: input.applicable_services || [],
      applicable_roles: input.applicable_roles || [],
      usage_limit: input.usage_limit || null,
      usage_count: input.usage_count || 0,
      is_active: input.is_active !== false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create promotion");
    }
    
    return results[0];
  }

  async update(promotionId: string, input: Partial<CreatePromotionInput>): Promise<Promotion> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.promotion_type !== undefined) updateData.promotion_type = input.promotion_type;
    if (input.discount_type !== undefined) updateData.discount_type = input.discount_type;
    if (input.discount_value !== undefined) updateData.discount_value = input.discount_value;
    if (input.min_order_amount !== undefined) updateData.min_order_amount = input.min_order_amount;
    if (input.max_discount_amount !== undefined) updateData.max_discount_amount = input.max_discount_amount;
    if (input.start_date !== undefined) updateData.start_date = input.start_date;
    if (input.end_date !== undefined) updateData.end_date = input.end_date;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.applicable_services !== undefined) updateData.applicable_services = input.applicable_services;
    if (input.applicable_roles !== undefined) updateData.applicable_roles = input.applicable_roles;
    if (input.usage_limit !== undefined) updateData.usage_limit = input.usage_limit;
    if (input.usage_count !== undefined) updateData.usage_count = input.usage_count;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    
    const results = await updateQuery<Promotion>(
      "promotions",
      { id: promotionId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Promotion not found: ${promotionId}`);
    }
    
    return results[0];
  }

  async delete(promotionId: string): Promise<void> {
    await updateQuery<Promotion>(
      "promotions",
      { id: promotionId },
      { is_active: false }
    );
  }
}

let repositoryInstance: PromotionsRepository | null = null;

export function getPromotionsRepository(): PromotionsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new PromotionsRepository();
  }
  return repositoryInstance;
}

