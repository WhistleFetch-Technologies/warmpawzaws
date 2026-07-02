'use client';

const TONES = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  warning: 'bg-amber-50 text-amber-800 border border-amber-100',
  danger: 'bg-red-50 text-red-700 border border-red-100',
  muted: 'bg-gray-100 text-gray-600',
};

export function MarketplaceStatus({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONES[tone]}`}
    >
      {label}
    </span>
  );
}
