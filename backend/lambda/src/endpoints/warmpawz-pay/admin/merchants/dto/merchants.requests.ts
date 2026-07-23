import { z } from 'zod';
import {
  ALLOWED_SORT_FIELDS,
  ALLOWED_SORT_ORDERS,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_FIELD,
  DEFAULT_SORT_ORDER,
  MAX_PAGE_SIZE,
} from '../../../constants/catalogue-limits';
import {
  ALLOWED_BUSINESS_TYPE_FILTERS,
  ALLOWED_CUSTOMER_VISIBLE_FILTERS,
  ALLOWED_PLATFORM_STATUS_FILTERS,
  ALLOWED_WARMPAWZ_PAY_STATUS_FILTERS,
} from '../../../constants/merchant-limits';

const MAX_SEARCH_QUERY_LENGTH = 256;
const MAX_CATEGORY_LENGTH = 128;

export const merchantListQuerySchema = z
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
    q: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).optional(),
    category: z.string().trim().min(1).max(MAX_CATEGORY_LENGTH).optional(),
    businessType: z.enum(ALLOWED_BUSINESS_TYPE_FILTERS).optional(),
    platformStatus: z.enum(ALLOWED_PLATFORM_STATUS_FILTERS).optional(),
    warmpawzPayStatus: z.enum(ALLOWED_WARMPAWZ_PAY_STATUS_FILTERS).optional(),
    customerVisible: z.enum(ALLOWED_CUSTOMER_VISIBLE_FILTERS).optional(),
  })
  .strict();

export type MerchantListQuery = z.infer<typeof merchantListQuerySchema>;

export function parseMerchantListQuery(input: unknown): MerchantListQuery {
  return merchantListQuerySchema.parse(input);
}
