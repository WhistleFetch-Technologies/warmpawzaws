/**
 * PACKAGES REPOSITORY
 * SQL-based repository for service packages and enrollments
 * NO KV STORE - All data from SQL
 */

import { getDbClient } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface ServicePackage {
  id: string;
  packageId: string;
  vendorId: string;
  name: string;
  description?: string;
  serviceType: string;
  totalSessions: number;
  sessionDuration?: number;
  sessionFrequency?: string;
  price: number;
  pricePerSession: number;
  discountPercent?: number;
  serviceStyle?: string;
  includes?: string[];
  requirements?: string[];
  validityDays?: number;
  petTypes?: string[];
  suitableFor?: string[];
  walkerConfig?: any;
  trainingConfig?: any;
  groomingConfig?: any;
  requiresOtp?: boolean;
  requiresGpsTracking?: boolean;
  isActive: boolean;
  maxActiveEnrollments?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PackageEnrollment {
  id: string;
  enrollmentId: string;
  packageId: string;
  vendorId: string;
  customerId: string;
  petId?: string;
  packageName: string;
  serviceType: string;
  totalSessions: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  status: string;
  purchasedAt?: string;
  expiresAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  requiresOtp?: boolean;
  sessions?: any[];
  notes?: string;
  cancellationReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class PackagesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get all packages for a vendor
   */
  async getVendorPackages(vendorId: string, serviceType?: string): Promise<ServicePackage[]> {
    try {
      let query = this.client
        .from('service_packages')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (serviceType) {
        query = query.eq('service_type', serviceType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching vendor packages:', error);
        return [];
      }

      return (data || []).map(this.mapPackageFromDb);
    } catch (error) {
      console.error('Error in getVendorPackages:', error);
      return [];
    }
  }

  /**
   * Get package by ID
   */
  async getPackageById(packageId: string): Promise<ServicePackage | null> {
    try {
      const { data, error } = await this.client
        .from('service_packages')
        .select('*')
        .or(`id.eq.${packageId},package_id.eq.${packageId}`)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapPackageFromDb(data);
    } catch (error) {
      console.error('Error in getPackageById:', error);
      return null;
    }
  }

  /**
   * Create a new package
   */
  async createPackage(packageData: Partial<ServicePackage>): Promise<ServicePackage> {
    try {
      const packageId = `package_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const insertData: any = {
        package_id: packageId,
        vendor_id: packageData.vendorId!,
        name: packageData.name!,
        description: packageData.description || null,
        service_type: packageData.serviceType!,
        total_sessions: packageData.totalSessions!,
        session_duration: packageData.sessionDuration || 60,
        session_frequency: packageData.sessionFrequency || null,
        price: packageData.price!,
        discount_percent: packageData.discountPercent || 0,
        service_style: packageData.serviceStyle || 'both',
        includes: packageData.includes || [],
        requirements: packageData.requirements || [],
        validity_days: packageData.validityDays || 90,
        pet_types: packageData.petTypes || ['dog', 'cat'],
        suitable_for: packageData.suitableFor || [],
        walker_config: packageData.walkerConfig || null,
        training_config: packageData.trainingConfig || null,
        grooming_config: packageData.groomingConfig || null,
        requires_otp: packageData.requiresOtp !== undefined ? packageData.requiresOtp : true,
        requires_gps_tracking: packageData.requiresGpsTracking || false,
        is_active: packageData.isActive !== undefined ? packageData.isActive : true,
        max_active_enrollments: packageData.maxActiveEnrollments || 50
      };

      const { data, error } = await this.client
        .from('service_packages')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapPackageFromDb(data);
    } catch (error) {
      console.error('Error creating package:', error);
      throw error;
    }
  }

  /**
   * Update a package
   */
  async updatePackage(packageId: string, updates: Partial<ServicePackage>): Promise<ServicePackage | null> {
    try {
      const updateData: any = {};

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.totalSessions !== undefined) updateData.total_sessions = updates.totalSessions;
      if (updates.sessionDuration !== undefined) updateData.session_duration = updates.sessionDuration;
      if (updates.sessionFrequency !== undefined) updateData.session_frequency = updates.sessionFrequency;
      if (updates.price !== undefined) updateData.price = updates.price;
      if (updates.discountPercent !== undefined) updateData.discount_percent = updates.discountPercent;
      if (updates.serviceStyle !== undefined) updateData.service_style = updates.serviceStyle;
      if (updates.includes !== undefined) updateData.includes = updates.includes;
      if (updates.requirements !== undefined) updateData.requirements = updates.requirements;
      if (updates.validityDays !== undefined) updateData.validity_days = updates.validityDays;
      if (updates.petTypes !== undefined) updateData.pet_types = updates.petTypes;
      if (updates.suitableFor !== undefined) updateData.suitable_for = updates.suitableFor;
      if (updates.walkerConfig !== undefined) updateData.walker_config = updates.walkerConfig;
      if (updates.trainingConfig !== undefined) updateData.training_config = updates.trainingConfig;
      if (updates.groomingConfig !== undefined) updateData.grooming_config = updates.groomingConfig;
      if (updates.requiresOtp !== undefined) updateData.requires_otp = updates.requiresOtp;
      if (updates.requiresGpsTracking !== undefined) updateData.requires_gps_tracking = updates.requiresGpsTracking;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.maxActiveEnrollments !== undefined) updateData.max_active_enrollments = updates.maxActiveEnrollments;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await this.client
        .from('service_packages')
        .update(updateData)
        .or(`id.eq.${packageId},package_id.eq.${packageId}`)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapPackageFromDb(data);
    } catch (error) {
      console.error('Error updating package:', error);
      return null;
    }
  }

  /**
   * Delete a package (soft delete)
   */
  async deletePackage(packageId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('service_packages')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .or(`id.eq.${packageId},package_id.eq.${packageId}`);

      return !error;
    } catch (error) {
      console.error('Error deleting package:', error);
      return false;
    }
  }

  /**
   * Get package enrollments for a vendor
   */
  async getVendorEnrollments(vendorId: string, status?: string): Promise<PackageEnrollment[]> {
    try {
      let query = this.client
        .from('package_enrollments')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching enrollments:', error);
        return [];
      }

      return (data || []).map(this.mapEnrollmentFromDb);
    } catch (error) {
      console.error('Error in getVendorEnrollments:', error);
      return [];
    }
  }

  /**
   * Get enrollment by ID
   */
  async getEnrollmentById(enrollmentId: string): Promise<PackageEnrollment | null> {
    try {
      const { data, error } = await this.client
        .from('package_enrollments')
        .select('*')
        .or(`id.eq.${enrollmentId},enrollment_id.eq.${enrollmentId}`)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapEnrollmentFromDb(data);
    } catch (error) {
      console.error('Error in getEnrollmentById:', error);
      return null;
    }
  }

  /**
   * Create a new enrollment
   */
  async createEnrollment(enrollmentData: Partial<PackageEnrollment>): Promise<PackageEnrollment> {
    try {
      const enrollmentId = `enroll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const insertData: any = {
        enrollment_id: enrollmentId,
        package_id: enrollmentData.packageId!,
        vendor_id: enrollmentData.vendorId!,
        customer_id: enrollmentData.customerId!,
        pet_id: enrollmentData.petId || null,
        package_name: enrollmentData.packageName!,
        service_type: enrollmentData.serviceType!,
        total_sessions: enrollmentData.totalSessions!,
        sessions_used: enrollmentData.sessionsUsed || 0,
        status: enrollmentData.status || 'active',
        expires_at: enrollmentData.expiresAt || null,
        requires_otp: enrollmentData.requiresOtp !== undefined ? enrollmentData.requiresOtp : true,
        sessions: enrollmentData.sessions || [],
        notes: enrollmentData.notes || null
      };

      const { data, error } = await this.client
        .from('package_enrollments')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapEnrollmentFromDb(data);
    } catch (error) {
      console.error('Error creating enrollment:', error);
      throw error;
    }
  }

  /**
   * Update enrollment
   */
  async updateEnrollment(enrollmentId: string, updates: Partial<PackageEnrollment>): Promise<PackageEnrollment | null> {
    try {
      const updateData: any = {};

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.sessionsUsed !== undefined) updateData.sessions_used = updates.sessionsUsed;
      if (updates.sessions !== undefined) updateData.sessions = updates.sessions;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.cancellationReason !== undefined) updateData.cancellation_reason = updates.cancellationReason;
      if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
      if (updates.cancelledAt !== undefined) updateData.cancelled_at = updates.cancelledAt;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await this.client
        .from('package_enrollments')
        .update(updateData)
        .or(`id.eq.${enrollmentId},enrollment_id.eq.${enrollmentId}`)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapEnrollmentFromDb(data);
    } catch (error) {
      console.error('Error updating enrollment:', error);
      return null;
    }
  }

  /**
   * Get today's sessions for staff
   */
  async getTodaySessionsForStaff(staffId: string): Promise<any[]> {
    try {
      // First get staff to find vendor
      const { data: staff } = await this.client
        .from('staff')
        .select('vendor_id')
        .eq('id', staffId)
        .single();

      if (!staff) {
        return [];
      }

      const today = new Date().toISOString().split('T')[0];

      // Get all active enrollments for this vendor
      const { data: enrollments } = await this.client
        .from('package_enrollments')
        .select('*')
        .eq('vendor_id', staff.vendor_id)
        .eq('status', 'active');

      if (!enrollments) {
        return [];
      }

      // Filter sessions for today assigned to this staff
      const todaySessions: any[] = [];

      for (const enrollment of enrollments) {
        const sessions = enrollment.sessions || [];
        for (const session of sessions) {
          if (session.scheduledDate === today && session.assignedStaffId === staffId) {
            todaySessions.push({
              ...session,
              enrollmentId: enrollment.enrollment_id,
              customerName: enrollment.package_name, // Would need to join with customers
              petName: enrollment.pet_id ? 'Pet' : null, // Would need to join with pets
              packageName: enrollment.package_name,
              serviceType: enrollment.service_type
            });
          }
        }
      }

      // Sort by scheduled time
      todaySessions.sort((a, b) => {
        const timeA = a.scheduledTime || '00:00';
        const timeB = b.scheduledTime || '00:00';
        return timeA.localeCompare(timeB);
      });

      return todaySessions;
    } catch (error) {
      console.error('Error in getTodaySessionsForStaff:', error);
      return [];
    }
  }

  /**
   * Map database row to ServicePackage
   */
  private mapPackageFromDb(row: any): ServicePackage {
    return {
      id: row.id,
      packageId: row.package_id,
      vendorId: row.vendor_id,
      name: row.name,
      description: row.description || undefined,
      serviceType: row.service_type,
      totalSessions: row.total_sessions,
      sessionDuration: row.session_duration || undefined,
      sessionFrequency: row.session_frequency || undefined,
      price: parseFloat(row.price),
      pricePerSession: parseFloat(row.price_per_session),
      discountPercent: row.discount_percent || undefined,
      serviceStyle: row.service_style || undefined,
      includes: row.includes || [],
      requirements: row.requirements || [],
      validityDays: row.validity_days || undefined,
      petTypes: row.pet_types || [],
      suitableFor: row.suitable_for || [],
      walkerConfig: row.walker_config || undefined,
      trainingConfig: row.training_config || undefined,
      groomingConfig: row.grooming_config || undefined,
      requiresOtp: row.requires_otp !== undefined ? row.requires_otp : true,
      requiresGpsTracking: row.requires_gps_tracking || false,
      isActive: row.is_active,
      maxActiveEnrollments: row.max_active_enrollments || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row to PackageEnrollment
   */
  private mapEnrollmentFromDb(row: any): PackageEnrollment {
    return {
      id: row.id,
      enrollmentId: row.enrollment_id,
      packageId: row.package_id,
      vendorId: row.vendor_id,
      customerId: row.customer_id,
      petId: row.pet_id || undefined,
      packageName: row.package_name,
      serviceType: row.service_type,
      totalSessions: row.total_sessions,
      sessionsUsed: row.sessions_used,
      sessionsRemaining: row.sessions_remaining,
      status: row.status,
      purchasedAt: row.purchased_at,
      expiresAt: row.expires_at || undefined,
      completedAt: row.completed_at || undefined,
      cancelledAt: row.cancelled_at || undefined,
      requiresOtp: row.requires_otp !== undefined ? row.requires_otp : true,
      sessions: row.sessions || [],
      notes: row.notes || undefined,
      cancellationReason: row.cancellation_reason || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

let packagesRepositoryInstance: PackagesRepository | null = null;

export function getPackagesRepository(): PackagesRepository {
  if (!packagesRepositoryInstance) {
    packagesRepositoryInstance = new PackagesRepository();
  }
  return packagesRepositoryInstance;
}

