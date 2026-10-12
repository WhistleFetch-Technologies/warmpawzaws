import { z } from 'zod';
import { INSURANCE_APPLICATION_STATUSES } from '../domain/application-status';
import { COMMISSION_BASES } from '../domain/commission';
import { PAYOUT_FREQUENCIES } from '../domain/payout-periods';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const companyInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    legalName: optionalText(200),
    providerCode: optionalText(40),
    logoUrl: optionalText(500),
    contactName: optionalText(120),
    contactEmail: z
      .string()
      .trim()
      .email()
      .optional()
      .nullable()
      .or(z.literal(''))
      .transform((v) => (v ? v : null)),
    contactPhone: optionalText(30),
    escalationContact: optionalText(300),
    products: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
    integrationMode: z.enum(['manual', 'link', 'api']).default('manual'),
    status: z.enum(['active', 'inactive']).default('active'),
    notes: optionalText(1000),
  })
  .strict();

export type CompanyInput = z.infer<typeof companyInputSchema>;

export const commissionTermsInputSchema = z
  .object({
    basis: z.enum(COMMISSION_BASES),
    rate: z.coerce.number().min(0).max(1_000_000),
    vendorCommissionRate: z.coerce.number().min(0).max(100).optional().nullable(),
    gstRate: z.coerce.number().min(0).max(100).default(0),
    effectiveFrom: isoDate,
    notes: optionalText(500),
  })
  .strict()
  .refine((t) => t.basis === 'fixed_per_policy' || t.rate <= 100, {
    message: 'A percentage rate cannot be above 100',
    path: ['rate'],
  });

export type CommissionTermsInput = z.infer<typeof commissionTermsInputSchema>;

export const vendorLinkCreateSchema = z
  .object({
    vendorId: z.string().uuid(),
    companyId: z.string().uuid(),
    authorisationRef: optionalText(120),
    agencyCode: optionalText(80),
    effectiveFrom: isoDate,
    effectiveTo: isoDate.optional().nullable(),
    notes: optionalText(1000),
    terms: commissionTermsInputSchema,
  })
  .strict();

export type VendorLinkCreateInput = z.infer<typeof vendorLinkCreateSchema>;

export const vendorLinkUpdateSchema = z
  .object({
    authorisationRef: optionalText(120),
    agencyCode: optionalText(80),
    effectiveFrom: isoDate.optional(),
    effectiveTo: isoDate.optional().nullable(),
    status: z.enum(['active', 'suspended', 'ended']).optional(),
    notes: optionalText(1000),
  })
  .strict();

export type VendorLinkUpdateInput = z.infer<typeof vendorLinkUpdateSchema>;

export const payoutScheduleInputSchema = z
  .object({
    frequency: z.enum(PAYOUT_FREQUENCIES),
    anchorDate: isoDate,
    dueDaysAfterPeriodEnd: z.coerce.number().int().min(0).max(90),
    graceDays: z.coerce.number().int().min(0).max(60),
    reminderDaysBefore: z.array(z.coerce.number().int().min(0).max(30)).max(5).default([]),
  })
  .strict();

export type PayoutScheduleInput = z.infer<typeof payoutScheduleInputSchema>;

export const linkScheduleInputSchema = z.union([
  z.object({ useDefault: z.literal(true) }).strict(),
  payoutScheduleInputSchema,
]);

export const outreachQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(INSURANCE_APPLICATION_STATUSES).optional(),
  vendorId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  search: z.string().trim().max(80).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export type OutreachQuery = z.infer<typeof outreachQuerySchema>;

export const dateRangeQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

const periodRef = {
  vendorCompanyId: z.string().uuid(),
  periodStart: isoDate,
  periodEnd: isoDate,
};

export const payoutRemindSchema = z.object(periodRef).strict();
export type PayoutRemindInput = z.infer<typeof payoutRemindSchema>;

export const payoutReceiptSchema = z
  .object({
    ...periodRef,
    amount: z.coerce.number().min(0).max(100_000_000),
    reference: optionalText(120),
    receivedOn: isoDate.optional(),
    notes: optionalText(500),
  })
  .strict();
export type PayoutReceiptInput = z.infer<typeof payoutReceiptSchema>;
