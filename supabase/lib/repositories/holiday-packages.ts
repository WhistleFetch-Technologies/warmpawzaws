/**
 * ============================================================================
 * HOLIDAY PACKAGES REPOSITORY
 * ============================================================================
 * 
 * Repository for holiday packages and bookings data access.
 * Replaces: holiday-package:{id}, holiday_booking_{id} KV keys
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

export interface HolidayPackage {
  id: string;
  packageId: string;
  vendorId: string;
  packageName: string;
  description?: string;
  destination: string;
  destinationImage?: string;
  packageType: 'beach' | 'mountain' | 'city' | 'wildlife' | 'adventure' | 'luxury';
  durationDays: number;
  durationNights: number;
  basePrice: number;
  pricePerPet: number;
  pricePerAdult: number;
  pricePerChild: number;
  currency: string;
  inclusions: string[];
  exclusions: string[];
  isGroupTour: boolean;
  minGroupSize?: number;
  maxGroupSize?: number;
  availableDates: Array<{
    startDate: string;
    endDate: string;
    availableSlots: number;
    bookedSlots: number;
  }>;
  itinerary: Array<{
    day: number;
    title: string;
    description: string;
    activities: string[];
  }>;
  requirements: {
    minAge?: number;
    maxAge?: number;
    petRequirements?: string[];
    healthRequirements?: string[];
  };
  cancellationPolicy?: string;
  refundPolicy?: string;
  rating: number;
  currentBookings: number;
  maxCapacity?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HolidayBooking {
  id: string;
  bookingId: string;
  packageId: string;
  customerId: string;
  vendorId: string;
  selectedStartDate: string;
  selectedEndDate: string;
  travelers: {
    adults: number;
    children: number;
    pets: Array<{
      petId: string;
      petName: string;
      breed: string;
    }>;
  };
  pricing: {
    basePrice: number;
    petCharges: number;
    adultCharges: number;
    childCharges: number;
    totalAmount: number;
  };
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  isGroupTour: boolean;
  groupMembers?: Array<{
    name: string;
    contactNumber: string;
    email: string;
  }>;
  specialRequests?: string;
  dietaryRequirements?: string;
  cancellationReason?: string;
  refundAmount?: number;
  paymentId?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
}

export class HolidayPackagesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get package by ID
   */
  async getPackageById(packageId: string): Promise<HolidayPackage | null> {
    try {
      const { data, error } = await this.client
        .from('holiday_packages')
        .select('*')
        .or(`id.eq.${packageId},package_id.eq.${packageId}`)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapPackageFromDb(data);
    } catch (error) {
      console.error('Error fetching holiday package:', error);
      return null;
    }
  }

  /**
   * Get all packages (with optional filters)
   */
  async getAllPackages(options?: {
    vendorId?: string;
    packageType?: string;
    isActive?: boolean;
    destination?: string;
  }): Promise<HolidayPackage[]> {
    try {
      let query = this.client.from('holiday_packages').select('*');

      if (options?.vendorId) {
        query = query.eq('vendor_id', options.vendorId);
      }

      if (options?.packageType) {
        query = query.eq('package_type', options.packageType);
      }

      if (options?.destination) {
        query = query.ilike('destination', `%${options.destination}%`);
      }

      if (options?.isActive !== undefined) {
        query = query.eq('is_active', options.isActive);
      } else {
        query = query.eq('is_active', true);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching holiday packages:', error);
        return [];
      }

      return (data || []).map(this.mapPackageFromDb);
    } catch (error) {
      console.error('Error in getAllPackages:', error);
      return [];
    }
  }

  /**
   * Create package
   */
  async createPackage(packageData: Partial<HolidayPackage>): Promise<HolidayPackage> {
    try {
      const packageId = `holiday_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const insertData: any = {
        package_id: packageData.packageId || packageId,
        vendor_id: packageData.vendorId!,
        package_name: packageData.packageName!,
        description: packageData.description || null,
        destination: packageData.destination!,
        destination_image: packageData.destinationImage || null,
        package_type: packageData.packageType!,
        duration_days: packageData.durationDays!,
        duration_nights: packageData.durationNights!,
        base_price: packageData.basePrice!,
        price_per_pet: packageData.pricePerPet!,
        price_per_adult: packageData.pricePerAdult!,
        price_per_child: packageData.pricePerChild!,
        currency: packageData.currency || 'INR',
        inclusions: packageData.inclusions || [],
        exclusions: packageData.exclusions || [],
        is_group_tour: packageData.isGroupTour || false,
        min_group_size: packageData.minGroupSize || null,
        max_group_size: packageData.maxGroupSize || null,
        available_dates: packageData.availableDates || [],
        itinerary: packageData.itinerary || [],
        requirements: packageData.requirements || {},
        cancellation_policy: packageData.cancellationPolicy || null,
        refund_policy: packageData.refundPolicy || null,
        rating: packageData.rating || 0,
        current_bookings: packageData.currentBookings || 0,
        max_capacity: packageData.maxCapacity || null,
        is_active: packageData.isActive !== undefined ? packageData.isActive : true,
      };

      const { data, error } = await this.client
        .from('holiday_packages')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapPackageFromDb(data);
    } catch (error) {
      console.error('Error creating holiday package:', error);
      throw error;
    }
  }

  /**
   * Update package
   */
  async updatePackage(packageId: string, updates: Partial<HolidayPackage>): Promise<HolidayPackage | null> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.packageName !== undefined) updateData.package_name = updates.packageName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.destination !== undefined) updateData.destination = updates.destination;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.availableDates !== undefined) updateData.available_dates = updates.availableDates;
      if (updates.currentBookings !== undefined) updateData.current_bookings = updates.currentBookings;

      const { data, error } = await this.client
        .from('holiday_packages')
        .update(updateData)
        .or(`id.eq.${packageId},package_id.eq.${packageId}`)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapPackageFromDb(data);
    } catch (error) {
      console.error('Error updating holiday package:', error);
      return null;
    }
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId: string): Promise<HolidayBooking | null> {
    try {
      const { data, error } = await this.client
        .from('holiday_bookings')
        .select('*')
        .or(`id.eq.${bookingId},booking_id.eq.${bookingId}`)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapBookingFromDb(data);
    } catch (error) {
      console.error('Error fetching holiday booking:', error);
      return null;
    }
  }

  /**
   * Get bookings by customer
   */
  async getCustomerBookings(customerId: string): Promise<HolidayBooking[]> {
    try {
      const { data, error } = await this.client
        .from('holiday_bookings')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer holiday bookings:', error);
        return [];
      }

      return (data || []).map(this.mapBookingFromDb);
    } catch (error) {
      console.error('Error in getCustomerBookings:', error);
      return [];
    }
  }

  /**
   * Get bookings by vendor
   */
  async getVendorBookings(vendorId: string): Promise<HolidayBooking[]> {
    try {
      const { data, error } = await this.client
        .from('holiday_bookings')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching vendor holiday bookings:', error);
        return [];
      }

      return (data || []).map(this.mapBookingFromDb);
    } catch (error) {
      console.error('Error in getVendorBookings:', error);
      return [];
    }
  }

  /**
   * Create booking
   */
  async createBooking(bookingData: Partial<HolidayBooking>): Promise<HolidayBooking> {
    try {
      const bookingId = `HOLIDAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const insertData: any = {
        booking_id: bookingData.bookingId || bookingId,
        package_id: bookingData.packageId!,
        customer_id: bookingData.customerId!,
        vendor_id: bookingData.vendorId!,
        selected_start_date: bookingData.selectedStartDate!,
        selected_end_date: bookingData.selectedEndDate!,
        travelers: bookingData.travelers!,
        pricing: bookingData.pricing!,
        status: bookingData.status || 'pending',
        payment_status: bookingData.paymentStatus || 'pending',
        is_group_tour: bookingData.isGroupTour || false,
        group_members: bookingData.groupMembers || [],
        special_requests: bookingData.specialRequests || null,
        dietary_requirements: bookingData.dietaryRequirements || null,
        payment_id: bookingData.paymentId || null,
        payment_method: bookingData.paymentMethod || null,
      };

      const { data, error } = await this.client
        .from('holiday_bookings')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapBookingFromDb(data);
    } catch (error) {
      console.error('Error creating holiday booking:', error);
      throw error;
    }
  }

  /**
   * Update booking
   */
  async updateBooking(bookingId: string, updates: Partial<HolidayBooking>): Promise<HolidayBooking | null> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.paymentStatus !== undefined) updateData.payment_status = updates.paymentStatus;
      if (updates.confirmedAt !== undefined) updateData.confirmed_at = updates.confirmedAt;
      if (updates.cancelledAt !== undefined) updateData.cancelled_at = updates.cancelledAt;
      if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
      if (updates.cancellationReason !== undefined) updateData.cancellation_reason = updates.cancellationReason;
      if (updates.refundAmount !== undefined) updateData.refund_amount = updates.refundAmount;
      if (updates.paymentId !== undefined) updateData.payment_id = updates.paymentId;

      const { data, error } = await this.client
        .from('holiday_bookings')
        .update(updateData)
        .or(`id.eq.${bookingId},booking_id.eq.${bookingId}`)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapBookingFromDb(data);
    } catch (error) {
      console.error('Error updating holiday booking:', error);
      return null;
    }
  }

  /**
   * Map database row to HolidayPackage
   */
  private mapPackageFromDb(row: any): HolidayPackage {
    return {
      id: row.id,
      packageId: row.package_id,
      vendorId: row.vendor_id,
      packageName: row.package_name,
      description: row.description || undefined,
      destination: row.destination,
      destinationImage: row.destination_image || undefined,
      packageType: row.package_type,
      durationDays: row.duration_days,
      durationNights: row.duration_nights,
      basePrice: parseFloat(row.base_price),
      pricePerPet: parseFloat(row.price_per_pet),
      pricePerAdult: parseFloat(row.price_per_adult),
      pricePerChild: parseFloat(row.price_per_child),
      currency: row.currency,
      inclusions: row.inclusions || [],
      exclusions: row.exclusions || [],
      isGroupTour: row.is_group_tour,
      minGroupSize: row.min_group_size || undefined,
      maxGroupSize: row.max_group_size || undefined,
      availableDates: row.available_dates || [],
      itinerary: row.itinerary || [],
      requirements: row.requirements || {},
      cancellationPolicy: row.cancellation_policy || undefined,
      refundPolicy: row.refund_policy || undefined,
      rating: parseFloat(row.rating || 0),
      currentBookings: row.current_bookings || 0,
      maxCapacity: row.max_capacity || undefined,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to HolidayBooking
   */
  private mapBookingFromDb(row: any): HolidayBooking {
    return {
      id: row.id,
      bookingId: row.booking_id,
      packageId: row.package_id,
      customerId: row.customer_id,
      vendorId: row.vendor_id,
      selectedStartDate: row.selected_start_date,
      selectedEndDate: row.selected_end_date,
      travelers: row.travelers || {},
      pricing: row.pricing || {},
      status: row.status,
      paymentStatus: row.payment_status,
      isGroupTour: row.is_group_tour,
      groupMembers: row.group_members || undefined,
      specialRequests: row.special_requests || undefined,
      dietaryRequirements: row.dietary_requirements || undefined,
      cancellationReason: row.cancellation_reason || undefined,
      refundAmount: row.refund_amount ? parseFloat(row.refund_amount) : undefined,
      paymentId: row.payment_id || undefined,
      paymentMethod: row.payment_method || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      confirmedAt: row.confirmed_at || undefined,
      cancelledAt: row.cancelled_at || undefined,
      completedAt: row.completed_at || undefined,
    };
  }
}

let holidayPackagesRepositoryInstance: HolidayPackagesRepository | null = null;

export function getHolidayPackagesRepository(): HolidayPackagesRepository {
  if (!holidayPackagesRepositoryInstance) {
    holidayPackagesRepositoryInstance = new HolidayPackagesRepository();
  }
  return holidayPackagesRepositoryInstance;
}

