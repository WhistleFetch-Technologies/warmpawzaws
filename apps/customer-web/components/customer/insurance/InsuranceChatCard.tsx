'use client';

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
    return <div className="rounded-xl border p-3 text-sm">Status: {String(metadata.toStatus || '')}</div>;
  }
  return <div className="rounded-xl border p-3 text-sm">{card}</div>;
}
