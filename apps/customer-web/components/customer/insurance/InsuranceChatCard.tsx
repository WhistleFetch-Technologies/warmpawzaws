'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { parseInsuranceChatMetadata } from './insurance-chat-metadata';

function PolicyDocumentsCard({ metadata }: { metadata: Record<string, unknown> }) {
  const [files, setFiles] = useState<Array<{ name?: string; url?: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    void import('@/lib/insurance-customer')
      .then(({ resolveCustomerId }) => resolveCustomerId())
      .then(async (customerId) => {
        if (!customerId) return [];
        const res = await apiClient.get<{ data?: { policies?: Array<{ application_id?: string; documents?: Array<{ name?: string; url?: string }> }> } }>(
          `/customer/insurance/policies?customerId=${encodeURIComponent(customerId)}`,
        );
        const match = (res.data?.policies || []).find((row) => row.application_id === String(metadata.applicationId));
        return match?.documents || [];
      })
      .then((docs) => {
        if (!cancelled) setFiles(docs);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [metadata.applicationId]);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
      <p className="font-semibold">Policy {String(metadata.policyNumber || '')}</p>
      <p className="mt-1 text-xs text-gray-600">The number and file are also in My Insurance and Your active policy.</p>
      {files.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {files.map((file, index) => (
            <li key={`${file.name || 'policy'}-${index}`}>
              {file.url ? (
                <a className="font-semibold text-[#FF8C42]" href={file.url} target="_blank" rel="noreferrer">{file.name || 'Open policy file'}</a>
              ) : (
                <span>{file.name || 'Policy file'}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function InsuranceChatCard({
  metadata: rawMetadata,
  onOpenForm,
}: {
  metadata: unknown;
  onOpenForm?: (applicationId: string) => void;
}) {
  const metadata = parseInsuranceChatMetadata(rawMetadata);
  if (!metadata) return null;
  const card = String(metadata.card);
  if (card === 'plan_quote') {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
        <p className="font-semibold">Plan quote</p>
        <p>{String(metadata.coverType || '')} · {String(metadata.sumInsured || '')}</p>
        <p>₹{String(metadata.indicativePremium || '')} / {String(metadata.premiumUnit || '')}</p>
      </div>
    );
  }
  if (card === 'form_request' || card === 'change_request') {
    const applicationId = String(metadata.applicationId || metadata.application_id || '');
    return (
      <div className={`rounded-xl border p-3 text-sm ${card === 'change_request' ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}>
        <p>{card === 'change_request' ? 'Corrections requested' : 'Please complete the information form.'}</p>
        {applicationId ? (
          <button
            type="button"
            className="mt-2 font-semibold text-[#FF8C42]"
            onClick={(event) => {
              event.stopPropagation();
              onOpenForm?.(applicationId);
              window.dispatchEvent(new CustomEvent('warmpawz-insurance-form', { detail: { applicationId } }));
            }}
          >
            Open form
          </button>
        ) : null}
      </div>
    );
  }
  if (card === 'form_submission') {
    return <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">Information form submitted · revision {String(metadata.revision || '')}</div>;
  }
  if (card === 'status_update') {
    return <div className="rounded-xl border p-3 text-sm">Status: {String(metadata.toStatus || '').replaceAll('_', ' ')}</div>;
  }
  if (card === 'payment_link') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
        <p className="font-semibold">Make payment · ₹{String(metadata.amount || '')}</p>
        <a className="mt-2 inline-block font-semibold text-[#FF8C42]" href={String(metadata.url || '')} target="_blank" rel="noreferrer">Make payment</a>
        <button
          type="button"
          className="mt-2 block text-left font-semibold"
          onClick={() => {
            void import('@/lib/insurance-customer')
              .then(({ resolveCustomerId }) => resolveCustomerId())
              .then((customerId) => {
                if (!customerId) throw new Error('customer');
                return apiClient.post(`/customer/insurance/applications/${String(metadata.applicationId)}/payment-reported`, { customerId });
              })
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
    return <PolicyDocumentsCard metadata={metadata} />;
  }
  return <div className="rounded-xl border p-3 text-sm">{card}</div>;
}
