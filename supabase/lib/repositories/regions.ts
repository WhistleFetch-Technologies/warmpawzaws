/**
 * Regions Repository
 * SQL-only data access for regions
 */

import { getDbClient } from '../db.ts';

export interface Region {
  id: string;
  name: string;
  code: string;
  country?: string;
  region_config?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function getRegionsRepository() {
  const client = getDbClient();

  return {
    /**
     * Find all regions
     */
    async findAll(): Promise<Region[]> {
      const { data, error } = await client
        .from('regions')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    /**
     * Find active regions only
     */
    async findActive(): Promise<Region[]> {
      const { data, error } = await client
        .from('regions')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    /**
     * Find region by ID
     */
    async findById(regionId: string): Promise<Region | null> {
      const { data, error } = await client
        .from('regions')
        .select('*')
        .eq('code', regionId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    /**
     * Find region by code
     */
    async findByCode(code: string): Promise<Region | null> {
      const { data, error } = await client
        .from('regions')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    /**
     * Create a new region
     */
    async create(regionData: Partial<Region> & { country_code?: string; currency_code?: string; currency_symbol?: string; timezone?: string }): Promise<Region> {
      // ✅ Extract config data and map to actual columns
      const config = regionData.region_config || {};
      const currency = config.currency || {};
      const localization = config.localization || {};
      
      const { data, error } = await client
        .from('regions')
        .insert({
          id: regionData.code || regionData.id, // Use code as id
          name: regionData.name!,
          code: regionData.code!,
          country_code: regionData.country_code || 'IND',
          currency_code: regionData.currency_code || currency.code || 'INR',
          currency_symbol: regionData.currency_symbol || currency.symbol || '₹',
          timezone: regionData.timezone || localization.timezone || 'Asia/Kolkata',
          business_hours: config.business || {},
          tax_config: { taxRate: config.business?.taxRate || 0, taxName: config.business?.taxName || 'GST' },
          is_active: regionData.is_active ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      // ✅ Reconstruct region with config for backward compatibility
      return {
        ...data,
        region_config: regionData.region_config || {},
      } as Region;
    },

    /**
     * Update a region
     */
    async update(regionId: string, updates: Partial<Region>): Promise<Region> {
      const { data, error } = await client
        .from('regions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('code', regionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Activate/deactivate a region
     */
    async setActive(regionId: string, isActive: boolean): Promise<Region> {
      return this.update(regionId, { is_active: isActive });
    },
  };
}

