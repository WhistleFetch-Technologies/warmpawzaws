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
  /** Hide author notes such as "options not yet verified" from the customer. */
  suppressUnverifiedHelp?: boolean;
  onChange?: (key: string, value: unknown) => void;
}

const controlClass =
  'mt-1.5 w-full rounded-xl border border-orange-100 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 disabled:bg-gray-50';

function visibleHelp(helperText: string | undefined, suppressUnverifiedHelp: boolean): string {
  const text = String(helperText || '').trim();
  if (!text) return '';
  if (suppressUnverifiedHelp && /unverified/i.test(text)) return '';
  return text;
}

export function DynamicFormRenderer({
  schema,
  values,
  prefilled = {},
  readOnly = false,
  fieldNotes = {},
  errors = {},
  suppressUnverifiedHelp = false,
  onChange,
}: DynamicFormRendererProps) {
  return (
    <div className="space-y-3">
      {schema.sections.map((section) => (
        <section key={section.key} className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-[#1E2A4A]">{section.title}</h3>
          <div className="mt-3 space-y-4">
            {section.fields.map((field) => {
              const value = values[field.key];
              const note = fieldNotes[field.key];
              const error = errors[field.key];
              const help = visibleHelp(field.helperText, suppressUnverifiedHelp);
              const common = {
                id: field.key,
                'data-field-type': field.type,
                disabled: readOnly || field.type === 'section_note',
                'aria-invalid': Boolean(error),
              };
              const selected = Array.isArray(value) ? value.map(String) : [];
              return (
                <div key={field.key} data-field-type={field.type}>
                  {field.type === 'section_note' ? (
                    <p className="rounded-xl bg-orange-50 px-3 py-2 text-sm text-gray-700">{help || field.label}</p>
                  ) : (
                    <label htmlFor={field.key} className="block text-sm font-medium text-gray-800">
                      <span>
                        {field.label}
                        {field.required ? <span className="text-[#FF8C42]"> *</span> : null}
                        {prefilled[field.key] ? (
                          <em data-prefilled="true" className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold not-italic text-[#FF8C42]">
                            Prefilled
                          </em>
                        ) : null}
                      </span>
                      {help && field.type !== 'checkbox' ? <small className="mt-0.5 block text-xs font-normal text-gray-500">{help}</small> : null}
                      {field.type === 'textarea' ? (
                        <textarea {...common} className={`${controlClass} min-h-24`} value={String(value ?? '')} onChange={(e) => onChange?.(field.key, e.target.value)} />
                      ) : null}
                      {field.type === 'select' ? (
                        <select {...common} className={controlClass} value={String(value ?? '')} onChange={(e) => onChange?.(field.key, e.target.value)}>
                          <option value="">Select</option>
                          {(field.options || []).map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : null}
                      {field.type === 'multiselect' ? (
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {(field.options || []).map((option) => {
                            const checked = selected.includes(option);
                            return (
                              <label key={option} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-normal ${checked ? 'border-[#FF8C42] bg-orange-50 text-[#1E2A4A]' : 'border-orange-100 bg-white text-gray-700'}`}>
                                <input
                                  type="checkbox"
                                  data-field-type="multiselect"
                                  className="h-4 w-4 accent-[#FF8C42]"
                                  checked={checked}
                                  disabled={readOnly}
                                  onChange={() => {
                                    const next = checked ? selected.filter((item) => item !== option) : [...selected, option];
                                    onChange?.(field.key, next);
                                  }}
                                />
                                {option}
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                      {field.type === 'radio' ? (
                        <span className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {(field.options || []).map((option) => (
                            <label key={option} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-normal ${value === option ? 'border-[#FF8C42] bg-orange-50' : 'border-orange-100 bg-white'}`}>
                              <input
                                type="radio"
                                name={field.key}
                                data-field-type="radio"
                                className="h-4 w-4 accent-[#FF8C42]"
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
                        <span className="mt-2 flex min-h-11 items-start gap-2 rounded-xl border border-orange-100 bg-white px-3 py-2.5 text-sm font-normal text-gray-700">
                          <input
                            {...common}
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-[#FF8C42]"
                            checked={value === true}
                            onChange={(e) => onChange?.(field.key, e.target.checked)}
                          />
                          <span>{help || 'Yes'}</span>
                        </span>
                      ) : null}
                      {field.type === 'file' ? (
                        <input {...common} className={`${controlClass} file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-[#FF8C42]`} type="file" onChange={(e) => onChange?.(field.key, e.target.files?.[0]?.name || '')} />
                      ) : null}
                      {['text', 'number', 'date', 'email', 'phone'].includes(field.type) ? (
                        <input
                          {...common}
                          className={controlClass}
                          type={field.type === 'phone' ? 'tel' : field.type}
                          value={String(value ?? '')}
                          onChange={(e) => onChange?.(field.key, e.target.value)}
                        />
                      ) : null}
                    </label>
                  )}
                  {note ? <strong data-field-note="true" className="mt-1 block text-xs font-medium text-amber-700">{note}</strong> : null}
                  {error ? <span role="alert" className="mt-1 block text-xs text-red-600">{error}</span> : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
