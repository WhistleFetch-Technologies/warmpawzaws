/**
 * ============================================================================
 * ECOMMERCE COMMISSION SETTINGS REPOSITORY
 * ============================================================================
 * 
 * Repository for ecommerce commission settings data access.
 * Replaces: ecommerce:commission_settings KV key
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Singleton pattern - only one settings record
 * 
 * Date: 2024-12-23
 * ============================================================================
 */

import { getDbClient, selectQuery, updateQuery, insertQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface EcommerceCommissionSettings {
  id: string;
  setting_key: string;
  default_rate: number;
  rules: any[];
  vendor_tiers: any[];
  seller_rates: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface UpdateCommissionSettingsInput {
  default_rate?: number;
  rules?: any[];
  vendor_tiers?: any[];
  seller_rates?: Record<string, number>;
}

export class EcommerceCommissionSettingsRepository {
  private client: SupabaseClient;
  private readonly SETTING_KEY = 'default';

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get commission settings (singleton)
   */
  async getSettings(): Promise<EcommerceCommissionSettings> {
    const results = await selectQuery<any>("ecommerce_commission_settings", { setting_key: this.SETTING_KEY }, { limit: 1 });
    
    if (!results[0]) {
      // Create default settings if not exists
      return await this.createDefault();
    }
    
    return this.mapSettings(results[0]);
  }

  /**
   * Update commission settings
   */
  async updateSettings(input: UpdateCommissionSettingsInput): Promise<EcommerceCommissionSettings> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.default_rate !== undefined) updateData.default_rate = input.default_rate;
    if (input.rules !== undefined) updateData.rules = input.rules;
    if (input.vendor_tiers !== undefined) updateData.vendor_tiers = input.vendor_tiers;
    if (input.seller_rates !== undefined) updateData.seller_rates = input.seller_rates;
    
    const results = await updateQuery<any>(
      "ecommerce_commission_settings",
      { setting_key: this.SETTING_KEY },
      updateData
    );
    
    if (!results[0]) {
      // If update failed, create default and try again
      await this.createDefault();
      return this.updateSettings(input);
    }
    
    return this.mapSettings(results[0]);
  }

  /**
   * Get commission rate for a specific vendor
   */
  async getVendorCommissionRate(vendorId: string): Promise<number> {
    const settings = await this.getSettings();
    
    // Check seller-specific rate first
    if (settings.seller_rates && settings.seller_rates[vendorId]) {
      return settings.seller_rates[vendorId];
    }
    
    // Return default rate
    return settings.default_rate;
  }

  /**
   * Set commission rate for a specific vendor
   */
  async setVendorCommissionRate(vendorId: string, rate: number): Promise<void> {
    const settings = await this.getSettings();
    const sellerRates = { ...settings.seller_rates };
    sellerRates[vendorId] = rate;
    
    await this.updateSettings({ seller_rates: sellerRates });
  }

  /**
   * Create default settings
   */
  private async createDefault(): Promise<EcommerceCommissionSettings> {
    const results = await insertQuery<any>("ecommerce_commission_settings", {
      setting_key: this.SETTING_KEY,
      default_rate: 15.00,
      rules: [],
      vendor_tiers: [],
      seller_rates: {},
    });
    
    if (!results[0]) {
      throw new Error("Failed to create default commission settings");
    }
    
    return this.mapSettings(results[0]);
  }

  /**
   * Map database row to interface
   */
  private mapSettings(data: any): EcommerceCommissionSettings {
    return {
      id: data.id,
      setting_key: data.setting_key,
      default_rate: parseFloat(data.default_rate || '15.00'),
      rules: Array.isArray(data.rules) ? data.rules : (typeof data.rules === 'string' ? JSON.parse(data.rules) : []),
      vendor_tiers: Array.isArray(data.vendor_tiers) ? data.vendor_tiers : (typeof data.vendor_tiers === 'string' ? JSON.parse(data.vendor_tiers) : []),
      seller_rates: typeof data.seller_rates === 'object' && data.seller_rates !== null 
        ? data.seller_rates 
        : (typeof data.seller_rates === 'string' ? JSON.parse(data.seller_rates) : {}),
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: EcommerceCommissionSettingsRepository | null = null;

export function getEcommerceCommissionSettingsRepository(): EcommerceCommissionSettingsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new EcommerceCommissionSettingsRepository();
  }
  return repositoryInstance;
}

