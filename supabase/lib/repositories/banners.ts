/**
 * ============================================================================
 * BANNERS REPOSITORY
 * ============================================================================
 * 
 * Repository for banner data access.
 * Replaces: content:banner:* KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Banner {
  id: string;
  type: 'main' | 'spotlight' | 'category' | 'service';
  title: string;
  subtitle?: string | null;
  image_url?: string | null;
  cta_text?: string | null;
  cta_link?: string | null;
  metadata?: any | null; // JSONB
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  display_order: number;
  target_role_id?: string | null;
  target_service_category?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBannerInput {
  type: 'main' | 'spotlight' | 'category' | 'service';
  title: string;
  subtitle?: string;
  image_url?: string;
  cta_text?: string;
  cta_link?: string;
  metadata?: any;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  display_order?: number;
  target_role_id?: string;
  target_service_category?: string;
}

export interface BannerAnalytics {
  id: string;
  banner_id: string;
  customer_id?: string | null;
  event_type: 'view' | 'click';
  user_agent?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export class BannersRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findAll(options?: { 
    type?: string; 
    is_active?: boolean; 
    target_role_id?: string;
    limit?: number; 
    offset?: number 
  }): Promise<Banner[]> {
    const filters: any = {};
    if (options?.type) filters.type = options.type;
    if (options?.is_active !== undefined) filters.is_active = options.is_active;
    if (options?.target_role_id) filters.target_role_id = options.target_role_id;
    
    return selectQuery<Banner>("banners", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "display_order",
      orderDirection: "asc",
    });
  }

  async findActiveByType(type: string, roleId?: string): Promise<Banner[]> {
    const now = new Date().toISOString();
    
    let query = this.client
      .from("banners")
      .select("*")
      .eq("type", type)
      .eq("is_active", true);
    
    // Filter by date range - banners are active if:
    // - start_date is null OR start_date <= now
    // - end_date is null OR end_date >= now
    query = query.or(`start_date.is.null,start_date.lte.${now}`);
    query = query.or(`end_date.is.null,end_date.gte.${now}`);
    
    // Filter by role if provided
    if (roleId) {
      query = query.or(`target_role_id.is.null,target_role_id.eq.${roleId}`);
    }
    
    query = query.order("display_order", { ascending: true });
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Additional client-side filtering for date ranges (Supabase OR doesn't work as expected for this)
    const filtered = (data || []).filter((banner: any) => {
      const startOk = !banner.start_date || new Date(banner.start_date) <= new Date(now);
      const endOk = !banner.end_date || new Date(banner.end_date) >= new Date(now);
      const roleOk = !roleId || !banner.target_role_id || banner.target_role_id === roleId;
      return startOk && endOk && roleOk;
    });
    
    return filtered as Banner[];
  }

  async findById(bannerId: string): Promise<Banner | null> {
    const results = await selectQuery<Banner>("banners", { id: bannerId }, { limit: 1 });
    return results[0] || null;
  }

  async create(input: CreateBannerInput): Promise<Banner> {
    const results = await insertQuery<Banner>("banners", {
      ...input,
      is_active: input.is_active !== false,
      display_order: input.display_order || 0,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create banner");
    }
    
    return results[0];
  }

  async update(bannerId: string, input: Partial<CreateBannerInput>): Promise<Banner> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.type !== undefined) updateData.type = input.type;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.subtitle !== undefined) updateData.subtitle = input.subtitle;
    if (input.image_url !== undefined) updateData.image_url = input.image_url;
    if (input.cta_text !== undefined) updateData.cta_text = input.cta_text;
    if (input.cta_link !== undefined) updateData.cta_link = input.cta_link;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;
    if (input.start_date !== undefined) updateData.start_date = input.start_date;
    if (input.end_date !== undefined) updateData.end_date = input.end_date;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.display_order !== undefined) updateData.display_order = input.display_order;
    if (input.target_role_id !== undefined) updateData.target_role_id = input.target_role_id;
    if (input.target_service_category !== undefined) updateData.target_service_category = input.target_service_category;
    
    const results = await updateQuery<Banner>(
      "banners",
      { id: bannerId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Banner not found: ${bannerId}`);
    }
    
    return results[0];
  }

  async delete(bannerId: string): Promise<void> {
    // Soft delete
    await updateQuery<Banner>(
      "banners",
      { id: bannerId },
      { is_active: false }
    );
  }

  async recordAnalytics(bannerId: string, eventType: 'view' | 'click', customerId?: string, metadata?: { user_agent?: string; ip_address?: string }): Promise<BannerAnalytics> {
    const results = await insertQuery<BannerAnalytics>("banner_analytics", {
      banner_id: bannerId,
      customer_id: customerId || null,
      event_type: eventType,
      user_agent: metadata?.user_agent || null,
      ip_address: metadata?.ip_address || null,
    });
    
    if (!results[0]) {
      throw new Error("Failed to record analytics");
    }
    
    return results[0];
  }
}

let repositoryInstance: BannersRepository | null = null;

export function getBannersRepository(): BannersRepository {
  if (!repositoryInstance) {
    repositoryInstance = new BannersRepository();
  }
  return repositoryInstance;
}

