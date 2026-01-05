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
import type { Pool } from "../db";
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
    payment_status: string;
    payment_id?: string | null;
    otp_code?: string | null;
    otp_verified: boolean;
    otp_expires_at?: string | null;
    otp_start_code?: string | null;
    otp_end_code?: string | null;
    otp_start_verified?: boolean;
    otp_end_verified?: boolean;
    otp_start_attempts?: number;
    otp_end_attempts?: number;
    started_at?: string | null;
    pet_id?: string | null;
    notes?: string | null;
    cancellation_reason?: string | null;
    rescheduled_from_booking_id?: string | null;
    created_at: string;
    updated_at: string;
    completed_at?: string | null;
    cancelled_at?: string | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    service_location?: string | null;
    metadata?: any;
    commute_time?: number | null;
    service_name?: string | null;
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
    metadata?: any;
    payment_status?: string;
    status?: string;
    otp_start_code?: string;
    otp_end_code?: string;
    otp_start_verified?: boolean;
    otp_end_verified?: boolean;
    otp_start_attempts?: number;
    otp_end_attempts?: number;
    pet_id?: string;
}
export interface UpdateBookingInput {
    total_amount?: number;
    status?: string;
    payment_status?: string;
    payment_id?: string;
    otp_code?: string;
    otp_verified?: boolean;
    otp_expires_at?: string;
    otp_start_code?: string;
    otp_end_code?: string;
    otp_start_verified?: boolean;
    otp_end_verified?: boolean;
    otp_start_attempts?: number;
    otp_end_attempts?: number;
    started_at?: string;
    notes?: string;
    cancellation_reason?: string;
    rescheduled_from_booking_id?: string;
    completed_at?: string;
    cancelled_at?: string;
    pet_id?: string;
}
export declare class BookingsRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    /**
     * Get booking by ID
     * Replaces: kv.get(`booking:${bookingId}`)
     */
    findById(bookingId: string): Promise<Booking | null>;
    /**
     * Get bookings by customer
     * Replaces: customer:{id}:bookings KV pattern
     */
    findByCustomer(customerId: string, options?: {
        limit?: number;
        offset?: number;
        status?: string;
    }): Promise<Booking[]>;
    /**
     * Get bookings by vendor
     * Replaces: vendor:{id}:bookings KV pattern
     */
    findByVendor(vendorId: string, options?: {
        limit?: number;
        offset?: number;
        status?: string;
        date?: string;
    }): Promise<Booking[]>;
    /**
     * Get bookings by staff
     */
    findByStaff(staffId: string, options?: {
        limit?: number;
        offset?: number;
        date?: string;
    }): Promise<Booking[]>;
    /**
     * Get bookings by vendor and date
     */
    findByVendorAndDate(vendorId: string, date: string): Promise<Booking[]>;
    /**
     * Get pending bookings
     * Replaces: booking:pending KV key
     */
    findPending(options?: {
        limit?: number;
        offset?: number;
    }): Promise<Booking[]>;
    /**
     * Get upcoming bookings
     */
    findUpcoming(customerId?: string, vendorId?: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Booking[]>;
    /**
     * Create a new booking
     * Replaces: kv.set(`booking:${bookingId}`, bookingData)
     */
    create(input: CreateBookingInput): Promise<Booking>;
    /**
     * Update booking
     * Replaces: kv.set(`booking:${bookingId}`, updatedData)
     */
    update(bookingId: string, input: UpdateBookingInput): Promise<Booking>;
    /**
     * Confirm booking
     */
    confirm(bookingId: string): Promise<Booking>;
    /**
     * Complete booking
     */
    complete(bookingId: string): Promise<Booking>;
    /**
     * Cancel booking
     */
    cancel(bookingId: string, reason?: string): Promise<Booking>;
    /**
     * Verify OTP
     */
    verifyOtp(bookingId: string, otpCode: string): Promise<boolean>;
    /**
     * Set OTP for booking
     */
    setOtp(bookingId: string, otpCode: string, expiresInMinutes?: number): Promise<void>;
    /**
     * Reschedule booking
     */
    reschedule(bookingId: string, newDate: string, newTime: string): Promise<Booking>;
}
export declare function getBookingsRepository(): BookingsRepository;
//# sourceMappingURL=bookings.d.ts.map