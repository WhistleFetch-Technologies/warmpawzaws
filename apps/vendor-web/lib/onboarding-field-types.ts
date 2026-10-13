import { FORM_FIELD_TYPES, type FormFieldType } from '@warmpawz/shared-types';

const RENDERED: Readonly<Record<string, string>> = {
  text: 'text',
  textarea: 'textarea',
  number: 'number',
  date: 'date',
  email: 'email',
  phone: 'tel',
  tel: 'tel',
  select: 'select',
  dropdown: 'select',
  multiselect: 'multiselect',
  'multi-select': 'multiselect',
  radio: 'radio',
  checkbox: 'checkbox',
  file: 'file',
  section_note: 'section_note',
};

/** Map a stored field type onto a renderer case. Dropdown is a select. */
export function normalizeOnboardingFieldType(raw: unknown): string {
  const key = String(raw || 'text').trim().toLowerCase().replace(/_/g, '-');
  return RENDERED[key] ?? key ?? 'text';
}

export function onboardingFieldTypesAreRendered(): boolean {
  return FORM_FIELD_TYPES.every((type: FormFieldType) => RENDERED[type] && RENDERED[type] !== 'text' || type === 'text');
}

export function validateOnboardingFieldValue(
  field: { name: string; label?: string; type?: string; required?: boolean; min?: number; max?: number },
  value: unknown,
): string | null {
  const label = field.label || field.name;
  const text = typeof value === 'string' ? value.trim() : value;
  const empty =
    text === undefined ||
    text === null ||
    text === '' ||
    (Array.isArray(text) && text.length === 0);
  if (field.required && empty) return `${label} is required`;
  if (field.type === 'number' && value !== undefined && value !== null && value !== '') {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return `${label} must be a number`;
    if (field.min !== undefined && n < field.min) return `Minimum value is ${field.min}`;
    if (field.max !== undefined && n > field.max) return `Maximum value is ${field.max}`;
  }
  return null;
}
