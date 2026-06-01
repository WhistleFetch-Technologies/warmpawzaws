'use client';

import { Edit2, type LucideIcon } from 'lucide-react';

interface ProfileSectionCardProps {
  title: string;
  titleIcon: LucideIcon;
  titleIconBg?: string;
  titleIconColor?: string;
  onEdit?: () => void;
  headerLink?: { label: string; onClick: () => void };
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ProfileSectionCard({
  title,
  titleIcon: TitleIcon,
  titleIconBg = 'bg-orange-50',
  titleIconColor = 'text-[#FF8C42]',
  onEdit,
  headerLink,
  headerExtra,
  children,
  className = '',
}: ProfileSectionCardProps) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/90 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:p-5 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${titleIconBg}`}>
            <TitleIcon className={`h-[18px] w-[18px] ${titleIconColor}`} strokeWidth={2} />
          </span>
          <h3 className="truncate text-[15px] font-bold text-gray-900">{title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerExtra}
          {headerLink && (
            <button
              type="button"
              onClick={headerLink.onClick}
              className="text-xs font-semibold text-[#FF8C42] active:opacity-80"
            >
              {headerLink.label}
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#FF8C42] active:opacity-80"
            >
              <Edit2 className="h-4 w-4" strokeWidth={2} />
              Edit
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
