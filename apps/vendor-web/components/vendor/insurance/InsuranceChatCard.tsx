'use client';

export function InsuranceChatCard({ metadata }: { metadata: Record<string, unknown> | null | undefined }) {
  if (!metadata || typeof metadata.card !== 'string') return null;
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm" data-card={metadata.card}>
      <p className="font-semibold">{metadata.card}</p>
      {metadata.coverType ? <p>{String(metadata.coverType)} · {String(metadata.sumInsured || '')}</p> : null}
      {metadata.indicativePremium != null && metadata.card === 'plan_quote' ? (
        <p>₹{String(metadata.indicativePremium)} / {String(metadata.premiumUnit || '')}</p>
      ) : null}
    </div>
  );
}
