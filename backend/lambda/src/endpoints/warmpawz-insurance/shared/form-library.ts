import {
  formSchemaSchema,
  insuranceSlugByKey,
  type FormFieldType,
  type FormSchema,
} from '@warmpawz/shared-types';

const SLUG_FIELD_TYPES: Readonly<Record<string, readonly FormFieldType[]>> = {
  text: ['text', 'textarea', 'email', 'phone', 'select', 'radio'],
  date: ['date'],
  number: ['number'],
  boolean: ['checkbox'],
};

export function parseFormSchema(input: unknown): FormSchema {
  return formSchemaSchema.parse(input);
}

export function formSchemaIssues(schema: FormSchema): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (keys.has(field.key)) issues.push(`Duplicate field key ${field.key}`);
      keys.add(field.key);
      if (!field.slug) continue;
      if (field.type === 'section_note' || field.type === 'file' || field.type === 'multiselect') {
        issues.push(`${field.key} cannot use a slug`);
        continue;
      }
      const def = insuranceSlugByKey(field.slug);
      if (!def) {
        issues.push(`Unknown slug ${field.slug}`);
        continue;
      }
      const allowed = SLUG_FIELD_TYPES[def.type] || [];
      if (!allowed.includes(field.type)) {
        issues.push(`Slug ${field.slug} is not compatible with ${field.type}`);
      }
    }
  }
  return issues;
}

export function nextTemplateVersion(current: number | null): number {
  return (current ?? 0) + 1;
}

export function nextSubmissionRevision(current: number | null): { revision: number; supersedePrevious: boolean } {
  const revision = (current ?? 0) + 1;
  return { revision, supersedePrevious: revision > 1 };
}
