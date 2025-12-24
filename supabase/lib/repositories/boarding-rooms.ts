/**
 * ============================================================================
 * BOARDING ROOMS REPOSITORY
 * ============================================================================
 * 
 * Repository for boarding rooms data access.
 * Replaces: vendor:{id}:boarding_rooms KV keys
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

export interface BoardingRoom {
  id: string;
  vendorId: string;
  name: string;
  description?: string;
  dayPrice: number;
  nightPrice: number;
  capacity: number;
  petTypes: string[];
  amenities: any[];
  included: any[];
  notIncluded: any[];
  photos: string[];
  videos: string[];
  size?: string;
  features?: string;
  rules?: string;
  isActive: boolean;
  totalUnits: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBoardingRoomInput {
  vendorId: string;
  name: string;
  description?: string;
  dayPrice: number;
  nightPrice: number;
  capacity?: number;
  petTypes?: string[];
  amenities?: any[];
  included?: any[];
  notIncluded?: any[];
  photos?: string[];
  videos?: string[];
  size?: string;
  features?: string;
  rules?: string;
  isActive?: boolean;
  totalUnits?: number;
}

export class BoardingRoomsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get room by ID
   */
  async findById(roomId: string): Promise<BoardingRoom | null> {
    try {
      const { data, error } = await this.client
        .from('boarding_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapRoomFromDb(data);
    } catch (error) {
      console.error('Error fetching boarding room:', error);
      return null;
    }
  }

  /**
   * Get rooms by vendor
   */
  async findByVendor(vendorId: string, options?: { isActive?: boolean }): Promise<BoardingRoom[]> {
    try {
      let query = this.client
        .from('boarding_rooms')
        .select('*')
        .eq('vendor_id', vendorId);

      if (options?.isActive !== undefined) {
        query = query.eq('is_active', options.isActive);
      } else {
        query = query.eq('is_active', true);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching vendor boarding rooms:', error);
        return [];
      }

      return (data || []).map(this.mapRoomFromDb);
    } catch (error) {
      console.error('Error in findByVendor:', error);
      return [];
    }
  }

  /**
   * Create room
   */
  async create(input: CreateBoardingRoomInput): Promise<BoardingRoom> {
    try {
      const insertData: any = {
        vendor_id: input.vendorId,
        name: input.name,
        description: input.description || null,
        day_price: input.dayPrice,
        night_price: input.nightPrice,
        capacity: input.capacity || 1,
        pet_types: input.petTypes || ['dog', 'cat'],
        amenities: input.amenities || [],
        included: input.included || [],
        not_included: input.notIncluded || [],
        photos: input.photos || [],
        videos: input.videos || [],
        size: input.size || null,
        features: input.features || null,
        rules: input.rules || null,
        is_active: input.isActive !== undefined ? input.isActive : true,
        total_units: input.totalUnits || 1,
      };

      const { data, error } = await this.client
        .from('boarding_rooms')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapRoomFromDb(data);
    } catch (error) {
      console.error('Error creating boarding room:', error);
      throw error;
    }
  }

  /**
   * Update room
   */
  async update(roomId: string, updates: Partial<CreateBoardingRoomInput>): Promise<BoardingRoom | null> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.dayPrice !== undefined) updateData.day_price = updates.dayPrice;
      if (updates.nightPrice !== undefined) updateData.night_price = updates.nightPrice;
      if (updates.capacity !== undefined) updateData.capacity = updates.capacity;
      if (updates.petTypes !== undefined) updateData.pet_types = updates.petTypes;
      if (updates.amenities !== undefined) updateData.amenities = updates.amenities;
      if (updates.included !== undefined) updateData.included = updates.included;
      if (updates.notIncluded !== undefined) updateData.not_included = updates.notIncluded;
      if (updates.photos !== undefined) updateData.photos = updates.photos;
      if (updates.videos !== undefined) updateData.videos = updates.videos;
      if (updates.size !== undefined) updateData.size = updates.size;
      if (updates.features !== undefined) updateData.features = updates.features;
      if (updates.rules !== undefined) updateData.rules = updates.rules;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.totalUnits !== undefined) updateData.total_units = updates.totalUnits;

      const { data, error } = await this.client
        .from('boarding_rooms')
        .update(updateData)
        .eq('id', roomId)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapRoomFromDb(data);
    } catch (error) {
      console.error('Error updating boarding room:', error);
      return null;
    }
  }

  /**
   * Delete room (soft delete by setting is_active to false)
   */
  async delete(roomId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('boarding_rooms')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', roomId);

      if (error) {
        console.error('Error deleting boarding room:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in delete:', error);
      return false;
    }
  }

  /**
   * Map database row to BoardingRoom
   */
  private mapRoomFromDb(row: any): BoardingRoom {
    return {
      id: row.id,
      vendorId: row.vendor_id,
      name: row.name,
      description: row.description || undefined,
      dayPrice: parseFloat(row.day_price),
      nightPrice: parseFloat(row.night_price),
      capacity: row.capacity || 1,
      petTypes: row.pet_types || [],
      amenities: row.amenities || [],
      included: row.included || [],
      notIncluded: row.not_included || [],
      photos: row.photos || [],
      videos: row.videos || [],
      size: row.size || undefined,
      features: row.features || undefined,
      rules: row.rules || undefined,
      isActive: row.is_active,
      totalUnits: row.total_units || 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

let boardingRoomsRepositoryInstance: BoardingRoomsRepository | null = null;

export function getBoardingRoomsRepository(): BoardingRoomsRepository {
  if (!boardingRoomsRepositoryInstance) {
    boardingRoomsRepositoryInstance = new BoardingRoomsRepository();
  }
  return boardingRoomsRepositoryInstance;
}
