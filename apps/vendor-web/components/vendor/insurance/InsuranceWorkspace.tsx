'use client';

import { useEffect, useState } from 'react';
import { DynamicFormRenderer } from '@warmpawz/ui';
import { INSURANCE_SLUGS, FORM_FIELD_TYPES, type FormSchema } from '@warmpawz/shared-types';
import { apiClient } from '@/lib/api-client';
import { InsuranceChatCard } from './InsuranceChatCard';

const TABS = ['Overview', 'Applications', 'Chat', 'Form Library', 'Availability', 'Reports'] as const;
type Tab = (typeof TABS)[number];

const EMPTY_SCHEMA: FormSchema = {
  sections: [{ key: 'details', title: 'Details', fields: [{ key: 'pet_name', label: 'Pet name', type: 'text', required: true, slug: 'pet.name' }] }],
};

export function InsuranceWorkspace({ vendorId }: { vendorId: string }) {
  const [tab, setTab] = useState<Tab>('Overview');
  const [forms, setForms] = useState<Array<Record<string, unknown>>>([]);
  const [applications, setApplications] = useState<Array<Record<string, unknown>>>([]);
  const [plans, setPlans] = useState<Array<Record<string, unknown>>>([]);
  const [draft, setDraft] = useState<FormSchema>(EMPTY_SCHEMA);
  const [name, setName] = useState('Proposal form');
  const [companyId, setCompanyId] = useState('');
  const [message, setMessage] = useState('');

  async function reload() {
    const [formRes, appRes, workspace] = await Promise.all([
      apiClient.get<{ data?: { forms?: Array<Record<string, unknown>> } }>(`/vendor/${vendorId}/insurance/forms`).catch(() => ({ data: { forms: [] } })),
      apiClient.get<{ data?: { applications?: Array<Record<string, unknown>> } }>(`/vendor/${vendorId}/insurance/applications`).catch(() => ({ data: { applications: [] } })),
      apiClient.get<{ data?: { plans?: Array<Record<string, unknown>>; links?: Array<{ companyId?: string }> } }>(`/vendor/${vendorId}/insurance/workspace`).catch(() => ({ data: { plans: [], links: [] } })),
    ]);
    setForms(formRes.data?.forms || []);
    setApplications(appRes.data?.applications || []);
    setPlans(workspace.data?.plans || []);
    const linkCompany = workspace.data?.links?.[0]?.companyId;
    if (linkCompany) setCompanyId(String(linkCompany));
  }

  useEffect(() => {
    void reload();
  }, [vendorId]);

  async function saveDraft() {
    const saved = await apiClient.post<{ data?: { form?: { id?: string } } }>(`/vendor/${vendorId}/insurance/forms`, {
      companyId,
      name,
      schema: draft,
    });
    setMessage(`Draft saved ${saved.data?.form?.id || ''}`);
    await reload();
  }

  async function publish(id: string) {
    await apiClient.post(`/vendor/${vendorId}/insurance/forms/${id}/publish`, {});
    setMessage('Published');
    await reload();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">Insurance</h1>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-4">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === item ? 'border-[#FF8C42] text-[#FF8C42]' : 'border-transparent text-gray-500'}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {tab === 'Overview' ? <p className="text-sm text-gray-600">{forms.length} forms · {applications.length} applications</p> : null}
        {tab === 'Applications' ? (
          <ApplicationsBoard vendorId={vendorId} applications={applications} onChanged={() => void reload()} />
        ) : null}
        {tab === 'Chat' ? (
          <ChatTab vendorId={vendorId} applications={applications} plans={plans} onSent={() => void reload()} />
        ) : null}
        {tab === 'Form Library' ? (
          <section className="space-y-3 rounded-xl border bg-white p-4">
            <input className="w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
            <FieldEditor schema={draft} onChange={setDraft} />
            <button type="button" className="rounded bg-[#FF8C42] px-3 py-2 text-sm font-semibold text-white" onClick={() => void saveDraft()} disabled={!companyId}>
              Save draft
            </button>
            <ul className="space-y-2 text-sm">
              {forms.map((form) => (
                <li key={String(form.id)} className="flex items-center justify-between">
                  <span>{String(form.name)} · {String(form.status)} · v{String(form.published_version || 'draft')}</span>
                  <button type="button" className="text-[#FF8C42]" onClick={() => void publish(String(form.id))}>Publish</button>
                </li>
              ))}
            </ul>
            <h3 className="font-semibold">Preview</h3>
            <DynamicFormRenderer schema={draft} values={{ pet_name: 'Sample pet' }} prefilled={{ pet_name: true }} readOnly />
          </section>
        ) : null}
        {tab === 'Availability' ? <p className="text-sm text-gray-600">Use your existing tele availability. Insurance bookings use the same tele slots.</p> : null}
        {tab === 'Reports' ? <ReportsTab vendorId={vendorId} /> : null}
        {message ? <p className="text-sm text-gray-700">{message}</p> : null}
      </main>
    </div>
  );
}

