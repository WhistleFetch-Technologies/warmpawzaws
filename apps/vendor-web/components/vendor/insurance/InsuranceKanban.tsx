'use client';

import { useMemo, useState } from 'react';
import { INSURANCE_STATUS_LABELS, type InsuranceApplicationStatus } from '@warmpawz/shared-types';
import { apiClient } from '@/lib/api-client';
import { isPdfPolicy, policyUploadBody } from './policy-upload';
import {
  KANBAN_COLUMNS,
  applicationColumn,
  filterApplications,
  isBookingCompleted,
  kanbanStats,
  resolveDropTransition,
  type BoardApplication,
  type KanbanColumnId,
} from './kanban-view';

function label(status: string) {
  return INSURANCE_STATUS_LABELS[status as InsuranceApplicationStatus] || status.replaceAll('_', ' ');
}

function when(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function InsuranceKanban({
  vendorId,
  applications,
  companies,
  vendorCompanyId,
  onChanged,
}: {
  vendorId: string;
  applications: BoardApplication[];
  companies: string[];
  vendorCompanyId: string;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('https://');
  const [amount, setAmount] = useState('999');
  const [policyNumber, setPolicyNumber] = useState('');
  const [policyFileName, setPolicyFileName] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const visible = useMemo(
    () => filterApplications(applications, query, company, status),
    [applications, query, company, status],
  );
  const stats = kanbanStats(visible);
  const statuses = [...new Set(applications.map((row) => row.status))];

  async function post(id: string, path: string, body: unknown) {
    try {
      await apiClient.post(`/vendor/${vendorId}/insurance/applications/${id}/${path}`, body);
      setNotice('Saved');
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That step could not be saved');
    }
  }

  async function sendPolicy(id: string, file: File | undefined) {
    if (!policyNumber.trim() || !file) {
      setNotice('Add the policy number and a PDF.');
      return;
    }
    if (!isPdfPolicy(file)) {
      setNotice('Upload the policy as a PDF.');
      return;
    }
    try {
      const presigned = await apiClient.post<{ presignedUrl?: string; fileKey?: string; error?: string }>('/upload/presigned-url', {
        fileName: file.name,
        fileType: 'application/pdf',
        folder: `insurance-policies/${id}`,
      });
      if (!presigned.presignedUrl || !presigned.fileKey) throw new Error(presigned.error || 'Upload could not start');
      const uploaded = await fetch(presigned.presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });
      if (!uploaded.ok) throw new Error('The PDF could not be uploaded');
      await post(id, 'policy', policyUploadBody({
        policyNumber,
        amount,
        fileName: file.name,
        fileType: 'application/pdf',
        fileSize: file.size,
        s3Key: presigned.fileKey,
      }));
      setPolicyFileName(file.name);
      setNotice('Policy sent in chat');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Policy could not be sent');
    }
  }

  async function transitionTo(id: string, to: string) {
    await post(id, 'transition', { to });
  }

  function exportCsv() {
    const header = ['Customer', 'Pet', 'Company', 'Plan', 'Status', 'Updated'];
    const lines = visible.map((row) => [row.customer_name, row.pet_name, row.company_name, row.plan_name, label(row.status), row.updated_at]);
    const csv = [header, ...lines].map((cells) => cells.map((cell) => `"${String(cell || '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'insurance-kanban.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function submitReport() {
    const start = new Date();
    start.setDate(1);
    const periodStart = start.toISOString().slice(0, 10);
    const periodEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0).toISOString().slice(0, 10);
    try {
      await apiClient.post(`/vendor/${vendorId}/insurance/payout-windows/report`, {
        vendorCompanyId,
        periodStart,
        periodEnd,
        lines: [],
        reportedAmount: 0,
        submit: true,
      });
      setNotice('Completion report submitted');
    } catch {
      setNotice('Report could not be submitted. Check the company link.');
    }
  }

  async function onDropColumn(columnId: KanbanColumnId) {
    if (!dragId) return;
    const row = applications.find((item) => item.id === dragId);
    setDragId(null);
    if (!row) return;
    const to = resolveDropTransition(row.status, columnId);
    if (!to) {
      setNotice(
        'That lane needs a status-only move (consulted / archive / confirm). Use chat or the card actions for quote, form, payment, or policy.',
      );
      return;
    }
    if (to === 'consulted' && !isBookingCompleted(row.booking_status)) {
      setNotice('Mark the tele consultation complete in Bookings before marking consulted.');
      return;
    }
    await transitionTo(row.id, to);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Kanban</h1>
          <p className="text-sm text-gray-500">Track applications from consultation to policy issuance. Drag cards between lanes for status-only moves.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" onClick={exportCsv}>Export</button>
          <button type="button" className="rounded-xl bg-[#FF8C42] px-3 py-2 text-sm font-semibold text-white" onClick={() => void submitReport()} disabled={!vendorCompanyId}>
            Generate Completion Report
          </button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <input className="rounded-xl border bg-white px-3 py-2 text-sm" placeholder="Search customer, pet or policy..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="rounded-xl border bg-white px-3 py-2 text-sm" value={company} onChange={(e) => setCompany(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="rounded-xl border bg-white px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}
        </select>
        <p className="rounded-xl border bg-orange-50 px-3 py-2 text-xs text-orange-800">Status updates sync to the customer timeline and the admin dashboard.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Active Applications', stats.active],
          ['Awaiting Customer', stats.awaitingCustomer],
          ['Payment Pending', stats.paymentPending],
          ['Completed This Period', stats.completedThisPeriod],
        ].map(([title, count]) => (
          <div key={String(title)} className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{count}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-5">
        {KANBAN_COLUMNS.map((column) => {
          const cards = visible.filter((row) => applicationColumn(row) === column.id);
          return (
            <section
              key={column.id}
              className="rounded-2xl bg-gray-50 p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void onDropColumn(column.id);
              }}
            >
              <h2 className={`mb-3 text-sm font-bold ${column.tone}`}>{column.title} <span className="text-gray-400">{cards.length}</span></h2>
              <div className="min-h-[4rem] space-y-2">
                {cards.map((row) => (
                  <article
                    key={row.id}
                    draggable
                    onDragStart={() => setDragId(row.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`cursor-grab rounded-xl border bg-white p-3 text-sm shadow-sm active:cursor-grabbing ${dragId === row.id ? 'opacity-60' : ''}`}
                  >
                    <p className="font-semibold text-gray-900">{row.customer_name || 'Customer'}</p>
                    <p className="text-xs text-gray-500">{[row.pet_name, row.pet_breed || row.pet_species].filter(Boolean).join(' · ') || 'Pet'}</p>
                    <p className="mt-2 text-xs font-semibold text-[#FF8C42]">{row.company_name || 'Insurer'}</p>
                    <p className="text-xs text-gray-600">{row.plan_name || 'Plan'}</p>
                    <span className="mt-2 inline-block rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700">{label(row.status)}</span>
                    {row.policy_number ? <p className="mt-2 text-xs font-semibold text-gray-800">Policy {row.policy_number}</p> : null}
                    {(row.documents || []).map((doc) => (
                      doc.url ? (
                        <a key={doc.url} className="mt-1 block truncate text-xs font-semibold text-[#FF8C42]" href={doc.url} target="_blank" rel="noreferrer">{doc.name || 'Policy file'}</a>
                      ) : null
                    ))}
                    <p className="mt-2 text-[11px] text-gray-400">Updated {when(row.updated_at)}</p>
                    {row.status === 'consultation_booked' && isBookingCompleted(row.booking_status) ? (
                      <button type="button" className="mt-2 rounded-lg bg-[#FF8C42] px-2 py-1 text-xs font-semibold text-white" onClick={() => void transitionTo(row.id, 'consulted')}>Mark consulted</button>
                    ) : null}
                    {row.status === 'consultation_booked' && !isBookingCompleted(row.booking_status) ? (
                      <p className="mt-2 text-[11px] text-amber-700">Complete the tele booking first, then mark consulted.</p>
                    ) : null}
                    {row.status === 'consulted' || row.status === 'quote_shared' || row.status === 'form_sent' || row.status === 'changes_requested' || row.status === 'payment_link_expired' ? (
                      <button type="button" className="mt-2 block text-xs font-semibold text-gray-600 underline" onClick={() => void transitionTo(row.id, 'dropped')}>Move to archive</button>
                    ) : null}
                    {row.status === 'consultation_booked' ? (
                      <button type="button" className="mt-1 block text-xs font-semibold text-gray-600 underline" onClick={() => void transitionTo(row.id, 'cancelled')}>Cancel application</button>
                    ) : null}
                    {row.status === 'form_submitted' || row.status === 'form_confirmed' || row.status === 'payment_link_sent' || row.status === 'payment_link_expired' ? (
                      <div className="mt-2 space-y-1">
                        <input className="w-full rounded border px-2 py-1 text-xs" value={paymentUrl} onChange={(e) => setPaymentUrl(e.target.value)} placeholder="https:// payment link" />
                        <button type="button" className="rounded-lg bg-[#FF8C42] px-2 py-1 text-xs font-semibold text-white" onClick={() => void post(row.id, 'payment-link', { url: paymentUrl, amount: Number(amount) })}>Send payment link</button>
                      </div>
                    ) : null}
                    {row.status === 'payment_link_sent' || row.status === 'payment_link_expired' || row.status === 'payment_reported' || row.status === 'policy_uploaded' ? (
                      <div className="mt-2 space-y-1">
                        <input className="w-full rounded border px-2 py-1 text-xs" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} placeholder="Policy number" />
                        <label className="block text-[11px] text-gray-500">
                          Policy PDF
                          <input
                            className="mt-1 block w-full text-xs"
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={(e) => setPolicyFileName(e.target.files?.[0]?.name || '')}
                          />
                        </label>
                        <button
                          type="button"
                          className="rounded-lg bg-[#FF8C42] px-2 py-1 text-xs font-semibold text-white"
                          onClick={(event) => {
                            const input = event.currentTarget.parentElement?.querySelector('input[type="file"]') as HTMLInputElement | null;
                            void sendPolicy(row.id, input?.files?.[0]);
                          }}
                        >
                          Send policy
                        </button>
                        {policyFileName ? <p className="text-[11px] text-gray-500">{policyFileName}</p> : null}
                      </div>
                    ) : null}
                    {row.status === 'policy_confirmed' ? (
                      <button type="button" className="mt-2 text-xs font-semibold text-[#FF8C42]" onClick={() => void post(row.id, 'free-look', {})}>Cancel in free look</button>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {notice ? <p className="text-sm text-gray-700">{notice}</p> : null}
      <p className="text-xs text-gray-500">Tele availability stays on your existing schedule. Insurance consultations use those slots.</p>
    </div>
  );
}
