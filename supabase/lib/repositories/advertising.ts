/**
 * ============================================================================
 * ADVERTISING REPOSITORY
 * ============================================================================
 * 
 * Repository for advertising campaign data access.
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 2, Task 2.2 - Advertising Module
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface AdvertisingCampaign {
  id: string;
  vendor_id: string;
  campaign_name: string;
  campaign_type: 'ppc' | 'impression' | 'banner' | 'sponsored';
  budget_amount: number;
  spent_amount: number;
  daily_budget: number | null;
  cost_per_click: number | null;
  cost_per_impression: number | null;
  target_audience: any;
  target_keywords: string[];
  target_categories: string[];
  ad_creative: any;
  landing_url: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string | null;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  click_through_rate: number;
  conversion_rate: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignInput {
  vendor_id: string;
  campaign_name: string;
  campaign_type: 'ppc' | 'impression' | 'banner' | 'sponsored';
  budget_amount: number;
  daily_budget?: number | null;
  cost_per_click?: number | null;
  cost_per_impression?: number | null;
  target_audience?: any;
  target_keywords?: string[];
  target_categories?: string[];
  ad_creative: any;
  landing_url: string;
  start_date: string;
  end_date?: string | null;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
}

export interface AdImpression {
  id: string;
  campaign_id: string;
  vendor_id: string;
  impression_type: string;
  target_id: string | null;
  target_type: string | null;
  customer_id: string | null;
  session_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  location: any;
  impressed_at: string;
}

export interface AdClick {
  id: string;
  campaign_id: string;
  impression_id: string | null;
  vendor_id: string;
  click_type: string;
  target_id: string | null;
  target_type: string | null;
  customer_id: string | null;
  session_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;
  location: any;
  converted: boolean;
  conversion_type: string | null;
  conversion_value: number | null;
  converted_at: string | null;
  clicked_at: string;
}

export class AdvertisingRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  // ============================================
  // CAMPAIGNS
  // ============================================

  async findById(campaignId: string): Promise<AdvertisingCampaign | null> {
    const results = await selectQuery<AdvertisingCampaign>("advertising_campaigns", { id: campaignId }, { limit: 1 });
    return results[0] || null;
  }

  async findByVendor(vendorId: string, options?: { status?: string; limit?: number; offset?: number }): Promise<AdvertisingCampaign[]> {
    const filters: any = { vendor_id: vendorId };
    if (options?.status) {
      filters.status = options.status;
    }
    return selectQuery<AdvertisingCampaign>("advertising_campaigns", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async findActive(): Promise<AdvertisingCampaign[]> {
    const now = new Date().toISOString().split('T')[0];
    return selectQuery<AdvertisingCampaign>("advertising_campaigns", {
      status: 'active',
    }, {
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async create(input: CreateCampaignInput): Promise<AdvertisingCampaign> {
    const results = await insertQuery<AdvertisingCampaign>("advertising_campaigns", {
      vendor_id: input.vendor_id,
      campaign_name: input.campaign_name,
      campaign_type: input.campaign_type,
      budget_amount: input.budget_amount,
      spent_amount: 0,
      daily_budget: input.daily_budget || null,
      cost_per_click: input.cost_per_click || null,
      cost_per_impression: input.cost_per_impression || null,
      target_audience: input.target_audience || {},
      target_keywords: input.target_keywords || [],
      target_categories: input.target_categories || [],
      ad_creative: input.ad_creative,
      landing_url: input.landing_url,
      status: input.status || 'draft',
      start_date: input.start_date,
      end_date: input.end_date || null,
      total_impressions: 0,
      total_clicks: 0,
      total_conversions: 0,
      click_through_rate: 0,
      conversion_rate: 0,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create campaign");
    }
    
    return results[0];
  }

  async update(campaignId: string, input: Partial<CreateCampaignInput & { spent_amount?: number; total_impressions?: number; total_clicks?: number; total_conversions?: number; click_through_rate?: number; conversion_rate?: number }>): Promise<AdvertisingCampaign> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.campaign_name !== undefined) updateData.campaign_name = input.campaign_name;
    if (input.budget_amount !== undefined) updateData.budget_amount = input.budget_amount;
    if (input.daily_budget !== undefined) updateData.daily_budget = input.daily_budget;
    if (input.cost_per_click !== undefined) updateData.cost_per_click = input.cost_per_click;
    if (input.cost_per_impression !== undefined) updateData.cost_per_impression = input.cost_per_impression;
    if (input.target_audience !== undefined) updateData.target_audience = input.target_audience;
    if (input.target_keywords !== undefined) updateData.target_keywords = input.target_keywords;
    if (input.target_categories !== undefined) updateData.target_categories = input.target_categories;
    if (input.ad_creative !== undefined) updateData.ad_creative = input.ad_creative;
    if (input.landing_url !== undefined) updateData.landing_url = input.landing_url;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.start_date !== undefined) updateData.start_date = input.start_date;
    if (input.end_date !== undefined) updateData.end_date = input.end_date;
    if (input.spent_amount !== undefined) updateData.spent_amount = input.spent_amount;
    if (input.total_impressions !== undefined) updateData.total_impressions = input.total_impressions;
    if (input.total_clicks !== undefined) updateData.total_clicks = input.total_clicks;
    if (input.total_conversions !== undefined) updateData.total_conversions = input.total_conversions;
    if (input.click_through_rate !== undefined) updateData.click_through_rate = input.click_through_rate;
    if (input.conversion_rate !== undefined) updateData.conversion_rate = input.conversion_rate;
    
    const results = await updateQuery<AdvertisingCampaign>("advertising_campaigns", { id: campaignId }, updateData);
    
    if (!results[0]) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }
    
    return results[0];
  }

  async delete(campaignId: string): Promise<void> {
    await deleteQuery("advertising_campaigns", { id: campaignId });
  }

  // ============================================
  // IMPRESSIONS
  // ============================================

  async recordImpression(input: {
    campaign_id: string;
    vendor_id: string;
    impression_type: string;
    target_id?: string | null;
    target_type?: string | null;
    customer_id?: string | null;
    session_id?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    location?: any;
  }): Promise<AdImpression> {
    const results = await insertQuery<AdImpression>("ad_impressions", {
      campaign_id: input.campaign_id,
      vendor_id: input.vendor_id,
      impression_type: input.impression_type,
      target_id: input.target_id || null,
      target_type: input.target_type || null,
      customer_id: input.customer_id || null,
      session_id: input.session_id || null,
      ip_address: input.ip_address || null,
      user_agent: input.user_agent || null,
      location: input.location || null,
    });
    
    if (!results[0]) {
      throw new Error("Failed to record impression");
    }
    
    return results[0];
  }

  async getImpressions(campaignId: string, options?: { limit?: number; offset?: number }): Promise<AdImpression[]> {
    return selectQuery<AdImpression>("ad_impressions", { campaign_id: campaignId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "impressed_at",
      orderDirection: "desc",
    });
  }

  // ============================================
  // CLICKS
  // ============================================

  async recordClick(input: {
    campaign_id: string;
    impression_id?: string | null;
    vendor_id: string;
    click_type: string;
    target_id?: string | null;
    target_type?: string | null;
    customer_id?: string | null;
    session_id?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    referrer?: string | null;
    location?: any;
  }): Promise<AdClick> {
    const results = await insertQuery<AdClick>("ad_clicks", {
      campaign_id: input.campaign_id,
      impression_id: input.impression_id || null,
      vendor_id: input.vendor_id,
      click_type: input.click_type,
      target_id: input.target_id || null,
      target_type: input.target_type || null,
      customer_id: input.customer_id || null,
      session_id: input.session_id || null,
      ip_address: input.ip_address || null,
      user_agent: input.user_agent || null,
      referrer: input.referrer || null,
      location: input.location || null,
      converted: false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to record click");
    }
    
    return results[0];
  }

  async getClicks(campaignId: string, options?: { limit?: number; offset?: number }): Promise<AdClick[]> {
    return selectQuery<AdClick>("ad_clicks", { campaign_id: campaignId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "clicked_at",
      orderDirection: "desc",
    });
  }

  async markClickAsConverted(clickId: string, conversionType: string, conversionValue: number): Promise<AdClick> {
    const results = await updateQuery<AdClick>("ad_clicks", { id: clickId }, {
      converted: true,
      conversion_type: conversionType,
      conversion_value: conversionValue,
      converted_at: new Date().toISOString(),
    });
    
    if (!results[0]) {
      throw new Error(`Click not found: ${clickId}`);
    }
    
    return results[0];
  }

  // ============================================
  // BUDGET TRANSACTIONS
  // ============================================

  async recordBudgetTransaction(input: {
    campaign_id: string;
    vendor_id: string;
    transaction_type: 'click' | 'impression' | 'refund' | 'adjustment';
    amount: number;
    currency?: string;
    click_id?: string | null;
    impression_id?: string | null;
    description?: string | null;
  }): Promise<any> {
    const results = await insertQuery<any>("ad_budget_transactions", {
      campaign_id: input.campaign_id,
      vendor_id: input.vendor_id,
      transaction_type: input.transaction_type,
      amount: input.amount,
      currency: input.currency || 'INR',
      click_id: input.click_id || null,
      impression_id: input.impression_id || null,
      description: input.description || null,
    });
    
    if (!results[0]) {
      throw new Error("Failed to record budget transaction");
    }
    
    return results[0];
  }

  async getBudgetTransactions(campaignId: string, options?: { limit?: number; offset?: number }): Promise<any[]> {
    return selectQuery<any>("ad_budget_transactions", { campaign_id: campaignId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }
}

let repositoryInstance: AdvertisingRepository | null = null;

export function getAdvertisingRepository(): AdvertisingRepository {
  if (!repositoryInstance) {
    repositoryInstance = new AdvertisingRepository();
  }
  return repositoryInstance;
}

