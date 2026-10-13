import type { FormFieldSchema, FormSchema } from './form-schema';

export interface DynamicFormValues {
  readonly [key: string]: unknown;
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function validateDynamicFormField(field: FormFieldSchema, value: unknown): string | null {
  if (field.type === 'section_note') return null;
  if (field.required && isEmpty(value) && field.type !== 'checkbox') {
    return `${field.label} is required`;
  }
  if (field.type === 'checkbox' && field.required && value !== true) {
    return `${field.label} is required`;
  }
  if (isEmpty(value)) return null;
  if (field.type === 'number') {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return `${field.label} must be a number`;
    if (field.min != null && n < field.min) return `${field.label} minimum is ${field.min}`;
    if (field.max != null && n > field.max) return `${field.label} maximum is ${field.max}`;
  }
  if ((field.type === 'select' || field.type === 'radio') && field.options?.length) {
    if (!field.options.includes(String(value))) return `${field.label} is not a valid option`;
  }
  if (field.type === 'multiselect' && field.options?.length && Array.isArray(value)) {
    const bad = value.find((item) => !field.options?.includes(String(item)));
    if (bad != null) return `${field.label} is not a valid option`;
  }
  if (field.type === 'email' && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return `${field.label} must be an email`;
  }
  return null;
}

export function validateDynamicForm(schema: FormSchema, values: DynamicFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const section of schema.sections) {
    for (const field of section.fields) {
      const message = validateDynamicFormField(field, values[field.key]);
      if (message) errors[field.key] = message;
    }
  }
  return errors;
}
