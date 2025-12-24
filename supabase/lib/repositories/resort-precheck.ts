/**
 * ============================================================================
 * RESORT PRE-CHECK REPOSITORY
 * ============================================================================
 * 
 * Repository for resort/boarding pre-check forms and room configurations.
 * Replaces: resort:precheck:{preCheckId} and resort:room:{configId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery, withTransaction } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface ResortPreCheckForm {
  id: string;
  pre_check_id: string;
  booking_id: string;
  customer_id: string;
  pet_id: string;
  pet_name: string;
  vendor_id: string;
  health_info: any;
  vaccinations: any;
  emergency_contacts: any[];
  special_requirements: any;
  veterinarian: any;
  authorization: any;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'clarification_needed';
  review_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePreCheckFormInput {
  pre_check_id: string;
  booking_id: string;
  customer_id: string;
  pet_id: string;
  pet_name: string;
  vendor_id: string;
  health_info: any;
  vaccinations: any;
  emergency_contacts: any[];
  special_requirements: any;
  veterinarian: any;
  authorization: any;
  status?: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'clarification_needed';
}

export interface UpdatePreCheckFormInput {
  status?: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'clarification_needed';
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  health_info?: any;
  vaccinations?: any;
  emergency_contacts?: any[];
  special_requirements?: any;
  veterinarian?: any;
  authorization?: any;
}

export interface ResortRoomConfiguration {
  id: string;
  config_id: string;
  vendor_id: string;
  room_type: 'standard' | 'deluxe' | 'suite' | 'outdoor' | 'climate_controlled';
  room_size: 'small' | 'medium' | 'large' | 'extra_large';
  total_rooms: number;
  available_rooms: number;
  features: string[];
  pricing: any;
  amenities: any;
  pet_size_limit: 'small' | 'medium' | 'large' | 'any';
  max_occupancy: number;
  photos: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRoomConfigurationInput {
  config_id: string;
  vendor_id: string;
  room_type: 'standard' | 'deluxe' | 'suite' | 'outdoor' | 'climate_controlled';
  room_size?: 'small' | 'medium' | 'large' | 'extra_large';
  total_rooms: number;
  available_rooms?: number;
  features?: string[];
  pricing: any;
  amenities?: any;
  pet_size_limit?: 'small' | 'medium' | 'large' | 'any';
  max_occupancy?: number;
  photos?: string[];
  is_active?: boolean;
}

export interface UpdateRoomConfigurationInput {
  room_type?: 'standard' | 'deluxe' | 'suite' | 'outdoor' | 'climate_controlled';
  room_size?: 'small' | 'medium' | 'large' | 'extra_large';
  total_rooms?: number;
  available_rooms?: number;
  features?: string[];
  pricing?: any;
  amenities?: any;
  pet_size_limit?: 'small' | 'medium' | 'large' | 'any';
  max_occupancy?: number;
  photos?: string[];
  is_active?: boolean;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export function getResortPreCheckRepository() {
  const client = getDbClient();

  return {
    // ========================================================================
    // PRE-CHECK FORMS
    // ========================================================================

    async createPreCheckForm(input: CreatePreCheckFormInput): Promise<ResortPreCheckForm> {
      const { data, error } = await client
        .from('resort_precheck_forms')
        .insert({
          pre_check_id: input.pre_check_id,
          booking_id: input.booking_id,
          customer_id: input.customer_id,
          pet_id: input.pet_id,
          pet_name: input.pet_name,
          vendor_id: input.vendor_id,
          health_info: input.health_info || {},
          vaccinations: input.vaccinations || {},
          emergency_contacts: input.emergency_contacts || [],
          special_requirements: input.special_requirements || {},
          veterinarian: input.veterinarian || {},
          authorization: input.authorization || {},
          status: input.status || 'submitted'
        })
        .select()
        .single();

      if (error) throw error;
      return data as ResortPreCheckForm;
    },

    async getPreCheckFormByPreCheckId(preCheckId: string): Promise<ResortPreCheckForm | null> {
      const { data, error } = await client
        .from('resort_precheck_forms')
        .select('*')
        .eq('pre_check_id', preCheckId)
        .maybeSingle();

      if (error) throw error;
      return data as ResortPreCheckForm | null;
    },

    async getPreCheckFormByBookingId(bookingId: string): Promise<ResortPreCheckForm | null> {
      const { data, error } = await client
        .from('resort_precheck_forms')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (error) throw error;
      return data as ResortPreCheckForm | null;
    },

    async getPreCheckFormsByVendor(vendorId: string, status?: string): Promise<ResortPreCheckForm[]> {
      let query = client
        .from('resort_precheck_forms')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as ResortPreCheckForm[];
    },

    async updatePreCheckForm(preCheckId: string, input: UpdatePreCheckFormInput): Promise<ResortPreCheckForm> {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (input.status !== undefined) updateData.status = input.status;
      if (input.review_notes !== undefined) updateData.review_notes = input.review_notes;
      if (input.reviewed_by !== undefined) updateData.reviewed_by = input.reviewed_by;
      if (input.reviewed_at !== undefined) updateData.reviewed_at = input.reviewed_at;
      if (input.health_info !== undefined) updateData.health_info = input.health_info;
      if (input.vaccinations !== undefined) updateData.vaccinations = input.vaccinations;
      if (input.emergency_contacts !== undefined) updateData.emergency_contacts = input.emergency_contacts;
      if (input.special_requirements !== undefined) updateData.special_requirements = input.special_requirements;
      if (input.veterinarian !== undefined) updateData.veterinarian = input.veterinarian;
      if (input.authorization !== undefined) updateData.authorization = input.authorization;

      const { data, error } = await client
        .from('resort_precheck_forms')
        .update(updateData)
        .eq('pre_check_id', preCheckId)
        .select()
        .single();

      if (error) throw error;
      return data as ResortPreCheckForm;
    },

    // ========================================================================
    // ROOM CONFIGURATIONS
    // ========================================================================

    async createRoomConfiguration(input: CreateRoomConfigurationInput): Promise<ResortRoomConfiguration> {
      const { data, error } = await client
        .from('resort_room_configurations')
        .insert({
          config_id: input.config_id,
          vendor_id: input.vendor_id,
          room_type: input.room_type,
          room_size: input.room_size || 'medium',
          total_rooms: input.total_rooms,
          available_rooms: input.available_rooms ?? input.total_rooms,
          features: input.features || [],
          pricing: input.pricing || {},
          amenities: input.amenities || {},
          pet_size_limit: input.pet_size_limit || 'any',
          max_occupancy: input.max_occupancy || 1,
          photos: input.photos || [],
          is_active: input.is_active !== undefined ? input.is_active : true
        })
        .select()
        .single();

      if (error) throw error;
      return data as ResortRoomConfiguration;
    },

    async getRoomConfigurationByConfigId(configId: string): Promise<ResortRoomConfiguration | null> {
      const { data, error } = await client
        .from('resort_room_configurations')
        .select('*')
        .eq('config_id', configId)
        .maybeSingle();

      if (error) throw error;
      return data as ResortRoomConfiguration | null;
    },

    async getRoomConfigurationsByVendor(vendorId: string, activeOnly: boolean = true): Promise<ResortRoomConfiguration[]> {
      let query = client
        .from('resort_room_configurations')
        .select('*')
        .eq('vendor_id', vendorId);

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as ResortRoomConfiguration[];
    },

    async updateRoomConfiguration(configId: string, input: UpdateRoomConfigurationInput): Promise<ResortRoomConfiguration> {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (input.room_type !== undefined) updateData.room_type = input.room_type;
      if (input.room_size !== undefined) updateData.room_size = input.room_size;
      if (input.total_rooms !== undefined) updateData.total_rooms = input.total_rooms;
      if (input.available_rooms !== undefined) updateData.available_rooms = input.available_rooms;
      if (input.features !== undefined) updateData.features = input.features;
      if (input.pricing !== undefined) updateData.pricing = input.pricing;
      if (input.amenities !== undefined) updateData.amenities = input.amenities;
      if (input.pet_size_limit !== undefined) updateData.pet_size_limit = input.pet_size_limit;
      if (input.max_occupancy !== undefined) updateData.max_occupancy = input.max_occupancy;
      if (input.photos !== undefined) updateData.photos = input.photos;
      if (input.is_active !== undefined) updateData.is_active = input.is_active;

      const { data, error } = await client
        .from('resort_room_configurations')
        .update(updateData)
        .eq('config_id', configId)
        .select()
        .single();

      if (error) throw error;
      return data as ResortRoomConfiguration;
    },

    async deleteRoomConfiguration(configId: string): Promise<void> {
      const { error } = await client
        .from('resort_room_configurations')
        .delete()
        .eq('config_id', configId);

      if (error) throw error;
    }
  };
}

