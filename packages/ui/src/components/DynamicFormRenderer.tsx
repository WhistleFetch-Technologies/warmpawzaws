import React from 'react';

export interface DynamicFormSchema {
  sections: Array<{
    key: string;
    title: string;
    fields: Array<{
      key: string;
      label: string;
      type: string;
      required?: boolean;
      helperText?: string;
      options?: string[];
    }>;
  }>;
}

export interface DynamicFormRendererProps {
  schema: DynamicFormSchema;
  values: Record<string, unknown>;
  prefilled?: Record<string, boolean>;
  readOnly?: boolean;
  fieldNotes?: Record<string, string>;
  errors?: Record<string, string>;
  onChange?: (key: string, value: unknown) => void;
}

export function DynamicFormRenderer({
  schema,
  values,
  prefilled = {},
  readOnly = false,
  fieldNotes = {},
  errors = {},
  onChange,
}: DynamicFormRendererProps) {
  return (
    <div>
      {schema.sections.map((section) => (
        <section key={section.key} style={{ marginBottom: 16 }}>
          <h3>{section.title}</h3>
          {section.fields.map((field) => {
            const value = values[field.key];
            const note = fieldNotes[field.key];
            const error = errors[field.key];
            const common = {
              id: field.key,
              'data-field-type': field.type,
              disabled: readOnly || field.type === 'section_note',
              'aria-invalid': Boolean(error),
            };
            return (
              <label key={field.key} htmlFor={field.key} data-field-type={field.type} style={{ display: 'block', marginBottom: 12 }}>
                <span>
                  {field.label}
                  {prefilled[field.key] ? <em data-prefilled="true"> Prefilled</em> : null}
                </span>
                {field.helperText ? <small style={{ display: 'block' }}>{field.helperText}</small> : null}
                {field.type === 'section_note' ? <p>{field.helperText || field.label}</p> : null}
                {field.type === 'textarea' ? (
                  <textarea {...common} value={String(value ?? '')} onChange={(e) => onChange?.(field.key, e.target.value)} />
                ) : null}
                {field.type === 'select' ? (
                  <select {...common} value={String(value ?? '')} onChange={(e) => onChange?.(field.key, e.target.value)}>
                    <option value="">Select</option>
                    {(field.options || []).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                ) : null}
                {field.type === 'multiselect' ? (
                  <select
                    {...common}
                    multiple
                    value={Array.isArray(value) ? value.map(String) : []}
                    onChange={(e) => onChange?.(field.key, Array.from(e.target.selectedOptions).map((option) => option.value))}
                  >
                    {(field.options || []).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                ) : null}
                {field.type === 'radio' ? (
                  <span>
                    {(field.options || []).map((option) => (
                      <label key={option}>
                        <input
                          type="radio"
                          name={field.key}
                          data-field-type="radio"
                          checked={value === option}
                          disabled={readOnly}
                          onChange={() => onChange?.(field.key, option)}
                        />
                        {option}
                      </label>
                    ))}
                  </span>
                ) : null}
                {field.type === 'checkbox' ? (
                  <input
                    {...common}
                    type="checkbox"
                    checked={value === true}
                    onChange={(e) => onChange?.(field.key, e.target.checked)}
                  />
                ) : null}
                {field.type === 'file' ? (
                  <input {...common} type="file" onChange={(e) => onChange?.(field.key, e.target.files?.[0]?.name || '')} />
                ) : null}
                {['text', 'number', 'date', 'email', 'phone'].includes(field.type) ? (
                  <input
                    {...common}
                    type={field.type === 'phone' ? 'tel' : field.type}
                    value={String(value ?? '')}
                    onChange={(e) => onChange?.(field.key, field.type === 'number' ? e.target.value : e.target.value)}
                  />
                ) : null}
                {note ? <strong data-field-note="true">{note}</strong> : null}
                {error ? <span role="alert">{error}</span> : null}
              </label>
            );
          })}
        </section>
      ))}
    </div>
  );
}
