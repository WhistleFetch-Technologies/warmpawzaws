/**
 * ============================================================================
 * PRICING RULES REPOSITORY
 * ============================================================================
 * 
 * Repository for boarding pricing rules.
 * Replaces: vendor:{id}:boarding_pricing KV keys
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

export interface PricingRule {
  id: string;
  vendor_id: string;
  room_id: string;
  room_name: string;
  base_night_price: number;
  size_based_pricing: any; // JSONB {small, medium, large, extraLarge}
  seasonal_pricing: any; // JSONB array
  special_offers: any; // JSONB array
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePricingRuleInput {
  vendor_id: string;
  room_id: string;
  room_name: string;
  base_night_price: number;
  size_based_pricing?: any;
  seasonal_pricing?: any;
  special_offers?: any;
  is_active?: boolean;
}

export class PricingRulesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findByVendor(vendorId: string, options?: { is_active?: boolean }): Promise<PricingRule[]> {
    const filters: any = { vendor_id: vendorId };
    if (options?.is_active !== undefined) {
      filters.is_active = options.is_active;
    }
    
    return selectQuery<PricingRule>("pricing_rules", filters, {
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async findByRoom(roomId: string): Promise<PricingRule[]> {
    return selectQuery<PricingRule>("pricing_rules", { room_id: roomId }, {
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async findById(ruleId: string): Promise<PricingRule | null> {
    const results = await selectQuery<PricingRule>("pricing_rules", { id: ruleId }, { limit: 1 });
    return results[0] || null;
  }

  async create(input: CreatePricingRuleInput): Promise<PricingRule> {
    const results = await insertQuery<PricingRule>("pricing_rules", {
      ...input,
      size_based_pricing: input.size_based_pricing || {
        small: input.base_night_price,
        medium: input.base_night_price,
        large: input.base_night_price,
        extraLarge: input.base_night_price
      },
      seasonal_pricing: input.seasonal_pricing || [],
      special_offers: input.special_offers || [],
      is_active: input.is_active !== false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create pricing rule");
    }
    
    return results[0];
  }

  async update(ruleId: string, input: Partial<CreatePricingRuleInput>): Promise<PricingRule> {
    const results = await updateQuery<PricingRule>(
      "pricing_rules",
      { id: ruleId },
      {
        ...input,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Pricing rule not found: ${ruleId}`);
    }
    
    return results[0];
  }

  async delete(ruleId: string): Promise<void> {
    await updateQuery<PricingRule>(
      "pricing_rules",
      { id: ruleId },
      { is_active: false }
    );
  }
}

let repositoryInstance: PricingRulesRepository | null = null;

export function getPricingRulesRepository(): PricingRulesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new PricingRulesRepository();
  }
  return repositoryInstance;
}

