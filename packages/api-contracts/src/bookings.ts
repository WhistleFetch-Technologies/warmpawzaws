/**
 * ============================================================================
 * BOOKING API CONTRACTS
 * ============================================================================
 */

import { z } from 'zod';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

// Schema for individual service in multi-service booking
// id/serviceId can be UUID or catalog ID (string) - backend accepts both
export const SelectedServiceSchema = z.object({
  id: z.string().optional(),
  serviceId: z.string().optional(),
  name: z.string().optional(),
  price: z.coerce.number().optional(),
  duration: z.coerce.number().optional(),
  quantity: z.coerce.number().int().positive().optional().default(1),
});

const CreateBookingRequestSchemaBase = z.object({
  customerId: z.string().uuid('Invalid customer ID format'),
  vendorId: z.string().uuid('Invalid vendor ID format'),
  serviceId: z.union([
    z.string().uuid('Invalid service ID format'),
    z.string().refine(
      (s) => /^diagnostics?$/i.test(s) || /^warmpawz_appointments$/i.test(s),
      'Must be UUID, diagnostics, or warmpawz_appointments',
    ),
  ]),
  /** Warmpawz Appointments: server reads catalogue fee; client may send slug serviceId. */
  bookingMode: z.enum(['warmpawz_appointments']).optional(),
  staffId: z.string().uuid('Invalid staff ID format').optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  bookingTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format (HH:MM)'),
  serviceType: z.enum(['at_vendor', 'at_home', 'online', 'at_center', 'tele', 'hybrid', 'product'], {
    errorMap: () => ({ message: 'Service type must be at_vendor/at_center, at_home, or online/tele' }),
  }),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  /** DB may use UUID or legacy string ids (e.g. prefixed); booking handler validates ownership when needed. */
  petId: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().min(1).max(128).optional()),
  amount: z.coerce.number().min(0, 'Amount must be non-negative').optional(),
  totalAmount: z.coerce.number().min(0, 'Total amount must be non-negative').optional(),
  notes: z.string().max(10000, 'Notes too long').optional(),
  idempotencyKey: z.string().uuid('Invalid idempotency key format').optional(),
  couponCode: z.string().optional(),
  promotionId: z.string().uuid('Invalid promotion ID format').optional(),
  selectedServices: z.array(SelectedServiceSchema).optional(),
  serviceName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  petName: z.string().optional(),
  packagePurchaseId: z.string().uuid('Invalid package purchase ID format').optional(),
  /** Boarding / pet sitting: end of stay (YYYY-MM-DD). */
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid check-out date').optional(),
  checkOutTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid check-out time (HH:MM)')
    .optional(),
  /** Client-computed stay length; server recomputes for pet sitting when checkout times are sent. */
  totalDurationMinutes: z.coerce.number().int().positive().optional(),
  numberOfNights: z.coerce.number().int().min(0).optional(),
  /** Customer app: drives timed pet-sitting / boarding / swimming pricing on the API. */
  flowVariant: z.enum(['pet_sitting', 'boarding', 'swimming']).optional(),
  /** Snake_case alias for `flowVariant` (merged during parse). */
  flow_variant: z.enum(['pet_sitting', 'boarding', 'swimming']).optional(),
  /** When true, server debits `customer_wallets` at booking create (wallet-only or split with Razorpay). */
  useWallet: z.boolean().optional(),
  /** Max INR to take from wallet; server clamps to balance and list price. */
  walletAmount: z.coerce.number().min(0).optional(),
  /** Diagnostics (pay-first): Razorpay order id after successful checkout + /razorpay/verify-payment. */
  razorpayOrderId: z.string().min(1).max(96).optional(),
});

export const CreateBookingRequestSchema = CreateBookingRequestSchemaBase.transform((d) => {
  const { flow_variant, ...rest } = d;
  return {
    ...rest,
    flowVariant: d.flowVariant ?? flow_variant,
  };
}).superRefine((data, ctx) => {
  if (data.flowVariant === 'boarding') {
    const cod = data.checkOutDate;
    const cot = data.checkOutTime;
    if (cod == null || String(cod).trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'checkOutDate is required when flowVariant is boarding',
        path: ['checkOutDate'],
      });
    }
    if (cot == null || String(cot).trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'checkOutTime is required when flowVariant is boarding',
        path: ['checkOutTime'],
      });
    }
  }
  if (data.flowVariant === 'swimming') {
    const cod = data.checkOutDate;
    const cot = data.checkOutTime;
    if (cod == null || String(cod).trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'checkOutDate is required when flowVariant is swimming',
        path: ['checkOutDate'],
      });
    } else if (String(cod).trim() !== String(data.bookingDate).trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Swimming sessions must check out on the same day as check-in',
        path: ['checkOutDate'],
      });
    }
    if (cot == null || String(cot).trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'checkOutTime is required when flowVariant is swimming',
        path: ['checkOutTime'],
      });
    }
  }
});

export const UpdateBookingStatusRequestSchema = z.object({
  status: z.enum([
    'pending', 'confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled',
    'sample_collected', 'sample_received_at_lab', 'processing', 'reports_ready'
  ], {
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
  serviceType: z.enum(['at_vendor', 'at_home', 'online', 'at_center', 'tele', 'hybrid', 'product']),
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
  selectedServices: z.array(SelectedServiceSchema).nullable().optional(),
  totalDurationMinutes: z.number().nullable().optional(),
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

