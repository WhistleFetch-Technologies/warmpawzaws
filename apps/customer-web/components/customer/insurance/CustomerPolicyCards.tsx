'use client';

import { useEffect, useState } from 'react';
import { FileText, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { resolveCustomerId } from '@/lib/insurance-customer';
import { toast } from 'sonner';
import { isActiveIssuedPolicy, policyStatusLabel, type CustomerPolicy } from './policy-list';

function formatInr(amount: string | number) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount || '');
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function CustomerPolicyCards({
  scope,
  focusApplicationId,
}: {
  scope: 'all' | 'active';
  focusApplicationId?: string;
}) {
  const [policies, setPolicies] = useState<CustomerPolicy[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const customerId = await resolveCustomerId();
    if (!customerId) {
      setMessage('Sign in again to see your policies.');
      setPolicies([]);
      return;
    }
    const res = await apiClient.get<{ data?: { policies?: CustomerPolicy[] } }>(
      `/customer/insurance/policies?customerId=${customerId}`,
    );
    setPolicies(res.data?.policies || []);
    setMessage('');
  }

  useEffect(() => {
    setLoading(true);
    void load()
      .catch(() => setMessage('Policies could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  async function confirm(applicationId: string) {
    const customerId = await resolveCustomerId();
    if (!customerId) {
      toast.error('Sign in again to confirm this policy.');
      return;
    }
    await apiClient.post(`/customer/insurance/applications/${applicationId}/confirm-policy`, { customerId });
    toast.success('Policy confirmed');
    await load();
  }

  const scoped = scope === 'active' ? policies.filter((row) => isActiveIssuedPolicy(row.status)) : policies;
  const visible = focusApplicationId
    ? scoped.filter((row) => row.application_id === focusApplicationId)
    : scoped;

  if (loading) return <p className="py-8 text-center text-sm text-gray-500">Loading policies…</p>;
  if (message) return <p className="py-8 text-center text-sm text-gray-600">{message}</p>;
  if (visible.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-600">
        {scope === 'active' ? 'You don’t have an active policy yet.' : 'No issued policies yet.'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((row) => {
        const active = row.status === 'policy_confirmed';
        const logo = String(row.company_logo_url || '');
        const showLogo = logo.startsWith('http');
        return (
          <article key={row.application_id} className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-50 text-[#FF8C42]">
                {showLogo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <Shield className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-gray-500">{row.company_name || 'Insurer'}</p>
                    <h2 className="truncate text-base font-bold text-[#1E2A4A]">{row.plan_name || 'Pet insurance'}</h2>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-[#FF8C42]'}`}>
                    {policyStatusLabel(row.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-800">{row.policy_number}</p>
                {row.pet_name ? <p className="text-xs text-gray-500">Pet · {row.pet_name}</p> : null}
                <p className="mt-2 text-sm text-gray-700">
                  ₹{formatInr(row.issued_premium)}
                  {row.start_date || row.end_date ? ` · ${formatDate(row.start_date)} – ${formatDate(row.end_date)}` : ''}
                </p>
              </div>
            </div>
            {(row.documents || []).length > 0 ? (
              <ul className="mt-3 space-y-1 border-t border-orange-50 pt-3">
                {(row.documents || []).map((doc, index) => (
                  <li key={`${row.application_id}-${index}`} className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-[#FF8C42]" />
                    {doc.url ? (
                      <a className="truncate font-medium text-[#FF8C42]" href={doc.url} target="_blank" rel="noreferrer">{doc.name || 'Policy document'}</a>
                    ) : (
                      <span className="truncate text-gray-700">{doc.name || 'Policy document'}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            {row.status === 'policy_uploaded' ? (
              <button
                type="button"
                className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl bg-[#FF8C42] text-sm font-bold text-white"
                onClick={() => void confirm(row.application_id)}
              >
                Confirm policy
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
