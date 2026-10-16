import { z } from 'zod';
import { FORM_FIELD_TYPES } from './form-field-types';

export const formFieldShowIfSchema = z
  .object({
    field: z.string().trim().min(1).max(80),
    equals: z.union([z.string(), z.boolean(), z.number()]),
  })
  .strict();

export const formFieldSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(160),
    type: z.enum(FORM_FIELD_TYPES),
    required: z.boolean(),
    helperText: z.string().trim().max(400).optional(),
    options: z.array(z.string().trim().min(1).max(120)).max(80).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    slug: z.string().trim().min(1).max(80).optional(),
    optionsVerified: z.boolean().optional(),
    unit: z.enum(['INR', 'percent']).optional(),
    showIf: formFieldShowIfSchema.optional(),
  })
  .strict();

export const formSectionRepeaterSchema = z
  .object({
    countField: z.string().trim().min(1).max(80),
    max: z.number().int().min(1).max(10),
  })
  .strict();

export const formSectionSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(160),
    fields: z.array(formFieldSchema),
    workflow: z.enum(['quote', 'proposal']).optional(),
    repeater: formSectionRepeaterSchema.optional(),
  })
  .strict();

export const formSchemaSchema = z
  .object({
    sections: z.array(formSectionSchema).min(1),
    productKey: z.string().trim().min(1).max(80).optional(),
    insurerKey: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export type FormFieldShowIf = z.infer<typeof formFieldShowIfSchema>;
export type FormFieldSchema = z.infer<typeof formFieldSchema>;
export type FormSectionSchema = z.infer<typeof formSectionSchema>;
export type FormSchema = z.infer<typeof formSchemaSchema>;

/** Evaluate showIf including `>=N` count conventions used by pet repeaters. */
export function formShowIfMatches(
  showIf: FormFieldShowIf | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!showIf) return true;
  const current = values[showIf.field];
  if (typeof showIf.equals === 'string' && showIf.equals.startsWith('>=')) {
    const min = Number(showIf.equals.slice(2));
    const count = Number(current);
    return Number.isFinite(min) && Number.isFinite(count) && count >= min;
  }
  if (showIf.equals === false) {
    return current === false || current == null || current === '';
  }
  return current === showIf.equals || String(current) === String(showIf.equals);
}
