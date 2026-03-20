import { phoneSchema, uuidSchema, amountSchema, safeStringSchema } from "src/middleware/validation-middleware";
import z from "zod";

export const approveInvoiceRequestSchema = z.object({
    approved: z.boolean({
      required_error: 'approved is required',
      invalid_type_error: 'approved must be a boolean',
    }),
    phone: phoneSchema.optional(),
  }).strict();

/**
 * Pharmacy order item schema
 */
export const pharmacyOrderItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').optional(),
  productId: uuidSchema.optional(),
  id: uuidSchema.optional(), // Alternative to productId
  quantity: z.coerce.number().int().positive('Quantity must be a positive integer'),
  price: amountSchema,
  prescription_required: z.boolean().optional().default(false),
}).strict().refine(
  (data) => data.name || data.productId || data.id,
  { message: 'Either name, productId, or id must be provided' }
);

/**
 * Delivery address schema
 */
export const deliveryAddressSchema = z.object({
  addressLine1: z.string().min(1, 'Address line 1 is required').optional(),
  street: z.string().min(1, 'Street address is required').optional(), // Alternative to addressLine1
  addressLine2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  latitude: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90').optional(),
  lat: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90').optional(), // Alternative to latitude
  longitude: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180').optional(),
  lng: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180').optional(), // Alternative to longitude
  phone: phoneSchema.optional(),
  name: z.string().min(1, 'Name is required').optional(),
}).strict().refine(
  (data) => data.addressLine1 || data.street,
  { message: 'Either addressLine1 or street must be provided' }
);

/**
 * Tax breakdown schema (optional nested object)
 */
export const taxBreakdownSchema = z.record(z.string(), z.union([
  z.number(),
  z.string(),
  z.object({}).passthrough(),
])).optional();

/**
 * POST /customer/pharmacy/orders
 * Create pharmacy order request schema
 */
export const createPharmacyOrderRequestSchema = z.object({
  items: z.array(pharmacyOrderItemSchema).min(1, 'At least one item is required'),
  address: deliveryAddressSchema,
  phone: phoneSchema,
  subtotal: amountSchema.optional(),
  taxAmount: amountSchema.optional(),
  taxBreakdown: taxBreakdownSchema,
  total: amountSchema.optional(),
  prescription_verified: z.boolean().optional().default(false),
  prescriptionId: uuidSchema.optional(),
  orderType: safeStringSchema(100).optional(),
  notes: safeStringSchema(5000).optional(),
}).strict();