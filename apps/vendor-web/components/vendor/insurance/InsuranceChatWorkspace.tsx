'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { InsuranceChatCard } from './InsuranceChatCard';
import type { BoardApplication } from './kanban-view';

type PlanRow = {
  id?: string;
  name?: string;
  companyId?: string;
  companyName?: string;
  premiumFrom?: number;
  premiumUnit?: string;
  coverOptions?: Array<{ key: string; label: string }>;
  sumInsuredOptions?: string[];
};

type FormRow = { id?: string; name?: string; status?: string };

export function InsuranceChatWorkspace({
  vendorId,
  vendorPhone,
  vendorName,
  applications,
  plans,
  forms,
  onSent,
}: {
  vendorId: string;
  vendorPhone?: string;
  vendorName?: string;
  applications: BoardApplication[];
  plans: PlanRow[];
  forms: FormRow[];
  onSent: () => void;
}) {
  const [applicationId, setApplicationId] = useState('');
  const [planId, setPlanId] = useState('');
  const [coverType, setCoverType] = useState('');
  const [sumInsured, setSumInsured] = useState('');
  const [copay, setCopay] = useState('0');
  const [optional, setOptional] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [draftText, setDraftText] = useState('');
  const [messages, setMessages] = useState<Array<{ id?: string; message?: string; sender_type?: string }>>([]);
  const [notice, setNotice] = useState('');
  const [summaryReady, setSummaryReady] = useState(false);
  const selected = applications.find((row) => row.id === applicationId) || applications[0];
  const plan = plans.find((row) => String(row.id) === planId) || plans[0];
  const covers = plan?.coverOptions || [];
  const sums = plan?.sumInsuredOptions || [];
  const published = forms.filter((form) => form.status === 'published');

  useEffect(() => {
    if (!applicationId && applications[0]) setApplicationId(applications[0].id);
    if (!planId && plans[0]?.id) setPlanId(String(plans[0].id));
  }, [applications, plans, applicationId, planId]);

  useEffect(() => {
    const bookingId = selected?.booking_id;
    if (!bookingId) {
      setMessages([]);
      return;
    }
    apiClient.get<{ messages?: Array<{ id?: string; message?: string; sender_type?: string }> }>(`/chat/booking/${bookingId}/conversation`)
      .then((res) => setMessages(res.messages || []))
      .catch(() => setMessages([]));
  }, [selected?.booking_id]);

  const quote = useMemo(() => ({
    card: 'plan_quote' as const,
    applicationId: selected?.id || '',
    version: 1,
    companyId: String(plan?.companyId || ''),
    planId: String(plan?.id || ''),
    coverType: coverType || covers[0]?.key || 'standard',
    sumInsured: sumInsured || String(sums[0] || '0'),
    copay: copay || '0',
    optionalCovers: optional,
    indicativePremium: Number(plan?.premiumFrom || 0),
    premiumUnit: plan?.premiumUnit === 'month' ? 'month' as const : 'year' as const,
  }), [selected?.id, plan, coverType, covers, sumInsured, sums, copay, optional]);

  async function sendQuote() {
    if (!selected) return;
    try {
      await apiClient.post(`/vendor/${vendorId}/insurance/applications/${selected.id}/quote`, quote);
      setNotice('Plan sent to the customer');
      setSummaryReady(false);
      onSent();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Quote could not be sent. Mark the consultation complete first.');
    }
  }

  async function sendForm() {
    if (!selected || !templateId) return;
    try {
      await apiClient.post(`/vendor/${vendorId}/insurance/applications/${selected.id}/form-request`, { templateId });
      setNotice('Form sent');
      onSent();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Publish the form before sending it');
    }
  }

  async function sendText() {
    if (!selected?.booking_id || !draftText.trim()) return;
    try {
      await apiClient.post(`/chat/booking/${selected.booking_id}/message`, {
        senderPhone: vendorPhone || vendorId,
        senderName: vendorName || 'Vendor',
        senderType: 'vendor',
        message: draftText.trim(),
        messageType: 'text',
      });
      setDraftText('');
      const res = await apiClient.get<{ messages?: Array<{ id?: string; message?: string; sender_type?: string }> }>(`/chat/booking/${selected.booking_id}/conversation`);
      setMessages(res.messages || []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Message could not be sent');
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
      <aside className="rounded-2xl border bg-white p-3">
        <h2 className="font-bold text-gray-900">Conversations</h2>
        <div className="mt-3 space-y-2">
          {applications.map((row) => (
            <button key={row.id} type="button" onClick={() => setApplicationId(row.id)} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${row.id === selected?.id ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-100'}`}>
              <span className="block font-semibold">{row.customer_name || 'Customer'}</span>
              <span className="text-xs text-gray-500">{[row.pet_name, row.pet_breed].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
          {applications.length === 0 ? <p className="text-sm text-gray-500">No consultations yet.</p> : null}
        </div>
      </aside>

      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <h2 className="font-bold text-gray-900">{selected?.customer_name || 'Select a conversation'}</h2>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-gray-50 p-3 text-sm">
          {messages.map((message) => (
            <p key={message.id} className={message.sender_type === 'vendor' ? 'text-right' : ''}>{message.message}</p>
          ))}
          {messages.length === 0 ? <p className="text-gray-500">No messages on this consultation yet.</p> : null}
        </div>
        <div className="rounded-2xl border border-orange-100 p-3">
          <p className="font-semibold">Quick Plan Builder</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <select className="rounded-lg border px-2 py-2 text-sm" value={planId} onChange={(e) => { setPlanId(e.target.value); setSummaryReady(false); }}>
              {plans.map((row) => <option key={String(row.id)} value={String(row.id)}>{row.companyName ? `${row.companyName} · ` : ''}{row.name}</option>)}
            </select>
            <select className="rounded-lg border px-2 py-2 text-sm" value={coverType} onChange={(e) => setCoverType(e.target.value)}>
              <option value="">Cover type</option>
              {covers.map((cover) => <option key={cover.key} value={cover.key}>{cover.label}</option>)}
            </select>
            <select className="rounded-lg border px-2 py-2 text-sm" value={sumInsured} onChange={(e) => setSumInsured(e.target.value)}>
              <option value="">Sum insured</option>
              {sums.map((sum) => <option key={sum} value={sum}>{sum}</option>)}
            </select>
            <input className="rounded-lg border px-2 py-2 text-sm" value={copay} onChange={(e) => setCopay(e.target.value)} placeholder="Co-pay %" />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {covers.map((cover) => (
              <label key={cover.key} className="flex items-center gap-1">
                <input type="checkbox" checked={optional.includes(cover.key)} onChange={() => setOptional((current) => current.includes(cover.key) ? current.filter((item) => item !== cover.key) : [...current, cover.key])} />
                {cover.label}
              </label>
            ))}
          </div>
          <button type="button" className="mt-3 rounded-xl bg-[#FF8C42] px-3 py-2 text-sm font-semibold text-white" onClick={() => setSummaryReady(true)}>Generate Plan Summary</button>
        </div>
        {summaryReady ? (
          <div className="space-y-2">
            <InsuranceChatCard metadata={quote as unknown as Record<string, unknown>} />
            <button type="button" className="rounded-xl bg-[#FF8C42] px-3 py-2 text-sm font-semibold text-white" onClick={() => void sendQuote()}>Review & Send</button>
          </div>
        ) : null}
        <div className="flex gap-2">
          <input className="flex-1 rounded-xl border px-3 py-2 text-sm" value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="Type a message..." />
          <button type="button" className="rounded-xl bg-[#FF8C42] px-3 py-2 text-sm font-semibold text-white" onClick={() => void sendText()}>Send</button>
        </div>
        {notice ? <p className="text-sm text-gray-600">{notice}</p> : null}
      </section>

      <aside className="space-y-3 rounded-2xl border bg-white p-4 text-sm">
        <h2 className="font-bold">Plan Summary</h2>
        <p className="font-semibold text-gray-900">{plan?.companyName || 'Insurer'}</p>
        <p className="text-gray-600">{plan?.name || 'Choose a plan'}</p>
        <p className="text-lg font-bold text-[#FF8C42]">₹{Number(plan?.premiumFrom || 0).toLocaleString('en-IN')} / {plan?.premiumUnit || 'year'}</p>
        <label className="block text-xs font-semibold text-gray-500">
          Select Form
          <select className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Published forms</option>
            {published.map((form) => <option key={String(form.id)} value={String(form.id)}>{form.name}</option>)}
          </select>
        </label>
        <button type="button" className="w-full rounded-xl bg-[#FF8C42] px-3 py-2 font-semibold text-white" disabled={!templateId} onClick={() => void sendForm()}>Send Customer Form</button>
      </aside>
    </div>
  );
}
