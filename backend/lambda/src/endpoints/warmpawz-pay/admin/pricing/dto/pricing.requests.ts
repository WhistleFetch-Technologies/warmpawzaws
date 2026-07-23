import { z } from 'zod';
import { uuidSchema } from '../../../../../middleware/validation-middleware';
import {
  ALLOWED_PRICING_DISCOUNT_TYPE_FILTERS,
  ALLOWED_PRICING_DISCOUNT_TYPES,
  ALLOWED_PRICING_SORT_FIELDS,
  ALLOWED_PRICING_STATUSES,
  ALLOWED_PRICING_STATUS_FILTERS,
  DEFAULT_PRICING_SORT_FIELD,
  PRICING_DISCOUNT_TYPE,
  PRICING_STATUS,
} from '../../../constants/merchant-pricing';
import {
  ALLOWED_SORT_ORDERS,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_ORDER,
  MAX_PAGE_SIZE,
} from '../../../constants/catalogue-limits';

const MAX_SEARCH_QUERY_LENGTH = 256;
const MAX_CATEGORY_LENGTH = 128;

const isoDateSchema = z
  .string()
  .datetime({ offset: true, message: 'Must be a valid ISO 8601 datetime' });

export const createPricingRequestSchema = z
  .object({
    vendorId: uuidSchema,
    discountType: z.enum(ALLOWED_PRICING_DISCOUNT_TYPES).default(PRICING_DISCOUNT_TYPE.PERCENTAGE),
    discountValue: z.coerce.number().min(0).max(100),
    status: z.enum(ALLOWED_PRICING_STATUSES).default(PRICING_STATUS.ACTIVE),
    effectiveFrom: isoDateSchema,
    effectiveUntil: isoDateSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.effectiveUntil) {
      const from = new Date(value.effectiveFrom);
      const until = new Date(value.effectiveUntil);
      if (until.getTime() < from.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Effective until must be on or after effective from',
          path: ['effectiveUntil'],
        });
      }
    }
  });

export type CreatePricingRequest = z.infer<typeof createPricingRequestSchema>;

export const updatePricingRequestSchema = z
  .object({
    discountType: z.enum(ALLOWED_PRICING_DISCOUNT_TYPES).optional(),
    discountValue: z.coerce.number().min(0).max(100).optional(),
    status: z.enum(ALLOWED_PRICING_STATUSES).optional(),
    effectiveFrom: isoDateSchema.optional(),
    effectiveUntil: isoDateSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.effectiveFrom && value.effectiveUntil) {
      const from = new Date(value.effectiveFrom);
      const until = new Date(value.effectiveUntil);
      if (until.getTime() < from.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Effective until must be on or after effective from',
          path: ['effectiveUntil'],
        });
      }
    }
  });

export type UpdatePricingRequest = z.infer<typeof updatePricingRequestSchema>;

export const pricingListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .optional()
      .default(DEFAULT_PAGE_SIZE),
    sortBy: z.enum(ALLOWED_PRICING_SORT_FIELDS).optional().default(DEFAULT_PRICING_SORT_FIELD),
    sortOrder: z.enum(ALLOWED_SORT_ORDERS).optional().default(DEFAULT_SORT_ORDER),
    q: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).optional(),
    category: z.string().trim().min(1).max(MAX_CATEGORY_LENGTH).optional(),
    status: z.enum(ALLOWED_PRICING_STATUS_FILTERS).optional(),
    discountType: z.enum(ALLOWED_PRICING_DISCOUNT_TYPE_FILTERS).optional(),
  })
  .strict();

export type PricingListQuery = z.infer<typeof pricingListQuerySchema>;

export function parseCreatePricingRequest(input: unknown): CreatePricingRequest {
  return createPricingRequestSchema.parse(input);
}

export function parseUpdatePricingRequest(input: unknown): UpdatePricingRequest {
  return updatePricingRequestSchema.parse(input);
}

export function parsePricingListQuery(input: unknown): PricingListQuery {
  return pricingListQuerySchema.parse(input);
}
