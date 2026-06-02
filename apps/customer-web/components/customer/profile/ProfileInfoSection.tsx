'use client';

import { Edit2, type LucideIcon } from 'lucide-react';

export interface ProfileInfoRow {
  label: string;
  value: string;
  icon: LucideIcon;
}

interface ProfileInfoSectionProps {
  title: string;
  titleIcon: LucideIcon;
  rows: ProfileInfoRow[];
  onEdit: () => void;
}

export function ProfileInfoSection({
  title,
  titleIcon: TitleIcon,
  rows,
  onEdit,
}: ProfileInfoSectionProps) {
  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50">
            <TitleIcon className="h-[18px] w-[18px] text-[#FF8C42]" strokeWidth={2} />
          </span>
          <h3 className="truncate text-[15px] font-bold text-gray-900">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#FF8C42] active:opacity-80"
        >
          <Edit2 className="h-4 w-4" strokeWidth={2} />
          Edit
        </button>
      </div>
      <div className="divide-y divide-stone-100">
        {rows.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-gray-500">{label}</p>
              <p className="mt-0.5 break-words text-sm font-semibold text-gray-900">
                {value || '—'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
