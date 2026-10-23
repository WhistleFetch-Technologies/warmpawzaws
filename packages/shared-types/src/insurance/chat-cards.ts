import { z } from 'zod';

const cardBase = {
  applicationId: z.string().uuid(),
  version: z.number().int().positive(),
};

export const planQuoteCardSchema = z.object({
  card: z.literal('plan_quote'),
  ...cardBase,
  companyId: z.string().uuid(),
  planId: z.string().uuid(),
  coverType: z.string().min(1),
  sumInsured: z.string().min(1),
  copay: z.string().min(1),
  optionalCovers: z.array(z.string()),
  indicativePremium: z.number().nonnegative(),
  premiumUnit: z.enum(['month', 'year']),
});

export const formRequestCardSchema = z.object({
  card: z.literal('form_request'),
  ...cardBase,
  templateId: z.string().uuid(),
  templateVersionId: z.string().uuid(),
});

export const formSubmissionCardSchema = z.object({
  card: z.literal('form_submission'),
  ...cardBase,
  submissionId: z.string().uuid(),
  revision: z.number().int().positive(),
});

export const changeRequestCardSchema = z.object({
  card: z.literal('change_request'),
  ...cardBase,
  notes: z.record(z.string(), z.string()),
});

export const paymentLinkCardSchema = z.object({
  card: z.literal('payment_link'),
  ...cardBase,
  url: z.string().url(),
  amount: z.number().nonnegative(),
  expiresAt: z.string().min(1),
});

export const policyDocumentsCardSchema = z.object({
  card: z.literal('policy_documents'),
  ...cardBase,
  policyNumber: z.string().min(1),
  documentCount: z.number().int().positive(),
  documents: z.array(z.object({
    name: z.string().min(1),
    s3Key: z.string().min(1),
  })).optional(),
});

export const statusUpdateCardSchema = z.object({
  card: z.literal('status_update'),
  ...cardBase,
  fromStatus: z.string().min(1).nullable(),
  toStatus: z.string().min(1),
});

export const chatCardSchema = z.discriminatedUnion('card', [
  planQuoteCardSchema,
  formRequestCardSchema,
  formSubmissionCardSchema,
  changeRequestCardSchema,
  paymentLinkCardSchema,
  policyDocumentsCardSchema,
  statusUpdateCardSchema,
]);

export type ChatCard = z.infer<typeof chatCardSchema>;
