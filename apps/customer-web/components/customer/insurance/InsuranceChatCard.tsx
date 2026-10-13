'use client';

import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export function InsuranceChatCard({ metadata }: { metadata: Record<string, unknown> | null | undefined }) {
  if (!metadata || typeof metadata.card !== 'string') return null;
  const card = metadata.card;
  if (card === 'plan_quote') {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
        <p className="font-semibold">Plan quote</p>
        <p>{String(metadata.coverType || '')} · {String(metadata.sumInsured || '')}</p>
        <p>₹{String(metadata.indicativePremium || '')} / {String(metadata.premiumUnit || '')}</p>
      </div>
    );
  }
  if (card === 'form_request') {
    return <div className="rounded-xl border p-3 text-sm">Please complete the information form.</div>;
  }
  if (card === 'form_submission') {
    return <div className="rounded-xl border p-3 text-sm">Form submitted · revision {String(metadata.revision || '')}</div>;
  }
  if (card === 'change_request') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Corrections requested</div>;
  }
  if (card === 'status_update') {
    return <div className="rounded-xl border p-3 text-sm">Status: {String(metadata.toStatus || '').replaceAll('_', ' ')}</div>;
  }
  if (card === 'payment_link') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
        <p className="font-semibold">Pay ₹{String(metadata.amount || '')}</p>
        <a className="mt-2 inline-block font-semibold text-[#FF8C42]" href={String(metadata.url || '')} target="_blank" rel="noreferrer">Open payment link</a>
        <button
          type="button"
          className="mt-2 block text-left font-semibold"
          onClick={() => {
            const customerId = window.localStorage.getItem('customerId') || '';
            void apiClient.post(`/customer/insurance/applications/${String(metadata.applicationId)}/payment-reported`, { customerId })
              .then(() => toast.success('Payment reported'))
              .catch(() => toast.error('Payment could not be reported'));
          }}
        >
          I&apos;ve paid
        </button>
      </div>
    );
  }
  if (card === 'policy_documents') {
    return <div className="rounded-xl border p-3 text-sm">Policy {String(metadata.policyNumber || '')} is ready to review in My Insurance.</div>;
  }
  return <div className="rounded-xl border p-3 text-sm">{card}</div>;
}
