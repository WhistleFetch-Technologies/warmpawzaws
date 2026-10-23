'use client';

export function InsuranceChatCard({
  metadata,
  role = 'vendor',
}: {
  metadata: Record<string, unknown> | null | undefined;
  role?: 'vendor' | 'customer';
}) {
  if (!metadata || typeof metadata.card !== 'string') return null;
  const card = metadata.card;
  if (card === 'form_request' || card === 'change_request') {
    return (
      <div className={`rounded-xl border p-3 text-sm ${card === 'change_request' ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}>
        <p className="font-semibold">{card === 'change_request' ? 'Corrections requested' : 'Information form'}</p>
        <p className="mt-1 text-xs text-gray-600">
          {role === 'vendor' ? 'Sent from the form library. The customer can open it in chat.' : 'Tap Open form to fill this in.'}
        </p>
      </div>
    );
  }
  if (card === 'payment_link') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
        <p className="font-semibold">Make payment · ₹{String(metadata.amount || '')}</p>
        {metadata.url ? (
          <a className="mt-2 inline-block font-semibold text-[#FF8C42]" href={String(metadata.url)} target="_blank" rel="noreferrer">
            Open insurer payment page
          </a>
        ) : null}
      </div>
    );
  }
  if (card === 'plan_quote') {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
        <p className="font-semibold">Plan quote</p>
        <p>{String(metadata.coverType || '')} · {String(metadata.sumInsured || '')}</p>
      </div>
    );
  }
  if (card === 'form_submission') {
    return <div className="rounded-xl border p-3 text-sm">Form submitted · revision {String(metadata.revision || '')}</div>;
  }
  if (card === 'status_update') {
    return <div className="rounded-xl border p-3 text-sm">Status: {String(metadata.toStatus || '').replaceAll('_', ' ')}</div>;
  }
  if (card === 'policy_documents') {
    return <div className="rounded-xl border p-3 text-sm">Policy {String(metadata.policyNumber || '')} uploaded</div>;
  }
  return <div className="rounded-xl border p-3 text-sm">{card}</div>;
}
