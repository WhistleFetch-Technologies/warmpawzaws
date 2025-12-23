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
        totalAppointments: 0, // Would need to query bookings table
        completedAppointments: 0,
        totalEarnings: 0,
        reviewCount: 0,
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
        .single();

      if (error || !data) {
        return null;
      }

      // Get vendor
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
        totalAppointments: 0,
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
        totalAppointments: 0,
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
