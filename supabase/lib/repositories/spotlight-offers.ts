/**
 * ============================================================================
 * SPOTLIGHT OFFERS REPOSITORY
 * ============================================================================
 * 
 * Repository for spotlight offers data access.
 * Replaces: Hardcoded spotlight offers in customer app components
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

export interface SpotlightOffer {
  id: string;
  role_id: string;
  service_category?: string | null;
  title: string;
  subtitle?: string | null;
  discount_type: 'percentage' | 'fixed' | 'free';
  discount_value?: number | null;
  badge_text?: string | null;
  icon?: string | null;
  image_url?: string | null;
  cta_text: string;
  cta_link?: string | null;
  metadata?: any | null; // JSONB
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSpotlightOfferInput {
  role_id: string;
  service_category?: string;
  title: string;
  subtitle?: string;
  discount_type: 'percentage' | 'fixed' | 'free';
  discount_value?: number;
  badge_text?: string;
  icon?: string;
  image_url?: string;
  cta_text?: string;
  cta_link?: string;
  metadata?: any;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface SpotlightAnalytics {
  id: string;
  spotlight_id: string;
  customer_id?: string | null;
  event_type: 'view' | 'click' | 'apply';
  created_at: string;
}

export class SpotlightOffersRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findAll(options?: { 
    role_id?: string; 
    service_category?: string;
    is_active?: boolean; 
    limit?: number; 
    offset?: number 
  }): Promise<SpotlightOffer[]> {
    const filters: any = {};
    if (options?.role_id) filters.role_id = options.role_id;
    if (options?.service_category) filters.service_category = options.service_category;
    if (options?.is_active !== undefined) filters.is_active = options.is_active;
    
    return selectQuery<SpotlightOffer>("spotlight_offers", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "display_order",
      orderDirection: "asc",
    });
  }

  async findActiveByRole(roleId: string, serviceCategory?: string): Promise<SpotlightOffer[]> {
    const now = new Date().toISOString();
    
    let query = this.client
      .from("spotlight_offers")
      .select("*")
      .eq("role_id", roleId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    
    // Filter by date if provided
    query = query.or(`start_date.is.null,start_date.lte.${now}`);
    query = query.or(`end_date.is.null,end_date.gte.${now}`);
    
    if (serviceCategory) {
      query = query.or(`service_category.is.null,service_category.eq.${serviceCategory}`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return (data || []) as SpotlightOffer[];
  }

  async findById(spotlightId: string): Promise<SpotlightOffer | null> {
    const results = await selectQuery<SpotlightOffer>("spotlight_offers", { id: spotlightId }, { limit: 1 });
    return results[0] || null;
  }

  async create(input: CreateSpotlightOfferInput): Promise<SpotlightOffer> {
    const results = await insertQuery<SpotlightOffer>("spotlight_offers", {
      ...input,
      cta_text: input.cta_text || 'Book Now',
      is_active: input.is_active !== false,
      display_order: input.display_order || 0,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create spotlight offer");
    }
    
    return results[0];
  }

  async update(spotlightId: string, input: Partial<CreateSpotlightOfferInput>): Promise<SpotlightOffer> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.role_id !== undefined) updateData.role_id = input.role_id;
    if (input.service_category !== undefined) updateData.service_category = input.service_category;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.subtitle !== undefined) updateData.subtitle = input.subtitle;
    if (input.discount_type !== undefined) updateData.discount_type = input.discount_type;
    if (input.discount_value !== undefined) updateData.discount_value = input.discount_value;
    if (input.badge_text !== undefined) updateData.badge_text = input.badge_text;
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.image_url !== undefined) updateData.image_url = input.image_url;
    if (input.cta_text !== undefined) updateData.cta_text = input.cta_text;
    if (input.cta_link !== undefined) updateData.cta_link = input.cta_link;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;
    if (input.start_date !== undefined) updateData.start_date = input.start_date;
    if (input.end_date !== undefined) updateData.end_date = input.end_date;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.display_order !== undefined) updateData.display_order = input.display_order;
    
    const results = await updateQuery<SpotlightOffer>(
      "spotlight_offers",
      { id: spotlightId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Spotlight offer not found: ${spotlightId}`);
    }
    
    return results[0];
  }

  async delete(spotlightId: string): Promise<void> {
    // Soft delete
    await updateQuery<SpotlightOffer>(
      "spotlight_offers",
      { id: spotlightId },
      { is_active: false }
    );
  }

  async recordAnalytics(spotlightId: string, eventType: 'view' | 'click' | 'apply', customerId?: string): Promise<SpotlightAnalytics> {
    const results = await insertQuery<SpotlightAnalytics>("spotlight_analytics", {
      spotlight_id: spotlightId,
      customer_id: customerId || null,
      event_type: eventType,
    });
    
    if (!results[0]) {
      throw new Error("Failed to record analytics");
    }
    
    return results[0];
  }
}

let repositoryInstance: SpotlightOffersRepository | null = null;

export function getSpotlightOffersRepository(): SpotlightOffersRepository {
  if (!repositoryInstance) {
    repositoryInstance = new SpotlightOffersRepository();
  }
  return repositoryInstance;
}

