'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_PAWS_N_CLAWS_FORM,
  DEFAULT_PAWS_N_CLAWS_FORM_NAME,
  FORM_FIELD_TYPES,
  INSURANCE_SLUGS,
  type FormFieldSchema,
  type FormSchema,
} from '@warmpawz/shared-types';
import { apiClient } from '@/lib/api-client';

type FormRow = {
  id?: string;
  name?: string;
  status?: string;
  company_id?: string;
  plan_id?: string | null;
  draft_schema?: FormSchema;
  published_version?: number | string | null;
};

type VersionRow = {
  id?: string;
  version?: number | string;
  schema?: FormSchema;
};

export function InsuranceFormLibrary({
  vendorId,
  forms,
  companyId,
  onChanged,
}: {
  vendorId: string;
  forms: FormRow[];
  companyId: string;
  plans?: Array<{ id?: string; name?: string }>;
  onChanged: () => void;
}) {
  const form = forms[0];
  const [name, setName] = useState(form?.name || DEFAULT_PAWS_N_CLAWS_FORM_NAME);
  const [schema, setSchema] = useState<FormSchema>(form?.draft_schema?.sections?.length ? form.draft_schema : structuredClone(DEFAULT_PAWS_N_CLAWS_FORM));
  const [sectionIndex, setSectionIndex] = useState(0);
  const [fieldIndex, setFieldIndex] = useState(0);
  const [notice, setNotice] = useState('');
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [versionId, setVersionId] = useState('');
  const field = schema.sections[sectionIndex]?.fields[fieldIndex];
  const selectedId = form?.id ? String(form.id) : '';

  useEffect(() => {
    if (!form && companyId) {
      void apiClient.post(`/vendor/${vendorId}/insurance/forms/ensure-default`, { companyId }).then(() => onChanged()).catch(() => undefined);
    }
  }, [form, companyId, vendorId, onChanged]);

  useEffect(() => {
    if (!form) return;
    setName(String(form.name || DEFAULT_PAWS_N_CLAWS_FORM_NAME));
    if (form.draft_schema?.sections?.length) setSchema(form.draft_schema);
    void apiClient
      .get<{ data?: { versions?: VersionRow[] }; versions?: VersionRow[] }>(`/vendor/${vendorId}/insurance/forms/${form.id}/versions`)
      .then((res) => setVersions(res.data?.versions || res.versions || []))
      .catch(() => setVersions([]));
  }, [form?.id, vendorId]);

  function patchField(patch: Partial<FormFieldSchema>) {
    if (!field) return;
    const next = structuredClone(schema);
    next.sections[sectionIndex].fields[fieldIndex] = { ...next.sections[sectionIndex].fields[fieldIndex], ...patch };
    setSchema(next);
  }

  async function save() {
    if (!companyId || !selectedId) {
      setNotice('No form to save yet.');
      return;
    }
    try {
      await apiClient.put(`/vendor/${vendorId}/insurance/forms/${selectedId}`, {
        companyId: form?.company_id || companyId,
        planId: form?.plan_id || null,
        name,
        schema,
      });
      setNotice('Draft saved');
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Draft could not be saved');
    }
  }

  async function setPublished(publish: boolean) {
    if (!selectedId) {
      setNotice('Save the draft first.');
      return;
    }
    try {
      if (publish) {
        await save();
        await apiClient.post(`/vendor/${vendorId}/insurance/forms/${selectedId}/publish`, {});
        setNotice('Published — available to send from Chat');
      } else {
        await apiClient.post(`/vendor/${vendorId}/insurance/forms/${selectedId}/unpublish`, {});
        setNotice('Moved back to draft');
      }
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Status could not be updated');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Form Library</h1>
          <p className="text-sm text-gray-500">One Quote &amp; Proposal form. Select a field to edit, then save a new version.</p>
        </div>
        <div className="flex items-center gap-2">
          {versions.length ? (
            <label className="text-xs font-semibold text-gray-500">
              Version
              <select
                className="ml-2 rounded-lg border px-2 py-1 text-sm"
                value={versionId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setVersionId(nextId);
                  const chosen = versions.find((row) => String(row.id) === nextId);
                  if (chosen?.schema?.sections?.length) {
                    setSchema(chosen.schema);
                    setSectionIndex(0);
                    setFieldIndex(0);
                    setNotice(`Editing version ${chosen.version}. Save draft to keep these changes.`);
                  }
                }}
              >
                <option value="">Current draft</option>
                {versions.map((row) => (
                  <option key={String(row.id)} value={String(row.id)}>v{row.version}</option>
                ))}
              </select>
            </label>
          ) : null}
          <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">{form?.status || 'draft'}{form?.published_version ? ` · v${form.published_version}` : ''}</span>
          <button type="button" className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => void save()}>Save draft</button>
          {form?.status === 'published' ? (
            <button type="button" className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => void setPublished(false)}>Set draft</button>
          ) : (
            <button type="button" className="rounded-xl bg-[#FF8C42] px-3 py-2 text-sm font-semibold text-white" onClick={() => void setPublished(true)}>Publish</button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-3 rounded-2xl border bg-white p-4">
          <input className="w-full rounded-lg border px-3 py-2 text-sm font-semibold" value={name} onChange={(e) => setName(e.target.value)} />
          {schema.sections.map((section, index) => (
            <div key={section.key} className="rounded-xl border p-3">
              <input
                className="w-full font-semibold"
                value={section.title}
                onChange={(e) => {
                  const next = structuredClone(schema);
                  next.sections[index].title = e.target.value;
                  setSchema(next);
                }}
              />
              <ul className="mt-2 space-y-1">
                {section.fields.map((item, itemIndex) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={`w-full rounded-lg px-2 py-1 text-left text-sm ${sectionIndex === index && fieldIndex === itemIndex ? 'bg-orange-50 font-semibold text-[#FF8C42]' : 'text-gray-700'}`}
                      onClick={() => { setSectionIndex(index); setFieldIndex(itemIndex); }}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <aside className="rounded-2xl border bg-white p-4 text-sm">
          <h2 className="font-bold">Edit field</h2>
          {field ? (
            <div className="mt-3 space-y-2">
              <label className="block">Label
                <input className="mt-1 w-full rounded-lg border px-2 py-2" value={field.label} onChange={(e) => patchField({ label: e.target.value })} />
              </label>
              <label className="block">Type
                <select className="mt-1 w-full rounded-lg border px-2 py-2" value={field.type} onChange={(e) => patchField({ type: e.target.value as FormFieldSchema['type'] })}>
                  {FORM_FIELD_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="block">Options
                <input className="mt-1 w-full rounded-lg border px-2 py-2" value={(field.options || []).join(', ')} onChange={(e) => patchField({ options: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} />
              </label>
              <label className="block">Warmpawz field
                <select className="mt-1 w-full rounded-lg border px-2 py-2" value={field.slug || ''} onChange={(e) => patchField({ slug: e.target.value || undefined })}>
                  <option value="">None</option>
                  {INSURANCE_SLUGS.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
                </select>
              </label>
              <label className="block">Helper
                <input className="mt-1 w-full rounded-lg border px-2 py-2" value={field.helperText || ''} onChange={(e) => patchField({ helperText: e.target.value || undefined })} />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(field.required)} onChange={(e) => patchField({ required: e.target.checked })} /> Required
              </label>
            </div>
          ) : (
            <p className="mt-3 text-gray-500">Select a field from the form.</p>
          )}
        </aside>
      </div>
      {notice ? <p className="text-sm text-gray-700">{notice}</p> : null}
    </div>
  );
}
