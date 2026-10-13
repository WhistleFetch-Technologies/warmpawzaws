import { z } from 'zod';
import { FORM_FIELD_TYPES } from './form-field-types';

export const formFieldSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(160),
    type: z.enum(FORM_FIELD_TYPES),
    required: z.boolean(),
    helperText: z.string().trim().max(400).optional(),
    options: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    slug: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const formSectionSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(160),
    fields: z.array(formFieldSchema),
  })
  .strict();

export const formSchemaSchema = z
  .object({
    sections: z.array(formSectionSchema).min(1),
  })
  .strict();

export type FormFieldSchema = z.infer<typeof formFieldSchema>;
export type FormSectionSchema = z.infer<typeof formSectionSchema>;
export type FormSchema = z.infer<typeof formSchemaSchema>;
