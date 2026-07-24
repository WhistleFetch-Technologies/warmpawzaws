import { z } from 'zod';

export const paymentsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaymentsListQuery = z.infer<typeof paymentsListQuerySchema>;

export function parsePaymentsListQuery(
  query: Record<string, string | undefined>,
): PaymentsListQuery {
  return paymentsListQuerySchema.parse({
    page: query.page,
    pageSize: query.pageSize,
  });
}
