'use client';

import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@warmpawz/ui';
import {
  errorMessage,
  formatDate,
  formatDateTime,
  formatInr,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import { useApplicationEvents, usePolicyDocuments } from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import type { ReconciliationPolicy } from '@/lib/warmpawz-insurance-admin';
import { speciesLabel, STATUS_STYLES } from './reconciliation-format';

function Item({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function Documents({ applicationId }: { applicationId: string }) {
  const { data, isLoading, error } = usePolicyDocuments(applicationId);
  if (isLoading) return <p className="text-sm text-gray-500">Loading documents…</p>;
  if (error) return <p className="text-sm text-red-600">{errorMessage(error)}</p>;
  return (
    <div className="space-y-2">
      {data?.startDate ? (
        <p className="text-sm text-gray-700">
          Cover {formatDate(data.startDate)} – {formatDate(data.endDate)}
        </p>
      ) : null}
      {data?.documents.length ? (
        <ul className="space-y-1">
          {data.documents.map((doc, i) => (
            <li key={`${doc.name}-${i}`}>
              {doc.url ? (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#FF8C42] hover:underline"
                >
                  {doc.name} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="text-sm text-gray-700">{doc.name} (link unavailable)</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No documents uploaded.</p>
      )}
    </div>
  );
}

function History({ applicationId }: { applicationId: string }) {
  const { data, isLoading, error } = useApplicationEvents(applicationId);
  if (isLoading) return <p className="text-sm text-gray-500">Loading history…</p>;
  if (error) return <p className="text-sm text-red-600">{errorMessage(error)}</p>;
  if (!data?.length) return <p className="text-sm text-gray-500">No status changes recorded.</p>;
  return (
    <ol className="space-y-3 border-l border-gray-200 pl-4">
      {data.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#FF8C42]" />
          <div className="text-sm font-medium text-gray-900">{event.toLabel}</div>
          <div className="text-xs text-gray-500">
            {formatDateTime(event.createdAt)} · {event.actorType}
          </div>
          {event.note ? <div className="mt-0.5 text-xs text-gray-600">{event.note}</div> : null}
        </li>
      ))}
    </ol>
  );
}

export function PolicyDetailDialog({ policy, onClose }: { policy: ReconciliationPolicy | null; onClose: () => void }) {
  return (
    <Dialog open={policy !== null} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {policy ? (
          <>
            <DialogHeader>
              <DialogTitle>Policy {policy.policyNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <dl className="grid gap-3 sm:grid-cols-3">
                <Item label="Customer" value={`${policy.customer.name ?? '-'}${policy.customer.phone ? ` · ${policy.customer.phone}` : ''}`} />
                <Item
                  label="Pet"
                  value={policy.pet ? `${policy.pet.name ?? '-'} ${policy.pet.species ? `(${speciesLabel(policy.pet.species)})` : ''}` : '-'}
                />
                <Item label="Insurance company" value={policy.company.name} />
                <Item label="Vendor" value={policy.vendor.name} />
                <Item label="Policy date" value={formatDate(policy.policyDate)} />
                <Item label="Added on" value={formatDateTime(policy.addedAt)} />
                <Item label="Premium" value={formatInr(policy.premium, 2)} />
                <Item
                  label="Platform commission"
                  value={policy.unpriced ? 'No terms' : `${formatInr(policy.commission, 2)} + ${formatInr(policy.gst, 2)} GST`}
                />
                <Item label="Status" value={STATUS_STYLES[policy.status].label} />
                {policy.period ? (
                  <Item
                    label="Payout period"
                    value={`${formatDate(policy.period.start)} – ${formatDate(policy.period.end)}, due ${formatDate(policy.period.dueDate)}`}
                  />
                ) : null}
              </dl>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Policy documents</h3>
                <Documents applicationId={policy.applicationId} />
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Status history</h3>
                <History applicationId={policy.applicationId} />
              </section>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
