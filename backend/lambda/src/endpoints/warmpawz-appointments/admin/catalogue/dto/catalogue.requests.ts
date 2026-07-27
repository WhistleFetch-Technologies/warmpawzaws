import { z } from 'zod';
import { uuidSchema } from 'src/middleware/validation-middleware';
import {
  ALLOWED_ELIGIBILITY_FILTERS,
  ALLOWED_PUBLISH_STATUS_FILTERS,
  ALLOWED_SORT_FIELDS,
  ALLOWED_SORT_ORDERS,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_FIELD,
  DEFAULT_SORT_ORDER,
  MAX_BULK_SIZE,
  MAX_PAGE_SIZE,
} from '../../../constants/catalogue-limits';

const MAX_SEARCH_QUERY_LENGTH = 256;
const MAX_CITY_LENGTH = 128;
const MAX_VENDOR_STATUS_LENGTH = 64;

export const appointmentFeeSchema = z
  .number({
    required_error: 'Appointment fee is required',
    invalid_type_error: 'Appointment fee must be a number',
  })
  .finite('Appointment fee must be a finite number')
  .min(0, 'Appointment fee must be >= 0')
  .refine((value) => Math.round(value * 100) === value * 100, {
    message: 'Appointment fee must have at most 2 decimal places',
  });

export const createCatalogueRequestSchema = z
  .object({
    vendorId: uuidSchema,
    appointmentFee: appointmentFeeSchema.optional().default(0),
  })
  .strict();

export type CreateCatalogueRequest = z.infer<typeof createCatalogueRequestSchema>;

export const updateCatalogueFeeRequestSchema = z
  .object({
    appointmentFee: appointmentFeeSchema,
  })
  .strict();

export type UpdateCatalogueFeeRequest = z.infer<typeof updateCatalogueFeeRequestSchema>;

export const bulkCatalogueRequestSchema = z
  .object({
    catalogueIds: z
      .array(uuidSchema)
      .min(1, 'At least one catalogue ID is required')
      .max(MAX_BULK_SIZE, `Bulk operations cannot exceed ${MAX_BULK_SIZE} catalogue IDs`),
  })
  .strict();

export type BulkCatalogueRequest = z.infer<typeof bulkCatalogueRequestSchema>;

export const bulkCatalogueFeeRequestSchema = z
  .object({
    catalogueIds: z
      .array(uuidSchema)
      .min(1, 'At least one catalogue ID is required')
      .max(MAX_BULK_SIZE, `Bulk operations cannot exceed ${MAX_BULK_SIZE} catalogue IDs`),
    appointmentFee: appointmentFeeSchema,
  })
  .strict();

export type BulkCatalogueFeeRequest = z.infer<typeof bulkCatalogueFeeRequestSchema>;

export const catalogueListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .optional()
      .default(DEFAULT_PAGE_SIZE),
    sortBy: z.enum(ALLOWED_SORT_FIELDS).optional().default(DEFAULT_SORT_FIELD),
    sortOrder: z.enum(ALLOWED_SORT_ORDERS).optional().default(DEFAULT_SORT_ORDER),
    publishStatus: z.enum(ALLOWED_PUBLISH_STATUS_FILTERS).optional(),
    q: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).optional(),
    eligibility: z.enum(ALLOWED_ELIGIBILITY_FILTERS).optional(),
    city: z.string().trim().min(1).max(MAX_CITY_LENGTH).optional(),
    vendorId: uuidSchema.optional(),
    category: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).optional(),
    serviceCategory: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).optional(),
  })
  .strict();

export type CatalogueListQuery = z.infer<typeof catalogueListQuerySchema>;

export const vendorCandidatesQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .optional()
      .default(DEFAULT_PAGE_SIZE),
    status: z.string().trim().min(1).max(MAX_VENDOR_STATUS_LENGTH).optional(),
    eligibility: z.enum(ALLOWED_ELIGIBILITY_FILTERS).optional(),
    vendorId: uuidSchema.optional(),
    category: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).optional(),
    serviceCategory: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).optional(),
  })
  .strict();

export type VendorCandidatesQuery = z.infer<typeof vendorCandidatesQuerySchema>;

export function parseCreateCatalogueRequest(input: unknown): CreateCatalogueRequest {
  return createCatalogueRequestSchema.parse(input);
}

export function parseUpdateCatalogueFeeRequest(input: unknown): UpdateCatalogueFeeRequest {
  return updateCatalogueFeeRequestSchema.parse(input);
}

export function parseBulkCatalogueRequest(input: unknown): BulkCatalogueRequest {
  return bulkCatalogueRequestSchema.parse(input);
}

export function parseBulkCatalogueFeeRequest(input: unknown): BulkCatalogueFeeRequest {
  return bulkCatalogueFeeRequestSchema.parse(input);
}

export function parseCatalogueListQuery(input: unknown): CatalogueListQuery {
  return catalogueListQuerySchema.parse(input);
}

export function parseVendorCandidatesQuery(input: unknown): VendorCandidatesQuery {
  return vendorCandidatesQuerySchema.parse(input);
}
