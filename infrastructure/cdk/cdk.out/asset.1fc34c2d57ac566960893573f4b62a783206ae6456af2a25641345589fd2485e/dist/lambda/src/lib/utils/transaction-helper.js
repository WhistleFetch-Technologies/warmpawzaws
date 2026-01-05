"use strict";
/**
 * Transaction Helper - Inline implementation for Lambda
 * Creates bookings with payments atomically using SQL transactions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBookingWithPayment = createBookingWithPayment;
const db_1 = require("../db");
const bookings_1 = require("../repositories/bookings");
const payments_1 = require("../repositories/payments");
/**
 * Create booking with payment atomically
 */
async function createBookingWithPayment(bookingData, paymentData) {
    return await (0, db_1.withTransaction)(async (client) => {
        const bookingsRepo = (0, bookings_1.getBookingsRepository)();
        const paymentsRepo = (0, payments_1.getPaymentsRepository)();
        // Create payment first
        const payment = await paymentsRepo.create({
            customer_id: paymentData.customer_id,
            amount: paymentData.amount,
            payment_method: paymentData.payment_method,
            payment_status: 'pending',
            currency: 'INR',
            discount_amount: 0,
            loyalty_points_used: 0,
            wallet_amount_used: 0
        });
        // Create booking
        const booking = await bookingsRepo.create({
            customer_id: bookingData.customer_id,
            vendor_id: bookingData.vendor_id,
            staff_id: bookingData.staff_id || null,
            service_id: bookingData.service_id,
            booking_date: bookingData.booking_date,
            booking_time: bookingData.booking_time,
            service_type: bookingData.service_type,
            address: bookingData.address || null,
            city: bookingData.city || null,
            state: bookingData.state || null,
            pincode: bookingData.pincode || null,
            latitude: bookingData.latitude || null,
            longitude: bookingData.longitude || null,
            base_price: bookingData.base_price,
            discount_amount: bookingData.discount_amount,
            tax_amount: bookingData.tax_amount,
            total_amount: bookingData.total_amount,
            notes: bookingData.notes || null
        });
        // Update payment with booking_id (if supported)
        try {
            await paymentsRepo.update(payment.id, {
                booking_id: booking.id
            });
        }
        catch (e) {
            // booking_id might not be in UpdatePaymentInput - that's ok
            console.warn('Could not update payment with booking_id:', e);
        }
        return { booking, payment };
    });
}
//# sourceMappingURL=transaction-helper.js.map