function FieldEditor({ schema, onChange }: { schema: FormSchema; onChange: (schema: FormSchema) => void }) {
  const field = schema.sections[0]?.fields[0];
  if (!field) return null;
  return (
    <div className="grid gap-2 text-sm">
      <label>
        Label
        <input className="mt-1 w-full rounded border px-2 py-1" value={field.label} onChange={(e) => {
          const next = structuredClone(schema);
          next.sections[0].fields[0].label = e.target.value;
          onChange(next);
        }} />
      </label>
      <label>
        Type
        <select className="mt-1 w-full rounded border px-2 py-1" value={field.type} onChange={(e) => {
          const next = structuredClone(schema);
          next.sections[0].fields[0].type = e.target.value as FormSchema['sections'][0]['fields'][0]['type'];
          onChange(next);
        }}>
          {FORM_FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      <label>
        Slug
        <select className="mt-1 w-full rounded border px-2 py-1" value={field.slug || ''} onChange={(e) => {
          const next = structuredClone(schema);
          next.sections[0].fields[0].slug = e.target.value || undefined;
          onChange(next);
        }}>
          <option value="">None</option>
          {INSURANCE_SLUGS.map((slug) => <option key={slug.slug} value={slug.slug}>{slug.label}</option>)}
        </select>
      </label>
    </div>
  );
}

function ChatTab({
  vendorId,
  applications,
  plans,
  onSent,
}: {
  vendorId: string;
  applications: Array<Record<string, unknown>>;
  plans: Array<Record<string, unknown>>;
  onSent: () => void;
}) {
  const [applicationId, setApplicationId] = useState(String(applications[0]?.id || ''));
  const [planId, setPlanId] = useState(String(plans[0]?.id || ''));
  const plan = plans.find((row) => String(row.id) === planId);
  const covers = Array.isArray(plan?.coverOptions) ? plan.coverOptions as Array<{ key: string; label: string }> : [];
  const sums = Array.isArray(plan?.sumInsuredOptions) ? plan.sumInsuredOptions as string[] : [];
  const [coverType, setCoverType] = useState('');
  const [sumInsured, setSumInsured] = useState('');

  useEffect(() => {
    if (!applicationId && applications[0]?.id) setApplicationId(String(applications[0].id));
  }, [applications, applicationId]);

  async function sendQuote() {
    const selected = plans.find((row) => String(row.id) === planId);
    await apiClient.post(`/vendor/${vendorId}/insurance/applications/${applicationId}/quote`, {
      card: 'plan_quote',
      applicationId,
      version: 1,
      companyId: String(selected?.companyId || ''),
      planId,
      coverType: coverType || covers[0]?.key || 'standard',
      sumInsured: sumInsured || String(sums[0] || '0'),
      copay: '0',
      optionalCovers: [],
      indicativePremium: Number(selected?.premiumFrom || 0),
      premiumUnit: selected?.premiumUnit === 'year' ? 'year' : 'month',
    });
    onSent();
  }

  return (
    <section className="space-y-3 rounded-xl border bg-white p-4 text-sm">
      <label className="block">
        Conversation
        <select className="mt-1 w-full rounded border px-2 py-1" value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
          {applications.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.plan_name || row.id)}</option>)}
        </select>
      </label>
      <div className="rounded-lg border p-3">
        <p className="font-semibold">Quick plan builder</p>
        <select className="mt-2 w-full rounded border px-2 py-1" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}
        </select>
        <select className="mt-2 w-full rounded border px-2 py-1" value={coverType} onChange={(e) => setCoverType(e.target.value)}>
          <option value="">Cover</option>
          {covers.map((cover) => <option key={cover.key} value={cover.key}>{cover.label}</option>)}
        </select>
        <select className="mt-2 w-full rounded border px-2 py-1" value={sumInsured} onChange={(e) => setSumInsured(e.target.value)}>
          <option value="">Sum insured</option>
          {sums.map((sum) => <option key={String(sum)} value={String(sum)}>{String(sum)}</option>)}
        </select>
        <button type="button" className="mt-3 rounded bg-[#FF8C42] px-3 py-2 font-semibold text-white" onClick={() => void sendQuote()}>
          Send quote
        </button>
      </div>
      <InsuranceChatCard metadata={{ card: 'plan_quote', coverType: coverType || 'Cover', sumInsured: sumInsured || 'Sum insured', indicativePremium: plan?.premiumFrom || 0, premiumUnit: plan?.premiumUnit || 'year' }} />
    </section>
  );
}

const COLUMNS = ['new', 'in_progress', 'awaiting_payment', 'policy_issued', 'closed'] as const;

