/**
 * ============================================================================
 * BOOKING API CONTRACTS
 * ============================================================================
 */

import { z } from 'zod';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const CreateBookingRequestSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID format'),
  vendorId: z.string().uuid('Invalid vendor ID format'),
  serviceId: z.string().uuid('Invalid service ID format'),
  staffId: z.string().uuid('Invalid staff ID format').optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  bookingTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format (HH:MM)'),
  serviceType: z.enum(['at_vendor', 'at_home', 'online'], {
    errorMap: () => ({ message: 'Service type must be at_vendor, at_home, or online' }),
  }),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  petId: z.string().uuid('Invalid pet ID format').optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
  idempotencyKey: z.string().uuid('Invalid idempotency key format').optional(),
  couponCode: z.string().optional(),
  promotionId: z.string().uuid('Invalid promotion ID format').optional(),
});

export const UpdateBookingStatusRequestSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'], {
    errorMap: () => ({ message: 'Invalid booking status' }),
  }),
  reason: z.string().max(500, 'Reason too long').optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
});

export const RescheduleBookingRequestSchema = z.object({
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  bookingTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format (HH:MM)'),
  reason: z.string().max(500, 'Reason too long').optional(),
});

export const CancelBookingRequestSchema = z.object({
  reason: z.string().max(500, 'Reason too long').optional(),
  refundRequested: z.boolean().optional(),
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const BookingSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  vendorId: z.string().uuid().nullable(),
  staffId: z.string().uuid().nullable(),
  serviceId: z.string().uuid(),
  bookingDate: z.string(),
  bookingTime: z.string(),
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled']),
  serviceType: z.enum(['at_vendor', 'at_home', 'online']),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  basePrice: z.number(),
  discountAmount: z.number(),
  taxAmount: z.number(),
  totalAmount: z.number(),
  paymentStatus: z.enum(['pending', 'partial', 'paid', 'refunded', 'failed']),
  paymentId: z.string().uuid().nullable(),
  petId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
});

export const BookingStatusHistorySchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  previousStatus: z.string().nullable(),
  newStatus: z.string(),
  changedBy: z.string().uuid().nullable(),
  changedByType: z.enum(['customer', 'vendor', 'staff', 'admin', 'system']),
  changeReason: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const CreateBookingResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    bookingId: z.string().uuid(),
    status: z.string(),
    message: z.string(),
    isNew: z.boolean(),
  }),
});

export const GetBookingResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    booking: BookingSchema,
  }),
});

export const BookingListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    bookings: z.array(BookingSchema),
    total: z.number(),
    page: z.number().optional(),
    limit: z.number().optional(),
  }),
});

export const BookingStatusHistoryResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    history: z.array(BookingStatusHistorySchema),
  }),
});

// ============================================================================
// TYPES
// ============================================================================

export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;
export type UpdateBookingStatusRequest = z.infer<typeof UpdateBookingStatusRequestSchema>;
export type RescheduleBookingRequest = z.infer<typeof RescheduleBookingRequestSchema>;
export type CancelBookingRequest = z.infer<typeof CancelBookingRequestSchema>;
export type Booking = z.infer<typeof BookingSchema>;
export type BookingStatusHistory = z.infer<typeof BookingStatusHistorySchema>;
export type CreateBookingResponse = z.infer<typeof CreateBookingResponseSchema>;
export type GetBookingResponse = z.infer<typeof GetBookingResponseSchema>;
export type BookingListResponse = z.infer<typeof BookingListResponseSchema>;
export type BookingStatusHistoryResponse = z.infer<typeof BookingStatusHistoryResponseSchema>;

