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
type ChatMessage = { id?: string; message?: string; sender_type?: string; metadata?: Record<string, unknown> | null };

const PAYMENT_STATUSES = new Set(['form_submitted', 'form_confirmed', 'payment_link_sent', 'payment_link_expired']);
const QUOTE_STATUSES = new Set(['consulted', 'quote_shared']);

function lastPaymentUrl(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const meta = messages[i]?.metadata;
    if (meta?.card === 'payment_link' && meta.url) return String(meta.url);
  }
  return '';
}

export function InsuranceChatWorkspace({
  vendorId,
  vendorPhone,
  vendorName,
  applications,
  plans = [],
  forms,
  onSent,
}: {
  vendorId: string;
  vendorPhone?: string;
  vendorName?: string;
  applications: BoardApplication[];
  plans?: PlanRow[];
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState('');
  const [summaryReady, setSummaryReady] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('https://');
  const [amount, setAmount] = useState('999');
  const selected = applications.find((row) => row.id === applicationId) || applications[0];
  const plan = plans.find((row) => String(row.id) === planId) || plans[0];
  const covers = plan?.coverOptions || [];
  const sums = plan?.sumInsuredOptions || [];
  const published = forms.filter((form) => form.status === 'published');
  const canPay = selected ? PAYMENT_STATUSES.has(selected.status) : false;
  const canQuote = selected ? QUOTE_STATUSES.has(selected.status) : false;
  const sentPayUrl = lastPaymentUrl(messages);

  useEffect(() => {
    if (!applicationId && applications[0]) setApplicationId(applications[0].id);
    if (!planId && plans[0]?.id) setPlanId(String(plans[0].id));
    if (!templateId && published[0]?.id) setTemplateId(String(published[0].id));
  }, [applications, plans, published, applicationId, planId, templateId]);

  async function loadMessages(bookingId?: string | null) {
    if (!bookingId) {
      setMessages([]);
      return;
    }
    const res = await apiClient.get<{ messages?: ChatMessage[]; data?: { messages?: ChatMessage[] } }>(`/chat/booking/${bookingId}/conversation`);
    setMessages(res.messages || res.data?.messages || []);
  }

  useEffect(() => {
    void loadMessages(selected?.booking_id).catch(() => setMessages([]));
  }, [selected?.booking_id]);

  useEffect(() => {
    const prior = lastPaymentUrl(messages);
    if (prior) setPaymentUrl(prior);
  }, [messages]);

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
      await loadMessages(selected.booking_id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Quote could not be sent. Mark consulted first.');
    }
  }

  async function sendForm() {
    if (!selected || !templateId) return;
    try {
      await apiClient.post(`/vendor/${vendorId}/insurance/applications/${selected.id}/form-request`, { templateId });
      setNotice('Form sent. The customer can open it from chat.');
      onSent();
      await loadMessages(selected.booking_id);
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
      await loadMessages(selected.booking_id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Message could not be sent');
    }
  }

  async function sendPayment() {
    if (!selected) return;
    try {
      await apiClient.post(`/vendor/${vendorId}/insurance/applications/${selected.id}/payment-link`, {
        url: paymentUrl,
        amount: Number(amount),
      });
      setNotice('Payment button sent to the customer');
      onSent();
      await loadMessages(selected.booking_id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Confirm the form first, and use an insurer https URL');
    }
  }

  return (
    <div className="relative grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
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
            <div key={message.id} className={message.sender_type === 'vendor' ? 'ml-8' : 'mr-8'}>
              {message.metadata?.card ? <InsuranceChatCard metadata={message.metadata} /> : <p className={message.sender_type === 'vendor' ? 'text-right' : ''}>{message.message}</p>}
            </div>
          ))}
          {messages.length === 0 ? <p className="text-gray-500">No messages on this consultation yet.</p> : null}
        </div>

        <div className="rounded-2xl border border-orange-100 p-3">
          <p className="font-semibold">Quick Plan Builder</p>
          <p className="mt-1 text-xs text-gray-500">
            {canQuote
              ? 'Build a quote, then Review & Send. You can send the customer form after that, or skip straight to the form.'
              : 'Mark the tele complete and consulted before sending a quote.'}
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <select className="rounded-lg border px-2 py-2 text-sm" value={planId} onChange={(e) => { setPlanId(e.target.value); setSummaryReady(false); }}>
              {plans.length === 0 ? <option value="">No published plans</option> : null}
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
          <button type="button" className="mt-3 rounded-xl bg-[#FF8C42] px-3 py-2 text-sm font-semibold text-white" disabled={!canQuote || !plan?.id} onClick={() => setSummaryReady(true)}>Generate Plan Summary</button>
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
        <h2 className="pt-2 font-bold">Send a library form</h2>
        <p className="text-xs text-gray-500">Works after consulted. Quote first is optional.</p>
        <label className="block text-xs font-semibold text-gray-500">
          Published form
          <select className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Select a form</option>
            {published.map((form) => <option key={String(form.id)} value={String(form.id)}>{form.name}</option>)}
          </select>
        </label>
        <button type="button" className="w-full rounded-xl bg-[#FF8C42] px-3 py-2 font-semibold text-white" disabled={!templateId} onClick={() => void sendForm()}>Send Customer Form</button>

        {canPay ? (
          <div className="space-y-2 border-t pt-3">
            <h3 className="font-bold">Make payment</h3>
            <p className="text-xs text-gray-500">Paste the insurer payment URL. The customer sees a Make payment button.</p>
            <input className="w-full rounded-lg border px-2 py-2 text-xs" value={paymentUrl} onChange={(e) => setPaymentUrl(e.target.value)} placeholder="https:// insurer payment page" />
            <input className="w-full rounded-lg border px-2 py-2 text-xs" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
            <button type="button" className="w-full rounded-xl bg-[#FF8C42] px-3 py-2 font-semibold text-white" onClick={() => void sendPayment()}>Send payment button</button>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Payment button appears after the customer submits the information form.</p>
        )}
      </aside>

      {sentPayUrl ? (
        <a
          href={sentPayUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-4 right-4 z-10 rounded-full bg-[#FF8C42] px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          Make payment
        </a>
      ) : null}
    </div>
  );
}
