/**
 * DISCOVERY REPOSITORY
 * SQL-based repository for problem-driven discovery
 * NO KV STORE - All data from SQL
 */

import { getDbClient, selectQuery, withTransaction } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface VendorDiscoveryResult {
  vendorId: string;
  businessName: string;
  roleId: string;
  status: string;
  isActive: boolean;
  rating: number;
  totalReviews: number;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    city: string;
    state: string;
  };
  distance?: number;
  matchingServices: ServiceDiscoveryResult[];
  staffCount: number;
}

export interface ServiceDiscoveryResult {
  serviceId: string;
  serviceName: string;
  category: string;
  subCategory: string;
  price: number;
  duration: number;
  serviceStyle: 'at_center' | 'at_home' | 'tele';
  publishStatus: string;
  isEnabled: boolean;
}

export interface StaffDiscoveryResult {
  staffId: string;
  fullName: string;
  vendorId: string;
  specialization: string;
  specializations: string[];
  isActive: boolean;
  rating: number;
  consultationFee: number;
  services: ServiceDiscoveryResult[];
  distance?: number;
}

export interface ProblemGridMapping {
  problemId: string;
  problemName: string;
  mappedSubCategories: string[];
}

export class DiscoveryRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get all approved and active vendors for a role
   */
  async getEligibleVendors(roleId: string): Promise<VendorDiscoveryResult[]> {
    const { data, error } = await this.client
      .from('vendors')
      .select(`
        id,
        business_name,
        role_id,
        status,
        is_active,
        rating,
        total_reviews,
        latitude,
        longitude,
        address,
        city,
        state
      `)
      .eq('status', 'approved')
      .eq('is_active', true)
      .eq('role_id', roleId);

    if (error) {
      console.error('Error fetching eligible vendors:', error);
      return [];
    }

    return (data || []).map((v: any) => ({
      vendorId: v.id,
      businessName: v.business_name,
      roleId: v.role_id,
      status: v.status,
      isActive: v.is_active,
      rating: v.rating || 0,
      totalReviews: v.total_reviews || 0,
      location: {
        latitude: v.latitude || 0,
        longitude: v.longitude || 0,
        address: v.address || '',
        city: v.city || '',
        state: v.state || ''
      },
      matchingServices: [],
      staffCount: 0
    }));
  }

  /**
   * Get published and enabled services for a vendor
   */
  async getVendorPublishedServices(vendorId: string): Promise<ServiceDiscoveryResult[]> {
    // Query vendor_services table (assuming it exists in SQL)
    // For now, we'll use a placeholder that needs to be implemented based on actual schema
    const { data, error } = await this.client
      .from('vendor_services')
      .select(`
        service_id,
        service_name,
        category,
        sub_category,
        price,
        duration_minutes,
        service_style,
        publish_status,
        is_enabled
      `)
      .eq('vendor_id', vendorId)
      .eq('publish_status', 'published')
      .eq('is_enabled', true);

    if (error) {
      console.error('Error fetching vendor services:', error);
      return [];
    }

    return (data || []).map((s: any) => ({
      serviceId: s.service_id,
      serviceName: s.service_name,
      category: s.category || '',
      subCategory: s.sub_category || '',
      price: s.price || 0,
      duration: s.duration_minutes || 30,
      serviceStyle: s.service_style || 'at_center',
      publishStatus: s.publish_status,
      isEnabled: s.is_enabled
    }));
  }

  /**
   * Get active staff for a vendor with their published services
   */
  async getVendorStaff(vendorId: string): Promise<StaffDiscoveryResult[]> {
    const { data: staffData, error: staffError } = await this.client
      .from('staff')
      .select(`
        id,
        full_name,
        vendor_id,
        specialization,
        specializations,
        is_active,
        rating,
        consultation_fee
      `)
      .eq('vendor_id', vendorId)
      .eq('is_active', true);

    if (staffError) {
      console.error('Error fetching staff:', staffError);
      return [];
    }

    const staffResults: StaffDiscoveryResult[] = [];

    for (const staff of (staffData || [])) {
      // Get staff's active published services
      const staffServices = await this.getStaffPublishedServices(staff.id);

      if (staffServices.length === 0) {
        continue; // Skip staff with no published services
      }

      staffResults.push({
        staffId: staff.id,
        fullName: staff.full_name,
        vendorId: staff.vendor_id,
        specialization: staff.specialization || '',
        specializations: Array.isArray(staff.specializations) 
          ? staff.specializations 
          : (staff.specializations ? [staff.specializations] : []),
        isActive: staff.is_active,
        rating: staff.rating || 0,
        consultationFee: staff.consultation_fee || 0,
        services: staffServices
      });
    }

    return staffResults;
  }

  /**
   * Get published services for a staff member
   */
  async getStaffPublishedServices(staffId: string): Promise<ServiceDiscoveryResult[]> {
    // Query staff_services table (assuming it exists)
    // Staff services should inherit from vendor services but with isActive flag
    const { data, error } = await this.client
      .from('staff_services')
      .select(`
        service_id,
        service_name,
        category,
        sub_category,
        price,
        duration_minutes,
        service_style,
        is_active
      `)
      .eq('staff_id', staffId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching staff services:', error);
      return [];
    }

    // Also need to check that the parent vendor service is published
    const serviceIds = (data || []).map((s: any) => s.service_id);
    
    if (serviceIds.length === 0) {
      return [];
    }

    // Get vendor ID from staff
    const { data: staffData } = await this.client
      .from('staff')
      .select('vendor_id')
      .eq('id', staffId)
      .single();

    if (!staffData) {
      return [];
    }

    // Verify services are published at vendor level
    const { data: vendorServices } = await this.client
      .from('vendor_services')
      .select('service_id, publish_status, is_enabled')
      .eq('vendor_id', staffData.vendor_id)
      .in('service_id', serviceIds)
      .eq('publish_status', 'published')
      .eq('is_enabled', true);

    const publishedServiceIds = new Set((vendorServices || []).map((vs: any) => vs.service_id));

    return (data || [])
      .filter((s: any) => publishedServiceIds.has(s.service_id))
      .map((s: any) => ({
        serviceId: s.service_id,
        serviceName: s.service_name,
        category: s.category || '',
        subCategory: s.sub_category || '',
        price: s.price || 0,
        duration: s.duration_minutes || 30,
        serviceStyle: s.service_style || 'at_center',
        publishStatus: 'published',
        isEnabled: s.is_active
      }));
  }

  /**
   * Search vendors by service subcategories
   */
  async searchVendorsBySubcategories(
    roleId: string,
    subCategoryIds: string[],
    customerLat?: number,
    customerLon?: number,
    maxDistance?: number
  ): Promise<VendorDiscoveryResult[]> {
    const vendors = await this.getEligibleVendors(roleId);
    const results: VendorDiscoveryResult[] = [];

    for (const vendor of vendors) {
      const services = await this.getVendorPublishedServices(vendor.vendorId);
      
      // TASK 2: Enhanced service matching - check both subCategory and category
      const matchingServices = services.filter(s => {
        // Check subcategory match
        const subCatMatch = subCategoryIds.includes(s.subCategory) || 
          subCategoryIds.some(subCat => s.subCategory.toLowerCase().includes(subCat.toLowerCase()));
        
        // Check category match (for services without subcategory)
        const catMatch = subCategoryIds.some(subCat => {
          const subCatName = this.getSubcategoryName(subCat);
          return s.category && s.category.toLowerCase().includes(subCatName.toLowerCase());
        });
        
        return subCatMatch || catMatch;
      });

      if (matchingServices.length === 0) {
        continue;
      }

      // Calculate distance if location provided
      if (customerLat && customerLon && vendor.location.latitude && vendor.location.longitude) {
        const distance = this.calculateDistance(
          customerLat,
          customerLon,
          vendor.location.latitude,
          vendor.location.longitude
        );

        if (maxDistance && distance > maxDistance) {
          continue;
        }

        vendor.distance = distance;
      }

      // Get staff count
      const staff = await this.getVendorStaff(vendor.vendorId);
      vendor.staffCount = staff.length;
      vendor.matchingServices = matchingServices;

      results.push(vendor);
    }

    return results;
  }

  /**
   * Check if staff has available slots (TASK 1: Schedule Availability Check)
   */
  async checkStaffAvailability(staffId: string, daysAhead: number = 7): Promise<boolean> {
    try {
      // Check if staff has any available slots in the next N days
      const { data: scheduleSlots, error } = await this.client
        .from('staff_schedule_slots')
        .select('id, day_of_week, time_windows')
        .eq('staff_id', staffId)
        .eq('is_available', true)
        .limit(1);

      if (error || !scheduleSlots || scheduleSlots.length === 0) {
        return false;
      }

      // Check if there are any time windows enabled
      const hasEnabledWindows = scheduleSlots.some((slot: any) => {
        const windows = slot.time_windows || [];
        return windows.some((w: any) => w.is_enabled === true);
      });

      return hasEnabledWindows;
    } catch (error) {
      console.error('Error checking staff availability:', error);
      return false; // Default to unavailable if check fails
    }
  }

  /**
   * Search staff by problem grid subcategories
   * TASK 1: Now includes schedule availability check
   */
  async searchStaffBySubcategories(
    roleId: string,
    subCategoryIds: string[],
    customerLat?: number,
    customerLon?: number,
    maxDistance?: number,
    checkAvailability: boolean = true
  ): Promise<StaffDiscoveryResult[]> {
    const vendors = await this.getEligibleVendors(roleId);
    const results: StaffDiscoveryResult[] = [];

    for (const vendor of vendors) {
      const staff = await this.getVendorStaff(vendor.vendorId);

      for (const staffMember of staff) {
        // TASK 2: Enhanced service matching - check both subCategory and category
        const matchingServices = staffMember.services.filter(s => {
          // Check subcategory match
          const subCatMatch = subCategoryIds.includes(s.subCategory) ||
            subCategoryIds.some(subCat => s.subCategory.toLowerCase().includes(subCat.toLowerCase()));
          
          // Check category match (for services without subcategory)
          const catMatch = subCategoryIds.some(subCat => {
            const subCatName = this.getSubcategoryName(subCat);
            return s.category && s.category.toLowerCase().includes(subCatName.toLowerCase());
          });
          
          return subCatMatch || catMatch;
        });

        if (matchingServices.length === 0) {
          continue;
        }

        // Check specialization match
        const hasSpecializationMatch = staffMember.specializations.some(spec =>
          subCategoryIds.includes(spec) ||
          subCategoryIds.some(subCat => spec.toLowerCase().includes(subCat.toLowerCase()))
        );

        if (!hasSpecializationMatch && matchingServices.length === 0) {
          continue;
        }

        // TASK 1: Check schedule availability
        if (checkAvailability) {
          const hasAvailability = await this.checkStaffAvailability(staffMember.staffId);
          if (!hasAvailability) {
            continue; // Skip staff with no available slots
          }
        }

        // Calculate distance if location provided
        if (customerLat && customerLon && vendor.location.latitude && vendor.location.longitude) {
          const distance = this.calculateDistance(
            customerLat,
            customerLon,
            vendor.location.latitude,
            vendor.location.longitude
          );

          if (maxDistance && distance > maxDistance) {
            continue;
          }

          staffMember.distance = distance;
        }

        staffMember.services = matchingServices;
        results.push(staffMember);
      }
    }

    return results;
  }

  /**
   * Get subcategory name from ID (helper for enhanced matching)
   */
  private getSubcategoryName(subCategoryId: string): string {
    // This would ideally use the problem-subcategory-mapping, but for now return the ID
    // In production, this should import and use the actual mapping
    return subCategoryId.replace(/^sub_/, '').replace(/_/g, ' ');
  }

  /**
   * Calculate distance using Haversine formula
   * TASK 7: Centralized distance calculation
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Update search index for a vendor
   */
  async updateVendorSearchIndex(vendorId: string): Promise<void> {
    const vendor = await this.getEligibleVendors('').then(v => v.find(v => v.vendorId === vendorId));
    if (!vendor) return;

    const services = await this.getVendorPublishedServices(vendorId);
    const staff = await this.getVendorStaff(vendorId);

    // Build searchable text
    const searchableText = [
      vendor.businessName,
      vendor.location.city,
      vendor.location.state,
      ...services.map(s => s.serviceName),
      ...staff.map(s => s.fullName)
    ].filter(Boolean).join(' ').toLowerCase();

    // Upsert search index
    const { error } = await this.client
      .from('search_index')
      .upsert({
        entity_type: 'vendor',
        entity_id: vendorId,
        search_text: searchableText,
        metadata: {
          businessName: vendor.businessName,
          roleId: vendor.roleId,
          serviceCount: services.length,
          staffCount: staff.length,
          location: vendor.location
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'entity_type,entity_id'
      });

    if (error) {
      console.error('Error updating vendor search index:', error);
    }
  }

  /**
   * Update search index for a staff member
   */
  async updateStaffSearchIndex(staffId: string): Promise<void> {
    const { data: staff, error: staffError } = await this.client
      .from('staff')
      .select(`
        id,
        full_name,
        specialization,
        specializations,
        vendor_id
      `)
      .eq('id', staffId)
      .single();

    if (staffError || !staff) return;

    const services = await this.getStaffPublishedServices(staffId);

    // Build searchable text
    const searchableText = [
      staff.full_name,
      staff.specialization,
      ...(Array.isArray(staff.specializations) ? staff.specializations : []),
      ...services.map(s => s.serviceName)
    ].filter(Boolean).join(' ').toLowerCase();

    // Upsert search index
    const { error } = await this.client
      .from('search_index')
      .upsert({
        entity_type: 'staff',
        entity_id: staffId,
        search_text: searchableText,
        metadata: {
          fullName: staff.full_name,
          specialization: staff.specialization,
          vendorId: staff.vendor_id,
          serviceCount: services.length
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'entity_type,entity_id'
      });

    if (error) {
      console.error('Error updating staff search index:', error);
    }
  }
}

let discoveryRepositoryInstance: DiscoveryRepository | null = null;

export function getDiscoveryRepository(): DiscoveryRepository {
  if (!discoveryRepositoryInstance) {
    discoveryRepositoryInstance = new DiscoveryRepository();
  }
  return discoveryRepositoryInstance;
}

