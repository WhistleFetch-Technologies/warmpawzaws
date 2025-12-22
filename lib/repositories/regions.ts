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
    async create(regionData: Partial<Region>): Promise<Region> {
      const { data, error } = await client
        .from('regions')
        .insert({
          name: regionData.name!,
          code: regionData.code!,
          country: regionData.country || 'India',
          region_config: regionData.region_config || {},
          is_active: regionData.is_active ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
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

