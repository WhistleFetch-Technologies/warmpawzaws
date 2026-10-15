'use client';

import { useState } from 'react';
import { FORM_FIELD_TYPES, INSURANCE_SLUGS, type FormFieldSchema, type FormSchema } from '@warmpawz/shared-types';
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

const STARTER: FormSchema = {
  sections: [
    { key: 'owner', title: 'Pet & Owner Details', fields: [{ key: 'pet_name', label: 'Pet name', type: 'text', required: true, slug: 'pet.name' }] },
    { key: 'cover', title: 'Coverage & Declarations', fields: [] },
  ],
};

function keyFrom(label: string) {
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return key || `field_${Date.now()}`;
}

export function InsuranceFormLibrary({
  vendorId,
  forms,
  companyId,
  plans,
  onChanged,
}: {
  vendorId: string;
  forms: FormRow[];
  companyId: string;
  plans: Array<{ id?: string; name?: string }>;
  onChanged: () => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('New form');
  const [planId, setPlanId] = useState('');
  const [schema, setSchema] = useState<FormSchema>(STARTER);
  const [search, setSearch] = useState('');
  const [sectionIndex, setSectionIndex] = useState(0);
  const [fieldIndex, setFieldIndex] = useState(0);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FormFieldSchema['type']>('text');
  const [required, setRequired] = useState(true);
  const [slug, setSlug] = useState('');
  const [helper, setHelper] = useState('');
  const [notice, setNotice] = useState('');
  const selected = forms.find((form) => String(form.id) === selectedId);
  const field = schema.sections[sectionIndex]?.fields[fieldIndex];

  function openForm(form: FormRow) {
    setSelectedId(String(form.id || ''));
    setName(String(form.name || 'Form'));
    setPlanId(form.plan_id ? String(form.plan_id) : '');
    const draft = form.draft_schema;
    setSchema(draft && Array.isArray(draft.sections) && draft.sections.length ? draft : STARTER);
    setSectionIndex(0);
    setFieldIndex(0);
  }

  function addField() {
    if (!label.trim()) return;
    const next = structuredClone(schema);
    const section = next.sections[sectionIndex] || next.sections[0];
    section.fields.push({
      key: keyFrom(label),
      label: label.trim(),
      type,
      required,
      helperText: helper.trim() || undefined,
      slug: slug || undefined,
    });
    setSchema(next);
    setFieldIndex(section.fields.length - 1);
    setLabel('');
    setHelper('');
  }

  async function save() {
    if (!companyId) {
      setNotice('This vendor has no active insurer link yet.');
      return;
    }
    try {
      if (selectedId) {
        await apiClient.put(`/vendor/${vendorId}/insurance/forms/${selectedId}`, {
          companyId: selected?.company_id || companyId,
          planId: planId || null,
          name,
          schema,
        });
      } else {
        const saved = await apiClient.post<{ data?: { form?: { id?: string } } }>(`/vendor/${vendorId}/insurance/forms`, {
          companyId,
          planId: planId || null,
          name,
          schema,
        });
        setSelectedId(String(saved.data?.form?.id || ''));
      }
      setNotice('Draft saved');
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Draft could not be saved');
    }
  }

  async function publish() {
    if (!selectedId) {
      setNotice('Save the draft before publishing.');
      return;
    }
    try {
      await apiClient.post(`/vendor/${vendorId}/insurance/forms/${selectedId}/publish`, {});
      setNotice('Published');
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Form could not be published');
    }
  }

  const shown = forms.filter((form) => String(form.name || '').toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Form Library</h1>
          <p className="text-sm text-gray-500">Build reusable customer forms for your insurance plans.</p>
        </div>
        <button type="button" className="rounded-xl bg-[#FF8C42] px-3 py-2 text-sm font-semibold text-white" onClick={() => { setSelectedId(''); setName('New form'); setSchema(structuredClone(STARTER)); }}>
          Create form
        </button>
      </div>
      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="rounded-2xl border bg-white p-3">
          <p className="text-sm font-semibold">Your forms ({forms.length})</p>
          <input className="mt-2 w-full rounded-lg border px-2 py-2 text-sm" placeholder="Search forms..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="mt-3 space-y-2">
            {shown.map((form) => (
              <button key={String(form.id)} type="button" onClick={() => openForm(form)} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${String(form.id) === selectedId ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-100'}`}>
                <span className="block font-semibold">{form.name}</span>
                <span className="text-xs text-gray-500">{form.status}{form.published_version ? ` · v${form.published_version}` : ''}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className="space-y-3 rounded-2xl border bg-white p-4">
          <div className="grid gap-2 md:grid-cols-3">
            <input className="rounded-lg border px-2 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            <select className="rounded-lg border px-2 py-2 text-sm" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Any plan</option>
              {plans.map((plan) => <option key={String(plan.id)} value={String(plan.id)}>{plan.name}</option>)}
            </select>
            <p className="rounded-lg bg-orange-50 px-2 py-2 text-sm font-semibold text-orange-700">{selected?.status || 'Draft'}</p>
          </div>
          {schema.sections.map((section, index) => (
            <div key={section.key} className="rounded-xl border p-3">
              <input className="w-full font-semibold" value={section.title} onChange={(e) => {
                const next = structuredClone(schema);
                next.sections[index].title = e.target.value;
                setSchema(next);
              }} />
              <ul className="mt-2 space-y-1 text-sm">
                {section.fields.map((item, itemIndex) => (
                  <li key={item.key}>
                    <button type="button" className="text-left" onClick={() => { setSectionIndex(index); setFieldIndex(itemIndex); }}>
                      {item.label} · {item.type}{item.required ? ' · required' : ''}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <button type="button" className="text-sm font-semibold text-[#FF8C42]" onClick={() => setSchema({ ...schema, sections: [...schema.sections, { key: `section_${schema.sections.length + 1}`, title: 'New section', fields: [] }] })}>
            Add section
          </button>
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => void save()}>Save draft</button>
            <button type="button" className="rounded-xl bg-[#FF8C42] px-3 py-2 text-sm font-semibold text-white" onClick={() => void publish()}>Publish form</button>
          </div>
        </section>
        <aside className="rounded-2xl border bg-white p-4 text-sm">
          <h2 className="font-bold">Add a field</h2>
          <label className="mt-3 block">Field label
            <input className="mt-1 w-full rounded-lg border px-2 py-2" value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="mt-2 block">Input type
            <select className="mt-1 w-full rounded-lg border px-2 py-2" value={type} onChange={(e) => setType(e.target.value as FormFieldSchema['type'])}>
              {FORM_FIELD_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="mt-2 block">Map to Warmpawz field
            <select className="mt-1 w-full rounded-lg border px-2 py-2" value={slug} onChange={(e) => setSlug(e.target.value)}>
              <option value="">None</option>
              {INSURANCE_SLUGS.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
            </select>
          </label>
          <label className="mt-2 block">Helper text
            <input className="mt-1 w-full rounded-lg border px-2 py-2" value={helper} onChange={(e) => setHelper(e.target.value)} />
          </label>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
          </label>
          <button type="button" className="mt-3 w-full rounded-xl bg-[#FF8C42] px-3 py-2 font-semibold text-white" onClick={addField}>Add field</button>
          {field ? <p className="mt-3 text-xs text-gray-500">Selected: {field.label}</p> : null}
        </aside>
      </div>
      {notice ? <p className="text-sm text-gray-700">{notice}</p> : null}
    </div>
  );
}
