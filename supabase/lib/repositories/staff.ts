/**
 * STAFF REPOSITORY
 * SQL-based repository for staff operations
 * NO KV STORE - All data from SQL
 */

import { getDbClient } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface StaffProfile {
  id: string;
  staffId: string;
  vendorId: string;
  fullName: string;
  phone: string;
  email?: string;
  role?: string;
  roleType?: string;
  specialization?: string;
  specializations?: string[];
  isActive: boolean;
  rating?: number;
  consultationFee?: number;
  photo?: string;
  degree?: string;
  experience?: number;
  bio?: string;
  services?: any[];
  availability?: any;
  totalAppointments?: number;
  completedAppointments?: number;
  totalEarnings?: number;
  reviewCount?: number;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class StaffRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Find staff by phone number
   */
  async findByPhone(phone: string): Promise<StaffProfile | null> {
    try {
      // Normalize phone number (remove non-digits)
      const normalizedPhone = phone.replace(/[^0-9]/g, '');

      const { data, error } = await this.client
        .from('staff')
        .select(`
          id,
          staff_id,
          vendor_id,
          full_name,
          phone,
          email,
          role,
          specialization,
          specializations,
          is_active,
          rating,
          experience_years,
          created_at,
          updated_at
        `)
        .eq('phone', normalizedPhone)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      // Get vendor to get additional staff info
      const { data: vendor } = await this.client
        .from('vendors')
        .select('id, business_name, role_id')
        .eq('id', data.vendor_id)
        .single();

      // Get staff services
      const { data: staffServices } = await this.client
        .from('staff_services')
        .select(`
          service_id,
          is_enabled,
          custom_price,
          custom_duration
        `)
        .eq('staff_id', data.id)
        .eq('is_enabled', true);

      // Format staff profile to match KV store format
      return {
        id: data.id,
        staffId: data.staff_id,
        vendorId: data.vendor_id,
        fullName: data.full_name,
        phone: data.phone,
        email: data.email || undefined,
        role: data.role || undefined,
        roleType: vendor?.role_id || undefined,
        specialization: data.specialization || undefined,
        specializations: Array.isArray(data.specializations) 
          ? data.specializations 
          : (data.specializations ? [data.specializations] : []),
        isActive: data.is_active,
        rating: data.rating || 0,
        experience: data.experience_years || 0,
        services: (staffServices || []).map((s: any) => ({
          serviceId: s.service_id,
          isEnabled: s.is_enabled,
          customPrice: s.custom_price,
          customDuration: s.custom_duration
        })),
        availability: data.working_hours || {},
        totalAppointments: data.total_appointments || 0,
        completedAppointments: 0, // Would need to query bookings table
        totalEarnings: 0, // Would need to query bookings/payments table
        reviewCount: 0, // Would need to query reviews table
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('Error finding staff by phone:', error);
      return null;
    }
  }

  /**
   * Find staff by ID
   */
  async findById(staffId: string): Promise<StaffProfile | null> {
    try {
      const { data, error } = await this.client
        .from('staff')
        .select(`
          id,
          staff_id,
          vendor_id,
          full_name,
          phone,
          email,
          role,
          specialization,
          specializations,
          is_active,
          rating,
          experience_years,
          created_at,
          updated_at
        `)
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      // Get vendor
      const { data: vendor } = await this.client
        .from('vendors')
        .select('id, business_name, role_id')
        .eq('id', data.vendor_id)
        .maybeSingle();

      // Get staff services
      const { data: staffServices } = await this.client
        .from('staff_services')
        .select(`
          service_id,
          is_enabled,
          custom_price,
          custom_duration
        `)
        .eq('staff_id', data.id)
        .eq('is_enabled', true);

      return {
        id: data.id,
        staffId: data.staff_id,
        vendorId: data.vendor_id,
        fullName: data.full_name,
        phone: data.phone,
        email: data.email || undefined,
        role: data.role || undefined,
        roleType: vendor?.role_id || undefined,
        specialization: data.specialization || undefined,
        specializations: Array.isArray(data.specializations) 
          ? data.specializations 
          : (data.specializations ? [data.specializations] : []),
        isActive: data.is_active,
        rating: data.rating || 0,
        experience: data.experience_years || 0,
        services: (staffServices || []).map((s: any) => ({
          serviceId: s.service_id,
          isEnabled: s.is_enabled,
          customPrice: s.custom_price,
          customDuration: s.custom_duration
        })),
        availability: data.working_hours || {},
        totalAppointments: data.total_appointments || 0,
        completedAppointments: 0,
        totalEarnings: 0,
        reviewCount: 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('Error finding staff by ID:', error);
      return null;
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(staffId: string): Promise<void> {
    try {
      await this.client
        .from('staff')
        .update({ updated_at: new Date().toISOString() })
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`);
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  /**
   * Create a new staff member
   */
  async create(input: {
    vendor_id: string; // UUID
    full_name: string;
    phone: string;
    email?: string;
    role?: string;
    role_type?: string;
    specialization?: string;
    experience_years?: number;
    is_active?: boolean;
  }): Promise<StaffProfile> {
    try {
      // Generate staff_id (unique string identifier)
      const staffId = `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Normalize phone number
      const normalizedPhone = input.phone.replace(/[^0-9]/g, '');
      
      const { data, error } = await this.client
        .from('staff')
        .insert({
          vendor_id: input.vendor_id,
          staff_id: staffId,
          full_name: input.full_name,
          phone: normalizedPhone,
          email: input.email || null,
          role: input.role || input.role_type || 'staff',
          specialization: input.specialization || null,
          experience_years: input.experience_years || 0,
          is_active: input.is_active !== undefined ? input.is_active : true,
        })
        .select()
        .single();
      
      if (error || !data) {
        throw new Error(`Failed to create staff: ${error?.message || 'Unknown error'}`);
      }
      
      // Get vendor info
      const { data: vendor } = await this.client
        .from('vendors')
        .select('id, business_name, role_id')
        .eq('id', data.vendor_id)
        .maybeSingle();
      
      return {
        id: data.id,
        staffId: data.staff_id,
        vendorId: data.vendor_id,
        fullName: data.full_name,
        phone: data.phone,
        email: data.email || undefined,
        role: data.role || undefined,
        roleType: vendor?.role_id || input.role_type || undefined,
        specialization: data.specialization || undefined,
        specializations: data.specialization ? [data.specialization] : [],
        isActive: data.is_active,
        rating: data.rating || 0,
        experience: data.experience_years || 0,
        services: [],
        availability: data.working_hours || {},
        totalAppointments: data.total_appointments || 0,
        completedAppointments: 0,
        totalEarnings: 0,
        reviewCount: 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('Error creating staff:', error);
      throw error;
    }
  }

  /**
   * Update staff member
   */
  async update(staffId: string, input: {
    full_name?: string;
    phone?: string;
    email?: string;
    role?: string;
    role_type?: string;
    specialization?: string;
    experience_years?: number;
    service_radius?: number;
    is_active?: boolean;
    working_hours?: any;
    [key: string]: any; // Allow other fields
  }): Promise<StaffProfile> {
    try {
      // ✅ FIX: Handle both UUID (id) and string (staff_id)
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      
      if (input.full_name !== undefined) updateData.full_name = input.full_name;
      if (input.phone !== undefined) updateData.phone = input.phone.replace(/[^0-9]/g, '');
      if (input.email !== undefined) updateData.email = input.email;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.role_type !== undefined) updateData.role = input.role_type;
      if (input.specialization !== undefined) updateData.specialization = input.specialization;
      if (input.experience_years !== undefined) updateData.experience_years = input.experience_years;
      if (input.service_radius !== undefined) updateData.service_radius = input.service_radius;
      if (input.is_active !== undefined) updateData.is_active = input.is_active;
      if (input.working_hours !== undefined) updateData.working_hours = input.working_hours;
      
      // Handle any other fields that might exist in the table
      const allowedFields = ['qualifications', 'license_number', 'is_available'];
      for (const field of allowedFields) {
        if (input[field] !== undefined) {
          updateData[field] = input[field];
        }
      }
      
      // Try to update by UUID first, then by staff_id
      let updated: any = null;
      let error: any = null;
      
      // Try UUID
      const { data: dataByUuid, error: errByUuid } = await this.client
        .from('staff')
        .update(updateData)
        .eq('id', staffId)
        .select()
        .single();
      
      if (dataByUuid) {
        updated = dataByUuid;
      } else {
        // Try staff_id
        const { data: dataByStaffId, error: errByStaffId } = await this.client
          .from('staff')
          .update(updateData)
          .eq('staff_id', staffId)
          .select()
          .single();
        
        if (dataByStaffId) {
          updated = dataByStaffId;
        } else {
          error = errByStaffId || errByUuid;
        }
      }
      
      if (error || !updated) {
        throw new Error(`Failed to update staff: ${error?.message || 'Staff not found'}`);
      }
      
      // Return updated staff profile
      return this.findById(updated.id) || {
        id: updated.id,
        staffId: updated.staff_id,
        vendorId: updated.vendor_id,
        fullName: updated.full_name,
        phone: updated.phone,
        email: updated.email || undefined,
        role: updated.role || undefined,
        specialization: updated.specialization || undefined,
        isActive: updated.is_active,
        rating: updated.rating || 0,
        experience: updated.experience_years || 0,
        services: [],
        availability: updated.working_hours || {},
        createdAt: updated.created_at,
        updatedAt: updated.updated_at
      };
    } catch (error) {
      console.error('Error updating staff:', error);
      throw error;
    }
  }

  /**
   * Get all staff for a vendor
   */
  async findByVendorId(vendorId: string): Promise<StaffProfile[]> {
    try {
      const { data, error } = await this.client
        .from('staff')
        .select(`
          id,
          staff_id,
          vendor_id,
          full_name,
          phone,
          email,
          role,
          specialization,
          specializations,
          is_active,
          rating,
          experience_years,
          created_at,
          updated_at
        `)
        .eq('vendor_id', vendorId)
        .eq('is_active', true);

      if (error || !data) {
        return [];
      }

      // Get vendor info
      const { data: vendor } = await this.client
        .from('vendors')
        .select('id, business_name, role_id')
        .eq('id', vendorId)
        .single();

      // Map to StaffProfile format
      return (data || []).map((s: any) => ({
        id: s.id,
        staffId: s.staff_id,
        vendorId: s.vendor_id,
        fullName: s.full_name,
        phone: s.phone,
        email: s.email || undefined,
        role: s.role || undefined,
        roleType: vendor?.role_id || undefined,
        specialization: s.specialization || undefined,
        specializations: Array.isArray(s.specializations) 
          ? s.specializations 
          : (s.specializations ? [s.specializations] : []),
        isActive: s.is_active,
        rating: s.rating || 0,
        experience: s.experience_years || 0,
        services: [],
        availability: s.working_hours || {},
        totalAppointments: s.total_appointments || 0,
        completedAppointments: 0,
        totalEarnings: 0,
        reviewCount: 0,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }));
    } catch (error) {
      console.error('Error finding staff by vendor:', error);
      return [];
    }
  }
}

let staffRepositoryInstance: StaffRepository | null = null;

export function getStaffRepository(): StaffRepository {
  if (!staffRepositoryInstance) {
    staffRepositoryInstance = new StaffRepository();
  }
  return staffRepositoryInstance;
}
