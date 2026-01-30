"use strict";
/**
 * ============================================================================
 * BOOKING API CONTRACTS
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingStatusHistoryResponseSchema = exports.BookingListResponseSchema = exports.GetBookingResponseSchema = exports.CreateBookingResponseSchema = exports.BookingStatusHistorySchema = exports.BookingSchema = exports.CancelBookingRequestSchema = exports.RescheduleBookingRequestSchema = exports.UpdateBookingStatusRequestSchema = exports.CreateBookingRequestSchema = exports.SelectedServiceSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// REQUEST SCHEMAS
// ============================================================================
// Schema for individual service in multi-service booking
// id/serviceId can be UUID or catalog ID (string) - backend accepts both
exports.SelectedServiceSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    serviceId: zod_1.z.string().optional(),
    name: zod_1.z.string().optional(),
    price: zod_1.z.coerce.number().optional(),
    duration: zod_1.z.coerce.number().optional(),
    quantity: zod_1.z.coerce.number().int().positive().optional().default(1),
});
exports.CreateBookingRequestSchema = zod_1.z.object({
    customerId: zod_1.z.string().uuid('Invalid customer ID format'),
    vendorId: zod_1.z.string().uuid('Invalid vendor ID format'),
    serviceId: zod_1.z.union([
        zod_1.z.string().uuid('Invalid service ID format'),
        zod_1.z.string().refine(s => /^diagnostics?$/i.test(s), 'Must be UUID or diagnostics')
    ]),
    staffId: zod_1.z.string().uuid('Invalid staff ID format').optional(),
    bookingDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    bookingTime: zod_1.z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format (HH:MM)'),
    serviceType: zod_1.z.enum(['at_vendor', 'at_home', 'online', 'at_center', 'tele', 'hybrid', 'product'], {
        errorMap: () => ({ message: 'Service type must be at_vendor/at_center, at_home, or online/tele' }),
    }),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    pincode: zod_1.z.string().optional(),
    latitude: zod_1.z.number().min(-90).max(90).optional(),
    longitude: zod_1.z.number().min(-180).max(180).optional(),
    petId: zod_1.z.string().uuid('Invalid pet ID format').optional(),
    amount: zod_1.z.coerce.number().min(0, 'Amount must be non-negative').optional(),
    totalAmount: zod_1.z.coerce.number().min(0, 'Total amount must be non-negative').optional(),
    notes: zod_1.z.string().max(10000, 'Notes too long').optional(),
    idempotencyKey: zod_1.z.string().uuid('Invalid idempotency key format').optional(),
    couponCode: zod_1.z.string().optional(),
    promotionId: zod_1.z.string().uuid('Invalid promotion ID format').optional(),
    // ✅ NEW: Support for multiple services in a single booking
    selectedServices: zod_1.z.array(exports.SelectedServiceSchema).optional(),
    serviceName: zod_1.z.string().optional(),
    customerPhone: zod_1.z.string().optional(),
    customerName: zod_1.z.string().optional(),
    petName: zod_1.z.string().optional(),
});
exports.UpdateBookingStatusRequestSchema = zod_1.z.object({
    status: zod_1.z.enum([
        'pending', 'confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled',
        'sample_collected', 'sample_received_at_lab', 'processing', 'reports_ready'
    ], {
        errorMap: () => ({ message: 'Invalid booking status' }),
    }),
    reason: zod_1.z.string().max(500, 'Reason too long').optional(),
    notes: zod_1.z.string().max(1000, 'Notes too long').optional(),
});
exports.RescheduleBookingRequestSchema = zod_1.z.object({
    bookingDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    bookingTime: zod_1.z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format (HH:MM)'),
    reason: zod_1.z.string().max(500, 'Reason too long').optional(),
});
exports.CancelBookingRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().max(500, 'Reason too long').optional(),
    refundRequested: zod_1.z.boolean().optional(),
});
// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================
exports.BookingSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    customerId: zod_1.z.string().uuid(),
    vendorId: zod_1.z.string().uuid().nullable(),
    staffId: zod_1.z.string().uuid().nullable(),
    serviceId: zod_1.z.string().uuid(),
    bookingDate: zod_1.z.string(),
    bookingTime: zod_1.z.string(),
    status: zod_1.z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled']),
    serviceType: zod_1.z.enum(['at_vendor', 'at_home', 'online', 'at_center', 'tele', 'hybrid', 'product']),
    address: zod_1.z.string().nullable(),
    city: zod_1.z.string().nullable(),
    state: zod_1.z.string().nullable(),
    pincode: zod_1.z.string().nullable(),
    latitude: zod_1.z.number().nullable(),
    longitude: zod_1.z.number().nullable(),
    basePrice: zod_1.z.number(),
    discountAmount: zod_1.z.number(),
    taxAmount: zod_1.z.number(),
    totalAmount: zod_1.z.number(),
    paymentStatus: zod_1.z.enum(['pending', 'partial', 'paid', 'refunded', 'failed']),
    paymentId: zod_1.z.string().uuid().nullable(),
    petId: zod_1.z.string().uuid().nullable(),
    notes: zod_1.z.string().nullable(),
    cancellationReason: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
    completedAt: zod_1.z.string().datetime().nullable(),
    cancelledAt: zod_1.z.string().datetime().nullable(),
    // ✅ NEW: Support for multiple services
    selectedServices: zod_1.z.array(exports.SelectedServiceSchema).nullable().optional(),
    totalDurationMinutes: zod_1.z.number().nullable().optional(),
});
exports.BookingStatusHistorySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    bookingId: zod_1.z.string().uuid(),
    previousStatus: zod_1.z.string().nullable(),
    newStatus: zod_1.z.string(),
    changedBy: zod_1.z.string().uuid().nullable(),
    changedByType: zod_1.z.enum(['customer', 'vendor', 'staff', 'admin', 'system']),
    changeReason: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string().datetime(),
});
exports.CreateBookingResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        bookingId: zod_1.z.string().uuid(),
        status: zod_1.z.string(),
        message: zod_1.z.string(),
        isNew: zod_1.z.boolean(),
    }),
});
exports.GetBookingResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        booking: exports.BookingSchema,
    }),
});
exports.BookingListResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        bookings: zod_1.z.array(exports.BookingSchema),
        total: zod_1.z.number(),
        page: zod_1.z.number().optional(),
        limit: zod_1.z.number().optional(),
    }),
});
exports.BookingStatusHistoryResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        history: zod_1.z.array(exports.BookingStatusHistorySchema),
    }),
});
