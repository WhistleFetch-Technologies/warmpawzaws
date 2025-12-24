/**
 * ============================================================================
 * BOOKINGS REPOSITORY
 * ============================================================================
 * 
 * Repository for booking data access.
 * Replaces: booking:{bookingId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery, withTransaction } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface Booking {
  id: string;
  customer_id: string;
  vendor_id?: string | null;
  staff_id?: string | null;
  service_id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  service_type: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  base_price: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  loyalty_points_used: number;
  coupon_code?: string | null;
  promotion_id?: string | null;
  is_package: boolean;
  package_id?: string | null;
  package_details?: any;
  payment_status: string; // 'pending', 'paid', 'pending_post_service', 'refunded', 'partially_refunded', 'failed'
  payment_id?: string | null;
  otp_code?: string | null;
  otp_verified: boolean;
  otp_expires_at?: string | null;
  notes?: string | null;
  cancellation_reason?: string | null;
  rescheduled_from_booking_id?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  settled_at?: string | null;
}

export interface CreateBookingInput {
  customer_id: string;
  vendor_id?: string;
  staff_id?: string;
  service_id: string;
  booking_date: string;
  booking_time: string;
  service_type: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  base_price: number;
  discount_amount?: number;
  tax_amount?: number;
  total_amount: number;
  loyalty_points_used?: number;
  coupon_code?: string;
  promotion_id?: string;
  is_package?: boolean;
  package_id?: string;
  package_details?: any;
  notes?: string;
}

export interface UpdateBookingInput {
  status?: string;
  payment_status?: string;
  payment_id?: string;
  otp_code?: string;
  otp_verified?: boolean;
  otp_expires_at?: string;
  notes?: string;
  cancellation_reason?: string;
  rescheduled_from_booking_id?: string;
  completed_at?: string;
  cancelled_at?: string;
  settled_at?: string;
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class BookingsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get booking by ID
   * Replaces: kv.get(`booking:${bookingId}`)
   */
  async findById(bookingId: string): Promise<Booking | null> {
    const results = await selectQuery<any>("bookings", { id: bookingId }, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapBooking(results[0]);
  }

  /**
   * Get all bookings (with optional filters)
   */
  async findAll(options?: { limit?: number; offset?: number; status?: string }): Promise<Booking[]> {
    const conditions: any = {};
    if (options?.status) {
      conditions.status = options.status;
    }
    
    const results = await selectQuery<any>("bookings", conditions, {
      limit: options?.limit || 1000,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
    
    return results.map((r: any) => this.mapBooking(r));
  }
  
  /**
   * Map database row to Booking interface
   */
  private mapBooking(data: any): Booking {
    return {
      id: data.id,
      customer_id: data.customer_id,
      vendor_id: data.vendor_id,
      staff_id: data.staff_id,
      service_id: data.service_id,
      booking_date: data.scheduled_date || data.booking_date || '',
      booking_time: data.scheduled_time || data.booking_time || '',
      scheduled_date: data.scheduled_date || data.booking_date,
      scheduled_time: data.scheduled_time || data.booking_time,
      status: data.status,
      service_type: data.service_type,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      latitude: data.latitude ? parseFloat(data.latitude) : null,
      longitude: data.longitude ? parseFloat(data.longitude) : null,
      base_price: parseFloat(data.base_price || data.amount || '0'),
      discount_amount: parseFloat(data.discount_amount || '0'),
      tax_amount: parseFloat(data.tax_amount || '0'),
      total_amount: parseFloat(data.total_amount || data.amount || '0'),
      loyalty_points_used: parseInt(data.loyalty_points_used || '0'),
      coupon_code: data.coupon_code,
      promotion_id: data.promotion_id,
      is_package: data.is_package || false,
      package_id: data.package_id,
      package_details: data.package_details,
      payment_status: data.payment_status,
      payment_id: data.payment_id,
      otp_code: data.otp_code,
      otp_verified: data.otp_verified || false,
      otp_expires_at: data.otp_expires_at,
      notes: data.notes,
      cancellation_reason: data.cancellation_reason,
      rescheduled_from_booking_id: data.rescheduled_from_booking_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
      completed_at: data.completed_at,
      cancelled_at: data.cancelled_at,
      settled_at: data.settled_at
    };
  }

  /**
   * Get bookings by customer
   * Replaces: customer:{id}:bookings KV pattern
   */
  async findByCustomer(customerId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<Booking[]> {
    const filters: any = { customer_id: customerId };
    if (options?.status) {
      filters.status = options.status;
    }
    
    const results = await selectQuery<any>("bookings", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "scheduled_date",
      orderDirection: "desc",
    });
    
    return results.map(r => this.mapBooking(r));
  }

  /**
   * Get bookings by vendor
   * Replaces: vendor:{id}:bookings KV pattern
   */
  async findByVendor(vendorId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
    date?: string;
    dateFrom?: string; // ✅ NEW: Filter bookings from this date onwards
  }): Promise<Booking[]> {
    const filters: any = { vendor_id: vendorId };
    if (options?.status) {
      filters.status = options.status;
    }
    if (options?.date) {
      filters.booking_date = options.date;
    }
    
    let query = this.client.from("bookings").select("*").eq("vendor_id", vendorId);
    
    if (options?.status) {
      query = query.eq("status", options.status);
    }
    if (options?.date) {
      query = query.eq("scheduled_date", options.date); // Use actual DB column name
    }
    if (options?.dateFrom) {
      query = query.gte("scheduled_date", options.dateFrom); // Use actual DB column name
    }
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }
    
    query = query.order("scheduled_date", { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return (data || []) as Booking[];
  }

  /**
   * Get bookings by vendor and date
   */
  async findByVendorAndDate(vendorId: string, date: string): Promise<Booking[]> {
    const results = await this.findByVendor(vendorId, { date });
    return results;
  }

  /**
   * Get bookings by staff
   */
  async findByStaff(staffId: string, options?: {
    limit?: number;
    offset?: number;
    date?: string;
  }): Promise<Booking[]> {
    const filters: any = { staff_id: staffId };
    if (options?.date) {
      filters.booking_date = options.date; // Use actual DB column name
    }
    
    const results = await selectQuery<any>("bookings", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "scheduled_date",
      orderDirection: "desc",
    });
    
    return results.map(r => this.mapBooking(r));
  }

  /**
   * Get pending bookings
   * Replaces: booking:pending KV key
   */
  async findPending(options?: { limit?: number; offset?: number }): Promise<Booking[]> {
    const results = await selectQuery<any>("bookings", { status: "pending" }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "scheduled_date",
      orderDirection: "asc",
    });
    
    return results.map(r => this.mapBooking(r));
  }

  /**
   * Get upcoming bookings
   */
  async findUpcoming(customerId?: string, vendorId?: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<Booking[]> {
    const filters: any = {};
    if (customerId) filters.customer_id = customerId;
    if (vendorId) filters.vendor_id = vendorId;
    
    // Use raw query for date comparison
    const client = getDbClient();
    let query = client
      .from("bookings")
      .select("*")
      .gte("scheduled_date", new Date().toISOString().split("T")[0]) // Use actual DB column
      .in("status", ["pending", "confirmed"]);
    
    if (customerId) {
      query = query.eq("customer_id", customerId);
    }
    if (vendorId) {
      query = query.eq("vendor_id", vendorId);
    }
    
    query = query.order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true });
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []) as Booking[];
  }

  /**
   * Create a new booking
   * Replaces: kv.set(`booking:${bookingId}`, bookingData)
   */
  async create(input: CreateBookingInput): Promise<Booking> {
    // Map booking_date/booking_time to scheduled_date/scheduled_time for bookings table
    const insertData: any = {
      ...input,
      scheduled_date: input.booking_date, // Map to actual column name
      scheduled_time: input.booking_time, // Map to actual column name
      status: "pending",
      payment_status: "pending",
      discount_amount: input.discount_amount || 0,
      tax_amount: input.tax_amount || 0,
      loyalty_points_used: input.loyalty_points_used || 0,
      is_package: input.is_package || false,
    };
    
    // Remove booking_date/booking_time as they're mapped above
    delete insertData.booking_date;
    delete insertData.booking_time;
    
    const results = await insertQuery<Booking>("bookings", insertData);
    
    if (!results[0]) {
      throw new Error("Failed to create booking");
    }
    
    // ✅ AUTO-ROUTE: Route to appropriate lifecycle handlers
    try {
      const { routeBookingCreation } = await import("../services/booking-service-router.ts");
      await routeBookingCreation(results[0].id, input.service_type, {
        is_subscription: (input as any).is_subscription,
        requires_insurance: (input as any).requires_insurance,
        requires_adoption: (input as any).requires_adoption,
        is_package: input.is_package,
        is_emergency: (input as any).is_emergency,
        subscription_type: (input as any).subscription_type,
        auto_renew: (input as any).auto_renew,
        total_milestones: (input as any).total_milestones,
        milestone_type: (input as any).milestone_type,
        pet_id: (input as any).pet_id,
        application_data: (input as any).application_data,
      });
    } catch (error) {
      console.error(`[BookingRepository] Error routing booking creation:`, error);
      // Don't fail booking creation if routing fails
    }
    
    return results[0];
  }

  /**
   * Update booking
   * Replaces: kv.set(`booking:${bookingId}`, updatedData)
   */
  async update(bookingId: string, input: UpdateBookingInput): Promise<Booking> {
    // Map booking_date/booking_time to scheduled_date/scheduled_time if present
    const updateData: any = { ...input };
    if (updateData.booking_date) {
      updateData.scheduled_date = updateData.booking_date;
      delete updateData.booking_date;
    }
    if (updateData.booking_time) {
      updateData.scheduled_time = updateData.booking_time;
      delete updateData.booking_time;
    }
    
    const results = await updateQuery<any>(
      "bookings",
      { id: bookingId },
      {
        ...updateData,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Booking not found: ${bookingId}`);
    }
    
    return this.mapBooking(results[0]);
  }

  /**
   * Confirm booking
   */
  async confirm(bookingId: string): Promise<Booking> {
    return this.update(bookingId, {
      status: "confirmed",
    });
  }

  /**
   * Complete booking
   * ✅ ENHANCED: Automatically triggers settlement
   */
  async complete(bookingId: string): Promise<Booking> {
    const result = await this.update(bookingId, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });
    
    // ✅ AUTO-SETTLEMENT: Trigger settlement for completed booking
    try {
      const { routeBookingCompletion } = await import("../services/booking-service-router.ts");
      await routeBookingCompletion(bookingId);
    } catch (error) {
      console.error(`[BookingRepository] Error routing booking completion:`, error);
      // Don't fail completion if settlement routing fails
    }
    
    return result;
  }

  /**
   * Cancel booking
   */
  async cancel(bookingId: string, reason?: string): Promise<Booking> {
    return this.update(bookingId, {
      status: "cancelled",
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
    });
  }

  /**
   * Verify OTP
   */
  async verifyOtp(bookingId: string, otpCode: string): Promise<boolean> {
    const booking = await this.findById(bookingId);
    if (!booking) {
      throw new Error(`Booking not found: ${bookingId}`);
    }
    
    if (booking.otp_code !== otpCode) {
      return false;
    }
    
    if (booking.otp_expires_at && new Date(booking.otp_expires_at) < new Date()) {
      return false;
    }
    
    await this.update(bookingId, {
      otp_verified: true,
    });
    
    return true;
  }

  /**
   * Set OTP for booking
   */
  async setOtp(bookingId: string, otpCode: string, expiresInMinutes: number = 10): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
    
    await this.update(bookingId, {
      otp_code: otpCode,
      otp_verified: false,
      otp_expires_at: expiresAt.toISOString(),
    });
  }

  /**
   * Reschedule booking
   */
  async reschedule(bookingId: string, newDate: string, newTime: string): Promise<Booking> {
    // Create new booking for reschedule
    const originalBooking = await this.findById(bookingId);
    if (!originalBooking) {
      throw new Error(`Booking not found: ${bookingId}`);
    }
    
    return await withTransaction(async (client) => {
      // Update original booking
      await this.update(bookingId, {
        status: "rescheduled",
        rescheduled_from_booking_id: bookingId,
      });
      
      // Create new booking
      const newBooking = await this.create({
        customer_id: originalBooking.customer_id,
        vendor_id: originalBooking.vendor_id || undefined,
        staff_id: originalBooking.staff_id || undefined,
        service_id: originalBooking.service_id,
        booking_date: newDate, // Will be mapped to scheduled_date
        booking_time: newTime, // Will be mapped to scheduled_time
        service_type: originalBooking.service_type,
        address: originalBooking.address || undefined,
        city: originalBooking.city || undefined,
        state: originalBooking.state || undefined,
        pincode: originalBooking.pincode || undefined,
        base_price: originalBooking.base_price,
        discount_amount: originalBooking.discount_amount,
        tax_amount: originalBooking.tax_amount,
        total_amount: originalBooking.total_amount,
        notes: `Rescheduled from booking ${bookingId}`,
      });
      
      return newBooking;
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: BookingsRepository | null = null;

export function getBookingsRepository(): BookingsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new BookingsRepository();
  }
  return repositoryInstance;
}

