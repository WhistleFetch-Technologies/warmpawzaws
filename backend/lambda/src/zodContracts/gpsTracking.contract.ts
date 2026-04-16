import { datetimeSchema, safeStringSchema, uuidSchema } from "src/middleware/validation-middleware";
import z from "zod";

/** Standard bookings use 4-digit `otp_code`; some flows (e.g. instant tele) use 6-digit. */
export const bookingServiceOtpSchema = z
  .string()
  .regex(/^\d{4}$|^\d{6}$/, "OTP must be 4 or 6 digits");

export const startSessionRequestSchema = z.object({
    otp: bookingServiceOtpSchema,
    vendorId: uuidSchema,
}).strict();

export const completeBookingRequestSchema = z.object({
    otp: bookingServiceOtpSchema.optional(),
    vendorId: uuidSchema,
}).strict();


export const startTravelRequestSchema = z.object({
    vendorId: uuidSchema,
    staffId: uuidSchema.optional(),
    startLocation: z.object({
        latitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
        longitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
    }).optional(),
}).strict();



export const markArrivedRequestSchema = z.object({
    vendorId: uuidSchema,
    arrivedAt: datetimeSchema.optional(),
    location: z.object({
        latitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
        longitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
    }).optional(),
}).strict();


export const locationUpdateRequestSchema = z.object({
    latitude: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().min(-90).max(90, "Latitude must be between -90 and 90")),
    longitude: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().min(-180).max(180, "Longitude must be between -180 and 180")),
    accuracy: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().positive("Accuracy must be positive")).optional(),
    heading: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().min(0).max(360, "Heading must be between 0 and 360 degrees")).optional(),
    speed: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().min(0, "Speed must be non-negative")).optional(),
}).strict();


export const checkInRequestSchema = z.object({
    vendorId: uuidSchema,
    staffId: uuidSchema.optional(),
    notes: safeStringSchema(5000).optional(),
    petCondition: safeStringSchema(2000).optional(),
}).strict();

export const endSessionRequestSchema = z.object({
    vendorId: uuidSchema,
    notes: safeStringSchema(5000).optional(),
}).strict();


export const otpVerifyRequestSchema = z.object({
    otp: bookingServiceOtpSchema,
    action: z
      .enum([
        'start',
        'complete',
        'end',
        'start_travel',
        'mark_arrived',
        'check_in',
        'end_session',
      ])
      .optional(),
}).strict();

export const acceptBookingRequestSchema = z.object({
    vendorId: uuidSchema,
}).strict();

export const rejectBookingRequestSchema = z.object({
    vendorId: uuidSchema,
    reason: safeStringSchema(2000).optional(),
}).strict();

