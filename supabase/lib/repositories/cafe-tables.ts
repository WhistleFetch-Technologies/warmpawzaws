/**
 * ============================================================================
 * CAFE TABLES REPOSITORY
 * ============================================================================
 * 
 * Repository for cafe tables data access.
 * Replaces: cafe:table:{id}, vendor:{id}:tables KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface CafeTable {
  id: string;
  vendorId: string;
  tableNumber: string;
  name?: string;
  capacity: number;
  section: string;
  location: string;
  isOutdoor: boolean;
  amenities: any[];
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCafeTableInput {
  vendorId: string;
  tableNumber: string;
  name?: string;
  capacity: number;
  section?: string;
  location?: string;
  isOutdoor?: boolean;
  amenities?: any[];
  status?: string;
  isActive?: boolean;
}

export class CafeTablesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get table by ID
   */
  async findById(tableId: string): Promise<CafeTable | null> {
    try {
      const { data, error } = await this.client
        .from('cafe_tables')
        .select('*')
        .eq('id', tableId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapTableFromDb(data);
    } catch (error) {
      console.error('Error fetching cafe table:', error);
      return null;
    }
  }

  /**
   * Get tables by vendor
   */
  async findByVendor(vendorId: string, options?: { isActive?: boolean; status?: string }): Promise<CafeTable[]> {
    try {
      let query = this.client
        .from('cafe_tables')
        .select('*')
        .eq('vendor_id', vendorId);

      if (options?.isActive !== undefined) {
        query = query.eq('is_active', options.isActive);
      } else {
        query = query.eq('is_active', true);
      }

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      query = query.order('table_number', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching vendor cafe tables:', error);
        return [];
      }

      return (data || []).map(this.mapTableFromDb);
    } catch (error) {
      console.error('Error in findByVendor:', error);
      return [];
    }
  }

  /**
   * Create table
   */
  async create(input: CreateCafeTableInput): Promise<CafeTable> {
    try {
      const insertData: any = {
        vendor_id: input.vendorId,
        table_number: input.tableNumber,
        name: input.name || null,
        capacity: input.capacity,
        section: input.section || 'Main Area',
        location: input.location || 'Indoor',
        is_outdoor: input.isOutdoor || false,
        amenities: input.amenities || [],
        status: input.status || 'available',
        is_active: input.isActive !== undefined ? input.isActive : true,
      };

      const { data, error } = await this.client
        .from('cafe_tables')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapTableFromDb(data);
    } catch (error) {
      console.error('Error creating cafe table:', error);
      throw error;
    }
  }

  /**
   * Update table
   */
  async update(tableId: string, updates: Partial<CreateCafeTableInput>): Promise<CafeTable | null> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.capacity !== undefined) updateData.capacity = updates.capacity;
      if (updates.section !== undefined) updateData.section = updates.section;
      if (updates.location !== undefined) updateData.location = updates.location;
      if (updates.isOutdoor !== undefined) updateData.is_outdoor = updates.isOutdoor;
      if (updates.amenities !== undefined) updateData.amenities = updates.amenities;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

      const { data, error } = await this.client
        .from('cafe_tables')
        .update(updateData)
        .eq('id', tableId)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapTableFromDb(data);
    } catch (error) {
      console.error('Error updating cafe table:', error);
      return null;
    }
  }

  /**
   * Delete table (soft delete by setting is_active to false)
   */
  async delete(tableId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('cafe_tables')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', tableId);

      if (error) {
        console.error('Error deleting cafe table:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in delete:', error);
      return false;
    }
  }

  /**
   * Map database row to CafeTable
   */
  private mapTableFromDb(row: any): CafeTable {
    return {
      id: row.id,
      vendorId: row.vendor_id,
      tableNumber: row.table_number,
      name: row.name || undefined,
      capacity: row.capacity,
      section: row.section || 'Main Area',
      location: row.location || 'Indoor',
      isOutdoor: row.is_outdoor || false,
      amenities: row.amenities || [],
      status: row.status || 'available',
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

let cafeTablesRepositoryInstance: CafeTablesRepository | null = null;

export function getCafeTablesRepository(): CafeTablesRepository {
  if (!cafeTablesRepositoryInstance) {
    cafeTablesRepositoryInstance = new CafeTablesRepository();
  }
  return cafeTablesRepositoryInstance;
}