function ApplicationsBoard({
  vendorId,
  applications,
  onChanged,
}: {
  vendorId: string;
  applications: Array<Record<string, unknown>>;
  onChanged: () => void;
}) {
  const [paymentUrl, setPaymentUrl] = useState('https://');
  const [amount, setAmount] = useState('1000');
  const [policyNumber, setPolicyNumber] = useState('');
  const [notice, setNotice] = useState('');

  async function post(id: string, path: string, body: unknown) {
    await apiClient.post(`/vendor/${vendorId}/insurance/applications/${id}/${path}`, body);
    setNotice('Saved');
    onChanged();
  }

  return (
    <div className="space-y-4">
      {COLUMNS.map((column) => (
        <section key={column}>
          <h3 className="mb-2 text-sm font-semibold capitalize">{column.replaceAll('_', ' ')}</h3>
          <ul className="space-y-2">
            {applications.filter((row) => String(row.column || '') === column).map((row) => {
              const id = String(row.id);
              const status = String(row.status);
              return (
                <li key={id} className="rounded-xl border bg-white p-3 text-sm">
                  <p>{String(row.plan_name || 'Plan')} · {status.replaceAll('_', ' ')}</p>
                  {status === 'consultation_booked' ? (
                    <button type="button" className="mt-2 rounded bg-[#FF8C42] px-3 py-1 font-semibold text-white" onClick={() => void post(id, 'transition', { to: 'consulted' })}>
                      Mark consulted
                    </button>
                  ) : null}
                  {status === 'form_confirmed' || status === 'payment_link_expired' || status === 'payment_link_sent' ? (
                    <div className="mt-2 space-y-2">
                      <input className="w-full rounded border px-2 py-1" value={paymentUrl} onChange={(e) => setPaymentUrl(e.target.value)} placeholder="https://pay.insurer.example/link" />
                      <input className="w-full rounded border px-2 py-1" value={amount} onChange={(e) => setAmount(e.target.value)} />
                      <button type="button" className="rounded bg-[#FF8C42] px-3 py-1 font-semibold text-white" onClick={() => void post(id, 'payment-link', { url: paymentUrl, amount: Number(amount) })}>
                        Send payment link
                      </button>
                    </div>
                  ) : null}
                  {status === 'payment_reported' || status === 'policy_uploaded' ? (
                    <div className="mt-2 space-y-2">
                      <input className="w-full rounded border px-2 py-1" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} placeholder="Policy number" />
                      <button
                        type="button"
                        className="rounded bg-[#FF8C42] px-3 py-1 font-semibold text-white"
                        onClick={() => void post(id, 'policy', {
                          policyNumber,
                          issuedPremium: Number(amount),
                          startDate: new Date().toISOString().slice(0, 10),
                          endDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
                          documents: [{ s3Key: `insurance/${id}.pdf`, name: 'policy.pdf', mime: 'application/pdf', size: 1024 }],
                        })}
                      >
                        Upload policy
                      </button>
                    </div>
                  ) : null}
                  {status === 'policy_confirmed' ? (
                    <button type="button" className="mt-2 text-[#FF8C42]" onClick={() => void post(id, 'free-look', {})}>
                      Cancel in free look
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {notice ? <p className="text-sm">{notice}</p> : null}
    </div>
  );
}

function ReportsTab({ vendorId }: { vendorId: string }) {
  const [vendorCompanyId, setVendorCompanyId] = useState('');
  const [reportedAmount, setReportedAmount] = useState('0');
  const [notice, setNotice] = useState('');
  const start = new Date();
  start.setDate(1);
  const periodStart = start.toISOString().slice(0, 10);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0).toISOString().slice(0, 10);

  return (
    <section className="space-y-2 rounded-xl border bg-white p-4 text-sm">
      <p>Window {periodStart} to {end}</p>
      <input className="w-full rounded border px-2 py-1" value={vendorCompanyId} onChange={(e) => setVendorCompanyId(e.target.value)} placeholder="Vendor company link id" />
      <input className="w-full rounded border px-2 py-1" value={reportedAmount} onChange={(e) => setReportedAmount(e.target.value)} />
      <button
        type="button"
        className="rounded bg-[#FF8C42] px-3 py-2 font-semibold text-white"
        onClick={() => {
          void apiClient.post(`/vendor/${vendorId}/insurance/payout-windows/report`, {
            vendorCompanyId,
            periodStart,
            periodEnd: end,
            lines: [],
            reportedAmount: Number(reportedAmount),
            submit: true,
          }).then(() => setNotice('Report submitted')).catch(() => setNotice('Report could not be submitted'));
        }}
      >
        Submit completion report
      </button>
      {notice ? <p>{notice}</p> : null}
    </section>
  );
}
