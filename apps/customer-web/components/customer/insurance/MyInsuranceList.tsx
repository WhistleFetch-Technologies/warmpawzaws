'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { resolveCustomerId } from '@/lib/insurance-customer';
import { toast } from 'sonner';

type PolicyRow = {
  application_id: string;
  status: string;
  policy_number: string;
  issued_premium: string | number;
  start_date: string;
  end_date: string;
  documents?: Array<{ name?: string; url?: string }>;
};

export function MyInsuranceList({
  onBack,
  focusApplicationId,
}: {
  onBack: () => void;
  focusApplicationId?: string;
}) {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    const customerId = await resolveCustomerId();
    if (!customerId) {
      setMessage('Sign in again to see your policies.');
      return;
    }
    const res = await apiClient.get<{ data?: { policies?: PolicyRow[] } }>(
      `/customer/insurance/policies?customerId=${customerId}`,
    );
    setPolicies(res.data?.policies || []);
  }

  useEffect(() => {
    void load().catch(() => setMessage('Policies could not be loaded'));
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

  const visible = focusApplicationId
    ? policies.filter((row) => row.application_id === focusApplicationId)
    : policies;

  return (
    <div className="mx-auto max-w-lg space-y-3 p-4">
      <button type="button" className="text-sm text-[#FF8C42]" onClick={onBack}>Back</button>
      <h1 className="text-xl font-semibold">My Insurance</h1>
      {message ? <p className="text-sm text-gray-600">{message}</p> : null}
      {visible.length === 0 ? <p className="text-sm text-gray-600">No policies yet.</p> : null}
      {visible.map((row) => (
        <article key={row.application_id} className="rounded-xl border bg-white p-4 text-sm">
          <p className="font-semibold">{row.policy_number}</p>
          <p>₹{row.issued_premium} · {row.start_date} to {row.end_date}</p>
          <p className="capitalize">{String(row.status).replaceAll('_', ' ')}</p>
          <ul className="mt-2 space-y-1">
            {(row.documents || []).map((doc, index) => (
              <li key={`${row.application_id}-${index}`}>
                {doc.url ? <a className="text-[#FF8C42]" href={doc.url} target="_blank" rel="noreferrer">{doc.name || 'Document'}</a> : doc.name}
              </li>
            ))}
          </ul>
          {row.status === 'policy_uploaded' ? (
            <button type="button" className="mt-3 rounded bg-[#FF8C42] px-3 py-2 font-semibold text-white" onClick={() => void confirm(row.application_id)}>
              Confirm policy
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
