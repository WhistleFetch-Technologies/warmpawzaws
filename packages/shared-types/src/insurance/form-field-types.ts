export const FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'date',
  'email',
  'phone',
  'select',
  'multiselect',
  'radio',
  'checkbox',
  'file',
  'section_note',
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export interface FormFieldValidation {
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: string;
  readonly options?: readonly string[];
}

export function isFormFieldType(value: unknown): value is FormFieldType {
  return typeof value === 'string' && (FORM_FIELD_TYPES as readonly string[]).includes(value);
}
