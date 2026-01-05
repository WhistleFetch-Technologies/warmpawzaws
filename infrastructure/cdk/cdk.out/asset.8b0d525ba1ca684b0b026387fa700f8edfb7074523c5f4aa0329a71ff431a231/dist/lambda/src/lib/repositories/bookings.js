"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsRepository = void 0;
exports.getBookingsRepository = getBookingsRepository;
const db_1 = require("../db");
// ============================================================================
// REPOSITORY CLASS
// ============================================================================
class BookingsRepository {
    pool = null;
    constructor(pool) {
        if (pool) {
            this.pool = pool;
        }
    }
    async getPool() {
        if (!this.pool) {
            this.pool = await (0, db_1.getDbClient)();
        }
        return this.pool;
    }
    /**
     * Get booking by ID
     * Replaces: kv.get(`booking:${bookingId}`)
     */
    async findById(bookingId) {
        const results = await (0, db_1.selectQuery)("bookings", { id: bookingId }, { limit: 1 });
        return results[0] || null;
    }
    /**
     * Get bookings by customer
     * Replaces: customer:{id}:bookings KV pattern
     */
    async findByCustomer(customerId, options) {
        const filters = { customer_id: customerId };
        if (options?.status) {
            filters.status = options.status;
        }
        return (0, db_1.selectQuery)("bookings", filters, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "booking_date",
            orderDirection: "desc",
        });
    }
    /**
     * Get bookings by vendor
     * Replaces: vendor:{id}:bookings KV pattern
     */
    async findByVendor(vendorId, options) {
        const filters = { vendor_id: vendorId };
        if (options?.status) {
            filters.status = options.status;
        }
        if (options?.date) {
            filters.booking_date = options.date;
        }
        return (0, db_1.selectQuery)("bookings", filters, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "booking_date",
            orderDirection: "desc",
        });
    }
    /**
     * Get bookings by staff
     */
    async findByStaff(staffId, options) {
        const filters = { staff_id: staffId };
        if (options?.date) {
            filters.booking_date = options.date;
        }
        return (0, db_1.selectQuery)("bookings", filters, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "booking_date",
            orderDirection: "desc",
        });
    }
    /**
     * Get bookings by vendor and date
     */
    async findByVendorAndDate(vendorId, date) {
        return (0, db_1.selectQuery)("bookings", {
            vendor_id: vendorId,
            booking_date: date
        }, {
            orderBy: "booking_time",
            orderDirection: "asc",
        });
    }
    /**
     * Get pending bookings
     * Replaces: booking:pending KV key
     */
    async findPending(options) {
        return (0, db_1.selectQuery)("bookings", { status: "pending" }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "booking_date",
            orderDirection: "asc",
        });
    }
    /**
     * Get upcoming bookings
     */
    async findUpcoming(customerId, vendorId, options) {
        const pool = await this.getPool();
        const filters = {};
        let query = 'SELECT * FROM bookings WHERE booking_date >= $1 AND status IN ($2, $3)';
        const params = [
            new Date().toISOString().split('T')[0],
            'pending',
            'confirmed'
        ];
        let paramIndex = 4;
        if (customerId) {
            query += ` AND customer_id = $${paramIndex}`;
            params.push(customerId);
            paramIndex++;
        }
        if (vendorId) {
            query += ` AND vendor_id = $${paramIndex}`;
            params.push(vendorId);
            paramIndex++;
        }
        query += ' ORDER BY booking_date ASC, booking_time ASC';
        if (options?.limit) {
            query += ` LIMIT $${paramIndex}`;
            params.push(options.limit);
            paramIndex++;
        }
        if (options?.offset) {
            query += ` OFFSET $${paramIndex}`;
            params.push(options.offset);
        }
        const result = await pool.query(query, params);
        return result.rows;
    }
    /**
     * Create a new booking
     * Replaces: kv.set(`booking:${bookingId}`, bookingData)
     */
    async create(input) {
        const results = await (0, db_1.insertQuery)("bookings", {
            ...input,
            status: "pending",
            payment_status: "pending",
            discount_amount: input.discount_amount || 0,
            tax_amount: input.tax_amount || 0,
            loyalty_points_used: input.loyalty_points_used || 0,
            is_package: input.is_package || false,
            otp_verified: false,
        });
        if (!results[0]) {
            throw new Error("Failed to create booking");
        }
        return results[0];
    }
    /**
     * Update booking
     * Replaces: kv.set(`booking:${bookingId}`, updatedData)
     */
    async update(bookingId, input) {
        const results = await (0, db_1.updateQuery)("bookings", { id: bookingId }, {
            ...input,
            updated_at: new Date().toISOString(),
        });
        if (!results[0]) {
            throw new Error(`Booking not found: ${bookingId}`);
        }
        return results[0];
    }
    /**
     * Confirm booking
     */
    async confirm(bookingId) {
        return this.update(bookingId, {
            status: "confirmed",
        });
    }
    /**
     * Complete booking
     */
    async complete(bookingId) {
        return this.update(bookingId, {
            status: "completed",
            completed_at: new Date().toISOString(),
        });
    }
    /**
     * Cancel booking
     */
    async cancel(bookingId, reason) {
        return this.update(bookingId, {
            status: "cancelled",
            cancellation_reason: reason,
            cancelled_at: new Date().toISOString(),
        });
    }
    /**
     * Verify OTP
     */
    async verifyOtp(bookingId, otpCode) {
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
    async setOtp(bookingId, otpCode, expiresInMinutes = 10) {
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
    async reschedule(bookingId, newDate, newTime) {
        // Create new booking for reschedule
        const originalBooking = await this.findById(bookingId);
        if (!originalBooking) {
            throw new Error(`Booking not found: ${bookingId}`);
        }
        return await (0, db_1.withTransaction)(async (client) => {
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
                booking_date: newDate,
                booking_time: newTime,
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
exports.BookingsRepository = BookingsRepository;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let repositoryInstance = null;
function getBookingsRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new BookingsRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=bookings.js.map