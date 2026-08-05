'use client';

import { useMemo } from 'react';
import { Award, Loader2 } from 'lucide-react';

export type VendorSpecializationChipsProps = {
  /** Dynamic labels from backend (any service). */
  specializations: string[];
  loading?: boolean;
  title?: string;
};

/** Generic wrapping specialization chips for any vendor profile Overview. */
export function VendorSpecializationChips({
  specializations,
  loading = false,
  title = 'Specializations',
}: VendorSpecializationChipsProps) {
  const labels = useMemo(
    () =>
      specializations
        .map((s) => String(s ?? '').trim())
        .filter(Boolean)
        .filter((label, idx, arr) => arr.findIndex((x) => x.toLowerCase() === label.toLowerCase()) === idx),
    [specializations],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin text-[#FF8C42]" />
        Loading specializations…
      </div>
    );
  }

  if (labels.length === 0) return null;

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900">
        <Award className="h-5 w-5 text-[#FF8C42]" aria-hidden />
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {labels.map((label) => (
          <span
            key={label}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 shadow-sm"
          >
            <Award className="h-3.5 w-3.5 flex-shrink-0 text-[#FF8C42]" aria-hidden />
            <span className="truncate">{label}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
